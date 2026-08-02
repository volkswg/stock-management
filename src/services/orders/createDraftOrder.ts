import crypto from "node:crypto";
import {
  lastColumnLetter,
  ORDERS_SHEET_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type DraftOrder = {
  id: string;
  status: "draft";
  seller: string;
  totalPrice: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
  remark: string;
};

export async function createDraftOrder({
  googleSheetsService,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  createdBy: string;
}): Promise<DraftOrder> {
  const now = new Date().toISOString();
  const order: DraftOrder = {
    id: crypto.randomUUID(),
    status: "draft",
    seller: "",
    totalPrice: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
    remark: "",
  };

  await googleSheetsService.orders.appendRows(getOrdersAppendRange(), [
    [
      order.id,
      order.status,
      order.seller,
      order.totalPrice,
      order.createdAt,
      order.updatedAt,
      order.deletedAt,
      order.createdBy,
      order.remark,
    ],
  ]);

  return order;
}

function getOrdersAppendRange(): string {
  return `A:${lastColumnLetter(ORDERS_SHEET_HEADERS.length - 1)}`;
}
