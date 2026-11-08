import "server-only";
import { createHash } from "node:crypto";
import type { GoogleSheetsClient } from "./client";
import type { GoogleSheetRow } from "./types";
export type SheetsGuard = { key: string; identity: string; fingerprint: string; data?: Record<string, string | null> };
export type SheetsGuardRecord = SheetsGuard & { metadataId: number };
export class GuardConflictError extends Error {
  constructor() { super("This operation was already applied with different details. Refresh before retrying."); this.name = "GuardConflictError"; }
}
export class GuardOutcomeUnknownError extends Error {
  constructor() { super("The write outcome is not yet confirmed. Retry the same operation; do not create a new request."); this.name = "GuardOutcomeUnknownError"; }
}
export function stableFingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function guardMetadataId(key: string, identity: string): number { return (createHash("sha256").update(`${key}\n${identity}`).digest().readUInt32BE(0) & 0x7fffffff) || 1; }
export function parseGuard(value: { metadataId?: number; metadataKey?: string; metadataValue?: string }): SheetsGuardRecord {
  try {
    const saved: unknown = JSON.parse(value.metadataValue ?? "");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error();
    const record = saved as SheetsGuard;
    if (!Number.isInteger(value.metadataId) || typeof record.identity !== "string" || typeof record.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(record.fingerprint) || !value.metadataKey || value.metadataId !== guardMetadataId(value.metadataKey, record.identity)) throw new Error();
    return { ...record, key: value.metadataKey, metadataId: value.metadataId! };
  } catch { throw new Error("Guarded worksheet history is invalid; operator review is required."); }
}
export async function guardedWrite(client: GoogleSheetsClient, guard: SheetsGuard, requests: unknown[]): Promise<"applied" | "replayed"> {
  if (!guard.key || guard.key.length > 128 || !guard.identity || !/^[a-f0-9]{64}$/.test(guard.fingerprint)) throw new Error("Invalid guarded write.");
  // A fixed unique metadata ID is a server-enforced precondition in the same
  // atomic request as the mutation. Never switch slots after an ambiguous POST.
  const metadataId = guardMetadataId(guard.key, guard.identity);
  function reconcile(records: Awaited<ReturnType<GoogleSheetsClient["findMetadata"]>>): boolean {
    if (!records.length) return false;
    if (records.length !== 1 || records[0].metadataKey !== guard.key) throw new Error("Worksheet guard ID collision; retain the request ID and contact the operator.");
    const previous = parseGuard(records[0]);
    if (previous.identity !== guard.identity) throw new Error("Worksheet guard ID collision; retain the request ID and contact the operator.");
    if (previous.fingerprint !== guard.fingerprint) throw new GuardConflictError();
    return true;
  }
  if (reconcile(await client.findMetadata({ metadataId }))) return "replayed";
  try {
    await client.updateSpreadsheet([
      { createDeveloperMetadata: { developerMetadata: { metadataId, metadataKey: guard.key, metadataValue: JSON.stringify({ identity: guard.identity, fingerprint: guard.fingerprint, data: guard.data }), location: { spreadsheet: true }, visibility: "DOCUMENT" } } },
      ...requests,
    ]);
    if (!reconcile(await client.findMetadata({ metadataId }))) throw new GuardOutcomeUnknownError();
    return "applied";
  } catch {
    let after;
    try { after = await client.findMetadata({ metadataId }); } catch { throw new GuardOutcomeUnknownError(); }
    if (reconcile(after)) return "replayed";
    throw new GuardOutcomeUnknownError();
  }
}

export function enteredRows(rows: GoogleSheetRow[]) {
  return rows.map(row => ({ values: row.map(value => ({ userEnteredValue: typeof value === "number" ? { numberValue: value } : typeof value === "boolean" ? { boolValue: value } : { stringValue: value === null ? "" : value } })) }));
}
