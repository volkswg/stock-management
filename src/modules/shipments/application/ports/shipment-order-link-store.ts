import type { ShipmentOrder } from "../../contracts";

export type ActiveShipmentCandidate = {
  readStatus(): string;
};

export type ShipmentLinkSnapshot = {
  findActiveShipment(shipmentId: string): ActiveShipmentCandidate | undefined;
  hasActiveOrder(orderId: string): boolean;
  findLatestActiveLink(orderId: string): ShipmentOrder | undefined;
};

export interface ShipmentOrderLinkStore {
  readLinkSnapshot(): Promise<ShipmentLinkSnapshot>;
  appendShipmentOrder(record: ShipmentOrder): Promise<void>;
}
