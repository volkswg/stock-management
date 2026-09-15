import type { IGoogleSheetsService } from "@/externals/google/sheet";

export type UpdateOrderItemProductCodeResult =
  | { outcome: "updated"; productCode: string; updatedAt: string }
  | { outcome: "not_found" };

export async function updateOrderItemProductCode({
  googleSheetsService,
  orderId,
  orderItemId,
  productCode,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  orderItemId: string;
  productCode: string;
}): Promise<UpdateOrderItemProductCodeResult> {
  const rows = await googleSheetsService.orderItems.readRows("A2:J");
  const rowIndex = rows.findIndex(
    ([id, linkedOrderId, , , , , , , deletedAt]) =>
      String(id ?? "").trim() === orderItemId &&
      String(linkedOrderId ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const createdAt = rows[rowIndex]?.[6] ?? "";
  const updatedAt = new Date().toISOString();
  const sheetRowNumber = rowIndex + 2;
  await googleSheetsService.orderItems.updateRows(
    `F${sheetRowNumber}:H${sheetRowNumber}`,
    [[productCode, createdAt, updatedAt]],
  );

  return { outcome: "updated", productCode, updatedAt };
}
