import type { LoyverseReceipt } from "@/externals/loyverse";

export function salesReceiptToRow({
  accountId,
  id,
  receipt,
  salesDate,
  shopName,
  syncedAt,
}: {
  accountId: string;
  id: string;
  receipt: LoyverseReceipt;
  salesDate: string;
  shopName: string;
  syncedAt: string;
}): string[] {
  return [
    id,
    salesDate,
    accountId,
    shopName,
    receipt.receipt_number,
    receipt.receipt_type,
    receipt.refund_for || "",
    receipt.order || "",
    receipt.receipt_date,
    receipt.created_at,
    receipt.updated_at,
    receipt.cancelled_at || "",
    receipt.source || "",
    receipt.store_id || "",
    receipt.employee_id || "",
    receipt.customer_id || "",
    receipt.pos_device_id || "",
    receipt.dining_option || "",
    String(receipt.total_money ?? 0),
    String(receipt.total_tax ?? 0),
    String(receipt.total_discount ?? 0),
    String(receipt.tip ?? 0),
    String(receipt.surcharge ?? 0),
    String(receipt.points_earned ?? 0),
    String(receipt.points_deducted ?? 0),
    syncedAt,
  ];
}

export function salesReceiptItemToRow({
  id,
  item,
  receiptId,
  syncedAt,
}: {
  id: string;
  item: LoyverseReceipt["line_items"][number];
  receiptId: string;
  syncedAt: string;
}): string[] {
  const taxes = (item.line_taxes || []).reduce(
    (sum, tax) => sum + (tax.money_amount || 0),
    0,
  );

  return [
    id,
    receiptId,
    item.id || "",
    item.item_id || "",
    item.variant_id || "",
    item.item_name || "",
    item.variant_name || "",
    item.sku || "",
    String(item.quantity ?? 0),
    String(item.price ?? 0),
    String(item.gross_total_money ?? 0),
    String(item.total_discount ?? 0),
    String(item.total_money ?? 0),
    String(item.cost ?? 0),
    String(item.cost_total ?? 0),
    String(taxes),
    item.line_note || "",
    JSON.stringify(item.line_discounts || []),
    JSON.stringify(item.line_taxes || []),
    JSON.stringify(item.line_modifiers || []),
    syncedAt,
  ];
}

export function salesReceiptPaymentToRow({
  id,
  payment,
  paymentIndex,
  receiptId,
  syncedAt,
}: {
  id: string;
  payment: LoyverseReceipt["payments"][number];
  paymentIndex: number;
  receiptId: string;
  syncedAt: string;
}): string[] {
  return [
    id,
    receiptId,
    String(paymentIndex),
    payment.payment_type_id || "",
    payment.name || "",
    payment.type || "",
    String(payment.money_amount ?? 0),
    payment.paid_at || "",
    JSON.stringify(payment.payment_details ?? null),
    syncedAt,
  ];
}
