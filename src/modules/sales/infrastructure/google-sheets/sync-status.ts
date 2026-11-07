import "server-only";
import type { IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { SalesSyncStatusRow } from "../../contracts";
import type { SyncStatusReader } from "../../application/ports/sync-status";
export function createSyncStatusReader(service: {
    salesReceiptSyncs: IGoogleRowsSheet;
}): SyncStatusReader {
    return { async read() { const rows = await service.salesReceiptSyncs.readRows("A:I"); return { records: () => rows.map(mapSalesSyncStatusRow).filter((row): row is SalesSyncStatusRow => Boolean(row)) }; } };
}

function mapSalesSyncStatusRow(
  row: unknown[],
  index: number,
): SalesSyncStatusRow | null {
  if (index === 0 && row[0] === "id" && row[1] === "salesDate") {
    return null;
  }

  const salesDate = toTrimmedString(row[1]);
  const accountId = toTrimmedString(row[2]);
  if (!salesDate || !accountId) {
    return null;
  }

  return {
    id: toTrimmedString(row[0]) || `${accountId}:${salesDate}`,
    salesDate,
    accountId,
    shopName: toTrimmedString(row[3]),
    status: toTrimmedString(row[4]),
    receiptCount: toNumber(row[5]),
    itemCount: toNumber(row[6]),
    paymentCount: toNumber(row[7]),
    syncedAt: toTrimmedString(row[8]),
  };
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function toNumber(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
