export enum ShipmentStatus {
  Draft = "draft",
  ReadyToShip = "ready_to_ship",
  Shipped = "shipped",
  Delivered = "delivered",
  Canceled = "canceled",
}

export type Shipment = {
  id: string;
  status: ShipmentStatus;
  carrier: string;
  poNumber: string;
  shippingFee: number | null;
  remark: string;
  shippedAt: string;
  deliveredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export type ShipmentListItem = Omit<Shipment, "deletedAt">;
