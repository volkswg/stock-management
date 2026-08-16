import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";

export async function completeOrderTotalPrice({
  googleSheetsService,
  orderId,
  userStateId,
  totalPrice,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  userStateId: string;
  totalPrice: string;
}): Promise<void> {
  const orderRowNumber = parseSheetRowNumber(orderId, "order");
  const userStateRowNumber = parseSheetRowNumber(userStateId, "user state");
  const now = new Date().toISOString();

  await googleSheetsService.orders.updateRows(`D${orderRowNumber}`, [
    [totalPrice],
  ]);
  await googleSheetsService.orders.updateRows(`B${orderRowNumber}`, [
    [OrderStatus.Complete],
  ]);
  await googleSheetsService.orders.updateRows(`G${orderRowNumber}`, [[now]]);
  await googleSheetsService.userState.updateRows(
    `A${userStateRowNumber}:G${userStateRowNumber}`,
    [["", "", "", "", "", "", ""]],
  );
}

function parseSheetRowNumber(value: string, label: string): number {
  const rowNumber = Number(value);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error(`Invalid ${label} row number.`);
  }
  return rowNumber;
}
