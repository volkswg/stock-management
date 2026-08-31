import { LOYVERSE_API_BASE_URL, LOYVERSE_MAX_PAGE_SIZE } from "./const";
import type {
  ILoyverseService,
  LoyverseConfig,
  LoyverseReceipt,
  LoyverseReceiptQuery,
  LoyverseSalesByItemQuery,
  LoyverseSalesByItemReport,
  LoyverseSalesByItemRow,
  LoyverseSalesByItemTotals,
  LoyverseSalesByPaymentTypeRow,
} from "./types";

type ReceiptPage = {
  receipts?: LoyverseReceipt[];
  cursor?: string | null;
};

export class LoyverseService implements ILoyverseService {
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(config: LoyverseConfig) {
    if (!config.accessToken.trim()) {
      throw new Error("Loyverse access token is required.");
    }
    this.accessToken = config.accessToken;
    this.baseUrl = (config.baseUrl || LOYVERSE_API_BASE_URL).replace(/\/$/, "");
  }

  async getReceipt(receiptNumber: string): Promise<LoyverseReceipt> {
    if (!receiptNumber.trim()) {
      throw new Error("Loyverse receipt number is required.");
    }
    return this.request<LoyverseReceipt>(
      `/receipts/${encodeURIComponent(receiptNumber.trim())}`,
    );
  }

  async getReceipts(
    query: LoyverseReceiptQuery = {},
  ): Promise<LoyverseReceipt[]> {
    const receipts: LoyverseReceipt[] = [];
    const seenCursors = new Set<string>();
    let cursor = "";

    do {
      const parameters = createReceiptQueryParameters(query);
      parameters.set("limit", String(LOYVERSE_MAX_PAGE_SIZE));
      if (cursor) parameters.set("cursor", cursor);

      const page = await this.request<ReceiptPage>(
        `/receipts?${parameters.toString()}`,
      );
      receipts.push(...(page.receipts || []));

      const nextCursor = page.cursor || "";
      if (nextCursor && seenCursors.has(nextCursor)) {
        throw new Error("Loyverse receipt pagination returned a repeated cursor.");
      }
      if (nextCursor) seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);

    return receipts;
  }

  async getSalesByItem(
    query: LoyverseSalesByItemQuery = {},
  ): Promise<LoyverseSalesByItemReport> {
    const { includeCancelled = false, ...receiptQuery } = query;
    const receipts = await this.getReceipts(receiptQuery);
    return aggregateSalesByItem(receipts, { includeCancelled });
  }

