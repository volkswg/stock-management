import type { OrderShipment } from "@/modules/orders/contracts";

export type PickerShipment = Pick<
  OrderShipment,
  "id" | "poNumber" | "carrier" | "status"
>;

export interface OrderShipmentPickerPort {
  listLinkableShipments(input: {
    signal?: AbortSignal;
  }): Promise<{ shipments: PickerShipment[] }>;
  createShipmentMaster(input: {
    poNumber: string;
    carrier?: string;
  }): Promise<{ shipment: PickerShipment }>;
  linkOrderToShipment(shipmentId: string, orderId: string): Promise<void>;
}
