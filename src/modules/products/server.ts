import "server-only";
import type { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import { createProductStore } from "./infrastructure/google-sheets/product-store";
import * as products from "./application/products";
import type { ProductInput } from "./contracts";
export { ProductValidationError, ProductDuplicatesError, ProductNotFoundError, ProductCreationCancelledError } from "./domain/validation";
export { GuardConflictError, GuardOutcomeUnknownError } from "@/infrastructure/persistence/google-sheets/guarded-write";
export function createProductsService(client: GoogleSheetsClient, now = () => new Date().toISOString()) {
  const store = createProductStore(client);
  return {
    cancelCreation: (requestId: unknown, actor: string) => products.cancelProductCreation(store, requestId, actor),
    search: (query: string, includeArchived = false) => products.searchProducts(store, query, includeArchived),
    findById: async (id: string) => (await store.list()).find(product => product.id === id),
    suggest: (input: unknown, excludeId?: string) => products.suggestProducts(store, input, excludeId),
    create: (requestId: unknown, input: unknown, actor: string, confirmedDuplicates: boolean) => products.createProduct(store, requestId, input, actor, now(), confirmedDuplicates),
    edit: (input: { id: string; values: ProductInput & { active: unknown }; expectedUpdatedAt: string; requestId: string }) => products.editProduct(store, input, now()),
  };
}
