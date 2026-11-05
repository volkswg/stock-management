import type { OrderShipment } from "../../contracts";

export interface OrderShipmentLinks {
  findShipmentIdForOrder(orderId: string): string | null;
}

export interface OrderShipmentCandidates {
  findShipmentById(shipmentId: string): OrderShipment | null;
}

export interface OrderDetailShipmentProjectionReader {
  readLinks(): Promise<OrderShipmentLinks>;
  readShipments(): Promise<OrderShipmentCandidates>;
}
