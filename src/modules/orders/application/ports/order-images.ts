import type { CreatedOrder, OrderImageType } from "../../contracts";
export type OrderImageUpload<Bytes> = {
    contentType: string;
    bytes: Bytes;
    imageType: OrderImageType;
};
export type OrderImageReference = {
    id: string;
    webViewLink: string;
};
export interface OrderImageStorage<Bytes> {
    upload(readInput: () => {
        fileName: string;
        contentType: string;
        bytes: Bytes;
    }): Promise<OrderImageReference>;
    remove(readId: () => string): Promise<void>;
    cleanupFailure(readDetails: () => {
        fileId: string | undefined;
        error: string;
    }): void;
}
export interface ProductImageStorage<Image> {
    upload(image: Image): Promise<OrderImageReference>;
}
export interface OrderImageRecords {
    create(input: {
        id: string;
        seller?: string;
        totalPrice?: number | null;
        remark?: string;
        createdBy: string;
    }): Promise<CreatedOrder>;
    bill(input: {
        orderId: string;
        imageUrl: string;
        createdBy: string;
    }): Promise<unknown>;
    item(input: {
        orderId: string;
        imageUrl: string;
        createdBy: string;
    }): Promise<unknown>;
}
export type OrderImageRuntime = {
    createId(): string;
    uploadTimestamp(): number;
};
