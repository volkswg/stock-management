import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";
import { updateOrderCreateState } from "./updateOrderCreateState";

export async function completeOrderTotalPrice({
  googleSheetsService,
  orderId,
  userStateId,
  userStateCreatedAt,
  totalPrice,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  userStateId: string;
  userStateCreatedAt: string;
  totalPrice: string;
}): Promise<void> {
  const orderRowNumber = parseSheetRowNumber(orderId);

  await googleSheetsService.orders.updateRows(`D${orderRowNumber}`, [
    [totalPrice],
  ]);
  await updateOrderCreateState({
    googleSheetsService,
    orderId,
    userStateId,
    userStateCreatedAt,
    state: OrderStatus.Paid,
  });
}

function parseSheetRowNumber(value: string): number {
  const rowNumber = Number(value);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Invalid order row number.");
  }
  return rowNumber;
}
