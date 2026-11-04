import { type OrderProductImage, type OrderBillImage, type OrderDetail } from "@/modules/orders/contracts";
export { type OrderListItem, type OrderProductImage, type OrderBillImage, type OrderDetail } from "@/modules/orders/contracts";
import type {
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { ShipmentStatus, type Shipment } from "@/services/shipments";
export { listOrders } from "@/modules/orders/server";
import { mapOrderRow, mapOrderProductImageRow, toStringValue, toPrice } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";

export async function getOrderDetail({
  googleSheetsService,
  orderId,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
}): Promise<OrderDetail | undefined> {
  const [
    orderRows,
    orderItemRows,
    orderBillRows,
    shipmentOrderRows,
    shipmentRows,
  ] =
    await Promise.all([
      googleSheetsService.orders.readRows("A:I"),
      googleSheetsService.orderItems.readRows(),
      googleSheetsService.orderBills.readRows(),
      googleSheetsService.shipmentOrders.readRows(),
      googleSheetsService.shipments.readRows(),
    ]);
  const order = orderRows
    .map(mapOrderRow)
    .find((candidate) => candidate?.id === orderId);

  if (!order) {
    return undefined;
  }

  const shipmentId = findShipmentIdForOrder(shipmentOrderRows, orderId);

  return {
    ...order,
    productImages: orderItemRows
      .map(mapOrderProductImageRow)
      .filter(
        (image): image is OrderProductImage => image?.orderId === orderId,
      ),
    billImages: orderBillRows
      .map(mapOrderBillImageRow)
      .filter((image): image is OrderBillImage => image?.orderId === orderId),
    shipmentId,
    shipment: shipmentId
      ? (shipmentRows
          .map(mapShipmentRow)
          .find((shipment) => shipment?.id === shipmentId) ?? null)
      : null,
  };
}

function findShipmentIdForOrder(
  rows: GoogleSheetRow[],
  orderId: string,
): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const [, shipmentId, linkedOrderId, , , deletedAt] = rows[index];
    if (
      toStringValue(linkedOrderId) === orderId &&
      !toStringValue(deletedAt)
    ) {
      return toStringValue(shipmentId) || null;
    }
  }
  return null;
}

function mapOrderBillImageRow(
  row: GoogleSheetRow,
): OrderBillImage | undefined {
  const [id, orderId, imageUrl, createdAt, , deletedAt] = row;
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

function mapShipmentRow(row: GoogleSheetRow): Shipment | undefined {
  const [
    id,
    status,
    carrier,
    poNumber,
    shippingFee,
    remark,
    shippedAt,
    deliveredAt,
    createdAt,
    updatedAt,
    deletedAt,
    createdBy,
    shippingBillUrl,
  ] = row;
  const normalizedId = toStringValue(id);
  const normalizedStatus = toStringValue(status);
  const normalizedPoNumber = toStringValue(poNumber);
  if (
    !normalizedId ||
    !isShipmentStatus(normalizedStatus) ||
    !normalizedPoNumber ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    status: normalizedStatus,
    carrier: toStringValue(carrier),
    poNumber: normalizedPoNumber,
    shippingFee: toPrice(shippingFee),
    remark: toStringValue(remark),
    shippedAt: toStringValue(shippedAt),
    deliveredAt: toStringValue(deliveredAt),
    deletedAt: toStringValue(deletedAt),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    createdBy: toStringValue(createdBy),
    shippingBillUrl: toStringValue(shippingBillUrl),
  };
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}
