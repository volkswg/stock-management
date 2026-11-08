// Pure public Product Master contracts. Product codes are descriptive, not IDs.
export type Product = {
  id: string;
  productCode: string;
  productName: string;
  variant: string;
  referenceImageUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};
export type ProductInput = Pick<Product, "productCode" | "productName" | "variant" | "referenceImageUrl">;
export type ProductEdit = ProductInput & { active: boolean };
export type ProductSuggestion = { product: Product; reasons: Array<"code" | "name" | "name_and_variant"> };
