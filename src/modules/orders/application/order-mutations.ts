import { OrderStatus, OrderItemQuantityType } from "../contracts";
import type { UpdateOrderItemQuantityResult, UpdateOrderItemProductCodeResult, UpdateOrderDetailsResult, CompleteWebOrderPriceResult, OrderProductUpdate, UpdatedOrderProduct } from "../contracts";
import type { OrderMutationStore, OrderItemChange, OrderMutationRuntime } from "./ports/order-mutations";
export async function updateOrderItemQuantity({ store, orderId, orderItemId, quantity, quantityType, runtime, }: {
    store: OrderMutationStore;
    runtime: OrderMutationRuntime;
    orderId: string;
    orderItemId: string;
    quantity: number;
    quantityType: OrderItemQuantityType;
}): Promise<UpdateOrderItemQuantityResult> {
    const snapshot = await store.readItems();
    const target = snapshot.findActive(orderId, orderItemId);
    if (!target)
        return { outcome: "not_found" };
    const { quoteQuantity: currentQuoteQuantity, deliveredQuantity: currentDeliveredQuantity, productCode: currentProductCode, createdAt } = target.quantities();
    const normalizedQuantity = String(quantity);
    const updatedAt = runtime.now();
    await store.writeQuantities(target, () => ({ quoteQuantity: quantityType === OrderItemQuantityType.Quote ? normalizedQuantity : currentQuoteQuantity ?? "", deliveredQuantity: quantityType === OrderItemQuantityType.Delivered ? normalizedQuantity : currentDeliveredQuantity ?? "", productCode: currentProductCode ?? "", createdAt: createdAt ?? "", updatedAt }));
    return {
        outcome: "updated",
        quantity: normalizedQuantity,
        updatedAt,
    };
}
export async function updateOrderItemProductCode({ store, orderId, orderItemId, productCode, runtime, }: {
    store: OrderMutationStore;
    runtime: OrderMutationRuntime;
    orderId: string;
    orderItemId: string;
    productCode: string;
}): Promise<UpdateOrderItemProductCodeResult> {
    const snapshot = await store.readItems();
    const target = snapshot.findActive(orderId, orderItemId);
    if (!target)
        return { outcome: "not_found" };
    const createdAt = target.createdAt() ?? "";
    const updatedAt = runtime.now();
    await store.writeProductCode(target, productCode, createdAt, updatedAt);
    return { outcome: "updated", productCode, updatedAt };
}
export async function updateOrderDetails({ store, orderId, remark, totalPrice, runtime, }: {
    store: OrderMutationStore;
    runtime: OrderMutationRuntime;
    orderId: string;
    remark?: string;
    totalPrice?: number;
}): Promise<UpdateOrderDetailsResult> {
    const snapshot = await store.readOrders();
    const target = snapshot.findActive(orderId);
    if (!target)
        return { outcome: "not_found" };
    const { status: currentStatus, seller, totalPrice: currentTotalPrice, remark: currentRemark, createdAt, createdBy } = target.fields();
    const normalizedStatus = String(currentStatus ?? "").trim();
    if (!isOrderStatus(normalizedStatus)) {
        return { outcome: "invalid_status" };
    }
    const status = normalizedStatus === OrderStatus.WaitingForTotalPrice &&
        String(createdBy ?? "").trim() === "web" &&
        totalPrice !== undefined
        ? OrderStatus.Complete
        : normalizedStatus;
    const updatedTotalPrice = totalPrice === undefined ? toNumber(currentTotalPrice) : totalPrice;
    const updatedRemark = remark === undefined
        ? String(currentRemark ?? "").trim()
        : remark.trim();
    const updatedAt = runtime.now();
    await store.writeDetails(target, () => ({ status, seller: seller ?? "", totalPrice: updatedTotalPrice, remark: updatedRemark, createdAt: createdAt ?? "", updatedAt }));
    return {
        outcome: "updated",
        order: {
            status,
            totalPrice: updatedTotalPrice,
            remark: updatedRemark,
            updatedAt,
        },
    };
}
function isOrderStatus(value: string): value is OrderStatus {
    return Object.values(OrderStatus).includes(value as OrderStatus);
}
function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }
    const number = Number(value.replace(/,/g, ""));
    return Number.isFinite(number) ? number : null;
}
export async function completeWebOrderPrice({ store, orderId, totalPrice, runtime, }: {
    store: OrderMutationStore;
    runtime: OrderMutationRuntime;
    orderId: string;
    totalPrice: number;
}): Promise<CompleteWebOrderPriceResult> {
    const snapshot = await store.readOrders();
    const target = snapshot.findActive(orderId);
    if (!target)
        return { outcome: "not_found" };
    const { status, seller, remark, createdAt, createdBy } = target.fields();
    if (String(status ?? "").trim() !== OrderStatus.WaitingForTotalPrice ||
        String(createdBy ?? "").trim() !== "web") {
        return { outcome: "invalid_status" };
    }
    const updatedAt = runtime.now();
    await store.writeDetails(target, () => ({ status: OrderStatus.Complete, seller: seller ?? "", totalPrice, remark: remark ?? "", createdAt: createdAt ?? "", updatedAt }));
    return {
        outcome: "updated",
        status: OrderStatus.Complete,
        totalPrice,
        updatedAt,
    };
}
export async function updateOrderProducts({ store, orderId, items, runtime, }: {
    store: OrderMutationStore;
    runtime: OrderMutationRuntime;
    orderId: string;
    items: OrderProductUpdate[];
}): Promise<{
    outcome: "updated";
    items: UpdatedOrderProduct[];
} | {
    outcome: "not_found";
    itemId: string;
}> {
    const snapshot = await store.readItems();
    const ranges: OrderItemChange[] = [];
    const updatedItems: UpdatedOrderProduct[] = [];
    const updatedAt = runtime.now();
    // Resolve every product before writing so missing or foreign IDs save nothing.
    for (const item of items) {
        const target = snapshot.findActive(orderId, item.id);
        if (!target)
            return { outcome: "not_found", itemId: item.id };
        const updated: UpdatedOrderProduct = {
            id: item.id,
            productCode: item.productCode?.trim() ?? String(target.productCode ?? ""),
            quoteQuantity: item.quoteQuantity === undefined
                ? String(target.quoteQuantity ?? "") : String(item.quoteQuantity),
            deliveredQuantity: item.deliveredQuantity === undefined
                ? String(target.deliveredQuantity ?? "") : String(item.deliveredQuantity),
            updatedAt,
        };
        // Only write edited cells so unrelated concurrent edits are not overwritten.
        if (item.quoteQuantity !== undefined) {
            ranges.push({ target, field: "quoteQuantity", value: updated.quoteQuantity });
        }
        if (item.deliveredQuantity !== undefined) {
            ranges.push({ target, field: "deliveredQuantity", value: updated.deliveredQuantity });
        }
        if (item.productCode !== undefined) {
            ranges.push({ target, field: "productCode", value: updated.productCode });
        }
        ranges.push({ target, field: "updatedAt", value: updatedAt });
        updatedItems.push(updated);
    }
    await store.writeItemChanges(() => ranges);
    return { outcome: "updated", items: updatedItems };
}
export async function orderExists(store: OrderMutationStore, orderId: string): Promise<boolean> { return store.exists(orderId); }
export async function prepareOrderTransition(store: OrderMutationStore, orderId: string) { const transition = await store.findTransition(orderId); if (!transition)
    throw new Error(`Order not found: ${orderId}`); return transition; }
