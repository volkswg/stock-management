import type { ShipmentStatusUpdate } from "../../contracts";

export interface ShipmentStatusTarget {
  readCurrentStatus(): string;
  readPoNumber(): string;
  readShippingFee(): number | null;
  readShippedAt(): string;
  readDeliveredAt(): string;
  readShippingBillUrl(): string;
  saveStatusUpdate(update: ShipmentStatusUpdate): Promise<void>;
}

export interface ShipmentStatusStore {
  prepareStatusUpdate(shipmentId: string): Promise<ShipmentStatusTarget | undefined>;
}
