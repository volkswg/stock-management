import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
import type { OrderListItem, OrderProductImage } from "../../contracts";
import type { OrderListReader } from "../../application/ports/order-list-reader";
import { mapOrderRow, mapOrderProductImageRow, toStringValue } from "./order-row-mapping";

export class PostgresOrderListReader implements OrderListReader {
  constructor(private readonly storage: Pick<Storage, "orders" | "orderItems" | "shipmentOrders">) {}

  async readOrderList(): Promise<OrderListItem[]> {
    const [orderRows, orderItemRows, shipmentOrderRows] = await Promise.all([
      this.storage.orders.all("descending").then(records => records.reverse()),
      this.storage.orderItems.all(),
      this.storage.shipmentOrders.all(),
    ]);
    const productImagesByOrderId = groupProductImagesByOrderId(orderItemRows);
    const shipmentIdsByOrderId = groupShipmentIdsByOrderId(shipmentOrderRows);

    return orderRows
      .map(mapOrderRow)
      .filter((order): order is OrderListItem => Boolean(order))
      .map((order) => ({
        ...order,
        shipmentId: shipmentIdsByOrderId.get(order.id) ?? null,
        productImages: productImagesByOrderId.get(order.id) ?? [],
      }));
  }
}

function groupShipmentIdsByOrderId(
  rows: NativeRecord[],
): Map<string, string> {
  const shipmentIdsByOrderId = new Map<string, string>();

  for (const row of rows) {
    const { shipmentId, orderId, deletedAt } = row;
    const normalizedShipmentId = toStringValue(shipmentId);
    const normalizedOrderId = toStringValue(orderId);
    if (
      !normalizedShipmentId ||
      !normalizedOrderId ||
      toStringValue(deletedAt)
    ) {
      continue;
    }
    shipmentIdsByOrderId.set(normalizedOrderId, normalizedShipmentId);
  }

  return shipmentIdsByOrderId;
}

function groupProductImagesByOrderId(
  rows: NativeRecord[],
): Map<string, OrderProductImage[]> {
  const productImagesByOrderId = new Map<string, OrderProductImage[]>();

  for (const row of rows) {
    const productImage = mapOrderProductImageRow(row);
    if (!productImage) {
      continue;
    }

    const productImages = productImagesByOrderId.get(productImage.orderId) ?? [];
    productImages.push(productImage);
    productImagesByOrderId.set(productImage.orderId, productImages);
  }

  return productImagesByOrderId;
}
