import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson, productWriteActor } from "@/composition/product-master-http";
import { readBoundedJson } from "@/infrastructure/http/read-json";
import { ProductValidationError } from "@/modules/products/server";
import { isRecord } from "@/shared/lib/is-record";
import type { ProductInput } from "@/modules/products/contracts";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params, product = await createProductMasterServices().products.findById(id);return product ? productJson({ product }) : productJson({ error: "Product not found." }, 404); }
  catch (error) { return productHttpError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    productWriteActor(request);
    const { id } = await params, body = await readBoundedJson(request);
    if (!isRecord(body) || !isRecord(body.product) || Object.keys(body.product).some(key => !["productCode", "productName", "variant", "referenceImageUrl", "active"].includes(key)) || typeof body.requestId !== "string" || typeof body.expectedUpdatedAt !== "string") throw new ProductValidationError("Product details, request ID and current revision are required. Immutable fields cannot be edited.");
    const product = await createProductMasterServices().products.edit({ id, values: body.product as ProductInput & { active: unknown }, requestId: body.requestId, expectedUpdatedAt: body.expectedUpdatedAt });
    return productJson({ product });
  } catch (error) { return productHttpError(error); }
}
