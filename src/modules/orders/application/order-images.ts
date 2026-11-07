import type { CreatedOrder, OrderImageType } from "../contracts";
import type { OrderImageReference, OrderImageUpload, OrderImageStorage, OrderImageRecords, OrderImageRuntime } from "./ports/order-images";
import { createImageFileName } from "../domain/image-names";
type UploadedOrderImage = {
    driveFile: OrderImageReference;
    imageType: OrderImageType;
};
export async function createOrderWithImages<Bytes>({ storage, records, images, seller, totalPrice, remark, createdBy, runtime, }: {
    storage: OrderImageStorage<Bytes>;
    records: OrderImageRecords;
    images: OrderImageUpload<Bytes>[];
    seller?: string;
    totalPrice?: number | null;
    remark?: string;
    createdBy: string;
    runtime: OrderImageRuntime;
}): Promise<CreatedOrder> {
    if (!images.some(({ imageType }) => imageType === "bill") ||
        !images.some(({ imageType }) => imageType === "product")) {
        throw new Error("At least one bill and product image is required.");
    }
    const orderId = runtime.createId();
    const uploadTimestamp = runtime.uploadTimestamp();
    const uploadedImages: UploadedOrderImage[] = [];
    try {
        for (const [index, image] of images.entries()) {
            const driveFile = await storage.upload(() => ({
                fileName: createImageFileName({
                    orderId,
                    imageType: image.imageType,
                    contentType: image.contentType,
                    uploadTimestamp,
                    index,
                }),
                contentType: image.contentType,
                bytes: image.bytes,
            }));
            uploadedImages.push({ driveFile, imageType: image.imageType });
        }
    }
    catch (error) {
        await cleanUpUploadedImages(storage, uploadedImages);
        throw error;
    }
    const order = await records.create({
        id: orderId,
        seller,
        totalPrice,
        remark,
        createdBy,
    });
    for (const image of uploadedImages) {
        if (image.imageType === "bill") {
            await records.bill({
                orderId,
                imageUrl: image.driveFile.webViewLink,
                createdBy,
            });
        }
        else {
            await records.item({
                orderId,
                imageUrl: image.driveFile.webViewLink,
                createdBy,
            });
        }
    }
    return order;
}
async function cleanUpUploadedImages<Bytes>(storage: OrderImageStorage<Bytes>, uploadedImages: UploadedOrderImage[]): Promise<void> {
    const results = await Promise.allSettled(uploadedImages.map(({ driveFile }) => storage.remove(() => driveFile.id)));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
            storage.cleanupFailure(() => ({
                fileId: uploadedImages[index]?.driveFile.id,
                error: result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
            }));
        }
    }
}
