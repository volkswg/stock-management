import "server-only";
import type { GoogleSheetCellValue, GoogleSheetRow, IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import { OrderStatus } from "@/modules/orders/contracts";
import {
  ShipmentStatus, type ShipmentListItem, type ShipmentRelatedOrder,
  type ShipmentRelatedProductImage,
} from "../../contracts";
import type { ShipmentListReader, ShipmentReadModel } from "../../application/ports/shipment-list-reader";

type ShipmentRow = Omit<ShipmentListItem, "costSummary" | "orders">;
type RelatedOrderRow = Omit<ShipmentRelatedOrder, "productImages">;

export class GoogleSheetsShipmentListReader implements ShipmentListReader {
  constructor(private readonly googleSheetsService: Pick<
    IGoogleSheetsService, "shipments" | "shipmentOrders" | "orders" | "orderItems"
  >) {}

  async readShipmentList({ includeOrders }: { includeOrders: boolean }): Promise<ShipmentReadModel> {
    const [shipmentRows, shipmentOrderRows, orderRows, orderItemRows] =
      await Promise.all([
        this.googleSheetsService.shipments.readRows(),
        includeOrders
          ? this.googleSheetsService.shipmentOrders.readRows()
          : Promise.resolve([]),
        includeOrders
          ? this.googleSheetsService.orders.readRows("A:I")
          : Promise.resolve([]),
        includeOrders
          ? this.googleSheetsService.orderItems.readRows()
          : Promise.resolve([]),
      ]);
    const orderIdsByShipmentId = groupOrderIdsByShipmentId(shipmentOrderRows);
    const productImagesByOrderId = groupProductImagesByOrderId(orderItemRows);
    const ordersById = new Map<string, ShipmentRelatedOrder>();
    for (const row of orderRows) {
      const order = mapRelatedOrderRow(row);
      if (order) {
        ordersById.set(order.id, {
          ...order,
          productImages: productImagesByOrderId.get(order.id) ?? [],
        });
      }
    }

    const shipments = shipmentRows
      .map(mapShipmentRow)
      .filter((shipment): shipment is ShipmentRow => Boolean(shipment));
    return { shipments, orderIdsByShipmentId, ordersById };
  }
}

function mapShipmentRow(row: GoogleSheetRow): ShipmentRow | undefined {
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
    shippingFee: toNumber(shippingFee),
    remark: toStringValue(remark),
    shippedAt: toStringValue(shippedAt),
    deliveredAt: toStringValue(deliveredAt),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    createdBy: toStringValue(createdBy),
    shippingBillUrl: toStringValue(shippingBillUrl),
  };
}

function groupOrderIdsByShipmentId(
  rows: GoogleSheetRow[],
): Map<string, string[]> {
  const orderIdsByShipmentId = new Map<string, string[]>();

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

    const orderIds = orderIdsByShipmentId.get(normalizedShipmentId) ?? [];
    if (!orderIds.includes(normalizedOrderId)) {
      orderIds.push(normalizedOrderId);
      orderIdsByShipmentId.set(normalizedShipmentId, orderIds);
    }
  }

  return orderIdsByShipmentId;
}

function mapRelatedOrderRow(
  row: GoogleSheetRow,
): RelatedOrderRow | undefined {
  const [id, status, seller, totalPrice, , createdAt, , deletedAt] = row;
  const normalizedId = toStringValue(id);
  const normalizedStatus = toStringValue(status);
  if (
    !normalizedId ||
    !isOrderStatus(normalizedStatus) ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    status: normalizedStatus,
    seller: toStringValue(seller),
    totalPrice: toNumber(totalPrice),
    createdAt: toStringValue(createdAt),
  };
}

function groupProductImagesByOrderId(
  rows: GoogleSheetRow[],
): Map<string, ShipmentRelatedProductImage[]> {
  const productImagesByOrderId = new Map<
    string,
    ShipmentRelatedProductImage[]
  >();

  for (const row of rows) {
    const [
      id,
      orderId,
      imageUrl,
      quoteQuantity,
      deliveredQuantity,
      productCode,
      ,
      ,
      deletedAt,
    ] = row;
    const normalizedId = toStringValue(id);
    const normalizedOrderId = toStringValue(orderId);
    const normalizedImageUrl = toStringValue(imageUrl);
    if (
      !normalizedId ||
      !normalizedOrderId ||
      !normalizedImageUrl ||
      toStringValue(deletedAt)
    ) {
      continue;
    }

    const images = productImagesByOrderId.get(normalizedOrderId) ?? [];
    images.push({
      id: normalizedId,
      imageUrl: normalizedImageUrl,
      quoteQuantity: toStringValue(quoteQuantity),
      deliveredQuantity: toStringValue(deliveredQuantity),
      productCode: toStringValue(productCode),
    });
    productImagesByOrderId.set(normalizedOrderId, images);
  }

  return productImagesByOrderId;
}

function toStringValue(value: GoogleSheetCellValue | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toNumber(value: GoogleSheetCellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}
