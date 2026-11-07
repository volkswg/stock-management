export function createSalesReceiptId(
  accountId: string,
  receiptNumber: string,
): string {
  return `RECEIPT-${toSafeIdPart(accountId)}-${toSafeIdPart(receiptNumber)}`;
}

export function createSalesReceiptSyncId(
  accountId: string,
  salesDate: string,
): string {
  return `RECEIPT-SYNC-${toSafeIdPart(accountId)}-${salesDate.replace(/-/g, "")}`;
}

export function createSalesReceiptItemId(
  receiptId: string,
  lineItemId: string,
  index: number,
): string {
  return `RECEIPT-ITEM-${toSafeIdPart(receiptId)}-${toSafeIdPart(lineItemId || String(index))}`;
}

export function createSalesReceiptPaymentId(
  receiptId: string,
  index: number,
): string {
  return `RECEIPT-PAYMENT-${toSafeIdPart(receiptId)}-${index}`;
}

function toSafeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
}
