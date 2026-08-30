import type { OrderStatus } from "../orders/createDraftOrder";

export enum ShipmentStatus {
  Draft = "draft",
  ReadyToShip = "ready_to_ship",
  Shipping = "shipping",
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

export type ShipmentRelatedOrder = {
  id: string;
  status: OrderStatus;
  seller: string;
  totalPrice: number | null;
  createdAt: string;
  productImages: ShipmentRelatedProductImage[];
};

export type ShipmentRelatedProductImage = {
  id: string;
  imageUrl: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  productCode: string;
};

export type ShipmentCostSummary = {
  totalOrderPrice: number;
  shippingFee: number;
  totalQuantity: number;
  averageLandedCostPerUnit: number;
};

export type ShipmentListItem = Omit<Shipment, "deletedAt"> & {
  costSummary: ShipmentCostSummary | null;
  orders: ShipmentRelatedOrder[];
};
