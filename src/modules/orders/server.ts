import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import type { CreatedOrder, OrderListItem, OrderDetail } from "./contracts";
import { createOrder as executeCreateOrder, type CreateOrderInput } from "./application/create-order";
import { listOrders as executeListOrders } from "./application/list-orders";
import { PostgresOrderListReader } from "./infrastructure/postgres/order-list-reader";
import { PostgresOrderWriter } from "./infrastructure/postgres/order-writer";
import type { OrderListQuery, OrderListPageResult } from "./contracts";

import { getOrderDetail as executeGetOrderDetail } from "./application/get-order-detail";
import type { OrderDetailShipmentProjectionReader } from "./application/ports/order-detail-shipment-projection";
import { PostgresOrderDetailReader } from "./infrastructure/postgres/order-detail-reader";

// Feature composition owns the native adapter, clock and ID generator.
export async function listOrders({
  storage,
}: { storage: Storage }): Promise<OrderListItem[]> {
  return executeListOrders(new PostgresOrderListReader(storage));
}
export async function listOrderPage({storage,query}: {storage: Storage;query: OrderListQuery}): Promise<OrderListPageResult> {
  return new PostgresOrderListReader(storage).readPage(query);
}

export async function createOrder({
  storage, id, seller, totalPrice, remark, createdBy,
}: CreateOrderInput & { storage: Storage }): Promise<CreatedOrder> {
  return executeCreateOrder({ id, seller, totalPrice, remark, createdBy }, {
    writer: new PostgresOrderWriter(storage),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}

export async function getOrderDetail({
  storage,
  orderId,
  shipmentProjection,
}: {
  storage: Storage;
  orderId: string;
  shipmentProjection: OrderDetailShipmentProjectionReader;
}): Promise<OrderDetail | undefined> {
  return await executeGetOrderDetail(new PostgresOrderDetailReader(storage), shipmentProjection, orderId);
}
import * as mutations from "./application/order-mutations";
import { createOrderMutationStore } from "./infrastructure/postgres/order-mutations";
import type { OrderItemQuantityType, UpdateOrderItemQuantityResult, UpdateOrderItemProductCodeResult, UpdateOrderDetailsResult, CompleteWebOrderPriceResult, OrderProductUpdate, UpdatedOrderProduct } from "./contracts";
const mutationRuntime = { now: () => new Date().toISOString() };
export async function updateOrderItemQuantity({ storage, orderId, orderItemId, quantity, quantityType, }: {
    storage: Storage;
    orderId: string;
    orderItemId: string;
    quantity: number;
    quantityType: OrderItemQuantityType;
}): Promise<UpdateOrderItemQuantityResult> {
    return mutations.updateOrderItemQuantity({ store: createOrderMutationStore(storage), orderId, orderItemId, quantity, quantityType, runtime: mutationRuntime });
}
export async function updateOrderItemProductCode({ storage, orderId, orderItemId, productCode, }: {
    storage: Storage;
    orderId: string;
    orderItemId: string;
    productCode: string;
}): Promise<UpdateOrderItemProductCodeResult> {
    return mutations.updateOrderItemProductCode({ store: createOrderMutationStore(storage), orderId, orderItemId, productCode, runtime: mutationRuntime });
}
export async function updateOrderDetails({ storage, orderId, seller, remark, totalPrice, }: {
    storage: Storage;
    orderId: string;
    seller?: string;
    remark?: string;
    totalPrice?: number;
}): Promise<UpdateOrderDetailsResult> {
    return mutations.updateOrderDetails({ store: createOrderMutationStore(storage), orderId, seller, remark, totalPrice, runtime: mutationRuntime });
}
export async function completeWebOrderPrice({ storage, orderId, totalPrice, }: {
    storage: Storage;
    orderId: string;
    totalPrice: number;
}): Promise<CompleteWebOrderPriceResult> {
    return mutations.completeWebOrderPrice({ store: createOrderMutationStore(storage), orderId, totalPrice, runtime: mutationRuntime });
}
export async function updateOrderProducts({ storage, orderId, items, }: {
    storage: Storage;
    orderId: string;
    items: OrderProductUpdate[];
}): Promise<{
    outcome: "updated";
    items: UpdatedOrderProduct[];
} | {
    outcome: "not_found";
    itemId: string;
}> {
    return mutations.updateOrderProducts({ store: createOrderMutationStore(storage), orderId, items, runtime: mutationRuntime });
}
export async function orderExists({ storage, orderId }: {
    storage: Storage;
    orderId: string;
}): Promise<boolean> { return mutations.orderExists(createOrderMutationStore(storage), orderId); }
export async function prepareOrderTransition({ storage, orderId }: {
    storage: Storage;
    orderId: string;
}) { return mutations.prepareOrderTransition(createOrderMutationStore(storage), orderId); }
import * as attachments from "./application/order-attachments";
import { createOrderAttachmentStore } from "./infrastructure/postgres/order-attachments";
import type { Order, OrderBill, OrderItem } from "./contracts";
const attachmentRuntime = { now: () => new Date().toISOString(), createId: createSortableId };
export async function createOrderBill({ storage, orderId, imageUrl, createdBy, }: {
    storage: Storage;
    orderId: string;
    imageUrl: string;
    createdBy: string;
}): Promise<OrderBill> {
    return attachments.createOrderBill({ store: createOrderAttachmentStore(storage), orderId, imageUrl, createdBy, runtime: attachmentRuntime });
}
export async function createOrderItem({ storage, orderId, imageUrl, quoteQuantity = "", deliveredQuantity = "", productCode = "", createdBy, }: {
    storage: Storage;
    orderId: string;
    imageUrl: string;
    quoteQuantity?: string;
    deliveredQuantity?: string;
    productCode?: string;
    createdBy: string;
}): Promise<OrderItem> {
    return attachments.createOrderItem({ store: createOrderAttachmentStore(storage), orderId, imageUrl, quoteQuantity, deliveredQuantity, productCode, createdBy, runtime: attachmentRuntime });
}
export async function createDraftRecord({ storage, createdBy }: {
    storage: Storage;
    createdBy: string;
}): Promise<Order> { return attachments.createDraftRecord({ store: createOrderAttachmentStore(storage), createdBy, runtime: attachmentRuntime }); }
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { OrderImageUpload as ImageUpload } from "./application/ports/order-images";
import type { ReplacedOrderProductImage } from "./contracts";
import { createOrderWithImages as executeCreateImages } from "./application/order-images";
import { createOrderFromUploadedImages as executeCreateUploadedImages } from "./application/order-images";
import { uploadedDriveImage, verifiedOrderImages } from "./infrastructure/postgres/order-image-uploads";
import type { UploadedOrderCreationImage } from "./contracts";
import { replaceOrderProductImage as executeReplaceImage } from "./application/replace-product-image";
import { createOrderImageStorage, createProductImageStorage } from "./infrastructure/google-drive/order-images";
export type { OrderImageType } from "./contracts";
export type OrderImageUpload = ImageUpload<Buffer>;
export async function uploadOrderCreationImage({ googleDriveService, image, imageType, uploadKey }: {
    googleDriveService: IGoogleDriveService; image: File; imageType: "bill" | "product"; uploadKey: string;
}): Promise<UploadedOrderCreationImage> {
    const extension = image.type === "image/png" ? ".png" : image.type === "image/webp" ? ".webp" : ".jpg";
    const bytes = Buffer.from(await image.arrayBuffer());
    const file = await createOrderImageStorage(googleDriveService).upload(() => ({
        fileName: `order-${imageType}-${createSortableId()}${extension}`,
        contentType: image.type, bytes,
    }));
    return { ...await uploadedDriveImage(file.id), imageType, uploadKey };
}
export async function createOrderFromUploadedImages({ storage, images, seller, totalPrice, remark }: {
    storage: Storage; images: UploadedOrderCreationImage[]; seller?: string; totalPrice?: number | null; remark?: string;
}): Promise<CreatedOrder | undefined> {
    const verified = await verifiedOrderImages(images);
    if (!verified) return undefined;
    return executeCreateUploadedImages({ records: {
        create: input => createOrder({ ...input, storage }),
        bill: input => createOrderBill({ ...input, storage }),
        item: input => createOrderItem({ ...input, storage }),
    }, images: verified, seller, totalPrice, remark, createdBy: "web", createId: createSortableId });
}
export async function createOrderWithImages({ googleDriveService, storage, images, seller, totalPrice, remark, createdBy, }: {
    googleDriveService: IGoogleDriveService;
    storage: Storage;
    images: OrderImageUpload[];
    seller?: string;
    totalPrice?: number | null;
    remark?: string;
    createdBy: string;
}): Promise<CreatedOrder> {
    return executeCreateImages({ storage: createOrderImageStorage(googleDriveService), records: { create: input => createOrder({ ...input, storage }), bill: input => createOrderBill({ ...input, storage }), item: input => createOrderItem({ ...input, storage }) }, images, seller, totalPrice, remark, createdBy, runtime: { createId: createSortableId, uploadTimestamp: () => Date.now() } });
}
export async function replaceOrderProductImage({ storage, googleDriveService, orderId, itemId, image, }: {
    storage: Storage;
    googleDriveService: IGoogleDriveService;
    orderId: string;
    itemId: string;
    image: File;
}): Promise<ReplacedOrderProductImage | undefined> {
    return executeReplaceImage({ store: createOrderMutationStore(storage), storage: createProductImageStorage(googleDriveService, createSortableId), orderId, itemId, image, runtime: mutationRuntime });
}
