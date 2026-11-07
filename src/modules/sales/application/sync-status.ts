import type { SalesSyncStatusRow, SalesSyncStatusSummary } from "../contracts";
import type { SyncStatusReader } from "./ports/sync-status";
export async function listSalesSyncStatus({
  accountId,
  reader,
  month,
}: {
  accountId?: string;
  reader: SyncStatusReader;
  month: string;
}): Promise<{
  rows: SalesSyncStatusRow[];
  summary: SalesSyncStatusSummary;
}> {
  const rows = (await reader.read()).records()
    .filter((row) => row.salesDate.startsWith(`${month}-`))
    .filter((row) => !accountId || row.accountId === accountId)
    .sort((left, right) => {
      if (left.salesDate !== right.salesDate) {
        return right.salesDate.localeCompare(left.salesDate);
      }
      return left.shopName.localeCompare(right.shopName);
    });

  return {
    rows,
    summary: createSummary(rows),
  };
}

function createSummary(rows: SalesSyncStatusRow[]): SalesSyncStatusSummary {
  return {
    syncedDays: new Set(rows.map((row) => `${row.accountId}:${row.salesDate}`))
      .size,
    totalReceipts: rows.reduce((sum, row) => sum + row.receiptCount, 0),
    totalItems: rows.reduce((sum, row) => sum + row.itemCount, 0),
    totalPayments: rows.reduce((sum, row) => sum + row.paymentCount, 0),
    latestSyncedAt:
      rows
        .map((row) => row.syncedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
  };
}

