export interface LoyverseConfig {
  accessToken: string;
  baseUrl?: string;
}

export interface LoyverseReceiptQuery {
  receiptNumbers?: string[];
  sinceReceiptNumber?: string;
  beforeReceiptNumber?: string;
  storeId?: string;
  order?: string;
  source?: string;
  createdAtMin?: string;
  createdAtMax?: string;
  updatedAtMin?: string;
  updatedAtMax?: string;
}

export interface LoyverseSalesByItemQuery extends LoyverseReceiptQuery {
  includeCancelled?: boolean;
}

export interface LoyverseSalesByItemRow {
  itemId: string | null;
  variantId: string | null;
  itemName: string;
  variantName: string | null;
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
}

export interface LoyverseSalesByItemTotals {
  itemsSold: number;
  grossSales: number;
  itemsRefunded: number;
  refunds: number;
  discounts: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  taxes: number;
}

export interface LoyverseSalesByItemReport {
  receiptCount: number;
  rows: LoyverseSalesByItemRow[];
  paymentsByType: LoyverseSalesByPaymentTypeRow[];
  totals: LoyverseSalesByItemTotals;
}

export interface LoyverseSalesByPaymentTypeRow {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
}

export interface LoyverseReceipt {
  receipt_number: string;
  note: string | null;
  receipt_type: "SALE" | "REFUND";
  refund_for: string | null;
  order: string | null;
  created_at: string;
  receipt_date: string;
  updated_at: string;
  cancelled_at: string | null;
  source: string;
  total_money: number;
  total_tax: number;
  points_earned: number;
  points_deducted: number;
  points_balance: number;
  customer_id: string | null;
  total_discount: number;
  employee_id: string | null;
  store_id: string;
  pos_device_id: string | null;
  dining_option: string | null;
  total_discounts: LoyverseDiscount[];
  total_taxes: LoyverseTax[];
  tip: number;
  surcharge: number;
  line_items: LoyverseLineItem[];
  payments: LoyversePayment[];
}

export interface LoyverseDiscount {
  id: string;
  type?: string;
  name?: string;
  percentage?: number;
  money_amount: number;
}

export interface LoyverseTax {
  id: string;
  type?: string;
  name?: string;
  rate?: number;
  money_amount: number;
}

export interface LoyverseLineItem {
  id: string;
  item_id: string | null;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  price: number;
  gross_total_money: number;
  total_money: number;
  cost: number;
  cost_total: number;
  line_note: string | null;
  total_discount: number;
  line_discounts: LoyverseDiscount[];
  line_taxes: LoyverseTax[];
  line_modifiers: LoyverseLineModifier[];
}

export interface LoyverseLineModifier {
  id: string;
  modifier_option_id: string;
  name: string;
  option: string;
  price: number;
  money_amount: number;
}

export interface LoyversePayment {
  payment_type_id: string;
  name: string;
  type: string;
  money_amount: number;
  paid_at: string;
  payment_details: unknown;
}

export interface ILoyverseService {
  getReceipt(receiptNumber: string): Promise<LoyverseReceipt>;
  getReceipts(query?: LoyverseReceiptQuery): Promise<LoyverseReceipt[]>;
  getSalesByItem(
    query?: LoyverseSalesByItemQuery,
  ): Promise<LoyverseSalesByItemReport>;
  checkConnection(): Promise<void>;
}
