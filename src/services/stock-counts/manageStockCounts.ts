import { randomUUID } from "node:crypto";
import {
  STOCK_COUNT_HEADERS,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { listMovements } from "@/services/movements";
import { getGoogleSheetsSalesDashboard } from "@/services/sales";

export type StockCountAccount = {
  id: string;
  shopName: string;
};

export type StockCountRecord = {
  id: string;
  month: string;
  accountId: string;
  shopName: string;
  physicalCount: number;
  note: string;
  countedAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type MonthlyShopStockCount = {
  accountId: string;
  shopName: string;
  month: string;
  openingStock: number;
  hasOpeningCount: boolean;
  stockIn: number;
  stockOut: number;
  salesSyncedDays: number;
  calculatedStock: number;
  physicalCount: number | null;
  variance: number | null;
  matches: boolean | null;
  note: string;
  countedAt: string;
  updatedAt: string;
};

export async function getMonthlyStockCounts({
  accounts,
  googleSheetsService,
  month,
}: {
  accounts: StockCountAccount[];
  googleSheetsService: IGoogleSheetsService;
  month: string;
}): Promise<MonthlyShopStockCount[]> {
  await ensureStockCountHeaders(googleSheetsService);
  const monthStart = `${month}-01`;
  const monthEnd = getMonthEnd(month);
  const previousMonth = shiftMonth(month, -1);
  const [countRows, movements, salesDashboard] = await Promise.all([
    googleSheetsService.stockCounts.readRows(),
    listMovements({ filter: {}, googleSheetsService }),
    getGoogleSheetsSalesDashboard({
      accountIds: accounts.map((account) => account.id),
      fromDate: monthStart,
      googleSheetsService,
      toDate: monthEnd,
    }),
  ]);
  const counts = countRows
    .map(mapStockCountRow)
    .filter((record): record is StockCountRecord => Boolean(record));
  const currentByAccount = recordsByAccount(counts, month);
  const previousByAccount = recordsByAccount(counts, previousMonth);
  const stockInByAccount = calculateStockIn({ accounts, month, movements });
  const stockOutByAccount = new Map(
    accounts.map((account) => {
      const series = salesDashboard.shopSeries.find(
        (shop) => shop.accountId === account.id,
      );
      const stockOut = (series?.dailySales || []).reduce(
        (total, day) => total + day.itemsSold - day.itemsRefunded,
        0,
      );
      return [account.id, normalizeNumber(stockOut)] as const;
    }),
  );
  const salesSyncedDaysByAccount = new Map(
    accounts.map((account) => {
      const series = salesDashboard.shopSeries.find(
        (shop) => shop.accountId === account.id,
      );
      return [account.id, series?.dailySales.length || 0] as const;
    }),
  );

  return accounts.map((account) => {
    const current = currentByAccount.get(account.id);
    const previous = previousByAccount.get(account.id);
    const openingStock = previous?.physicalCount || 0;
    const stockIn = stockInByAccount.get(account.id) || 0;
    const stockOut = stockOutByAccount.get(account.id) || 0;
    const calculatedStock = normalizeNumber(openingStock + stockIn - stockOut);
    const physicalCount = current?.physicalCount ?? null;
    const variance =
      physicalCount === null
        ? null
        : normalizeNumber(physicalCount - calculatedStock);
    return {
      accountId: account.id,
      shopName: account.shopName,
      month,
      openingStock,
      hasOpeningCount: Boolean(previous),
      stockIn,
      stockOut,
      salesSyncedDays: salesSyncedDaysByAccount.get(account.id) || 0,
      calculatedStock,
      physicalCount,
      variance,
      matches: variance === null ? null : variance === 0,
      note: current?.note || "",
      countedAt: current?.countedAt || "",
      updatedAt: current?.updatedAt || "",
    };
  });
}

export async function saveMonthlyStockCount({
  account,
  googleSheetsService,
  month,
  note,
  physicalCount,
  updatedBy,
}: {
  account: StockCountAccount;
  googleSheetsService: IGoogleSheetsService;
  month: string;
  note: string;
  physicalCount: number;
  updatedBy: string;
}): Promise<StockCountRecord> {
  await ensureStockCountHeaders(googleSheetsService);
  const rows = await googleSheetsService.stockCounts.readRows();
  const rowIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      toStringValue(row[1]) === month &&
      toStringValue(row[2]) === account.id,
  );
  const now = new Date().toISOString();
  const existing = rowIndex >= 0 ? mapStockCountRow(rows[rowIndex]) : null;
  const record: StockCountRecord = {
    id: existing?.id || `STC-${randomUUID()}`,
    month,
    accountId: account.id,
    shopName: account.shopName,
    physicalCount: normalizeNumber(physicalCount),
    note,
    countedAt: now,
    updatedAt: now,
    updatedBy,
  };
  if (rowIndex >= 0) {
    await googleSheetsService.stockCounts.updateRows(
      `A${rowIndex + 1}:I${rowIndex + 1}`,
      [stockCountToRow(record)],
    );
  } else {
    await googleSheetsService.stockCounts.appendRows("A:I", [
      stockCountToRow(record),
    ]);
  }
  return record;
}

function calculateStockIn({
  accounts,
  month,
  movements,
}: {
  accounts: StockCountAccount[];
  month: string;
  movements: Awaited<ReturnType<typeof listMovements>>;
}): Map<string, number> {
  const accountIdByShop = new Map<string, string>();
  for (const account of accounts) {
    accountIdByShop.set(normalizeShop(account.id), account.id);
    accountIdByShop.set(normalizeShop(account.shopName), account.id);
    accountIdByShop.set(shopAlias(account.shopName), account.id);
  }
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (
      movement.status !== "delivered" ||
      !movement.deliverDateTime ||
      toBangkokDate(movement.deliverDateTime).slice(0, 7) !== month
    ) {
      continue;
    }
    for (const [shopName, quantity] of Object.entries(
      movement.shopQuantities,
    )) {
      const accountId =
        accountIdByShop.get(normalizeShop(shopName)) ||
        accountIdByShop.get(shopAlias(shopName));
      if (!accountId) continue;
      totals.set(
        accountId,
        normalizeNumber((totals.get(accountId) || 0) + quantity),
      );
    }
  }
  return totals;
}

