import type {
  GoogleSheetCellValue,
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import {
  SALES_RECEIPT_HEADERS,
  SALES_RECEIPT_ITEM_HEADERS,
  SALES_RECEIPT_PAYMENT_HEADERS,
  SALES_RECEIPT_SYNC_HEADERS,
} from "@/externals/google/sheet";
import type { SalesProfitExpense } from "./manageSalesProfitExpenses";
import type { SalesProfitCostOverride } from "./manageSalesProfitCostOverrides";

export type GoogleSheetsDailySalesItemRow = {
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  sku: string;
  itemsSold: number;
  grossSales: number;
  itemsRefunded: number;
  refunds: number;
  discounts: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  marginPercent: number;
  taxes: number;
};

export type GoogleSheetsDailySalesPaymentRow = {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
};

export type GoogleSheetsDailySalesReport = {
  receiptCount: number;
  rows: GoogleSheetsDailySalesItemRow[];
  paymentsByType: GoogleSheetsDailySalesPaymentRow[];
  totals: Omit<
    GoogleSheetsDailySalesItemRow,
    "itemId" | "variantId" | "itemName" | "variantName" | "sku" | "marginPercent"
  >;
  hourlyGrossSales: Array<{ hour: string; grossSales: number }>;
};

export type GoogleSheetsSalesDashboardDay = {
  salesDate: string;
  syncedShopCount: number;
  receiptCount: number;
  itemsSold: number;
  grossSales: number;
  netSales: number;
};

export type GoogleSheetsSalesDashboardReport = {
  syncedDays: number;
  dailySales: GoogleSheetsSalesDashboardDay[];
  shopSeries: Array<{
    accountId: string;
    shopName: string;
    dailySales: GoogleSheetsSalesDashboardDay[];
  }>;
  report: GoogleSheetsDailySalesReport;
};

export type GoogleSheetsProfitSummaryMetrics = {
  netItems: number;
  netSales: number;
  averageSellingPrice: number;
  averageItemCost: number;
  unitGrossProfit: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

export type GoogleSheetsProfitSummaryShop = GoogleSheetsProfitSummaryMetrics & {
  accountId: string;
  shopName: string;
  syncedAverageItemCost: number;
  hasItemCostOverride: boolean;
  itemCostOverrideNote: string;
  expenseNote: string;
};

export type GoogleSheetsProfitSummarySharedExpense = Pick<
  SalesProfitExpense,
  "id" | "amount" | "category" | "name" | "note"
>;

export type GoogleSheetsProfitSummaryMonth = GoogleSheetsProfitSummaryMetrics & {
  month: string;
  shops: GoogleSheetsProfitSummaryShop[];
  shopExpenses: number;
  sharedExpenseTotal: number;
  sharedExpenses: GoogleSheetsProfitSummarySharedExpense[];
};

export type GoogleSheetsProfitSummary = {
  year: string;
  months: GoogleSheetsProfitSummaryMonth[];
  totals: GoogleSheetsProfitSummaryMetrics;
};

type SheetRecord = Record<string, GoogleSheetCellValue>;
type RowsSheet = IGoogleSheetsService["salesReceipts"];

export async function getGoogleSheetsDailySales({
  accountId,
  googleSheetsService,
  salesDate,
}: {
  accountId: string;
  googleSheetsService: IGoogleSheetsService;
  salesDate: string;
}): Promise<GoogleSheetsDailySalesReport> {
  const [receiptRecords, itemRecords, paymentRecords] = await Promise.all([
    readRecords(googleSheetsService.salesReceipts, SALES_RECEIPT_HEADERS),
    readRecords(googleSheetsService.salesReceiptItems, SALES_RECEIPT_ITEM_HEADERS),
    readRecords(
      googleSheetsService.salesReceiptPayments,
      SALES_RECEIPT_PAYMENT_HEADERS,
    ),
  ]);

  const receipts = receiptRecords.filter(
    (receipt) =>
      toString(receipt.salesDate) === salesDate &&
      toString(receipt.accountId) === accountId &&
      !toString(receipt.cancelledAt),
  );
  return createSalesReport(receipts, itemRecords, paymentRecords);
}

export async function getGoogleSheetsSalesDashboard({
  accountIds,
  fromDate,
  googleSheetsService,
  toDate,
}: {
  accountIds?: string[];
  fromDate: string;
  googleSheetsService: IGoogleSheetsService;
  toDate: string;
}): Promise<GoogleSheetsSalesDashboardReport> {
  const [receiptRecords, itemRecords, paymentRecords, syncRecords] =
    await Promise.all([
      readRecords(googleSheetsService.salesReceipts, SALES_RECEIPT_HEADERS),
      readRecords(
        googleSheetsService.salesReceiptItems,
        SALES_RECEIPT_ITEM_HEADERS,
      ),
      readRecords(
        googleSheetsService.salesReceiptPayments,
        SALES_RECEIPT_PAYMENT_HEADERS,
      ),
      readRecords(
        googleSheetsService.salesReceiptSyncs,
        SALES_RECEIPT_SYNC_HEADERS,
      ),
    ]);
  const completeSyncs = syncRecords.filter((sync) => {
    const salesDate = toString(sync.salesDate);
    return (
      toString(sync.status).toLowerCase() === "complete" &&
      salesDate >= fromDate &&
      salesDate <= toDate &&
      (!accountIds?.length || accountIds.includes(toString(sync.accountId)))
    );
  });
  const syncedKeys = new Set(
    completeSyncs.map(
      (sync) => `${toString(sync.accountId)}:${toString(sync.salesDate)}`,
    ),
  );
  const receipts = receiptRecords.filter(
    (receipt) =>
      syncedKeys.has(
        `${toString(receipt.accountId)}:${toString(receipt.salesDate)}`,
      ) && !toString(receipt.cancelledAt),
  );
  const dailySales = createDashboardDays(
    completeSyncs,
    receipts,
    itemRecords,
    paymentRecords,
  );
  const shopSeries = [
    ...new Map(
      completeSyncs.map((sync) => [
        toString(sync.accountId),
        toString(sync.shopName) || toString(sync.accountId),
      ]),
    ),
  ].map(([seriesAccountId, shopName]) => {
    const shopSyncs = completeSyncs.filter(
      (sync) => toString(sync.accountId) === seriesAccountId,
    );
    const shopReceipts = receipts.filter(
      (receipt) => toString(receipt.accountId) === seriesAccountId,
    );
    return {
      accountId: seriesAccountId,
      shopName,
      dailySales: createDashboardDays(
        shopSyncs,
        shopReceipts,
        itemRecords,
        paymentRecords,
      ),
    };
  });

  return {
    syncedDays: dailySales.length,
    dailySales,
    shopSeries,
    report: createSalesReport(receipts, itemRecords, paymentRecords),
  };
}

export async function getGoogleSheetsProfitSummary({
  accounts,
  costOverrides,
  expenses,
  googleSheetsService,
  year,
}: {
  accounts: Array<{ id: string; shopName: string }>;
  costOverrides: SalesProfitCostOverride[];
  expenses: SalesProfitExpense[];
  googleSheetsService: IGoogleSheetsService;
  year: string;
}): Promise<GoogleSheetsProfitSummary> {
  const [receiptRecords, itemRecords, syncRecords] = await Promise.all([
    readRecords(googleSheetsService.salesReceipts, SALES_RECEIPT_HEADERS),
    readRecords(googleSheetsService.salesReceiptItems, SALES_RECEIPT_ITEM_HEADERS),
    readRecords(googleSheetsService.salesReceiptSyncs, SALES_RECEIPT_SYNC_HEADERS),
  ]);
  const accountById = new Map(
    accounts.map((account) => [account.id, account.shopName]),
  );
  const completeSyncs = syncRecords.filter((sync) => {
    const salesDate = toString(sync.salesDate);
    return (
      toString(sync.status).toLowerCase() === "complete" &&
      salesDate.startsWith(`${year}-`) &&
      accountById.has(toString(sync.accountId))
    );
  });
  const syncedKeys = new Set(
    completeSyncs.map(
      (sync) => `${toString(sync.accountId)}:${toString(sync.salesDate)}`,
    ),
  );
  const receipts = receiptRecords.filter(
    (receipt) =>
      syncedKeys.has(
        `${toString(receipt.accountId)}:${toString(receipt.salesDate)}`,
      ) && !toString(receipt.cancelledAt),
  );
  const shopExpenses = expenses.filter((expense) => expense.scope === "SHOP");
  const sharedExpenses = expenses.filter(
    (expense) => expense.scope === "SHARED",
  );
  const expensesByShopKey = new Map<string, SalesProfitExpense[]>();
  for (const expense of shopExpenses) {
    const key = `${expense.month}:${expense.accountId}`;
    expensesByShopKey.set(key, [
      ...(expensesByShopKey.get(key) || []),
      expense,
    ]);
  }
  const costOverrideByKey = new Map(
    costOverrides.map((override) => [
      `${override.month}:${override.accountId}`,
      override,
    ]),
  );
  const groupKeys = new Set(
    completeSyncs.map(
      (sync) =>
        `${toString(sync.salesDate).slice(0, 7)}:${toString(sync.accountId)}`,
    ),
  );
  for (const expense of shopExpenses) {
    if (accountById.has(expense.accountId)) {
      groupKeys.add(`${expense.month}:${expense.accountId}`);
    }
  }
  for (const override of costOverrides) {
    if (accountById.has(override.accountId)) {
      groupKeys.add(`${override.month}:${override.accountId}`);
    }
  }

  const shops = [...groupKeys]
    .map((key) => {
      const separatorIndex = key.indexOf(":");
      const month = key.slice(0, separatorIndex);
      const accountId = key.slice(separatorIndex + 1);
      const groupReceipts = receipts.filter(
        (receipt) =>
          toString(receipt.accountId) === accountId &&
          toString(receipt.salesDate).startsWith(`${month}-`),
      );
      const report = createSalesReport(groupReceipts, itemRecords, []);
      const netItems = normalizeNumber(
        report.totals.itemsSold - report.totals.itemsRefunded,
      );
      const netSales = report.totals.netSales;
      const totalItemCost = report.totals.costOfGoods;
      const averageSellingPrice = safeAverage(netSales, netItems);
      const syncedAverageItemCost = safeAverage(totalItemCost, netItems);
      const costOverride = costOverrideByKey.get(key);
      const averageItemCost =
        costOverride?.averageItemCost ?? syncedAverageItemCost;
      const grossProfit = normalizeNumber(
        netSales - averageItemCost * netItems,
      );
      const groupExpenses = expensesByShopKey.get(key) || [];
      const expenseAmount = normalizeNumber(
        groupExpenses.reduce((total, expense) => total + expense.amount, 0),
      );
      return {
        month,
        accountId,
        shopName: accountById.get(accountId) || accountId,
        netItems,
        netSales,
        averageSellingPrice,
        averageItemCost,
        syncedAverageItemCost,
        hasItemCostOverride: Boolean(costOverride),
        itemCostOverrideNote: costOverride?.note || "",
        unitGrossProfit: normalizeNumber(
          averageSellingPrice - averageItemCost,
        ),
        grossProfit,
        expenses: expenseAmount,
        netProfit: normalizeNumber(grossProfit - expenseAmount),
        expenseNote: groupExpenses
          .map((expense) => expense.note)
          .filter(Boolean)
          .join("; "),
      };
    })
    .sort((left, right) =>
      `${left.month}:${left.shopName}`.localeCompare(
        `${right.month}:${right.shopName}`,
      ),
    );
  const monthKeys = [
    ...new Set([
      ...shops.map((shop) => shop.month),
      ...sharedExpenses.map((expense) => expense.month),
    ]),
  ].sort();
  const months = monthKeys.map((month) => {
    const monthShops = shops
      .filter((shop) => shop.month === month)
      .map<GoogleSheetsProfitSummaryShop>((shop) => ({
        accountId: shop.accountId,
        shopName: shop.shopName,
        netItems: shop.netItems,
        netSales: shop.netSales,
        averageSellingPrice: shop.averageSellingPrice,
        averageItemCost: shop.averageItemCost,
        syncedAverageItemCost: shop.syncedAverageItemCost,
        hasItemCostOverride: shop.hasItemCostOverride,
        itemCostOverrideNote: shop.itemCostOverrideNote,
        unitGrossProfit: shop.unitGrossProfit,
        grossProfit: shop.grossProfit,
        expenses: shop.expenses,
        netProfit: shop.netProfit,
        expenseNote: shop.expenseNote,
      }));
    return createProfitSummaryMonth(
      month,
      monthShops,
      sharedExpenses.filter((expense) => expense.month === month),
    );
  });

  return {
    year,
    months,
    totals: aggregateProfitRows(months),
  };
}

function createDashboardDays(
  syncRecords: SheetRecord[],
  receipts: SheetRecord[],
  itemRecords: SheetRecord[],
  paymentRecords: SheetRecord[],
): GoogleSheetsSalesDashboardDay[] {
  const syncedDates = [
    ...new Set(syncRecords.map((sync) => toString(sync.salesDate))),
  ]
    .filter(Boolean)
    .sort();

  return syncedDates.map((salesDate) => {
    const dailyReceipts = receipts.filter(
      (receipt) => toString(receipt.salesDate) === salesDate,
    );
    const dailyReport = createSalesReport(
      dailyReceipts,
      itemRecords,
      paymentRecords,
    );
    return {
      salesDate,
      syncedShopCount: new Set(
        syncRecords
          .filter((sync) => toString(sync.salesDate) === salesDate)
          .map((sync) => toString(sync.accountId)),
      ).size,
      receiptCount: dailyReport.receiptCount,
      itemsSold: dailyReport.totals.itemsSold,
      grossSales: dailyReport.totals.grossSales,
      netSales: dailyReport.totals.netSales,
    };
  });
}

function createSalesReport(
  receipts: SheetRecord[],
  itemRecords: SheetRecord[],
  paymentRecords: SheetRecord[],
): GoogleSheetsDailySalesReport {
  const receiptsById = new Map(
    receipts.map((receipt) => [toString(receipt.id), receipt]),
  );
  const items = itemRecords.filter((item) =>
    receiptsById.has(toString(item.receiptId)),
  );
  const payments = paymentRecords.filter((payment) =>
    receiptsById.has(toString(payment.receiptId)),
  );
  const rows = aggregateItems(items, receiptsById);

  return {
    receiptCount: receipts.length,
    rows,
    paymentsByType: aggregatePayments(payments, receiptsById),
    totals: aggregateTotals(rows),
    hourlyGrossSales: aggregateHourlySales(items, receiptsById),
  };
}

async function readRecords(
  sheet: RowsSheet,
  headers: string[],
): Promise<SheetRecord[]> {
  const rows = await sheet.readRows();
  return rows
    .filter((row) => row[0] !== headers[0])
    .map((row) => rowToRecord(row, headers));
}

function rowToRecord(row: GoogleSheetRow, headers: string[]): SheetRecord {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? null]),
  );
}

