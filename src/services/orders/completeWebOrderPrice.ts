import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";

export type CompleteWebOrderPriceResult =
  | {
      outcome: "updated";
      status: OrderStatus.Complete;
      totalPrice: number;
      updatedAt: string;
    }
  | { outcome: "not_found" }
  | { outcome: "invalid_status" };

export async function completeWebOrderPrice({
  googleSheetsService,
  orderId,
  totalPrice,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  totalPrice: number;
}): Promise<CompleteWebOrderPriceResult> {
  const rows = await googleSheetsService.orders.readRows("A2:I");
  const rowIndex = rows.findIndex(
    ([id, , , , , , , deletedAt]) =>
      String(id ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const [, status, seller, , remark, createdAt, , , createdBy] = rows[rowIndex];
  if (
    String(status ?? "").trim() !== OrderStatus.WaitingForTotalPrice ||
    String(createdBy ?? "").trim() !== "web"
  ) {
    return { outcome: "invalid_status" };
  }

  const updatedAt = new Date().toISOString();
  const sheetRowNumber = rowIndex + 2;
  await googleSheetsService.orders.updateRows(
    `B${sheetRowNumber}:G${sheetRowNumber}`,
    [
      [
        OrderStatus.Complete,
        seller ?? "",
        totalPrice,
        remark ?? "",
        createdAt ?? "",
        updatedAt,
      ],
    ],
  );

  return {
    outcome: "updated",
    status: OrderStatus.Complete,
    totalPrice,
    updatedAt,
  };
}
