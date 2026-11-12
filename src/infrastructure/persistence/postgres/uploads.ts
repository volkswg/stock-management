import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import { executeCommand, hashIntent } from "./commands";
import { currentTransaction, requireMutation, transaction, PersistenceFailure } from "./database";

type FileAttempt = { remove: () => Promise<void>; attempted: boolean; deleted: boolean };
type UploadScope = { unresolved: number; files: Map<string, FileAttempt> };
const activeUploads = new AsyncLocalStorage<UploadScope>();
const reconcile = () => new PersistenceFailure(503, "Upload outcome requires reconciliation. Do not start another upload for this operation.");

export async function observeUpload<T extends { id: string }>(upload: () => Promise<T>, remove: (id: string) => Promise<void>): Promise<T> {
  const scope = activeUploads.getStore();
  if (!scope) return upload();
  scope.unresolved++;
  const file = await upload();
  if (!file.id?.trim()) throw reconcile();
  scope.unresolved--;
  scope.files.set(file.id, { remove: () => remove(file.id), attempted: false, deleted: false });
  return file;
}

// The provider identity is observed before feature code can swallow an error.
// Only newly returned IDs are eligible for compensation; old files are untouched.
export function observeStagingDrive(drive: IGoogleDriveService): IGoogleDriveService {
  const scope = activeUploads.getStore();
  if (!scope) return drive;
  return {
    async uploadImage(input) {
      return observeUpload(() => drive.uploadImage(input), id => drive.deleteFile(id));
    },
    async deleteFile(id) {
      const file = scope.files.get(id);
      if (file) file.attempted = true;
      await drive.deleteFile(id);
      if (file) file.deleted = true;
    },
    makeFileReadableByLink: id => drive.makeFileReadableByLink(id),
    checkConnection: () => drive.checkConnection(),
  };
}

// This claim commits before any provider call, using the existing restricted
// effect ledger. A crash or unknown upload is never automatically uploaded again.
// A known rollback with confirmed cleanup permits a new attempt on the same key.
export async function executeUploadCommand<T>(kind: string, key: string, intent: string, run: () => Promise<T>): Promise<T> {
  if (!/^[a-zA-Z0-9_:.-]{8,200}$/.test(key)) throw new PersistenceFailure(428, "A stable Idempotency-Key is required.");
  const prefix = `UPLOAD:${hashIntent({ kind, key })}:`, deadline = Date.now() + 10000;
  let claim: string | undefined;
  while (!claim) {
    const state = await transaction(true, async () => {
      const client = requireMutation();
      const command = await client.query("SELECT intent,state FROM stock_operational.commands WHERE actor=$1 AND kind=$2 AND key=$3", ["isolated-staging", kind, key]);
      if (command.rowCount) {
        if (command.rows[0].intent !== intent) throw new PersistenceFailure(409, "Operation key was already used for different input.");
        if (command.rows[0].state !== "complete") throw reconcile();
        return "complete";
      }
      const prior = await client.query("SELECT key,state FROM stock_operational.side_effects WHERE key LIKE $1", [prefix + "%"]);
      if (prior.rows.some(row => row.key.split(":")[2] !== intent)) throw new PersistenceFailure(409, "Operation key was already used for different input.");
      if (prior.rows.some(row => row.state === "uncertain")) throw reconcile();
      if (prior.rows.some(row => row.state === "sending")) return "waiting";
      const attempt = prefix + intent + ":" + randomUUID();
      await client.query("INSERT INTO stock_operational.side_effects(key,state) VALUES($1,'sending')", [attempt]);
      return attempt;
    });
    if (state === "complete") return executeCommand(kind, key, intent, run);
    if (state !== "waiting") { claim = state; break; }
    if (Date.now() >= deadline) throw reconcile();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const scope: UploadScope = { unresolved: 0, files: new Map() };
  let committed: boolean | undefined, result: T | undefined, failure: unknown;
  try {
    result = await activeUploads.run(scope, () => executeCommand(kind, key, intent, run));
    committed = true;
  } catch (error) {
    failure = error;
    try {
      // The shared writer lock waits for an ambiguous original COMMIT to drain.
      committed = await transaction(false, async () => {
        const found = await currentTransaction().query("SELECT intent,state FROM stock_operational.commands WHERE actor=$1 AND kind=$2 AND key=$3", ["isolated-staging", kind, key]);
        return found.rowCount === 1 && found.rows[0].intent === intent && found.rows[0].state === "complete";
      });
    } catch { /* No proof of rollback: retain files and the unresolved claim. */ }
  }
  if (committed === false) for (const file of scope.files.values()) if (!file.attempted) {
    file.attempted = true;
    try { await file.remove(); file.deleted = true; }
    catch { console.error("Staging upload cleanup requires reconciliation."); }
  }
  const uncertain = committed === undefined || scope.unresolved > 0 || (committed === false && [...scope.files.values()].some(file => !file.deleted));
  try {
    await transaction(true, async () => {
      await requireMutation().query("UPDATE stock_operational.side_effects SET state=$2,updated_at=now() WHERE key=$1 AND state='sending'", [claim, uncertain ? "uncertain" : "done"]);
    });
  } catch { if (!failure) throw reconcile(); }
  if (failure) throw failure;
  return result as T;
}