function aggregateItems(
  items: SheetRecord[],
  receiptsById: Map<string, SheetRecord>,
): GoogleSheetsDailySalesItemRow[] {
  const rowsByItem = new Map<string, GoogleSheetsDailySalesItemRow>();

  for (const item of items) {
    const receipt = receiptsById.get(toString(item.receiptId));
    if (!receipt) continue;

    const key =
      toString(item.variantId) ||
      toString(item.itemId) ||
      toString(item.sku) ||
      toString(item.itemName);
    const row = rowsByItem.get(key) || createItemRow(item);
    const quantity = toNumber(item.quantity);
    const grossSales = toNumber(item.grossTotalMoney);
    const discounts = toNumber(item.totalDiscount);
    const cost = toNumber(item.costTotal);
    const taxes = toNumber(item.taxes);

    if (toString(receipt.receiptType) === "REFUND") {
      row.itemsRefunded += quantity;
      row.refunds += grossSales;
      row.discounts -= discounts;
      row.costOfGoods -= cost;
      row.taxes -= taxes;
    } else {
      row.itemsSold += quantity;
      row.grossSales += grossSales;
      row.discounts += discounts;
      row.costOfGoods += cost;
      row.taxes += taxes;
    }
    rowsByItem.set(key, row);
  }

  return [...rowsByItem.values()]
    .map(finalizeItemRow)
    .sort((left, right) => right.netSales - left.netSales);
}

