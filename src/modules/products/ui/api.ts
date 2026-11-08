import type { Product, ProductEdit, ProductInput, ProductSuggestion } from "../contracts";
export class ProductApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly suggestions?: ProductSuggestion[]) { super(message); }
}
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new ProductApiError(body.error ?? "Product request failed.", response.status, body.code, body.suggestions);
  return body;
}
const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const searchProducts = (query: string, includeArchived = false, signal?: AbortSignal) => request<{ products: Product[] }>(`/api/products?q=${encodeURIComponent(query)}&includeArchived=${includeArchived}`, { signal });
export const getProduct = (id: string, signal?: AbortSignal) => request<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`, { signal });
export const suggestProducts = (product: ProductInput) => request<{ suggestions: ProductSuggestion[] }>("/api/products/suggestions", { method: "POST", ...json(product) });
export const createProduct = (requestId: string, product: ProductInput, confirmDuplicates: boolean) => request<{ product: Product }>("/api/products", { method: "POST", ...json({ requestId, product, confirmed: true, confirmDuplicates }) });
export const editProduct = (id: string, requestId: string, expectedUpdatedAt: string, product: ProductEdit) => request<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`, { method: "PATCH", ...json({ requestId, expectedUpdatedAt, product }) });
export const cancelProductCreation = (requestId: string) => request<{ outcome: "cancelled" } | { outcome: "created"; product: Product }>(`/api/products/creations/${encodeURIComponent(requestId)}/cancel`, { method: "POST", ...json({ confirmed: true }) });
