import type { OrderStatus } from "../../contracts";
export type OrderValue = string | number | boolean | null | undefined;
export interface OrderItemReference {
    readonly productCode: OrderValue;
    readonly quoteQuantity: OrderValue;
    readonly deliveredQuantity: OrderValue;
    createdAt(): OrderValue;
    quantities(): {
        quoteQuantity: OrderValue;
        deliveredQuantity: OrderValue;
        productCode: OrderValue;
        createdAt: OrderValue;
    };
}
export type OrderItemChange = {
    target: OrderItemReference;
    field: 'quoteQuantity' | 'deliveredQuantity' | 'productCode' | 'updatedAt' | 'imageUrl';
    value: string;
};
export type StoredOrderValue = Exclude<OrderValue, undefined>;
export interface OrderItemMutationStore {
    readItems(): Promise<{
        findActive(orderId: string, itemId: string): OrderItemReference | undefined;
    }>;
    writeQuantities(target: OrderItemReference, readValue: () => {
        quoteQuantity: StoredOrderValue;
        deliveredQuantity: StoredOrderValue;
        productCode: StoredOrderValue;
        createdAt: StoredOrderValue;
        updatedAt: string;
    }): Promise<void>;
    writeProductCode(target: OrderItemReference, productCode: string, createdAt: StoredOrderValue, updatedAt: string): Promise<void>;
    writeItemChanges(readChanges: () => OrderItemChange[]): Promise<void>;
}
export interface OrderRecordReference {
    fields(): {
        status: OrderValue;
        seller: OrderValue;
        totalPrice: OrderValue;
        remark: OrderValue;
        createdAt: OrderValue;
        createdBy: OrderValue;
    };
}
export interface OrderTransition {
    status(state: OrderStatus): Promise<void>;
    touch(now: string): Promise<void>;
    price(value: string): Promise<void>;
}
export interface OrderMutationStore extends OrderItemMutationStore {
    readOrders(): Promise<{
        findActive(orderId: string): OrderRecordReference | undefined;
    }>;
    writeDetails(target: OrderRecordReference, readValue: () => {
        status: OrderStatus;
        seller: StoredOrderValue;
        totalPrice: number | null;
        remark: StoredOrderValue;
        createdAt: StoredOrderValue;
        updatedAt: string;
    }): Promise<void>;
    exists(orderId: string): Promise<boolean>;
    findTransition(orderId: string): Promise<OrderTransition | undefined>;
}
export type OrderMutationRuntime = {
    now(): string;
};
