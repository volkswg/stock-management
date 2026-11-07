import type { Order, OrderBill, OrderItem } from "../../contracts";
export interface OrderAttachmentStore {
    nextBillId(): Promise<number>;
    nextItemId(): Promise<number>;
    appendBill(value: OrderBill): Promise<void>;
    appendItem(value: OrderItem): Promise<void>;
    appendDraft(value: Order): Promise<void>;
}
export type OrderAttachmentRuntime = {
    now(): string;
    createId(): string;
};
