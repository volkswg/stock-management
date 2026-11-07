import "server-only";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { OrderImageStorage, ProductImageStorage } from "../../application/ports/order-images";
export function createOrderImageStorage(googleDriveService: IGoogleDriveService): OrderImageStorage<Buffer> {
    return { upload: readInput => googleDriveService.uploadImage(readInput()), remove: readId => googleDriveService.deleteFile(readId()), cleanupFailure: readDetails => console.error("Failed to clean up Google Drive file", readDetails()) };
}
export function createProductImageStorage(googleDriveService: IGoogleDriveService, createId: () => string): ProductImageStorage<File> {
    return { async upload(image) {
            const extension = image.type === "image/png" ? ".png"
                : image.type === "image/webp" ? ".webp" : ".jpg";
            return await googleDriveService.uploadImage({
                fileName: `order-product-${createId()}${extension}`,
                contentType: image.type,
                bytes: Buffer.from(await image.arrayBuffer()),
            });
        } };
}
