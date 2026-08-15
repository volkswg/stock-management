import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";

export async function completeOrderBill({
  googleSheetsService,
  orderId,
  userStateId,
  userStateCreatedAt,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  userStateId: string;
  userStateCreatedAt: string;
}): Promise<void> {
  const orderRowNumber = parseSheetRowNumber(orderId, "order");
  const userStateRowNumber = parseSheetRowNumber(userStateId, "user state");
  const now = new Date().toISOString();

  await googleSheetsService.orders.updateRows(`B${orderRowNumber}`, [
    [OrderStatus.WaitingForProductImage],
  ]);
  await googleSheetsService.orders.updateRows(`G${orderRowNumber}`, [[now]]);
  await googleSheetsService.userState.updateRows(
    `E${userStateRowNumber}:G${userStateRowNumber}`,
    [
      [
        OrderStatus.WaitingForProductImage,
        userStateCreatedAt,
        now,
      ],
    ],
  );
}

function parseSheetRowNumber(value: string, label: string): number {
  const rowNumber = Number(value);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error(`Invalid ${label} row number.`);
  }
  return rowNumber;
}
