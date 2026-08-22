import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderItemQuantityType } from "./OrderItemQuantityType";

export type UpdateOrderItemQuantityResult =
  | { outcome: "updated"; quantity: string; updatedAt: string }
  | { outcome: "not_found" };

export async function updateOrderItemQuantity({
  googleSheetsService,
  orderId,
  orderItemId,
  quantity,
  quantityType,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  orderItemId: string;
  quantity: number;
  quantityType: OrderItemQuantityType;
}): Promise<UpdateOrderItemQuantityResult> {
  const rows = await googleSheetsService.orderItems.readRows("A2:I");
  const rowIndex = rows.findIndex(
    ([id, linkedOrderId, , , , , , deletedAt]) =>
      String(id ?? "").trim() === orderItemId &&
      String(linkedOrderId ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const [, , , currentQuoteQuantity, currentDeliveredQuantity, createdAt] =
    rows[rowIndex];
  const normalizedQuantity = String(quantity);
  const updatedAt = new Date().toISOString();
  const sheetRowNumber = rowIndex + 2;
  await googleSheetsService.orderItems.updateRows(
    `D${sheetRowNumber}:G${sheetRowNumber}`,
    [
      [
        quantityType === OrderItemQuantityType.Quote
          ? normalizedQuantity
          : currentQuoteQuantity ?? "",
        quantityType === OrderItemQuantityType.Delivered
          ? normalizedQuantity
          : currentDeliveredQuantity ?? "",
        createdAt ?? "",
        updatedAt,
      ],
    ],
  );

  return {
    outcome: "updated",
    quantity: normalizedQuantity,
    updatedAt,
  };
}
