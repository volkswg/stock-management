import "server-only";
import type { IGoogleRowsSheet, IGoogleBatchRowsSheet, GoogleSheetRangeUpdate, GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types";
import type { OrderMutationStore, OrderItemReference, OrderRecordReference, OrderItemChange } from "../../application/ports/order-mutations";
type MutationSheets = {
    orderItems: IGoogleBatchRowsSheet;
    orders: IGoogleRowsSheet;
};
export function createOrderMutationStore(service: MutationSheets): OrderMutationStore & {
    findOrderRowNumber(orderId: string): Promise<number>;
} {
    const itemLocations = new WeakMap<OrderItemReference, number>(), orderLocations = new WeakMap<OrderRecordReference, number>();
    function quantityValues(value: ReturnType<Parameters<OrderMutationStore['writeQuantities']>[1]>): GoogleSheetRow { return [value.quoteQuantity, value.deliveredQuantity, value.productCode, value.createdAt, value.updatedAt]; }
    function detailsValues(value: ReturnType<Parameters<OrderMutationStore['writeDetails']>[1]>): GoogleSheetRow { return [value.status, value.seller, value.totalPrice, value.remark, value.createdAt, value.updatedAt]; }
    function itemNumber(target: OrderItemReference) { return itemLocations.get(target)!; }
    function changes(values: OrderItemChange[]): GoogleSheetRangeUpdate[] { const columns = { quoteQuantity: 'D', deliveredQuantity: 'E', productCode: 'F', updatedAt: 'H', imageUrl: 'C' }; return values.map(v => ({ range: `${columns[v.field]}${itemNumber(v.target)}`, values: [[v.value]] })); }
    async function findOrderRowNumber(orderId: string): Promise<number> {
        const rows = await service.orders.readRows("A2:A");
        const rowIndex = rows.findIndex(([id]) => String(id ?? "") === orderId);
        if (rowIndex === -1)
            throw new Error(`Order not found: ${orderId}`);
        return rowIndex + 2;
    }
    return {
        findOrderRowNumber,
        async readItems() {
            const rows = await service.orderItems.readRows("A2:J");
            return { findActive(orderId, itemId) {
                    const rowIndex = rows.findIndex(([id, linkedOrderId, , , , , , , deletedAt]) => String(id ?? "").trim() === itemId && String(linkedOrderId ?? "").trim() === orderId && !String(deletedAt ?? "").trim());
                    if (rowIndex === -1)
                        return undefined;
                    const target: OrderItemReference = { get productCode() { return rows[rowIndex][5]; }, get quoteQuantity() { return rows[rowIndex][3]; }, get deliveredQuantity() { return rows[rowIndex][4]; }, createdAt: () => rows[rowIndex]?.[6], quantities() { const [, , , quoteQuantity, deliveredQuantity, productCode, createdAt] = rows[rowIndex]; return { quoteQuantity, deliveredQuantity, productCode, createdAt }; } };
                    itemLocations.set(target, rowIndex + 2);
                    return target;
                } };
        },
        writeQuantities: (target, readValue) => service.orderItems.updateRows(`D${itemNumber(target)}:H${itemNumber(target)}`, [quantityValues(readValue())]),
        writeProductCode: (target, productCode, createdAt, updatedAt) => service.orderItems.updateRows(`F${itemNumber(target)}:H${itemNumber(target)}`, [[productCode, createdAt, updatedAt]]),
        writeItemChanges: readChanges => service.orderItems.batchUpdateRows(changes(readChanges())),
        async readOrders() {
            const rows = await service.orders.readRows("A2:I");
            return { findActive(orderId) {
                    const rowIndex = rows.findIndex(([id, , , , , , , deletedAt]) => String(id ?? "").trim() === orderId && !String(deletedAt ?? "").trim());
                    if (rowIndex === -1)
                        return undefined;
                    const target: OrderRecordReference = { fields() { const [, status, seller, totalPrice, remark, createdAt, , , createdBy] = rows[rowIndex]; return { status, seller, totalPrice, remark, createdAt, createdBy }; } };
                    orderLocations.set(target, rowIndex + 2);
                    return target;
                } };
        },
        writeDetails: (target, readValue) => service.orders.updateRows(`B${orderLocations.get(target)!}:G${orderLocations.get(target)!}`, [detailsValues(readValue())]),
        async exists(orderId) { const rows = await service.orders.readRows("A2:A"); return rows.some(([id]) => String(id ?? "").trim() === orderId); },
        async findTransition(orderId) { const row = await findOrderRowNumber(orderId); return { status: state => service.orders.updateRows(`B${row}`, [[state]]), touch: now => service.orders.updateRows(`G${row}`, [[now]]), price: value => service.orders.updateRows(`D${row}`, [[value]]) }; }
    };
}
