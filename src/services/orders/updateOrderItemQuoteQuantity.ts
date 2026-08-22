import type { IGoogleSheetsService } from "@/externals/google/sheet";

export type UpdateOrderItemQuoteQuantityResult =
  | { outcome: "updated"; quoteQuantity: string; updatedAt: string }
  | { outcome: "not_found" };

export async function updateOrderItemQuoteQuantity({
  googleSheetsService,
  orderId,
  orderItemId,
  quoteQuantity,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  orderItemId: string;
  quoteQuantity: number;
}): Promise<UpdateOrderItemQuoteQuantityResult> {
  const rows = await googleSheetsService.orderItems.readRows("A2:H");
  const rowIndex = rows.findIndex(
    ([id, linkedOrderId, , , , , deletedAt]) =>
      String(id ?? "").trim() === orderItemId &&
      String(linkedOrderId ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const [, , , , createdAt] = rows[rowIndex];
  const normalizedQuoteQuantity = String(quoteQuantity);
  const updatedAt = new Date().toISOString();
  const sheetRowNumber = rowIndex + 2;
  await googleSheetsService.orderItems.updateRows(
    `D${sheetRowNumber}:F${sheetRowNumber}`,
    [[normalizedQuoteQuantity, createdAt ?? "", updatedAt]],
  );

  return {
    outcome: "updated",
    quoteQuantity: normalizedQuoteQuantity,
    updatedAt,
  };
}
