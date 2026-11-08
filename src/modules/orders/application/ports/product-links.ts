import type { OrderItemProductLink, OrderItemProductSummary } from "../../product-link-contracts";
export interface OrderItemProductLinks {
  list(orderId: string): Promise<OrderItemProductSummary[]>;
  read(orderId: string, itemId: string): Promise<OrderItemProductLink | undefined>;
  save(input: OrderItemProductLink & { requestId: string }): Promise<OrderItemProductLink>;
}
export interface LinkableProducts {
  findById(id: string): Promise<{ id: string; active: boolean } | undefined>;
}
