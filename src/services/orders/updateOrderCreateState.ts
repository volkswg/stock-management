import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";

export async function updateOrderCreateState({
  googleSheetsService,
  orderId,
  userStateId,
  userStateCreatedAt,
  state,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  userStateId: string;
  userStateCreatedAt: string;
  state: OrderStatus;
}): Promise<void> {
  const orderRowNumber = parseSheetRowNumber(orderId, "order");
  const userStateRowNumber = parseSheetRowNumber(userStateId, "user state");
  const now = new Date().toISOString();

  await googleSheetsService.orders.updateRows(`B${orderRowNumber}`, [[state]]);
  await googleSheetsService.orders.updateRows(`G${orderRowNumber}`, [[now]]);
  await googleSheetsService.userState.updateRows(
    `E${userStateRowNumber}:G${userStateRowNumber}`,
    [[state, userStateCreatedAt, now]],
  );
}

function parseSheetRowNumber(value: string, label: string): number {
  const rowNumber = Number(value);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error(`Invalid ${label} row number.`);
  }
  return rowNumber;
}
