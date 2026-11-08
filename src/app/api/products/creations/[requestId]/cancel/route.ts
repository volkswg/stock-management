import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson, productWriteActor } from "@/composition/product-master-http";
import { readBoundedJson } from "@/infrastructure/http/read-json";
import { ProductValidationError } from "@/modules/products/server";
import { isRecord } from "@/shared/lib/is-record";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const actor = productWriteActor(request), body = await readBoundedJson(request), { requestId } = await params;
    if (!isRecord(body) || body.confirmed !== true) throw new ProductValidationError("Confirm cancellation explicitly. An already-created product will be retained.");
    return productJson(await createProductMasterServices().products.cancelCreation(requestId, actor));
  } catch (error) { return productHttpError(error); }
}
