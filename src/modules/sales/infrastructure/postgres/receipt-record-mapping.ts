import type { SyncReceipt as LoyverseReceipt } from "../../application/ports/receipt-source";

export function salesReceiptToRecord({
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
}) {
  return {
    id: id,
    salesDate: salesDate,
    accountId: accountId,
    shopName: shopName,
    receiptNumber: receipt.receipt_number,
    receiptType: receipt.receipt_type,
    refundFor: receipt.refund_for || "",
    order: receipt.order || "",
    receiptDate: receipt.receipt_date,
    createdAt: receipt.created_at,
    updatedAt: receipt.updated_at,
    cancelledAt: receipt.cancelled_at || "",
    source: receipt.source || "",
    storeId: receipt.store_id || "",
    employeeId: receipt.employee_id || "",
    customerId: receipt.customer_id || "",
    posDeviceId: receipt.pos_device_id || "",
    diningOption: receipt.dining_option || "",
    totalMoney: String(receipt.total_money ?? 0),
    totalTax: String(receipt.total_tax ?? 0),
    totalDiscount: String(receipt.total_discount ?? 0),
    tip: String(receipt.tip ?? 0),
    surcharge: String(receipt.surcharge ?? 0),
    pointsEarned: String(receipt.points_earned ?? 0),
    pointsDeducted: String(receipt.points_deducted ?? 0),
    syncedAt: syncedAt,
  };
}

export function salesReceiptItemToRecord({
  id,
  item,
  receiptId,
  syncedAt,
}: {
  id: string;
  item: LoyverseReceipt["line_items"][number];
  receiptId: string;
  syncedAt: string;
}) {
  const taxes = (item.line_taxes || []).reduce(
    (sum, tax) => sum + (tax.money_amount || 0),
    0,
  );

  return {
    id: id,
    receiptId: receiptId,
    lineItemId: item.id || "",
    itemId: item.item_id || "",
    variantId: item.variant_id || "",
    itemName: item.item_name || "",
    variantName: item.variant_name || "",
    sku: item.sku || "",
    quantity: String(item.quantity ?? 0),
    price: String(item.price ?? 0),
    grossTotalMoney: String(item.gross_total_money ?? 0),
    totalDiscount: String(item.total_discount ?? 0),
    totalMoney: String(item.total_money ?? 0),
    cost: String(item.cost ?? 0),
    costTotal: String(item.cost_total ?? 0),
    taxes: String(taxes),
    lineNote: item.line_note || "",
    lineDiscountsJson: JSON.stringify(item.line_discounts || []),
    lineTaxesJson: JSON.stringify(item.line_taxes || []),
    lineModifiersJson: JSON.stringify(item.line_modifiers || []),
    syncedAt: syncedAt,
  };
}

export function salesReceiptPaymentToRecord({
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
}) {
  return {
    id: id,
    receiptId: receiptId,
    paymentIndex: String(paymentIndex),
    paymentTypeId: payment.payment_type_id || "",
    paymentName: payment.name || "",
    paymentType: payment.type || "",
    moneyAmount: String(payment.money_amount ?? 0),
    paidAt: payment.paid_at || "",
    paymentDetailsJson: JSON.stringify(payment.payment_details ?? null),
    syncedAt: syncedAt,
  };
}
