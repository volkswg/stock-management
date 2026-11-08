import type { ProductStore } from "./ports/product-store";
import type { ProductEdit, ProductInput } from "../contracts";
import { findProductSuggestions, normalizeProductText, validateProductInput, validateRequestId, ProductValidationError, ProductDuplicatesError } from "../domain/validation";
export async function searchProducts(store: ProductStore, query: string, includeArchived = false) {
  if (typeof query !== "string" || query.length > 200) throw new ProductValidationError("Search text must contain at most 200 characters.");
  const terms = normalizeProductText(query).split(" ").filter(Boolean);
  return (await store.list()).filter(product => (includeArchived || product.active) && terms.every(term => normalizeProductText(`${product.productCode} ${product.productName} ${product.variant}`).includes(term)));
}
export async function suggestProducts(store: ProductStore, value: unknown, excludeId?: string) {
  const input = validateProductInput(value);
  return findProductSuggestions(await store.list(), input, excludeId);
}
export async function createProduct(store: ProductStore, requestId: unknown, value: unknown, actor: string, now: string, confirmedDuplicates: boolean) {
  const id = `PROD-${validateRequestId(requestId)}`, values = validateProductInput(value);
  if (!actor.trim()) throw new ProductValidationError("An authenticated staff identity is required.");
  const existing = await store.list();
  const suggestions = findProductSuggestions(existing, values, id);
  if (!existing.some(product => product.id === id) && suggestions.length && !confirmedDuplicates) throw new ProductDuplicatesError(suggestions);
  // The persistence guard enforces request identity, not code uniqueness.
  return store.create({ id, values, actor, now });
}
export async function editProduct(store: ProductStore, input: { id: string; values: ProductInput & { active: unknown }; expectedUpdatedAt: string; requestId: string }, now: string) {
  if (!/^PROD-/.test(input.id) || typeof input.expectedUpdatedAt !== "string" || !input.expectedUpdatedAt) throw new ProductValidationError("Product identity and current revision are required.");
  if (typeof input.values.active !== "boolean") throw new ProductValidationError("Active must be true or false.");
  const values: ProductEdit = { ...validateProductInput(input.values), active: input.values.active };
  return store.edit({ id: input.id, values, expectedUpdatedAt: input.expectedUpdatedAt, requestId: validateRequestId(input.requestId), now });
}

export function cancelProductCreation(store: ProductStore, requestId: unknown, actor: string) {
  if (!actor.trim()) throw new ProductValidationError("An authenticated staff identity is required.");
  return store.cancelCreation(`PROD-${validateRequestId(requestId)}`, actor);
}
