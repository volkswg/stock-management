import "server-only";
import type { IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const";
import { ORDER_BILLS_SHEET_HEADERS } from "./order-bills/const";
import { ORDER_ITEMS_SHEET_HEADERS } from "./order-items/const";
import { ORDERS_SHEET_HEADERS } from "./orders/const";
import type { Order, OrderBill, OrderItem } from "../../contracts";
import type { OrderAttachmentStore } from "../../application/ports/order-attachments";
type AttachmentSheets = {
    orders: IGoogleRowsSheet;
    orderBills: IGoogleRowsSheet;
    orderItems: IGoogleRowsSheet;
};
export function createOrderAttachmentStore(service: AttachmentSheets): OrderAttachmentStore {
    return {
        nextBillId: () => getNextOrderBillRowNumber(service), nextItemId: () => getNextOrderItemRowNumber(service),
        appendBill: (value: OrderBill) => service.orderBills.appendRows(getOrderBillsAppendRange(), [
            [
                value.id,
                value.orderId,
                value.imageUrl,
                value.createdAt,
                value.updatedAt,
                value.deletedAt,
                value.createdBy,
            ],
        ]),
        appendItem: (value: OrderItem) => service.orderItems.appendRows(getOrderItemsAppendRange(), [
            [
                value.id,
                value.orderId,
                value.imageUrl,
                value.quoteQuantity,
                value.deliveredQuantity,
                value.productCode,
                value.createdAt,
                value.updatedAt,
                value.deletedAt,
                value.createdBy,
            ],
        ]),
        appendDraft: (value: Order) => service.orders.appendRows(getOrdersAppendRange(), [
            [
                value.id,
                value.status,
                value.seller,
                value.totalPrice,
                value.remark,
                value.createdAt,
                value.updatedAt,
                value.deletedAt,
                value.createdBy,
            ],
        ]),
    };
}
function getOrderBillsAppendRange(): string {
    return `A:${lastColumnLetter(ORDER_BILLS_SHEET_HEADERS.length - 1)}`;
}
async function getNextOrderBillRowNumber(googleSheetsService: AttachmentSheets): Promise<number> {
    const rows = await googleSheetsService.orderBills.readRows("A:A");
    return rows.length + 1;
}
function getOrderItemsAppendRange(): string {
    return `A:${lastColumnLetter(ORDER_ITEMS_SHEET_HEADERS.length - 1)}`;
}
async function getNextOrderItemRowNumber(googleSheetsService: AttachmentSheets): Promise<number> {
    const rows = await googleSheetsService.orderItems.readRows("A:A");
    return rows.length + 1;
}
function getOrdersAppendRange(): string {
    return `A:${lastColumnLetter(ORDERS_SHEET_HEADERS.length - 1)}`;
}
