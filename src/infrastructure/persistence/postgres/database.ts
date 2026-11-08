import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";

export class PersistenceFailure extends Error {
  constructor(public readonly status = 503, message = "PostgreSQL storage is unavailable; no fallback was attempted.") { super(message); }
}
type Context = { client: PoolClient; safe: PoolClient; mutation: boolean; open: boolean };
const active = new AsyncLocalStorage<Context>();
let pool: Pool | undefined;
export function storageMode(): "google-sheets" | "supabase" {
  const mode = process.env.STOCK_STORAGE || "google-sheets";
  if (mode !== "google-sheets" && mode !== "supabase") throw new PersistenceFailure(503, "Invalid STOCK_STORAGE.");
  return mode;
}
export function stagingSettings() {
  if (process.env.STOCK_STAGING_ENABLED !== "true" || process.env.VERCEL_ENV === "production") throw new PersistenceFailure();
  const url = process.env.STOCK_DATABASE_URL, token = process.env.STOCK_STAGING_AUTH_TOKEN, targetId = process.env.STOCK_TARGET_ISOLATION_ID;
  if (!url || !token || token.length < 32 || !targetId || !/^[a-f0-9-]{36}$/i.test(targetId)) throw new PersistenceFailure();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new PersistenceFailure(); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new PersistenceFailure();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (local && process.env.STOCK_ALLOW_LOCAL_TEST_DATABASE !== "true") throw new PersistenceFailure();
  if (parsed.search) throw new PersistenceFailure(503, "Configure TLS through server configuration, not URL query overrides.");
  return { url, token, local, targetId };
}
export function connectionPool(): Pool {
  if (!pool) {
    const config = stagingSettings();
    pool = new Pool({ connectionString: config.url, max: 2, min: 0, idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000, allowExitOnIdle: true,
      ssl: config.local ? false : { rejectUnauthorized: true, ca: process.env.STOCK_DATABASE_CA || undefined },
      application_name: "stock-isolated-staging" });
    // Never propagate driver errors, SQL text, bind values or connection URLs to HTTP/logs.
    pool.on("error", () => {});
  }
  return pool;
}
export function currentTransaction(): PoolClient {
  const context = active.getStore();
  if (!context?.open) throw new PersistenceFailure(503, "PostgreSQL persistence requires an explicit unit of work.");
  return context.safe;
}
export function requireMutation(): PoolClient {
  const context = active.getStore();
  if (!context?.open || !context.mutation) throw new PersistenceFailure(503, "A read-only request cannot mutate persistence.");
  return context.safe;
}
export async function transaction<T>(mutation: boolean, operation: () => Promise<T>): Promise<T> {
  const previous=active.getStore();
  if (previous) {
    if (!previous.open || (mutation && !previous.mutation)) throw new PersistenceFailure(503, "A read-only unit of work cannot be upgraded to a mutation.");
    return operation();
  }
  if (storageMode() !== "supabase") throw new PersistenceFailure();
  stagingSettings();
  let client: PoolClient;
  try { client = await connectionPool().connect(); } catch { throw new PersistenceFailure(); }
  let destroy = false;
  let scope: Context | undefined;
  const onError = () => { destroy = true; };
  client.on("error",onError);
  try {
    await client.query(mutation ? "BEGIN" : "BEGIN READ ONLY");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    const role = await client.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user");
    if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) throw new PersistenceFailure(503, "Use a nonprivileged runtime login.");
    await client.query("SET LOCAL ROLE stock_runtime");
    const guard=await client.query("SELECT isolation_id::text,purpose FROM stock_operational.environment WHERE singleton");
    if(guard.rowCount !== 1 || guard.rows[0].isolation_id !== stagingSettings().targetId || guard.rows[0].purpose !== "isolated-staging") throw new PersistenceFailure(503,"The database does not match the approved isolated staging target.");
    await client.query(mutation ? "SELECT pg_advisory_xact_lock(835107242)" : "SELECT pg_advisory_xact_lock_shared(835107242)");
    const context: Context={client,safe:client,mutation,open:true};
    scope=context;
    const safe = new Proxy(client,{ get(target,key) {
      if (key === "query") return async (text: string, values?: unknown[]) => {
        if (!context.open) throw new PersistenceFailure(503,"The PostgreSQL unit of work is closed.");
        try { return await target.query(text,values); } catch { throw new PersistenceFailure(); }
      };
      const value=Reflect.get(target,key);
      return typeof value === "function" ? value.bind(target) : value;
    }});
    context.safe=safe;
    const result = await active.run(context, operation);
    context.open=false;
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (scope) scope.open=false;
    try { await client.query("ROLLBACK"); } catch { destroy = true; }
    // A failed/ambiguous COMMIT must never trigger a blind transaction retry.
    destroy = true;
    if (error instanceof PersistenceFailure) throw error;
    throw new PersistenceFailure();
  } finally { client.removeListener("error",onError); client.release(destroy); }
}
export async function closePool() { const previous = pool; pool = undefined; await previous?.end(); }
