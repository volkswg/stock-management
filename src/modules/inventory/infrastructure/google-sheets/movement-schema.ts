import type { IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";

export const MASTER_HEADERS = [
  "id", "userId", "packingDate", "deliverDateTime", "status",
  "totalQuantity", "createdAt", "updatedAt",
];

export const DETAIL_HEADERS = [
  "id", "movementMasterId", "shopName", "quantity", "remark",
  "fromLocation", "toLocation", "productImageUrl", "purchaseDetailId",
  "status", "createdAt", "updatedAt", "stockCounted", "isNewArrival",
];

export async function ensureHeader(sheet: IGoogleRowsSheet, headers: string[], end: string): Promise<void> {
  await sheet.ensureExists?.();
  const rows = await sheet.readRows(`A1:${end}1`);
  if (JSON.stringify(rows[0] || []) !== JSON.stringify(headers)) {
    await sheet.updateRows(`A1:${end}1`, [headers]);
  }
}
