import type {
  GoogleSheetCellValue,
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import {
  SALES_RECEIPT_HEADERS,
  SALES_RECEIPT_ITEM_HEADERS,
  SALES_RECEIPT_PAYMENT_HEADERS,
} from "@/externals/google/sheet";

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
