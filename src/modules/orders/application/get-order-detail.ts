import type { OrderDetail } from "../contracts";
import type { OrderDetailReader } from "./ports/order-detail-reader";
import type { OrderDetailShipmentProjectionReader } from "./ports/order-detail-shipment-projection";

export async function getOrderDetail(
  reader: OrderDetailReader,
  shipmentProjection: OrderDetailShipmentProjectionReader,
  orderId: string,
): Promise<OrderDetail | undefined> {
  const [orders, products, bills, links, shipments] = await Promise.all([
    reader.readOrders(),
    reader.readProductImages(),
    reader.readBillImages(),
    shipmentProjection.readLinks(),
    shipmentProjection.readShipments(),
  ]);
  const order = orders.findOrder(orderId);
  if (!order) return undefined;

  const shipmentId = links.findShipmentIdForOrder(orderId);
  return {
    ...order,
    productImages: products.forOrder(orderId),
    billImages: bills.forOrder(orderId),
    shipmentId,
    shipment: shipmentId ? shipments.findShipmentById(shipmentId) : null,
  };
}
