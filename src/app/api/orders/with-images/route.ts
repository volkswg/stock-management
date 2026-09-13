import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/externals/google/drive";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  createOrderWithImages,
  type OrderImageUpload,
} from "@/services/orders";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES_PER_TYPE = 10;

export async function POST(request: Request): Promise<NextResponse> {
  const input = await readCreateOrderInput(request);
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

    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const order = await createOrderWithImages({
      googleDriveService,
      googleSheetsService,
      images: input.images,
      seller: input.seller,
      totalPrice: input.totalPrice,
      remark: input.remark,
      createdBy: "web",
    });

    return NextResponse.json({ order }, { status: 201 });
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

type CreateOrderInput = {
  seller?: string;
  totalPrice?: number;
  remark?: string;
  images: OrderImageUpload[];
};

async function readCreateOrderInput(
  request: Request,
): Promise<CreateOrderInput | undefined> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return undefined;
  }

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
