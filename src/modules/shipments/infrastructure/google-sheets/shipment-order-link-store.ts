import "server-only";
import type { GoogleSheetCellValue, GoogleSheetRow, IGoogleSheetsService } from "@/externals/google/sheet/types";
import { lastColumnLetter } from "@/externals/google/sheet/const";
import { SHIPMENT_ORDERS_SHEET_HEADERS } from "@/externals/google/sheet/sheets/shipment-orders/const";
import type { ShipmentOrder } from "../../contracts";
import type { ShipmentOrderLinkStore, ShipmentLinkSnapshot } from "../../application/ports/shipment-order-link-store";

export class GoogleSheetsShipmentOrderLinkStore implements ShipmentOrderLinkStore {
  constructor(private readonly googleSheetsService: Pick<
    IGoogleSheetsService, "shipments" | "orders" | "shipmentOrders"
  >) {}

  async readLinkSnapshot(): Promise<ShipmentLinkSnapshot> {
    const [shipmentRows, orderRows, shipmentOrderRows] = await Promise.all([
      this.googleSheetsService.shipments.readRows(),
      this.googleSheetsService.orders.readRows("A:I"),
      this.googleSheetsService.shipmentOrders.readRows(),
    ]);
    return {
      findActiveShipment(shipmentId) {
        const shipmentRow = shipmentRows.find(
          (row) =>
            toStringValue(row[0]) === shipmentId && !toStringValue(row[10]),
        );
        if (!shipmentRow) return undefined;
        return { readStatus: () => toStringValue(shipmentRow[1]) };
      },
      hasActiveOrder(orderId) {
        return orderRows.some(
          (row) => toStringValue(row[0]) === orderId && !toStringValue(row[7]),
        );
      },
      findLatestActiveLink(orderId) {
        return findLatestShipmentOrder(shipmentOrderRows, orderId);
      },
    };
  }

  async appendShipmentOrder(shipmentOrder: ShipmentOrder): Promise<void> {
    await this.googleSheetsService.shipmentOrders.appendRows(
      getShipmentOrdersAppendRange(),
      [
        [
          shipmentOrder.id,
          shipmentOrder.shipmentId,
          shipmentOrder.orderId,
          shipmentOrder.createdAt,
          shipmentOrder.updatedAt,
          shipmentOrder.deletedAt,
          shipmentOrder.createdBy,
        ],
      ],
    );
  }
}

function findLatestShipmentOrder(
  rows: GoogleSheetRow[],
  orderId: string,
): ShipmentOrder | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const shipmentOrder = mapShipmentOrderRow(rows[index]);
    if (shipmentOrder?.orderId === orderId) {
      return shipmentOrder;
    }
  }
  return undefined;
}

function mapShipmentOrderRow(row: GoogleSheetRow): ShipmentOrder | undefined {
  const [
    id,
    shipmentId,
    orderId,
    createdAt,
    updatedAt,
    deletedAt,
    createdBy,
  ] = row;
  const normalizedId = toStringValue(id);
  const normalizedShipmentId = toStringValue(shipmentId);
  const normalizedOrderId = toStringValue(orderId);
  if (
    !normalizedId ||
    !normalizedShipmentId ||
    !normalizedOrderId ||
    toStringValue(deletedAt)
  ) {
    return undefined;
  }

  return {
    id: normalizedId,
    shipmentId: normalizedShipmentId,
    orderId: normalizedOrderId,
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    deletedAt: "",
    createdBy: toStringValue(createdBy),
  };
}

function getShipmentOrdersAppendRange(): string {
  return `A:${lastColumnLetter(SHIPMENT_ORDERS_SHEET_HEADERS.length - 1)}`;
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
