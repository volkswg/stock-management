import { createProductMasterServices } from "@/composition/product-master";
import { productHttpError, productJson } from "@/composition/product-master-http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params;return productJson({ links: await createProductMasterServices().links.list(id) }); }
  catch (error) { return productHttpError(error); }
}
