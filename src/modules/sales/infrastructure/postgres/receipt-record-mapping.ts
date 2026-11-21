// Keep full provider receipts through pagination/conflict validation. Persist
// only the used report values, stable identities and synchronization metadata.
import type { SyncReceipt as LoyverseReceipt } from "../../application/ports/receipt-source";

export function salesReceiptToRecord({
  accountId,
  id,
  receipt,
  salesDate,
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
    receiptNumber: receipt.receipt_number,
    receiptType: receipt.receipt_type,
    receiptDate: receipt.receipt_date,
    createdAt: receipt.created_at,
    updatedAt: receipt.updated_at,
    cancelledAt: receipt.cancelled_at || "",
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
    itemId: item.item_id || "",
    variantId: item.variant_id || "",
    itemName: item.item_name || "",
    variantName: item.variant_name || "",
    sku: item.sku || "",
    quantity: String(item.quantity ?? 0),
    grossTotalMoney: String(item.gross_total_money ?? 0),
    totalDiscount: String(item.total_discount ?? 0),
    costTotal: String(item.cost_total ?? 0),
    taxes: String(taxes),
    syncedAt: syncedAt,
  };
}

export function salesReceiptPaymentToRecord({
  id,
  payment,
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
    paymentTypeId: payment.payment_type_id || "",
    paymentName: payment.name || "",
    paymentType: payment.type || "",
    moneyAmount: String(payment.money_amount ?? 0),
    syncedAt: syncedAt,
  };
}
