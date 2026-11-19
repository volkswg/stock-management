import "server-only";
import type { OrderMutationStore, OrderItemReference, OrderRecordReference } from "../../application/ports/order-mutations";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
export function createOrderMutationStore(storage: Pick<Storage, "orders" | "orderItems">): OrderMutationStore {
  const items = new WeakMap<OrderItemReference, NativeRecord>();
  const orders = new WeakMap<OrderRecordReference, NativeRecord>();
  return {
    async readItems() {
      const records = await storage.orderItems.all();
      return { findActive(orderId, itemId) {
        const record = records.find(r => String(r.id).trim() === itemId && String(r.orderId).trim() === orderId);
        if (!record) return undefined;
        const target: OrderItemReference = { get productCode() { return record.productCode; }, get quoteQuantity() { return record.quoteQuantity; }, get deliveredQuantity() { return record.deliveredQuantity; }, createdAt: () => record.createdAt, quantities: () => ({ quoteQuantity: record.quoteQuantity, deliveredQuantity: record.deliveredQuantity, productCode: record.productCode, createdAt: record.createdAt }) };
        items.set(target, record); return target;
      } };
    },
    writeQuantities: (target, read) => storage.orderItems.update(items.get(target)!, read()),
    writeProductCode: (target, productCode, createdAt, updatedAt) => storage.orderItems.update(items.get(target)!, { productCode, createdAt, updatedAt }),
    async writeItemChanges(read) { for (const change of read()) await storage.orderItems.update(items.get(change.target)!, { [change.field]: change.value }); },
    async readOrders() {
      const records = await storage.orders.all();
      return { findActive(orderId) {
        const record = records.find(r => String(r.id).trim() === orderId);
        if (!record) return undefined;
        const target: OrderRecordReference = { fields: () => ({ status: record.status, seller: record.seller, totalPrice: record.totalPrice, remark: record.remark, createdAt: record.createdAt, createdBy: record.createdBy }) };
        orders.set(target, record); return target;
      } };
    },
    writeDetails: (target, read) => storage.orders.update(orders.get(target)!, read()),
    async exists(id) { return (await storage.orders.all()).some(record => String(record.id).trim() === id); },
    async findTransition(id) {
      const record = await storage.orders.find(id);
      if (!record) throw new Error(`Order not found: ${id}`);
      return { status: status => storage.orders.update(record, { status }), touch: updatedAt => storage.orders.update(record, { updatedAt }), price: totalPrice => storage.orders.update(record, { totalPrice }) };
    },
  };
}