async function ensureStockCountHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await googleSheetsService.stockCounts.ensureExists?.();
  const rows = await googleSheetsService.stockCounts.readRows("A1:I1");
  if (rows[0]?.join("|") !== STOCK_COUNT_HEADERS.join("|")) {
    await googleSheetsService.stockCounts.updateRows("A1:I1", [
      STOCK_COUNT_HEADERS,
    ]);
  }
}

function recordsByAccount(
  records: StockCountRecord[],
  month: string,
): Map<string, StockCountRecord> {
  const result = new Map<string, StockCountRecord>();
  for (const record of records) {
    if (record.month === month) result.set(record.accountId, record);
  }
  return result;
}

function mapStockCountRow(row: GoogleSheetRow): StockCountRecord | null {
  if (!row.length || row[0] === "id") return null;
  const id = toStringValue(row[0]);
  const month = toStringValue(row[1]);
  const accountId = toStringValue(row[2]);
  const physicalCount = Number(row[4]);
  if (!id || !month || !accountId || !Number.isFinite(physicalCount)) {
    return null;
  }
  return {
    id,
    month,
    accountId,
    shopName: toStringValue(row[3]),
    physicalCount,
    note: toStringValue(row[5]),
    countedAt: toStringValue(row[6]),
    updatedAt: toStringValue(row[7]),
    updatedBy: toStringValue(row[8]),
  };
}

function stockCountToRow(record: StockCountRecord): GoogleSheetRow {
  return [
    record.id,
    record.month,
    record.accountId,
    record.shopName,
    record.physicalCount,
    record.note,
    record.countedAt,
    record.updatedAt,
    record.updatedBy,
  ];
}

function getMonthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toBangkokDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(date);
}

function normalizeShop(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function shopAlias(value: string): string {
  return normalizeShop(value).replace(/\s+shop$/, "");
}

function normalizeNumber(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
