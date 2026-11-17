import "server-only";
import { updateRecord } from "@/infrastructure/persistence/google-sheets/record-reference";
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
    const itemRows = new WeakMap<OrderItemReference, GoogleSheetRow>(), orderRows = new WeakMap<OrderRecordReference, GoogleSheetRow>();
    function quantityValues(value: ReturnType<Parameters<OrderMutationStore['writeQuantities']>[1]>): GoogleSheetRow { return [value.quoteQuantity, value.deliveredQuantity, value.productCode, value.createdAt, value.updatedAt]; }
    function detailsValues(value: ReturnType<Parameters<OrderMutationStore['writeDetails']>[1]>): GoogleSheetRow { return [value.status, value.seller, value.totalPrice, value.remark, value.createdAt, value.updatedAt]; }
    function itemNumber(target: OrderItemReference) { return itemLocations.get(target)!; }
    function changes(values: OrderItemChange[]): GoogleSheetRangeUpdate[] { const columns = { quoteQuantity: 'D', deliveredQuantity: 'E', productCode: 'F', updatedAt: 'H', imageUrl: 'C' }; return values.map(v => ({ range: `${columns[v.field]}${itemNumber(v.target)}`, values: [[v.value]] })); }
    async function findOrderRowNumber(orderId: string): Promise<number> {
        if (service.orders.referenceId) throw new Error("Positional order references are unavailable for PostgreSQL.");
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
                    itemLocations.set(target, rowIndex + 2); itemRows.set(target, rows[rowIndex]);
                    return target;
                } };
        },
        writeQuantities: (target, readValue) => updateRecord(service.orderItems, itemRows.get(target)!, `D${itemNumber(target)}:H${itemNumber(target)}`, [quantityValues(readValue())]),
        writeProductCode: (target, productCode, createdAt, updatedAt) => updateRecord(service.orderItems, itemRows.get(target)!, `F${itemNumber(target)}:H${itemNumber(target)}`, [[productCode, createdAt, updatedAt]]),
        writeItemChanges: readChanges => {
            if (!service.orderItems.referenceRow) return service.orderItems.batchUpdateRows(changes(readChanges()));
            const values = readChanges(), updates = changes(values);
            return (async () => { for (const [i, update] of updates.entries()) await updateRecord(service.orderItems, itemRows.get(values[i].target)!, update.range, update.values); })();
        },
        async readOrders() {
            const rows = await service.orders.readRows("A2:I");
            return { findActive(orderId) {
                    const rowIndex = rows.findIndex(([id, , , , , , , deletedAt]) => String(id ?? "").trim() === orderId && !String(deletedAt ?? "").trim());
                    if (rowIndex === -1)
                        return undefined;
                    const target: OrderRecordReference = { fields() { const [, status, seller, totalPrice, remark, createdAt, , , createdBy] = rows[rowIndex]; return { status, seller, totalPrice, remark, createdAt, createdBy }; } };
                    orderLocations.set(target, rowIndex + 2); orderRows.set(target, rows[rowIndex]);
                    return target;
                } };
        },
        writeDetails: (target, readValue) => updateRecord(service.orders, orderRows.get(target)!, `B${orderLocations.get(target)!}:G${orderLocations.get(target)!}`, [detailsValues(readValue())]),
        async exists(orderId) { const rows = await service.orders.readRows("A2:A"); return rows.some(([id]) => String(id ?? "").trim() === orderId); },
        async findTransition(orderId) {
            if (service.orders.referenceId) {
                const target = await service.orders.referenceId(orderId);
                if (!target) throw new Error(`Order not found: ${orderId}`);
                return {status: state => target.update("B", [state]), touch: now => target.update("G", [now]), price: value => target.update("D", [value])};
            }
            const row = await findOrderRowNumber(orderId); return { status: state => service.orders.updateRows(`B${row}`, [[state]]), touch: now => service.orders.updateRows(`G${row}`, [[now]]), price: value => service.orders.updateRows(`D${row}`, [[value]]) }; }
    };
}
