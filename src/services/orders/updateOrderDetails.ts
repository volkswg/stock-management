import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { OrderStatus } from "./createDraftOrder";

export type OrderDetailsUpdate = {
  status: OrderStatus;
  totalPrice: number | null;
  remark: string;
  updatedAt: string;
};

export type UpdateOrderDetailsResult =
  | { outcome: "updated"; order: OrderDetailsUpdate }
  | { outcome: "not_found" }
  | { outcome: "invalid_status" };

export async function updateOrderDetails({
  googleSheetsService,
  orderId,
  remark,
  totalPrice,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  remark?: string;
  totalPrice?: number;
}): Promise<UpdateOrderDetailsResult> {
  const rows = await googleSheetsService.orders.readRows("A2:I");
  const rowIndex = rows.findIndex(
    ([id, , , , , , , deletedAt]) =>
      String(id ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) {
    return { outcome: "not_found" };
  }

  const [
    ,
    currentStatus,
    seller,
    currentTotalPrice,
    currentRemark,
    createdAt,
    ,
    ,
    createdBy,
  ] = rows[rowIndex];
  const normalizedStatus = String(currentStatus ?? "").trim();
  if (!isOrderStatus(normalizedStatus)) {
    return { outcome: "invalid_status" };
  }

  const status =
    normalizedStatus === OrderStatus.WaitingForTotalPrice &&
    String(createdBy ?? "").trim() === "web" &&
    totalPrice !== undefined
      ? OrderStatus.Complete
      : normalizedStatus;
  const updatedTotalPrice =
    totalPrice === undefined ? toNumber(currentTotalPrice) : totalPrice;
  const updatedRemark =
    remark === undefined
      ? String(currentRemark ?? "").trim()
      : remark.trim();
  const updatedAt = new Date().toISOString();
  const sheetRowNumber = rowIndex + 2;

  await googleSheetsService.orders.updateRows(
    `B${sheetRowNumber}:G${sheetRowNumber}`,
    [
      [
        status,
        seller ?? "",
        updatedTotalPrice,
        updatedRemark,
        createdAt ?? "",
        updatedAt,
      ],
    ],
  );

  return {
    outcome: "updated",
    order: {
      status,
      totalPrice: updatedTotalPrice,
      remark: updatedRemark,
      updatedAt,
    },
  };
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}
