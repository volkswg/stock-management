import type { OrderImageType } from "../contracts";
export function createImageFileName({ orderId, imageType, contentType, uploadTimestamp, index, }: {
    orderId: string;
    imageType: OrderImageType;
    contentType: string;
    uploadTimestamp: number;
    index: number;
}): string {
    return ([
        `order-${imageType}`,
        sanitizeFileNamePart(orderId),
        uploadTimestamp,
        index + 1,
    ].join("-") + getImageExtension(contentType));
}
function sanitizeFileNamePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function getImageExtension(contentType: string): string {
    if (contentType === "image/jpeg")
        return ".jpg";
    if (contentType === "image/png")
        return ".png";
    if (contentType === "image/webp")
        return ".webp";
    return "";
}
