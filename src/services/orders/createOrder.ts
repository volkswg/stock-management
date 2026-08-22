import {
  lastColumnLetter,
  ORDERS_SHEET_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { createSortableId } from "../utils/createSortableId";
import { OrderStatus } from "./createDraftOrder";

export type CreatedOrder = {
  id: string;
  status: OrderStatus.Draft;
  seller: string;
  totalPrice: number | null;
  remark: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export async function createOrder({
  googleSheetsService,
  seller,
  totalPrice,
  remark,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
  createdBy: string;
}): Promise<CreatedOrder> {
  const now = new Date().toISOString();
  const order: CreatedOrder = {
    id: createSortableId(),
    status: OrderStatus.Draft,
    seller: seller?.trim() || "",
    totalPrice: totalPrice ?? null,
    remark: remark?.trim() || "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await googleSheetsService.orders.appendRows(getOrdersAppendRange(), [
    [
      order.id,
      order.status,
      order.seller,
      order.totalPrice,
      order.remark,
      order.createdAt,
      order.updatedAt,
      order.deletedAt,
      order.createdBy,
    ],
  ]);

  return order;
}

function getOrdersAppendRange(): string {
  return `A:${lastColumnLetter(ORDERS_SHEET_HEADERS.length - 1)}`;
}
