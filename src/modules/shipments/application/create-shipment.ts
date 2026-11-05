import { ShipmentStatus, type Shipment } from "../contracts";
import type { CreatedShipmentWriter } from "./ports/created-shipment-writer";

export type CreateShipmentInput = {
  poNumber: string;
  carrier?: string;
  createdBy: string;
};

export type CreateShipmentDependencies = {
  writer: CreatedShipmentWriter;
  now: () => string;
  createId: () => string;
};

export async function createShipment(
  { poNumber, carrier, createdBy }: CreateShipmentInput,
  { writer, now: readClock, createId }: CreateShipmentDependencies,
): Promise<Shipment> {
  const normalizedPoNumber = poNumber.trim();
  if (!normalizedPoNumber) {
    throw new Error("Shipment PO number is required.");
  }

  const now = readClock();
  const shipment: Shipment = {
    id: createId(),
    status: ShipmentStatus.Draft,
    carrier: carrier?.trim() || "",
    poNumber: normalizedPoNumber,
    shippingFee: null,
    remark: "",
    shippedAt: "",
    deliveredAt: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
    shippingBillUrl: "",
  };

  await writer.appendCreatedShipment(shipment);
  return shipment;
}
