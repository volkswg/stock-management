import type { IGoogleSheetsService } from "@/externals/google/sheet";

export type SalesSyncStatusRow = {
  id: string;
  salesDate: string;
  accountId: string;
  shopName: string;
  status: string;
  receiptCount: number;
  itemCount: number;
  paymentCount: number;
  syncedAt: string;
};

export type SalesSyncStatusSummary = {
  syncedDays: number;
  totalReceipts: number;
  totalItems: number;
  totalPayments: number;
  latestSyncedAt: string | null;
};

export async function listSalesSyncStatus({
  accountId,
  googleSheetsService,
  month,
}: {
  accountId?: string;
  googleSheetsService: IGoogleSheetsService;
  month: string;
}): Promise<{
  rows: SalesSyncStatusRow[];
  summary: SalesSyncStatusSummary;
}> {
  const rows = (await googleSheetsService.salesReceiptSyncs.readRows("A:I"))
    .map(mapSalesSyncStatusRow)
    .filter((row): row is SalesSyncStatusRow => Boolean(row))
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

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function toNumber(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
