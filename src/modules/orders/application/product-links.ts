import { isRequestId } from "@/shared/lib/request-id";
import type { OrderItemProductLinks, LinkableProducts } from "./ports/product-links";
import type { OrderItemProductLink } from "../product-link-contracts";
export class OrderProductLinkError extends Error {
  constructor(message: string, readonly status: number) { super(message);this.name = "OrderProductLinkError"; }
}
export async function saveOrderItemProductLink(store: OrderItemProductLinks, products: LinkableProducts, input: OrderItemProductLink & { requestId: string }) {
  if (!input.orderId.trim() || !input.itemId.trim() || input.orderId.length > 128 || input.itemId.length > 128 || !isRequestId(input.requestId) || !(input.revision === "initial" || isRequestId(input.revision)) || !(input.productId === null || (typeof input.productId === "string" && input.productId.length <= 128 && input.productId.trim() === input.productId && input.productId.length > 0))) throw new OrderProductLinkError("Valid Order Item, product, revision and request identifiers are required.", 400);
  input = { ...input, requestId: input.requestId.toLowerCase(), revision: input.revision.toLowerCase() };
  if (input.requestId === input.revision) throw new OrderProductLinkError("Use a new request ID for a new association change.", 400);
  const current = await store.read(input.orderId, input.itemId);
  if (!current) throw new OrderProductLinkError("Order item not found.", 404);
  if (input.productId !== null) {
    const product = await products.findById(input.productId);
    if (!product || (!product.active && current.productId !== product.id)) throw new OrderProductLinkError("Select an active Product Master record.", 409);
  }
  return store.save(input);
}
