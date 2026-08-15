import {
  lastColumnLetter,
  ORDER_BILLS_SHEET_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type OrderBill = {
  id: string;
  orderId: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export async function createOrderBill({
  googleSheetsService,
  orderId,
  imageUrl,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  imageUrl: string;
  createdBy: string;
}): Promise<OrderBill> {
  const id = await getNextOrderBillRowNumber(googleSheetsService);
  const now = new Date().toISOString();
  const orderBill: OrderBill = {
    id: String(id),
    orderId,
    imageUrl,
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await googleSheetsService.orderBills.appendRows(getOrderBillsAppendRange(), [
    [
      orderBill.id,
      orderBill.orderId,
      orderBill.imageUrl,
      orderBill.createdAt,
      orderBill.updatedAt,
      orderBill.deletedAt,
      orderBill.createdBy,
    ],
  ]);

  return orderBill;
}

function getOrderBillsAppendRange(): string {
  return `A:${lastColumnLetter(ORDER_BILLS_SHEET_HEADERS.length - 1)}`;
}

async function getNextOrderBillRowNumber(
  googleSheetsService: IGoogleSheetsService,
): Promise<number> {
  const rows = await googleSheetsService.orderBills.readRows("A:A");
  return rows.length + 1;
}
