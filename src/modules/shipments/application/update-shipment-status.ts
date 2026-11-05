import { ShipmentStatus, type ShipmentStatusUpdate } from "../contracts";
import type { ShipmentStatusStore } from "./ports/shipment-status-store";

export type UpdateShipmentStatusResult =
  | { outcome: "updated"; shipment: ShipmentStatusUpdate }
  | { outcome: "not_found" }
  | { outcome: "invalid_transition" }
  | { outcome: "invalid_delivery_fee" }
  | { outcome: "invalid_po_number" };

export type UpdateShipmentStatusInput = {
  deliveryFee?: number;
  poNumber?: string;
  shippingBillUrl?: string;
  shipmentId: string;
  status: ShipmentStatus;
};

export type UpdateShipmentStatusDependencies = {
  store: ShipmentStatusStore;
  now: () => string;
};

export async function updateShipmentStatus(
  { deliveryFee, poNumber, shippingBillUrl, shipmentId, status }: UpdateShipmentStatusInput,
  { store, now: readClock }: UpdateShipmentStatusDependencies,
): Promise<UpdateShipmentStatusResult> {
  if (
    status === ShipmentStatus.Delivered &&
    (deliveryFee === undefined ||
      !Number.isFinite(deliveryFee) ||
      deliveryFee < 0 ||
      deliveryFee > 1_000_000_000)
  ) {
    return { outcome: "invalid_delivery_fee" };
  }

  const target = await store.prepareStatusUpdate(shipmentId);
  if (!target) {
    return { outcome: "not_found" };
  }

  if (!isValidTransition(target.readCurrentStatus(), status)) {
    return { outcome: "invalid_transition" };
  }
  if (
    status === ShipmentStatus.Shipping &&
    (!poNumber?.trim() || poNumber.length > 100)
  ) {
    return { outcome: "invalid_po_number" };
  }

  const now = readClock();
  const updatedPoNumber =
    status === ShipmentStatus.Shipping
      ? (poNumber?.trim() ?? "")
      : target.readPoNumber();
  const shippingFee =
    status === ShipmentStatus.Delivered
      ? (deliveryFee ?? null)
      : target.readShippingFee();
  const shippedAt =
    status === ShipmentStatus.Shipping
      ? now
      : target.readShippedAt();
  const deliveredAt =
    status === ShipmentStatus.Delivered
      ? now
      : target.readDeliveredAt();
  const updatedShippingBillUrl =
    status === ShipmentStatus.Shipping
      ? shippingBillUrl?.trim() || ""
      : target.readShippingBillUrl();

  await target.saveStatusUpdate({
    status,
    poNumber: updatedPoNumber,
    shippingFee,
    shippedAt,
    deliveredAt,
    updatedAt: now,
    shippingBillUrl: updatedShippingBillUrl,
  });

  return {
    outcome: "updated",
    shipment: {
      status,
      poNumber: updatedPoNumber,
      shippingFee,
      shippedAt,
      deliveredAt,
      updatedAt: now,
      shippingBillUrl: updatedShippingBillUrl,
    },
  };
}

function isValidTransition(
  currentStatus: string,
  nextStatus: ShipmentStatus,
): boolean {
  return (
    (currentStatus === ShipmentStatus.Draft &&
      nextStatus === ShipmentStatus.ReadyToShip) ||
    (currentStatus === ShipmentStatus.ReadyToShip &&
      nextStatus === ShipmentStatus.Shipping) ||
    (currentStatus === ShipmentStatus.Shipping &&
      nextStatus === ShipmentStatus.Delivered)
  );
}
