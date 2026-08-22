import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/externals/google/drive";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  createOrderBill,
  createOrderItem,
  orderExists,
} from "@/services/orders";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type OrderImageType = "bill" | "product";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const orderId = id.trim();
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 },
      );
    }

    const upload = await readImageUpload(request);
    if (!upload) {
      return NextResponse.json(
        { error: "Select a JPEG, PNG, or WebP image up to 10 MB." },
        { status: 400 },
      );
    }

    const config = getConfig();
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const hasOrder = await orderExists({ googleSheetsService, orderId });
    if (!hasOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const googleDriveService = createGoogleDriveServiceFromConfig(config);
    if (!googleDriveService) {
      return NextResponse.json(
        { error: "Google Drive is not configured." },
        { status: 503 },
      );
    }

    const driveFile = await googleDriveService.uploadImage({
      fileName: createImageFileName(orderId, upload.image, upload.imageType),
      contentType: upload.image.type,
      bytes: Buffer.from(await upload.image.arrayBuffer()),
    });
    const record =
      upload.imageType === "bill"
        ? await createOrderBill({
            googleSheetsService,
            orderId,
            imageUrl: driveFile.webViewLink,
            createdBy: "web",
          })
        : await createOrderItem({
            googleSheetsService,
            orderId,
            imageUrl: driveFile.webViewLink,
            createdBy: "web",
          });

    return NextResponse.json(
      { imageType: upload.imageType, record },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to upload order image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to upload order image." },
      { status: 500 },
    );
  }
}

async function readImageUpload(
  request: Request,
): Promise<{ image: File; imageType: OrderImageType } | undefined> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return undefined;
  }

  const image = formData.get("image");
  const imageType = formData.get("imageType");
  if (
    !(image instanceof File) ||
    image.size === 0 ||
    image.size > MAX_IMAGE_SIZE_BYTES ||
    !ALLOWED_IMAGE_TYPES.has(image.type) ||
    !isOrderImageType(imageType)
  ) {
    return undefined;
  }

  return { image, imageType };
}

function isOrderImageType(value: FormDataEntryValue | null): value is OrderImageType {
  return value === "bill" || value === "product";
}

function createImageFileName(
  orderId: string,
  image: File,
  imageType: OrderImageType,
): string {
  const extension = getImageExtension(image.type);
  return [
    `order-${imageType}`,
    sanitizeFileNamePart(orderId),
    Date.now(),
  ].join("-") + extension;
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getImageExtension(contentType: string): string {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return "";
}
