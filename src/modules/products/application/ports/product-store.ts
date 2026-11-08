import type { Product, ProductInput, ProductEdit } from "../../contracts";
export interface ProductStore {
  list(): Promise<Product[]>;
  cancelCreation(id: string, actor: string): Promise<{ outcome: "cancelled" } | { outcome: "created"; product: Product }>;
  create(input: { id: string; values: ProductInput; actor: string; now: string }): Promise<Product>;
  edit(input: { id: string; values: ProductEdit; expectedUpdatedAt: string; requestId: string; now: string }): Promise<Product>;
}