  async checkConnection(): Promise<void> {
    await this.request<ReceiptPage>("/receipts?limit=1");
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Loyverse API request failed with status ${response.status}.`);
    }
    return (await response.json()) as T;
  }
}

export function aggregateSalesByItem(
  input: LoyverseReceipt[],
  { includeCancelled = false }: { includeCancelled?: boolean } = {},
): LoyverseSalesByItemReport {
  const receipts = input.filter(
    (receipt) => includeCancelled || !receipt.cancelled_at,
  );
  const rowsByItem = new Map<string, LoyverseSalesByItemRow>();

  for (const receipt of receipts) {
    const isRefund = receipt.receipt_type === "REFUND";
    for (const lineItem of receipt.line_items || []) {
      const key = createLineItemKey(lineItem);
      const row = rowsByItem.get(key) || createSalesByItemRow(lineItem);
      const quantity = toNumber(lineItem.quantity);
      const grossTotal = toNumber(lineItem.gross_total_money);
      const discount = toNumber(lineItem.total_discount);
      const cost = toNumber(lineItem.cost_total);
      const taxes = (lineItem.line_taxes || []).reduce(
        (sum, tax) => sum + toNumber(tax.money_amount),
        0,
      );

      if (isRefund) {
        row.itemsRefunded += quantity;
        row.refunds += grossTotal;
        row.discounts -= discount;
        row.costOfGoods -= cost;
        row.taxes -= taxes;
      } else {
        row.itemsSold += quantity;
        row.grossSales += grossTotal;
        row.discounts += discount;
        row.costOfGoods += cost;
        row.taxes += taxes;
      }
      rowsByItem.set(key, row);
    }
  }

  const rows = [...rowsByItem.values()]
    .map(finalizeSalesByItemRow)
    .sort((left, right) => right.netSales - left.netSales);
  return {
    receiptCount: receipts.length,
    rows,
    paymentsByType: createSalesByPaymentTypeRows(receipts),
    totals: createSalesByItemTotals(rows),
  };
}

function createLineItemKey(
  lineItem: LoyverseReceipt["line_items"][number],
): string {
  return lineItem.variant_id || lineItem.item_id || lineItem.sku || lineItem.item_name;
}

function createSalesByItemRow(
  lineItem: LoyverseReceipt["line_items"][number],
): LoyverseSalesByItemRow {
  return {
    itemId: lineItem.item_id,
    variantId: lineItem.variant_id,
    itemName: lineItem.item_name,
    variantName: lineItem.variant_name,
    sku: lineItem.sku,
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

function finalizeSalesByItemRow(
  row: LoyverseSalesByItemRow,
): LoyverseSalesByItemRow {
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

function createSalesByItemTotals(
  rows: LoyverseSalesByItemRow[],
): LoyverseSalesByItemTotals {
  const totals = rows.reduce<LoyverseSalesByItemTotals>(
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
  return {
    itemsSold: normalizeNumber(totals.itemsSold),
    grossSales: normalizeNumber(totals.grossSales),
    itemsRefunded: normalizeNumber(totals.itemsRefunded),
    refunds: normalizeNumber(totals.refunds),
    discounts: normalizeNumber(totals.discounts),
    netSales: normalizeNumber(totals.netSales),
    costOfGoods: normalizeNumber(totals.costOfGoods),
    grossProfit: normalizeNumber(totals.grossProfit),
    taxes: normalizeNumber(totals.taxes),
  };
}

function createSalesByPaymentTypeRows(
  receipts: LoyverseReceipt[],
): LoyverseSalesByPaymentTypeRow[] {
  const rowsByType = new Map<string, LoyverseSalesByPaymentTypeRow>();
  for (const receipt of receipts) {
    const isRefund = receipt.receipt_type === "REFUND";
    for (const payment of receipt.payments || []) {
      const key = payment.payment_type_id || `${payment.type}:${payment.name}`;
      const row = rowsByType.get(key) || {
        paymentTypeId: payment.payment_type_id,
        name: payment.name || payment.type || "Unknown",
        type: payment.type || "UNKNOWN",
        paymentsReceived: 0,
        refunds: 0,
        netPayments: 0,
      };
      const amount = toNumber(payment.money_amount);
      if (isRefund) row.refunds += amount;
      else row.paymentsReceived += amount;
      rowsByType.set(key, row);
    }
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

function createReceiptQueryParameters(
  query: LoyverseReceiptQuery,
): URLSearchParams {
  const parameters = new URLSearchParams();
  setParameter(parameters, "receipt_numbers", query.receiptNumbers?.join(","));
  setParameter(parameters, "since_receipt_number", query.sinceReceiptNumber);
  setParameter(parameters, "before_receipt_number", query.beforeReceiptNumber);
  setParameter(parameters, "store_id", query.storeId);
  setParameter(parameters, "order", query.order);
  setParameter(parameters, "source", query.source);
  setParameter(parameters, "created_at_min", query.createdAtMin);
  setParameter(parameters, "created_at_max", query.createdAtMax);
  setParameter(parameters, "updated_at_min", query.updatedAtMin);
  setParameter(parameters, "updated_at_max", query.updatedAtMax);
  return parameters;
}

function setParameter(
  parameters: URLSearchParams,
  name: string,
  value: string | undefined,
): void {
  if (value) parameters.set(name, value);
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeNumber(value: number): number {
  return Number(value.toFixed(6));
}
