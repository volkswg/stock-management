import "server-only";
import { createHash } from "node:crypto";
import { requireMutation, transaction, PersistenceFailure } from "./database";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)]));
  return value;
}
export function hashIntent(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
// The journal and every business write commit together. A waiter obtains the
// same database lock before inspecting the journal, even after a lost COMMIT ACK.
export async function executeCommand<T>(kind: string, key: string, intent: string, run: () => Promise<T>): Promise<T> {
  if (!/^[a-zA-Z0-9_:.-]{8,200}$/.test(key)) throw new PersistenceFailure(428,"A stable Idempotency-Key is required.");
  return transaction(true,async () => {
    const client = requireMutation(), actor = "isolated-staging";
    const found = await client.query("SELECT intent,response,state FROM stock_operational.commands WHERE actor=$1 AND kind=$2 AND key=$3",[actor,kind,key]);
    if (found.rowCount) {
      if (found.rows[0].intent !== intent) throw new PersistenceFailure(409,"Operation key was already used for different input.");
      if (found.rows[0].state !== "complete") throw new PersistenceFailure(503,"Operation outcome requires reconciliation.");
      return found.rows[0].response.value as T;
    }
    await client.query("INSERT INTO stock_operational.commands(actor,kind,key,intent,state) VALUES($1,$2,$3,$4,'pending')",[actor,kind,key,intent]);
    const result = await run();
    await client.query("UPDATE stock_operational.commands SET state='complete',response=$4::jsonb,completed_at=now() WHERE actor=$1 AND kind=$2 AND key=$3",[actor,kind,key,JSON.stringify({value:result})]);
    return result;
  });
}