function createItemRow(item: SheetRecord): GoogleSheetsDailySalesItemRow {
  return {
    itemId: toString(item.itemId),
    variantId: toString(item.variantId),
    itemName: toString(item.itemName),
    variantName: toString(item.variantName),
    sku: toString(item.sku),
    itemsSold: 0,
    grossSales: 0,
    itemsRefunded: 0,
    refunds: 0,
    discounts: 0,
    netSales: 0,
    costOfGoods: 0,
    grossProfit: 0,
    marginPercent: 0,
    taxes: 0,
  };
}

function finalizeItemRow(
  row: GoogleSheetsDailySalesItemRow,
): GoogleSheetsDailySalesItemRow {
  const netSales = row.grossSales - row.discounts - row.refunds;
  const grossProfit = netSales - row.costOfGoods;
  return {
    ...row,
    itemsSold: normalizeNumber(row.itemsSold),
    grossSales: normalizeNumber(row.grossSales),
    itemsRefunded: normalizeNumber(row.itemsRefunded),
    refunds: normalizeNumber(row.refunds),
    discounts: normalizeNumber(row.discounts),
    netSales: normalizeNumber(netSales),
    costOfGoods: normalizeNumber(row.costOfGoods),
    grossProfit: normalizeNumber(grossProfit),
    marginPercent:
      netSales === 0 ? 0 : normalizeNumber((grossProfit / netSales) * 100),
    taxes: normalizeNumber(row.taxes),
  };
}

