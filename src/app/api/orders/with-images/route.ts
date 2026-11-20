import { withStagingUploadCleanup } from "@/composition/staging-upload-cleanup";
import { withPersistence } from "@/composition/postgres/route";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/infrastructure/files/google-drive";
import { createBusinessDatabase } from "@/composition/postgres/service";
import {
  createOrderWithImages,
  createOrderFromUploadedImages,
  uploadOrderCreationImage,
  type OrderImageUpload,
} from "@/modules/orders/server";

import type { UploadedOrderCreationImage } from "@/modules/orders/contracts";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES_PER_TYPE = 10;

async function POSTOperation(request: Request): Promise<NextResponse> {
  if (request.headers.get("content-type")?.includes("application/json")) return createFromReferences(request);
  let formData: FormData;
  try { formData = await request.formData(); } catch { return invalidInput(); }
  if (formData.get("operation") === "upload") return uploadSelectedImage(request, formData);
  const input = await readCreateOrderInput(formData);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "Enter valid order details and add at least one bill and product image.",
      },
      { status: 400 },
    );
  }

  try {
    const config = getConfig();
    const googleDriveService = createGoogleDriveServiceFromConfig(config);
    if (!googleDriveService) {
      return NextResponse.json(
        { error: "Google Drive is not configured." },
        { status: 503 },
      );
    }

    const storage = createBusinessDatabase();
    return await withStagingUploadCleanup(googleDriveService, async (googleDriveService) => {
      const order = await createOrderWithImages({
        googleDriveService,
        storage,
        images: input.images,
        seller: input.seller,
        totalPrice: input.totalPrice,
        remark: input.remark,
        createdBy: "web",
      });

      return NextResponse.json({ order }, { status: 201 });
    });
  } catch (error) {
    console.error("Failed to create order with images", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          "Failed to create order. No order was saved if an upload failed.",
      },
      { status: 500 },
    );
  }
}

