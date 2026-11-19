import "server-only";
import type { BusinessDatabase as Storage } from "@/composition/postgres/service";
import type { OrderDetail } from "@/modules/orders/contracts";
import { getOrderDetail as executeGetOrderDetail } from "@/modules/orders/server";
import { PostgresOrderDetailShipmentProjection } from "@/modules/shipments/infrastructure/postgres/order-detail-shipment-projection";
export { type OrderListItem, type OrderProductImage, type OrderBillImage, type OrderDetail } from "@/modules/orders/contracts";
export { listOrders } from "@/modules/orders/server";

// Orders consumes its own Shipment projection port through composition.
export async function getOrderDetail({
  storage,
  orderId,
}: {
  storage: Storage;
  orderId: string;
}): Promise<OrderDetail | undefined> {
  return await executeGetOrderDetail({
    storage,
    orderId,
    shipmentProjection: new PostgresOrderDetailShipmentProjection(storage),
  });
}
