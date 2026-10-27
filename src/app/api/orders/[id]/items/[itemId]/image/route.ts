import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/externals/google/drive";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { replaceOrderProductImage } from "@/services/orders";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
): Promise<NextResponse> {
  const paramsValue = await params;
  const orderId = paramsValue.id.trim();
  const itemId = paramsValue.itemId.trim();
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "Order and product IDs are required." }, { status: 400 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Select an image to upload." }, { status: 400 });
  }
  const image = formData.get("image");
  if (
    !(image instanceof File) ||
    !ALLOWED_IMAGE_TYPES.has(image.type) ||
    image.size === 0 ||
    image.size > MAX_IMAGE_SIZE_BYTES
  ) {
    return NextResponse.json({
      error: "Select a JPEG, PNG, or WebP image up to 10 MB.",
    }, { status: 400 });
  }

  try {
    const config = getConfig();
    const googleDriveService = createGoogleDriveServiceFromConfig(config);
    if (!googleDriveService) {
      return NextResponse.json({ error: "Google Drive is not configured." }, { status: 503 });
    }
    const item = await replaceOrderProductImage({
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      googleDriveService,
      orderId,
      itemId,
      image,
    });
    if (!item) {
      return NextResponse.json({ error: "Order product not found." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Failed to replace order product image", {
      orderId,
      itemId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to replace the product image. Please retry." }, { status: 500 });
  }
}
