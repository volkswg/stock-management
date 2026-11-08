import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson, productWriteActor } from "@/composition/product-master-http";
import { readBoundedJson } from "@/infrastructure/http/read-json";
import { isRecord } from "@/shared/lib/is-record";
import { ProductValidationError } from "@/modules/products/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const url = new URL(request.url);return productJson({ products: await createProductMasterServices().products.search(url.searchParams.get("q") ?? "", url.searchParams.get("includeArchived") === "true") }); }
  catch (error) { return productHttpError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = productWriteActor(request), body = await readBoundedJson(request);
    if (!isRecord(body) || body.confirmed !== true || !isRecord(body.product) || Object.keys(body.product).some(key => !["productCode", "productName", "variant", "referenceImageUrl"].includes(key))) throw new ProductValidationError("Confirm creation explicitly and provide editable product details only.");
    const product = await createProductMasterServices().products.create(body.requestId, body.product, actor, body.confirmDuplicates === true);
    return productJson({ product }, 201);
  } catch (error) { return productHttpError(error); }
}
