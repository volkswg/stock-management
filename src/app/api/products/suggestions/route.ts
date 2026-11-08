import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson } from "@/composition/product-master-http";
import { readBoundedJson } from "@/infrastructure/http/read-json";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return productJson({ suggestions: await createProductMasterServices().products.suggest(await readBoundedJson(request)) }); }
  catch (error) { return productHttpError(error); }
}
