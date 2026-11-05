import type { Shipment } from "../../contracts";

export interface CreatedShipmentWriter {
  appendCreatedShipment(shipment: Shipment): Promise<void>;
}
