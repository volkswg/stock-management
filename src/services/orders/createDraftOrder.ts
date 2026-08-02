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
  const id = await getNextOrderRowNumber(googleSheetsService);
  const now = new Date().toISOString();
  const order: DraftOrder = {
    id: String(id),
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

async function getNextOrderRowNumber(
  googleSheetsService: IGoogleSheetsService,
): Promise<number> {
  const rows = await googleSheetsService.orders.readRows("A:A");
  return rows.length + 1;
}
