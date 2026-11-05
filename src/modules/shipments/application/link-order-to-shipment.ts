import { ShipmentStatus, type ShipmentOrder } from "../contracts";
import type { ShipmentOrderLinkStore } from "./ports/shipment-order-link-store";

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

export type LinkOrderInput = {
  shipmentId: string;
  orderId: string;
  createdBy: string;
};

export type LinkOrderDependencies = {
  store: ShipmentOrderLinkStore;
  now: () => string;
  createId: () => string;
};

export async function linkOrderToShipment(
  { shipmentId, orderId, createdBy }: LinkOrderInput,
  { store, now: readClock, createId }: LinkOrderDependencies,
): Promise<LinkOrderToShipmentResult> {
  const snapshot = await store.readLinkSnapshot();
  const shipment = snapshot.findActiveShipment(shipmentId);
  if (!shipment) {
    throw new LinkOrderToShipmentError(
      "shipment_not_found",
      "Shipment not found.",
    );
  }

  const orderExists = snapshot.hasActiveOrder(orderId);
  if (!orderExists) {
    throw new LinkOrderToShipmentError("order_not_found", "Order not found.");
  }

  const existingLink = snapshot.findLatestActiveLink(orderId);
  if (existingLink?.shipmentId === shipmentId) {
    return { shipmentOrder: existingLink, created: false };
  }
  if (existingLink) {
    throw new LinkOrderToShipmentError(
      "order_already_linked",
      "Order is already linked to another shipment.",
    );
  }

  const shipmentStatus = shipment.readStatus();
  if (
    shipmentStatus !== ShipmentStatus.Draft &&
    shipmentStatus !== ShipmentStatus.ReadyToShip
  ) {
    throw new LinkOrderToShipmentError(
      "shipment_not_linkable",
      "Orders can only be linked to draft or ready-to-ship shipments.",
    );
  }

  const now = readClock();
  const shipmentOrder: ShipmentOrder = {
    id: createId(),
    shipmentId,
    orderId,
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
  };

  await store.appendShipmentOrder(shipmentOrder);

  return { shipmentOrder, created: true };
}
