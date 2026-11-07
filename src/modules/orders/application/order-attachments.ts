import { OrderStatus } from "../contracts";
import type { Order, OrderBill, OrderItem } from "../contracts";
import type { OrderAttachmentStore, OrderAttachmentRuntime } from "./ports/order-attachments";
export async function createOrderBill({ store, orderId, imageUrl, createdBy, runtime, }: {
    store: OrderAttachmentStore;
    runtime: OrderAttachmentRuntime;
    orderId: string;
    imageUrl: string;
    createdBy: string;
}): Promise<OrderBill> {
    const id = await store.nextBillId();
    const now = runtime.now();
    const orderBill: OrderBill = {
        id: String(id),
        orderId,
        imageUrl,
        createdAt: now,
        updatedAt: now,
        deletedAt: "",
        createdBy,
    };
    await store.appendBill(orderBill);
    return orderBill;
}
export async function createOrderItem({ store, orderId, imageUrl, quoteQuantity = "", deliveredQuantity = "", productCode = "", createdBy, runtime, }: {
    store: OrderAttachmentStore;
    runtime: OrderAttachmentRuntime;
    orderId: string;
    imageUrl: string;
    quoteQuantity?: string;
    deliveredQuantity?: string;
    productCode?: string;
    createdBy: string;
}): Promise<OrderItem> {
    const id = await store.nextItemId();
    const now = runtime.now();
    const orderItem: OrderItem = {
        id: String(id),
        orderId,
        imageUrl,
        quoteQuantity,
        deliveredQuantity,
        productCode,
        createdAt: now,
        updatedAt: now,
        deletedAt: "",
        createdBy,
    };
    await store.appendItem(orderItem);
    return orderItem;
}
export async function createDraftRecord({ store, createdBy, runtime, }: {
    store: OrderAttachmentStore;
    runtime: OrderAttachmentRuntime;
    createdBy: string;
}): Promise<Order> {
    const id = runtime.createId();
    const now = runtime.now();
    const order: Order = {
        id,
        status: OrderStatus.WaitingForBillImage,
        seller: "",
        totalPrice: "",
        createdAt: now,
        updatedAt: now,
        deletedAt: "",
        createdBy,
        remark: "",
    };
    await store.appendDraft(order);
    return order;
}
