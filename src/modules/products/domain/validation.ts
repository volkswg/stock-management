import type { ProductInput } from '../contracts';
export class ProductError extends Error {
  constructor(message: string, readonly status=400, readonly code='product_invalid') { super(message); }
}
export function productInput(input: unknown): ProductInput {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new ProductError('Enter product details.');
  const v=input as Record<string,unknown>;
  const field=(key:string,max:number,required=false) => {
    if (typeof v[key]!=='string' || v[key].length>max || (required && !v[key].trim())) throw new ProductError('Enter a product name (up to 200 characters), code and variant (up to 100 each).');
    return v[key].trim();
  };
  return {productCode:field('productCode',100),productName:field('productName',200,true),variant:field('variant',100)};
}
export function productId(value: unknown): string {
  if (typeof value!=='string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value)>BigInt('9223372036854775807')) throw new ProductError('Invalid product identity.');
  return value;
}
export function revision(value: unknown): string {
  if (typeof value!=='string' || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value)>BigInt('9223372036854775807')) throw new ProductError('Refresh this record before editing.',428);
  return value;
}
