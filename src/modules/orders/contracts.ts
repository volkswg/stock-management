// Browser-safe public Orders contracts. Keep this module free of imports and IO.
// Values and wire field names are compatibility contracts; do not normalize them here.

export enum OrderStatus {
  Draft = "draft",
  WaitingForBillImage = "waiting_for_bill_image",
  WaitingForProductImage = "waiting_for_product_image",
  WaitingForTotalPrice = "waiting_for_total_price",
  Complete = "complete",
  Paid = "paid",
  Shipped = "shipped",
  Delivered = "delivered",
  Canceled = "canceled",
}

export enum OrderItemQuantityType {
  Quote = "quote",
  Delivered = "delivered",
}

// Orders-owned projection of the existing nested shipment response, not a shipment use case.
export type OrderShipment = {
  id: string;
  status: "draft" | "ready_to_ship" | "shipping" | "delivered" | "canceled";
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
  shippingBillUrl: string;
};

export type OrderListItem = {
  id: string;
  status: OrderStatus;
  seller: string;
  totalPrice: number | null;
  remark: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  shipmentId: string | null;
  productImages: OrderProductImage[];
};

export type OrderProductImage = {
  id: string;
  orderId: string;
  imageUrl: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  productCode: string;
  createdAt: string;
};

export type OrderBillImage = {
  id: string;
  orderId: string;
  imageUrl: string;
  createdAt: string;
};

export type OrderDetail = OrderListItem & {
  billImages: OrderBillImage[];
  shipment: OrderShipment | null;
};

export type CreatedOrder = {
  id: string;
  status: OrderStatus.Complete | OrderStatus.WaitingForTotalPrice;
  seller: string;
  totalPrice: number | null;
  remark: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export type OrderProductUpdate = {
  id: string;
  productCode?: string;
  quoteQuantity?: number;
  deliveredQuantity?: number;
};

export type UpdatedOrderProduct = {
  id: string;
  productCode: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  updatedAt: string;
};

export type ReplacedOrderProductImage = {
  id: string;
  imageUrl: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  status: OrderStatus;
  seller: string;
  totalPrice: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
  remark: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  imageUrl: string;
  quoteQuantity: string;
  deliveredQuantity: string;
  productCode: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export type OrderBill = {
  id: string;
  orderId: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
};

export type UpdateOrderItemQuantityResult =
  | { outcome: "updated"; quantity: string; updatedAt: string }
  | { outcome: "not_found" };

export type UpdateOrderItemProductCodeResult =
  | { outcome: "updated"; productCode: string; updatedAt: string }
  | { outcome: "not_found" };

export type OrderDetailsUpdate = {
  status: OrderStatus;
  totalPrice: number | null;
  remark: string;
  updatedAt: string;
};

export type UpdateOrderDetailsResult =
  | { outcome: "updated"; order: OrderDetailsUpdate }
  | { outcome: "not_found" }
  | { outcome: "invalid_status" };

export type CompleteWebOrderPriceResult =
  | {
      outcome: "updated";
      status: OrderStatus.Complete;
      totalPrice: number;
      updatedAt: string;
    }
  | { outcome: "not_found" }
  | { outcome: "invalid_status" };

export type OrderImageType = "bill" | "product";
