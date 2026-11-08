import "server-only";
import { transaction, requireMutation } from "./database";
// A recorded attempt is never automatically resent after a crash/timeout.
// This deliberately trades availability for avoiding duplicate external replies.
export async function attemptEffectOnce(key: string, send: () => Promise<void>): Promise<boolean> {
  const claimed=await transaction(true,async () => {
    const result=await requireMutation().query("INSERT INTO stock_operational.side_effects(key,state) VALUES($1,'sending') ON CONFLICT DO NOTHING RETURNING key",[key]);
    return result.rowCount === 1;
  });
  if (!claimed) return false;
  let state="done";
  try { await send(); } catch { state="uncertain"; }
  await transaction(true,async () => { await requireMutation().query("UPDATE stock_operational.side_effects SET state=$2,updated_at=now() WHERE key=$1 AND state='sending'",[key,state]); });
  return state==="done";
}
