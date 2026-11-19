import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { SalesSyncStatusRow } from "../../contracts";
import type { SyncStatusReader } from "../../application/ports/sync-status";
import type { Storage } from "./storage";
export function createSyncStatusReader(storage: Pick<Storage, "salesReceiptSyncs">): SyncStatusReader {
  return { async read() { const records = await storage.salesReceiptSyncs.all(); return { records: () => records.map(mapSalesSyncStatusRow).filter((r): r is SalesSyncStatusRow => Boolean(r)) }; } };
}
function mapSalesSyncStatusRow(
  row: NativeRecord,
): SalesSyncStatusRow | null {

  const salesDate = toTrimmedString(row.salesDate);
  const accountId = toTrimmedString(row.accountId);
  if (!salesDate || !accountId) {
    return null;
  }

  return {
    id: toTrimmedString(row.id) || `${accountId}:${salesDate}`,
    salesDate,
    accountId,
    shopName: toTrimmedString(row.shopName),
    status: toTrimmedString(row.status),
    receiptCount: toNumber(row.receiptCount),
    itemCount: toNumber(row.itemCount),
    paymentCount: toNumber(row.paymentCount),
    syncedAt: toTrimmedString(row.syncedAt),
  };
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function toNumber(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
