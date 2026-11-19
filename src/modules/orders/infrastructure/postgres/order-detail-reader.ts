import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
import type { OrderProductImage, OrderBillImage } from "../../contracts";
import type { OrderDetailReader, OrderDetailOrders, OrderDetailProducts, OrderDetailBills } from "../../application/ports/order-detail-reader";
import { mapOrderRow, mapOrderProductImageRow, toStringValue } from "./order-row-mapping";

export class PostgresOrderDetailReader implements OrderDetailReader {
  constructor(private readonly storage: Pick<Storage, "orders" | "orderItems" | "orderBills">) {}

  // Deliberately not async: synchronous read-start failures must stop later reads.
  readOrders(): Promise<OrderDetailOrders> {
    return Promise.resolve(this.storage.orders.all()).then(orderRows => ({
      findOrder: orderId => orderRows.map(mapOrderRow).find(candidate => candidate?.id === orderId),
    }));
  }

  readProductImages(): Promise<OrderDetailProducts> {
    return Promise.resolve(this.storage.orderItems.all()).then(orderItemRows => ({
      forOrder: orderId => orderItemRows.map(mapOrderProductImageRow)
        .filter((image): image is OrderProductImage => image?.orderId === orderId),
    }));
  }

  readBillImages(): Promise<OrderDetailBills> {
    return Promise.resolve(this.storage.orderBills.all()).then(orderBillRows => ({
      forOrder: orderId => orderBillRows.map(mapOrderBillImageRow)
        .filter((image): image is OrderBillImage => image?.orderId === orderId),
    }));
  }
}

function mapOrderBillImageRow(
  row: NativeRecord,
): OrderBillImage | undefined {
  const { id, orderId, imageUrl, createdAt, deletedAt } = row;
  const normalizedId = toStringValue(id);
  const normalizedOrderId = toStringValue(orderId);
  const normalizedImageUrl = toStringValue(imageUrl);
  if (
    !normalizedId ||
    !normalizedOrderId ||
    !normalizedImageUrl ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    orderId: normalizedOrderId,
    imageUrl: normalizedImageUrl,
    createdAt: toStringValue(createdAt),
  };
}
