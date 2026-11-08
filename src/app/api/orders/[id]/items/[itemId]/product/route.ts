import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson, productWriteActor } from "@/composition/product-master-http";
import { readBoundedJson } from "@/infrastructure/http/read-json";
import { ProductValidationError } from "@/modules/products/server";
import { isRecord } from "@/shared/lib/is-record";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try { const { id, itemId } = await params, services = createProductMasterServices(), link = await services.links.read(id, itemId);if (!link) return productJson({ error: "Order item not found." }, 404);return productJson({ link, product: link.productId ? await services.products.findById(link.productId) ?? null : null }); }
  catch (error) { return productHttpError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    productWriteActor(request);
    const { id, itemId } = await params, body = await readBoundedJson(request);
    if (!isRecord(body) || !(body.productId === null || typeof body.productId === "string") || typeof body.revision !== "string" || typeof body.requestId !== "string") throw new ProductValidationError("Product ID, association revision and request ID are required.");
    const services = createProductMasterServices(), link = await services.links.save({ orderId: id, itemId, productId: body.productId, revision: body.revision, requestId: body.requestId });
    return productJson({ link, product: link.productId ? await services.products.findById(link.productId) ?? null : null });
  } catch (error) { return productHttpError(error); }
}