// New browser flow: each selection is its own durable upload command. The
// subsequent JSON order command does no provider IO and commits atomically.
function invalidInput(): NextResponse {
  return NextResponse.json({ error: "Enter valid order details and add at least one bill and product image." }, { status: 400 });
}
async function uploadSelectedImage(request: Request, form: FormData): Promise<NextResponse> {
  const image = form.get("image"), imageType = form.get("imageType");
  if (!(image instanceof File) || form.getAll("image").length !== 1 ||
      !/^order-image:[a-f0-9-]{36}$/.test(request.headers.get("Idempotency-Key") || "") ||
      !["bill", "product"].includes(String(imageType)) || image.size === 0 || !ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: "Select one JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (image.size > 4_000_000) return NextResponse.json({ error: "Each image must be smaller than 4 MB. Reduce this image and select it again." }, { status: 413 });
  try {
    const drive = createGoogleDriveServiceFromConfig(getConfig());
    if (!drive) return NextResponse.json({ error: "Google Drive is not configured." }, { status: 503 });
    return await withStagingUploadCleanup(drive, async tracked => {
      const uploaded = await uploadOrderCreationImage({ googleDriveService: tracked, image,
        imageType: imageType as "bill" | "product", uploadKey: request.headers.get("Idempotency-Key") || "" });
      return NextResponse.json({ image: uploaded }, { status: 201 });
    });
  } catch {
    console.error("Failed to upload selected order image; retain its operation reference for reconciliation.");
    return NextResponse.json({ error: "The image upload needs review. Retry only this same image and request reference." }, { status: 503 });
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function createFromReferences(request: Request): Promise<NextResponse> {
  let value: unknown;
  try { value = await request.json(); } catch { return invalidInput(); }
  if (!isRecord(value) || !Array.isArray(value.images) || value.images.length < 2 || value.images.length > 20 ||
      (value.seller !== undefined && (typeof value.seller !== "string" || value.seller.trim().length > 100)) ||
      (value.remark !== undefined && (typeof value.remark !== "string" || value.remark.length > 1000)) ||
      (value.totalPrice !== undefined && value.totalPrice !== null && (typeof value.totalPrice !== "number" || !Number.isFinite(value.totalPrice) || value.totalPrice < 0))) return invalidInput();
  const images: UploadedOrderCreationImage[] = [];
  for (const image of value.images) {
    if (!isRecord(image) || typeof image.id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(image.id) ||
        typeof image.url !== "string" || image.url.length > 4096 || typeof image.uploadKey !== "string" ||
        !/^order-image:[a-f0-9-]{36}$/.test(image.uploadKey) || (image.imageType !== "bill" && image.imageType !== "product")) return invalidInput();
    images.push({ id: image.id, url: image.url, uploadKey: image.uploadKey, imageType: image.imageType });
  }
  if (["bill", "product"].some(type => !images.some(image => image.imageType === type) || images.filter(image => image.imageType === type).length > MAX_IMAGES_PER_TYPE)) return invalidInput();
  try {
    const order = await createOrderFromUploadedImages({ storage: createBusinessDatabase(), images,
      seller: typeof value.seller === "string" ? value.seller.trim() : undefined,
      remark: typeof value.remark === "string" ? value.remark.trim() : undefined,
      totalPrice: typeof value.totalPrice === "number" ? value.totalPrice : undefined });
    if (!order) return NextResponse.json({ error: "An image receipt is missing, changed, or no longer available. Review the selected uploads." }, { status: 400 });
    return NextResponse.json({ order }, { status: 201 });
  } catch {
    console.error("Failed to create order from completed image uploads.");
    return NextResponse.json({ error: "The order outcome needs review. Keep the same request reference." }, { status: 500 });
  }
}

type CreateOrderInput = {
  seller?: string;
  totalPrice?: number;
  remark?: string;
  images: OrderImageUpload[];
};

async function readCreateOrderInput(
  formData: FormData,
): Promise<CreateOrderInput | undefined> {

  const seller = formData.get("seller");
  const totalPrice = formData.get("totalPrice");
  const remark = formData.get("remark");
  const billImages = formData.getAll("billImages");
  const productImages = formData.getAll("productImages");
  if (
    (seller !== null && typeof seller !== "string") ||
    (typeof seller === "string" && seller.trim().length > 100) ||
    (totalPrice !== null && typeof totalPrice !== "string") ||
    (remark !== null && typeof remark !== "string") ||
    (typeof remark === "string" && remark.length > 1000) ||
    !areValidImages(billImages) ||
    !areValidImages(productImages)
  ) {
    return undefined;
  }

  const normalizedTotalPrice = parseTotalPrice(totalPrice);
  if (
    normalizedTotalPrice === undefined &&
    totalPrice !== null &&
    totalPrice.trim() !== ""
  ) {
    return undefined;
  }

  try {
    const [billImageUploads, productImageUploads] = await Promise.all([
      toOrderImageUploads(billImages, "bill"),
      toOrderImageUploads(productImages, "product"),
    ]);

    return {
      seller: typeof seller === "string" ? seller.trim() : undefined,
      totalPrice: normalizedTotalPrice,
      remark: typeof remark === "string" ? remark.trim() : undefined,
      images: [...billImageUploads, ...productImageUploads],
    };
  } catch {
    return undefined;
  }
}

function parseTotalPrice(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;

  const totalPrice = Number(value);
  return Number.isFinite(totalPrice) && totalPrice >= 0
    ? totalPrice
    : undefined;
}

function areValidImages(values: FormDataEntryValue[]): values is File[] {
  return (
    values.length > 0 &&
    values.length <= MAX_IMAGES_PER_TYPE &&
    values.every(
      (value) =>
        value instanceof File &&
        value.size > 0 &&
        value.size <= MAX_IMAGE_SIZE_BYTES &&
        ALLOWED_IMAGE_TYPES.has(value.type),
    )
  );
}

async function toOrderImageUploads(
  images: File[],
  imageType: OrderImageUpload["imageType"],
): Promise<OrderImageUpload[]> {
  return Promise.all(
    images.map(async (image) => ({
      contentType: image.type,
      bytes: Buffer.from(await image.arrayBuffer()),
      imageType,
    })),
  );
}

export const POST = withPersistence(POSTOperation);
