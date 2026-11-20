import "server-only";
import type { OrderAttachmentStore } from "../../application/ports/order-attachments";
import type { Storage } from "./storage";
export function createOrderAttachmentStore(storage: Pick<Storage, "orders" | "orderItems" | "orderBills">): OrderAttachmentStore {
  return {
    nextBillId: () => storage.orderBills.reserveIdentifier(), nextItemId: () => storage.orderItems.reserveIdentifier(),
    appendBill: value => storage.orderBills.insert({ id: value.id, orderId: value.orderId, imageUrl: value.imageUrl, createdAt: value.createdAt, updatedAt: value.updatedAt, deletedAt: value.deletedAt, createdBy: value.createdBy }),
    appendItem: value => storage.orderItems.insert({ id: value.id, orderId: value.orderId, imageUrl: value.imageUrl, quoteQuantity: value.quoteQuantity, deliveredQuantity: value.deliveredQuantity, productCode: value.productCode, createdAt: value.createdAt, updatedAt: value.updatedAt, deletedAt: value.deletedAt, createdBy: value.createdBy }),
    appendDraft: value => storage.orders.insert({ id: value.id, status: value.status, seller: value.seller, totalPrice: value.totalPrice, remark: value.remark, createdAt: value.createdAt, updatedAt: value.updatedAt, deletedAt: value.deletedAt, createdBy: value.createdBy }),
  };
}
