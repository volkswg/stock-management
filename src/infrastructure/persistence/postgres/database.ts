import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";

export class PersistenceFailure extends Error {
  constructor(public readonly status = 503, message = "PostgreSQL storage is unavailable; no fallback was attempted.") { super(message); }
}
type Context = { client: PoolClient; safe: PoolClient; mutation: boolean; open: boolean };
const active = new AsyncLocalStorage<Context>();
let pool: Pool | undefined;
let poolIdentity: string | undefined;
export function storageMode(): "google-sheets" | "supabase" {
  const mode = process.env.STOCK_STORAGE || "google-sheets";
  if (mode !== "google-sheets" && mode !== "supabase") throw new PersistenceFailure(503, "Invalid STOCK_STORAGE.");
  return mode;
}
export function stagingSettings() {
  if (process.env.STOCK_PRODUCTION_ENABLED === "true" || process.env.STOCK_PRODUCTION_RELEASE_JSON) throw new PersistenceFailure();
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
// Explicit server-only release binding. No production target is checked in or enabled.
export function productionSettings() {
  const fail = () => { throw new PersistenceFailure(); };
  if (process.env.VERCEL_ENV !== "production" || process.env.STOCK_STORAGE !== "supabase" || process.env.STOCK_PRODUCTION_ENABLED !== "true") return fail();
  if (process.env.STOCK_STAGING_ENABLED === "true" || process.env.STOCK_STAGING_AUTH_TOKEN || process.env.STOCK_STAGING_READ_ONLY || Object.keys(process.env).some(key => key.startsWith("STOCK_HA_") && process.env[key]) || process.env.STOCK_ALLOW_LOCAL_TEST_DATABASE || process.env.STOCK_LOCAL_WRITE_HARNESS || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") return fail();
  let release: Record<string, unknown>, parsed: URL;
  try { release = JSON.parse(process.env.STOCK_PRODUCTION_RELEASE_JSON || "null"); parsed = new URL(process.env.STOCK_DATABASE_URL || ""); } catch { return fail(); }
  const fields = ["version", "projectRef", "isolationId", "databaseHost", "connectionMode", "runtimeUser", "vercelProjectId", "sourceCommit", "accessPolicy"];
  if (!release || Array.isArray(release) || Object.keys(release).length !== fields.length || Object.keys(release).some(key => !fields.includes(key))) return fail();
  if (!fields.slice(1).every(key => typeof release[key] === "string") || release.version !== 1 || release.accessPolicy !== "legacy-as-is" || !/^[a-z]{20}$/.test(String(release.projectRef)) || release.projectRef === "orjnazrothkdgmzlsuto") return fail();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(String(release.isolationId)) || release.isolationId === "160669bd-2f6f-4490-9259-bada5a1d02c4" || process.env.STOCK_TARGET_ISOLATION_ID !== release.isolationId) return fail();
  if (!/^stock_prod_[a-z0-9_]+$/.test(String(release.runtimeUser)) || !/^prj_[A-Za-z0-9]+$/.test(String(release.vercelProjectId)) || release.vercelProjectId !== process.env.VERCEL_PROJECT_ID || !/^[a-f0-9]{40}$/.test(String(release.sourceCommit)) || /^0+$/.test(String(release.sourceCommit)) || release.sourceCommit !== process.env.VERCEL_GIT_COMMIT_SHA) return fail();
  const direct = release.connectionMode === "direct" && release.databaseHost === "db." + release.projectRef + ".supabase.co";
  const session = release.connectionMode === "session" && /^aws-[0-9]+-ap-northeast-1\.pooler\.supabase\.com$/.test(String(release.databaseHost));
  let login: string; try { login = decodeURIComponent(parsed.username); } catch { return fail(); }
  const username = session ? release.runtimeUser + "." + release.projectRef : release.runtimeUser;
  if (!(direct || session) || !["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== release.databaseHost || Number(parsed.port || 5432) !== 5432 || parsed.pathname !== "/postgres" || parsed.search || parsed.hash || login !== username || !parsed.password) return fail();
  if (process.env.STOCK_PRODUCTION_READ_ONLY !== undefined && !["true", "false"].includes(process.env.STOCK_PRODUCTION_READ_ONLY)) return fail();
  return { url: process.env.STOCK_DATABASE_URL!, token: "", local: false, targetId: String(release.isolationId), purpose: "production", runtimeUser: String(release.runtimeUser) };
}
function runtimeSettings() {
  if (process.env.VERCEL_ENV === "production") return productionSettings();
  if (process.env.STOCK_PRODUCTION_ENABLED === "true" || process.env.STOCK_PRODUCTION_RELEASE_JSON) throw new PersistenceFailure();
  return { ...stagingSettings(), purpose: "isolated-staging", runtimeUser: undefined };
}
export function connectionPool(): Pool {
  const config = runtimeSettings(), identity = JSON.stringify([config.url, config.targetId, config.purpose, process.env.STOCK_DATABASE_CA]);
  if (pool && poolIdentity !== identity) throw new PersistenceFailure();
  if (!pool) {
    poolIdentity = identity;
    pool = new Pool({ connectionString: config.url, max: 2, min: 0, idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000, allowExitOnIdle: true,
      ssl: config.local ? false : { rejectUnauthorized: true, ca: process.env.STOCK_DATABASE_CA || undefined },
      application_name: config.purpose === "production" ? "stock-production" : "stock-isolated-staging" });
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
export function stagingReadOnly(): boolean { return process.env.VERCEL_ENV === "production" ? process.env.STOCK_PRODUCTION_READ_ONLY !== "false" : process.env.STOCK_STAGING_READ_ONLY === "true"; }
export function requireMutation(): PoolClient {
  if (stagingReadOnly()) throw new PersistenceFailure(405,"Staging is read-only.");
  const context = active.getStore();
  if (!context?.open || !context.mutation) throw new PersistenceFailure(503, "A read-only request cannot mutate persistence.");
  return context.safe;
}
export async function transaction<T>(mutation: boolean, operation: () => Promise<T>): Promise<T> {
  if (mutation && stagingReadOnly()) throw new PersistenceFailure(405,"Staging is read-only.");
  const previous=active.getStore();
  if (previous) {
    if (!previous.open || (mutation && !previous.mutation)) throw new PersistenceFailure(503, "A read-only unit of work cannot be upgraded to a mutation.");
    return operation();
  }
  if (storageMode() !== "supabase") throw new PersistenceFailure();
  const settings = runtimeSettings();
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
    const role = await client.query("SELECT current_user AS runtime_user,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolconnlimit FROM pg_roles WHERE rolname=current_user");
    if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) throw new PersistenceFailure(503, "Use a nonprivileged runtime login.");
    if (settings.purpose === "production" && (role.rows[0]?.runtime_user !== settings.runtimeUser || role.rows[0]?.rolcreatedb !== false || role.rows[0]?.rolcreaterole !== false || role.rows[0]?.rolinherit !== false || role.rows[0]?.rolconnlimit !== 6)) throw new PersistenceFailure();
    if (!stagingReadOnly()) await client.query("SET LOCAL ROLE stock_runtime");
    const guard=await client.query("SELECT isolation_id::text,purpose FROM stock_operational.environment WHERE singleton");
    if(guard.rowCount !== 1 || guard.rows[0].isolation_id !== settings.targetId || guard.rows[0].purpose !== settings.purpose) throw new PersistenceFailure(503,"The database does not match the approved storage target.");
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
export async function closePool() { const previous = pool; pool = undefined; poolIdentity = undefined; await previous?.end(); }
