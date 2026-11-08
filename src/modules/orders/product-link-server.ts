import "server-only";
import type { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import type { LinkableProducts } from "./application/ports/product-links";
import { createOrderItemProductLinks } from "./infrastructure/google-sheets/product-links";
import { saveOrderItemProductLink } from "./application/product-links";
import type { OrderItemProductLink } from "./product-link-contracts";
export { OrderProductLinkError } from "./application/product-links";
export function createOrderProductLinkService(client: GoogleSheetsClient, names: { orderItems: string; orders: string }, products: LinkableProducts) {
  const store = createOrderItemProductLinks(client, names.orderItems, names.orders);
  return { list: store.list, read: store.read, save: (input: OrderItemProductLink & { requestId: string }) => saveOrderItemProductLink(store, products, input) };
}
