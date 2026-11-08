import { isRequestId } from "@/shared/lib/request-id";
import type { ProductInput, ProductSuggestion, Product } from "../contracts";
export class ProductValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ProductValidationError"; }
}
export class ProductCreationCancelledError extends Error { constructor() { super("This creation was permanently cancelled. Start a new creation only if needed.");this.name = "ProductCreationCancelledError"; } }
export class ProductNotFoundError extends Error { constructor() { super("Product not found.");this.name = "ProductNotFoundError"; } }
export class ProductDuplicatesError extends Error {
  constructor(readonly suggestions: ProductSuggestion[]) { super("Possible duplicate products were found. Review them before confirming creation."); this.name = "ProductDuplicatesError"; }
}
export function validateProductInput(value: unknown): ProductInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProductValidationError("Product details are required.");
  const input = value as Record<string, unknown>;
  const limits = { productCode: 100, productName: 200, variant: 200, referenceImageUrl: 2048 };
  const result = {} as ProductInput;
  for (const field of Object.keys(limits) as Array<keyof ProductInput>) {
    if (typeof input[field] !== "string" || input[field].length > limits[field]) throw new ProductValidationError(`${field} must be text with at most ${limits[field]} characters.`);
    result[field] = input[field].trim();
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result[field])) throw new ProductValidationError(`${field} contains invalid control characters.`);
  }
  if (!result.productName) throw new ProductValidationError("Product name is required.");
  if (result.referenceImageUrl) {
    let url: URL;
    try { url = new URL(result.referenceImageUrl); } catch { throw new ProductValidationError("Reference image must be an HTTPS URL."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new ProductValidationError("Reference image must be an HTTPS URL without credentials.");
  }
  return result;
}
export function normalizeProductText(value: string): string { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"); }
export function findProductSuggestions(products: Product[], input: ProductInput, excludeId?: string): ProductSuggestion[] {
  const code = normalizeProductText(input.productCode), name = normalizeProductText(input.productName), variant = normalizeProductText(input.variant);
  return products.filter(product => product.id !== excludeId).map(product => {
    const reasons: ProductSuggestion["reasons"] = [];
    if (code && normalizeProductText(product.productCode) === code) reasons.push("code");
    if (name && normalizeProductText(product.productName) === name) reasons.push(normalizeProductText(product.variant) === variant ? "name_and_variant" : "name");
    return { product, reasons };
  }).filter(suggestion => suggestion.reasons.length > 0);
}
export function validateRequestId(value: unknown): string {
  if (!isRequestId(value)) throw new ProductValidationError("A valid request ID is required.");
  return value.toLowerCase();
}
