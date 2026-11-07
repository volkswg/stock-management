export interface SyncReceipt {
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
  total_discounts: SyncDiscount[];
  total_taxes: SyncTax[];
  tip: number;
  surcharge: number;
  line_items: SyncLineItem[];
  payments: SyncPayment[];
}

export interface SyncDiscount {
  id: string;
  type?: string;
  name?: string;
  percentage?: number;
  money_amount: number;
}

export interface SyncTax {
  id: string;
  type?: string;
  name?: string;
  rate?: number;
  money_amount: number;
}

export interface SyncLineItem {
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
  line_discounts: SyncDiscount[];
  line_taxes: SyncTax[];
  line_modifiers: SyncLineModifier[];
}

export interface SyncLineModifier {
  id: string;
  modifier_option_id: string;
  name: string;
  option: string;
  price: number;
  money_amount: number;
}

export interface SyncPayment {
  payment_type_id: string;
  name: string;
  type: string;
  money_amount: number;
  paid_at: string;
  payment_details: unknown;
}

export interface ReceiptSource { getReceipts(query: { receiptDateMin: string; receiptDateMax: string; storeId?: string }): Promise<SyncReceipt[]>; }
