import "server-only";
import type { GoogleSheetCellValue, GoogleSheetRow, IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { OrderShipment } from "@/modules/orders/contracts";
import type { OrderDetailShipmentProjectionReader, OrderShipmentLinks, OrderShipmentCandidates } from "@/modules/orders/application/ports/order-detail-shipment-projection";
import { ShipmentStatus } from "../../contracts";

export class GoogleSheetsOrderDetailShipmentProjection implements OrderDetailShipmentProjectionReader {
  constructor(private readonly sheets: Pick<IGoogleSheetsService, "shipmentOrders" | "shipments">) {}

  // Start each original operation synchronously; map only when the consumer asks.
  readLinks(): Promise<OrderShipmentLinks> {
    return Promise.resolve(this.sheets.shipmentOrders.readRows()).then(rows => ({
      findShipmentIdForOrder: orderId => findShipmentIdForOrder(rows, orderId),
    }));
  }

  readShipments(): Promise<OrderShipmentCandidates> {
    return Promise.resolve(this.sheets.shipments.readRows()).then(shipmentRows => ({
      findShipmentById: shipmentId => shipmentRows.map(mapShipmentRow)
        .find(shipment => shipment?.id === shipmentId) ?? null,
    }));
  }
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

function mapShipmentRow(row: GoogleSheetRow): OrderShipment | undefined {
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

// These exact converters stay feature-local to avoid importing Orders private infrastructure.
function toStringValue(value: GoogleSheetCellValue | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toPrice(value: GoogleSheetCellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const price = Number(value.replace(/,/g, ""));
  return Number.isFinite(price) ? price : null;
}
