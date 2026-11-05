import type { OrderListItem, OrderProductImage, OrderBillImage } from "../../contracts";

export interface OrderDetailOrders {
  findOrder(orderId: string): OrderListItem | undefined;
}
export interface OrderDetailProducts {
  forOrder(orderId: string): OrderProductImage[];
}
export interface OrderDetailBills {
  forOrder(orderId: string): OrderBillImage[];
}

export interface OrderDetailReader {
  readOrders(): Promise<OrderDetailOrders>;
  readProductImages(): Promise<OrderDetailProducts>;
  readBillImages(): Promise<OrderDetailBills>;
}
