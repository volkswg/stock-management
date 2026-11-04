import "server-only";
import type { GoogleSheetRow, IGoogleSheetsService } from "@/externals/google/sheet";
import type { OrderListItem, OrderProductImage } from "../../contracts";
import type { OrderListReader } from "../../application/ports/order-list-reader";
import { mapOrderRow, mapOrderProductImageRow, toStringValue } from "./order-row-mapping";

export class GoogleSheetsOrderListReader implements OrderListReader {
  constructor(private readonly googleSheetsService: Pick<IGoogleSheetsService, "orders" | "orderItems" | "shipmentOrders">) {}

  async readOrderList(): Promise<OrderListItem[]> {
    const [orderRows, orderItemRows, shipmentOrderRows] = await Promise.all([
      this.googleSheetsService.orders.readRows("A:I"),
      this.googleSheetsService.orderItems.readRows(),
      this.googleSheetsService.shipmentOrders.readRows(),
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
  rows: GoogleSheetRow[],
): Map<string, string> {
  const shipmentIdsByOrderId = new Map<string, string>();

  for (const row of rows) {
    const [, shipmentId, orderId, , , deletedAt] = row;
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
  rows: GoogleSheetRow[],
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