function aggregatePayments(
  payments: SheetRecord[],
  receiptsById: Map<string, SheetRecord>,
): GoogleSheetsDailySalesPaymentRow[] {
  const rowsByType = new Map<string, GoogleSheetsDailySalesPaymentRow>();

  for (const payment of payments) {
    const receipt = receiptsById.get(toString(payment.receiptId));
    if (!receipt) continue;

    const paymentTypeId = toString(payment.paymentTypeId);
    const name = toString(payment.paymentName);
    const type = toString(payment.paymentType);
    const key = paymentTypeId || `${type}:${name}`;
    const row = rowsByType.get(key) || {
      paymentTypeId,
      name: name || type || "Unknown",
      type: type || "UNKNOWN",
      paymentsReceived: 0,
      refunds: 0,
      netPayments: 0,
    };
    const amount = toNumber(payment.moneyAmount);
    if (toString(receipt.receiptType) === "REFUND") row.refunds += amount;
    else row.paymentsReceived += amount;
    rowsByType.set(key, row);
  }

  return [...rowsByType.values()]
    .map((row) => ({
      ...row,
      paymentsReceived: normalizeNumber(row.paymentsReceived),
      refunds: normalizeNumber(row.refunds),
      netPayments: normalizeNumber(row.paymentsReceived - row.refunds),
    }))
    .sort((left, right) => right.netPayments - left.netPayments);
}

