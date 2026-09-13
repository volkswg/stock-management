import type {
  GoogleDriveFile,
  IGoogleDriveService,
} from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { createSortableId } from "../utils/createSortableId";
import { createOrder, type CreatedOrder } from "./createOrder";
import { createOrderBill } from "./createOrderBill";
import { createOrderItem } from "./createOrderItem";

export type OrderImageType = "bill" | "product";

export type OrderImageUpload = {
  contentType: string;
  bytes: Buffer;
  imageType: OrderImageType;
};

type UploadedOrderImage = {
  driveFile: GoogleDriveFile;
  imageType: OrderImageType;
};

export async function createOrderWithImages({
  googleDriveService,
  googleSheetsService,
  images,
  seller,
  totalPrice,
  remark,
  createdBy,
}: {
  googleDriveService: IGoogleDriveService;
  googleSheetsService: IGoogleSheetsService;
  images: OrderImageUpload[];
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
  createdBy: string;
}): Promise<CreatedOrder> {
  if (
    !images.some(({ imageType }) => imageType === "bill") ||
    !images.some(({ imageType }) => imageType === "product")
  ) {
    throw new Error("At least one bill and product image is required.");
  }

  const orderId = createSortableId();
  const uploadTimestamp = Date.now();
  const uploadedImages: UploadedOrderImage[] = [];

  try {
    for (const [index, image] of images.entries()) {
      const driveFile = await googleDriveService.uploadImage({
        fileName: createImageFileName({
          orderId,
          imageType: image.imageType,
          contentType: image.contentType,
          uploadTimestamp,
          index,
        }),
        contentType: image.contentType,
        bytes: image.bytes,
      });
      uploadedImages.push({ driveFile, imageType: image.imageType });
    }
  } catch (error) {
    await cleanUpUploadedImages(googleDriveService, uploadedImages);
    throw error;
  }

  const order = await createOrder({
    googleSheetsService,
    id: orderId,
    seller,
    totalPrice,
    remark,
    createdBy,
  });

  for (const image of uploadedImages) {
    if (image.imageType === "bill") {
      await createOrderBill({
        googleSheetsService,
        orderId,
        imageUrl: image.driveFile.webViewLink,
        createdBy,
      });
    } else {
      await createOrderItem({
        googleSheetsService,
        orderId,
        imageUrl: image.driveFile.webViewLink,
        createdBy,
      });
    }
  }

  return order;
}

async function cleanUpUploadedImages(
  googleDriveService: IGoogleDriveService,
  uploadedImages: UploadedOrderImage[],
): Promise<void> {
  const results = await Promise.allSettled(
    uploadedImages.map(({ driveFile }) =>
      googleDriveService.deleteFile(driveFile.id),
    ),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error("Failed to clean up Google Drive file", {
        fileId: uploadedImages[index]?.driveFile.id,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }
}

function createImageFileName({
  orderId,
  imageType,
  contentType,
  uploadTimestamp,
  index,
}: {
  orderId: string;
  imageType: OrderImageType;
  contentType: string;
  uploadTimestamp: number;
  index: number;
}): string {
  return (
    [
      `order-${imageType}`,
      sanitizeFileNamePart(orderId),
      uploadTimestamp,
      index + 1,
    ].join("-") + getImageExtension(contentType)
  );
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
