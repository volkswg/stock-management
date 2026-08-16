import {
  lastColumnLetter,
  ORDER_ITEMS_SHEET_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";

export type OrderItem = {
  id: string;
  orderId: string;
  imageUrl: string;
  quoteQuantity: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export async function createOrderItem({
  googleSheetsService,
  orderId,
  imageUrl,
  quoteQuantity = "",
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  imageUrl: string;
  quoteQuantity?: string;
  createdBy: string;
}): Promise<OrderItem> {
  const id = await getNextOrderItemRowNumber(googleSheetsService);
  const now = new Date().toISOString();
  const orderItem: OrderItem = {
    id: String(id),
    orderId,
    imageUrl,
    quoteQuantity,
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await googleSheetsService.orderItems.appendRows(getOrderItemsAppendRange(), [
    [
      orderItem.id,
      orderItem.orderId,
      orderItem.imageUrl,
      orderItem.quoteQuantity,
      orderItem.createdAt,
      orderItem.updatedAt,
      orderItem.deletedAt,
      orderItem.createdBy,
    ],
  ]);

  return orderItem;
}

function getOrderItemsAppendRange(): string {
  return `A:${lastColumnLetter(ORDER_ITEMS_SHEET_HEADERS.length - 1)}`;
}

async function getNextOrderItemRowNumber(
  googleSheetsService: IGoogleSheetsService,
): Promise<number> {
  const rows = await googleSheetsService.orderItems.readRows("A:A");
  return rows.length + 1;
}
