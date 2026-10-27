import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { createSortableId } from "@/services/utils/createSortableId";

export type ReplacedOrderProductImage = {
  id: string;
  imageUrl: string;
  updatedAt: string;
};

export async function replaceOrderProductImage({
  googleSheetsService,
  googleDriveService,
  orderId,
  itemId,
  image,
}: {
  googleSheetsService: IGoogleSheetsService;
  googleDriveService: IGoogleDriveService;
  orderId: string;
  itemId: string;
  image: File;
}): Promise<ReplacedOrderProductImage | undefined> {
  const rows = await googleSheetsService.orderItems.readRows("A2:J");
  const rowIndex = rows.findIndex(
    ([id, linkedOrderId, , , , , , , deletedAt]) =>
      String(id ?? "").trim() === itemId &&
      String(linkedOrderId ?? "").trim() === orderId &&
      !String(deletedAt ?? "").trim(),
  );
  if (rowIndex === -1) return undefined;

  const extension = image.type === "image/png" ? ".png"
    : image.type === "image/webp" ? ".webp" : ".jpg";
  const uploaded = await googleDriveService.uploadImage({
    fileName: `order-product-${createSortableId()}${extension}`,
    contentType: image.type,
    bytes: Buffer.from(await image.arrayBuffer()),
  });
  if (!uploaded.webViewLink?.trim()) throw new Error("Google Drive returned no image URL.");

  const updatedAt = new Date().toISOString();
  const rowNumber = rowIndex + 2;
  // Update only the image and timestamp, preserving product codes and quantities.
  await googleSheetsService.orderItems.batchUpdateRows([
    { range: `C${rowNumber}`, values: [[uploaded.webViewLink]] },
    { range: `H${rowNumber}`, values: [[updatedAt]] },
  ]);
  return { id: itemId, imageUrl: uploaded.webViewLink, updatedAt };
}
