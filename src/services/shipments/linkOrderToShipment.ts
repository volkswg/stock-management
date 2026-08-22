import {
  lastColumnLetter,
  SHIPMENT_ORDERS_SHEET_HEADERS,
  type GoogleSheetCellValue,
  type GoogleSheetRow,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { createSortableId } from "../utils/createSortableId";
import { ShipmentStatus } from "./types";

export type ShipmentOrder = {
  id: string;
  shipmentId: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export type LinkOrderToShipmentResult = {
  shipmentOrder: ShipmentOrder;
  created: boolean;
};

export type LinkOrderToShipmentErrorCode =
  | "shipment_not_found"
  | "order_not_found"
  | "order_already_linked"
  | "shipment_not_linkable";

export class LinkOrderToShipmentError extends Error {
  constructor(
    readonly code: LinkOrderToShipmentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LinkOrderToShipmentError";
  }
}

export async function linkOrderToShipment({
  googleSheetsService,
  shipmentId,
  orderId,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  shipmentId: string;
  orderId: string;
  createdBy: string;
}): Promise<LinkOrderToShipmentResult> {
  const [shipmentRows, orderRows, shipmentOrderRows] = await Promise.all([
    googleSheetsService.shipments.readRows(),
    googleSheetsService.orders.readRows("A:I"),
    googleSheetsService.shipmentOrders.readRows(),
  ]);
  const shipmentRow = shipmentRows.find(
    (row) =>
      toStringValue(row[0]) === shipmentId && !toStringValue(row[10]),
  );
  if (!shipmentRow) {
    throw new LinkOrderToShipmentError(
      "shipment_not_found",
      "Shipment not found.",
    );
  }

  const orderExists = orderRows.some(
    (row) => toStringValue(row[0]) === orderId && !toStringValue(row[7]),
  );
  if (!orderExists) {
    throw new LinkOrderToShipmentError("order_not_found", "Order not found.");
  }

  const existingLink = findLatestShipmentOrder(shipmentOrderRows, orderId);
  if (existingLink?.shipmentId === shipmentId) {
    return { shipmentOrder: existingLink, created: false };
  }
  if (existingLink) {
    throw new LinkOrderToShipmentError(
      "order_already_linked",
      "Order is already linked to another shipment.",
    );
  }

  const shipmentStatus = toStringValue(shipmentRow[1]);
  if (
    shipmentStatus !== ShipmentStatus.Draft &&
    shipmentStatus !== ShipmentStatus.ReadyToShip
  ) {
    throw new LinkOrderToShipmentError(
      "shipment_not_linkable",
      "Orders can only be linked to draft or ready-to-ship shipments.",
    );
  }

  const now = new Date().toISOString();
  const shipmentOrder: ShipmentOrder = {
    id: createSortableId(),
    shipmentId,
    orderId,
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await googleSheetsService.shipmentOrders.appendRows(
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

  return { shipmentOrder, created: true };
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