function aggregateTotals(
  rows: GoogleSheetsDailySalesItemRow[],
): GoogleSheetsDailySalesReport["totals"] {
  const totals = rows.reduce<GoogleSheetsDailySalesReport["totals"]>(
    (result, row) => ({
      itemsSold: result.itemsSold + row.itemsSold,
      grossSales: result.grossSales + row.grossSales,
      itemsRefunded: result.itemsRefunded + row.itemsRefunded,
      refunds: result.refunds + row.refunds,
      discounts: result.discounts + row.discounts,
      netSales: result.netSales + row.netSales,
      costOfGoods: result.costOfGoods + row.costOfGoods,
      grossProfit: result.grossProfit + row.grossProfit,
      taxes: result.taxes + row.taxes,
    }),
    {
      itemsSold: 0,
      grossSales: 0,
      itemsRefunded: 0,
      refunds: 0,
      discounts: 0,
      netSales: 0,
      costOfGoods: 0,
      grossProfit: 0,
      taxes: 0,
    },
  );

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, normalizeNumber(value)]),
  ) as GoogleSheetsDailySalesReport["totals"];
}

function createProfitSummaryMonth(
  month: string,
  shops: GoogleSheetsProfitSummaryShop[],
  sharedExpenses: SalesProfitExpense[],
): GoogleSheetsProfitSummaryMonth {
  const shopTotals = aggregateProfitRows(shops);
  const sharedExpenseTotal = normalizeNumber(
    sharedExpenses.reduce((total, expense) => total + expense.amount, 0),
  );
  const expenses = normalizeNumber(shopTotals.expenses + sharedExpenseTotal);
  return {
    month,
    shops,
    ...shopTotals,
    expenses,
    netProfit: normalizeNumber(shopTotals.grossProfit - expenses),
    shopExpenses: shopTotals.expenses,
    sharedExpenseTotal,
    sharedExpenses: sharedExpenses
      .map(({ id, amount, category, name, note }) => ({
        id,
        amount,
        category,
        name,
        note,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function aggregateProfitRows(
  rows: Array<
    Pick<
      GoogleSheetsProfitSummaryShop,
      | "netItems"
      | "netSales"
      | "averageItemCost"
      | "grossProfit"
      | "expenses"
      | "netProfit"
    >
  >,
): GoogleSheetsProfitSummaryMetrics {
  const totals = rows.reduce(
    (result, row) => ({
      netItems: result.netItems + row.netItems,
      netSales: result.netSales + row.netSales,
      totalItemCost:
        result.totalItemCost + row.averageItemCost * row.netItems,
      grossProfit: result.grossProfit + row.grossProfit,
      expenses: result.expenses + row.expenses,
      netProfit: result.netProfit + row.netProfit,
    }),
    {
      netItems: 0,
      netSales: 0,
      totalItemCost: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
    },
  );
  const netItems = normalizeNumber(totals.netItems);
  const netSales = normalizeNumber(totals.netSales);
  const averageSellingPrice = safeAverage(netSales, netItems);
  const averageItemCost = safeAverage(totals.totalItemCost, netItems);
  return {
    netItems,
    netSales,
    averageSellingPrice,
    averageItemCost,
    unitGrossProfit: normalizeNumber(
      averageSellingPrice - averageItemCost,
    ),
    grossProfit: normalizeNumber(totals.grossProfit),
    expenses: normalizeNumber(totals.expenses),
    netProfit: normalizeNumber(totals.netProfit),
  };
}

function safeAverage(total: number, quantity: number): number {
  return quantity === 0 ? 0 : normalizeNumber(total / quantity);
}

function aggregateHourlySales(
  items: SheetRecord[],
  receiptsById: Map<string, SheetRecord>,
): GoogleSheetsDailySalesReport["hourlyGrossSales"] {
  const values = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    grossSales: 0,
  }));
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  });

  for (const item of items) {
    const receipt = receiptsById.get(toString(item.receiptId));
    if (!receipt || toString(receipt.receiptType) !== "SALE") continue;

    const hour = Number(
      hourFormatter.format(new Date(toString(receipt.receiptDate))),
    );
    if (!Number.isInteger(hour) || !values[hour]) continue;
    values[hour].grossSales += toNumber(item.grossTotalMoney);
  }

  return values.map((value) => ({
    ...value,
    grossSales: normalizeNumber(value.grossSales),
  }));
}

function toString(value: GoogleSheetCellValue | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toNumber(value: GoogleSheetCellValue | undefined): number {
  const numberValue = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeNumber(value: number): number {
  return Number(value.toFixed(6));
}
