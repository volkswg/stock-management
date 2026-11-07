import type { StockCountAccount, StockCountRecord, MonthlyShopStockCount, ProductMovementMasterRecord } from "../contracts";
import { stockAdjustmentTotals } from "./adjustments";
import type { StockCountStore, StockCountReaders, StockCountRuntime } from "./ports/stock-counts";
export async function getMonthlyStockCounts({
  accounts,
  store,
  month,
  readers,
  runtime,
}: {
  accounts: StockCountAccount[];
  store: StockCountStore;
  month: string;
  readers: StockCountReaders;
  runtime: StockCountRuntime;
}): Promise<MonthlyShopStockCount[]> {
  await store.prepare();
  const monthStart = `${month}-01`;
  const monthEnd = getMonthEnd(month);
  const previousMonth = shiftMonth(month, -1);
  const [countRows, movements, salesDashboard, adjustments] = await Promise.all([
    store.read(),
    readers.movements(),
    readers.sales({
      accountIds: accounts.map((account) => account.id),
      fromDate: monthStart,
      toDate: monthEnd,
    }),
    readers.adjustments(),
  ]);
  const counts = countRows.records();
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
    const adjustmentTotals = stockAdjustmentTotals(adjustments, account.id, month);
    const calculatedStock = normalizeNumber(openingStock + stockIn - stockOut - adjustmentTotals.adjustmentsOut + adjustmentTotals.adjustmentsIn);
    const today = runtime.today();
    const expectedSalesDays = month < today.slice(0, 7) ? Number(monthEnd.slice(8)) : month === today.slice(0, 7) ? Number(today.slice(8)) : 0;
    const syncedDates = new Set(salesDashboard.shopSeries.find(shop => shop.accountId === account.id)?.dailySales.map(day => day.salesDate) || []);
    const missingSalesDays = Array.from({ length: expectedSalesDays }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(date => !syncedDates.has(date)).length;
    const warnings: string[] = [];
    if (!previous) warnings.push("No previous physical count: opening stock is assumed to be 0.");
    if (missingSalesDays) warnings.push(`${missingSalesDays} of ${expectedSalesDays} days have no completed sales sync. Calculated stock may be incomplete.`);
    if (calculatedStock < 0) warnings.push("Calculated stock is negative. Review opening counts, deliveries, sales and adjustments.");
    if (current && adjustments.some(a => a.accountId === account.id && a.date.slice(0, 7) === month && a.createdAt > current.countedAt)) warnings.push("Adjustment history changed after this physical count was saved. Review the variance; the saved physical count is unchanged.");
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
      ...adjustmentTotals,
      expectedSalesDays,
      missingSalesDays,
      warnings,
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
  store,
  month,
  note,
  physicalCount,
  updatedBy,
  runtime,
}: {
  account: StockCountAccount;
  store: StockCountStore;
  month: string;
  note: string;
  physicalCount: number;
  updatedBy: string;
  runtime: StockCountRuntime;
}): Promise<StockCountRecord> {
  await store.prepare();
  const rows = await store.read();
  const target = rows.find(month,account.id);
  const now = runtime.now();
  const existing = target ? target.record() : null;
  const record: StockCountRecord = {
    id: existing?.id || `STC-${runtime.uuid()}`,
    month,
    accountId: account.id,
    shopName: account.shopName,
    physicalCount: normalizeNumber(physicalCount),
    note,
    countedAt: now,
    updatedAt: now,
    updatedBy,
  };
  if(target) await target.save(record); else await store.append(record);
  return record;
}

function calculateStockIn({
  accounts,
  month,
  movements,
}: {
  accounts: StockCountAccount[];
  month: string;
  movements: ProductMovementMasterRecord[];
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

