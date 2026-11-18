import "server-only";
import { currentTransaction, requireMutation, PersistenceFailure } from "./database";

export type UploadedMediaMetadata = {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
};
const capabilities = new WeakMap<ReturnType<typeof currentTransaction>, Promise<boolean>>();
async function enabled(): Promise<boolean> {
  const client = currentTransaction();
  let pending = capabilities.get(client);
  if (!pending) {
    pending = (async () => {
      const { rows } = await client.query<{ table_present: boolean; contract_present: boolean }>(
        "SELECT to_regclass('stock_operational.media') IS NOT NULL AS table_present,to_regprocedure('stock_operational.media_catalog_v1()') IS NOT NULL AS contract_present",
      );
      if (rows.length !== 1) throw new PersistenceFailure();
      const found = rows[0];
      // Before the separately approved schema release, preserve existing uploads.
      // A partial installation is an error, never a fallback to untracked files.
      if (!found.table_present && !found.contract_present) return false;
      if (!found.table_present || !found.contract_present) throw new PersistenceFailure(503,"Incomplete media catalog schema.");
      const version = await client.query<{ version: string }>("SELECT stock_operational.media_catalog_v1() AS version");
      if (version.rows[0]?.version !== "media-v1") throw new PersistenceFailure(503,"Unsupported media catalog schema.");
      return true;
    })();
    capabilities.set(client,pending);
  }
  return pending;
}

// Called only after the provider identity is observed and registered for upload
// compensation. Catalog metadata and its business reference share the command
// transaction; pending/uncertain effects remain in the existing effect ledger.
export async function registerUploadedMedia(
  file: { id: string; name?: unknown; webViewLink?: unknown },
  readMetadata?: () => UploadedMediaMetadata,
): Promise<void> {
  if (!await enabled()) return;
  if (typeof file.webViewLink !== "string" || !file.webViewLink) return;
  const metadata = readMetadata?.() || {};
  const optional = (value: unknown) => typeof value === "string" && value.length ? value : null;
  const size = metadata.sizeBytes === undefined ? null : metadata.sizeBytes;
  if (size !== null && (!Number.isSafeInteger(size) || size < 0)) throw new PersistenceFailure(503,"Invalid uploaded media size.");
  const client = requireMutation();
  const found = await client.query<{ id: string }>(
    "SELECT stock_operational.media_for_location_v1('google_drive',$1,$2) AS id",[file.id,file.webViewLink],
  );
  await client.query(`UPDATE stock_operational.media SET
    "fileName"=coalesce("fileName",$2),"mimeType"=coalesce("mimeType",$3),
    "sizeBytes"=coalesce("sizeBytes",$4),"createdBy"=coalesce("createdBy",$5)
    WHERE id=$1 AND (("fileName" IS NULL AND $2::text IS NOT NULL)
      OR ("mimeType" IS NULL AND $3::text IS NOT NULL)
      OR ("sizeBytes" IS NULL AND $4::bigint IS NOT NULL)
      OR ("createdBy" IS NULL AND $5::text IS NOT NULL))`,[
    found.rows[0].id,optional(file.name) || optional(metadata.fileName),optional(metadata.mimeType),size,optional(metadata.createdBy),
  ]);
}
