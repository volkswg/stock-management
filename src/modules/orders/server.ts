import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { createSortableId } from "@/infrastructure/runtime/create-sortable-id";
import type { CreatedOrder, OrderListItem, OrderDetail } from "./contracts";
import { createOrder as executeCreateOrder, type CreateOrderInput } from "./application/create-order";
import { listOrders as executeListOrders } from "./application/list-orders";
import { GoogleSheetsOrderListReader } from "./infrastructure/google-sheets/order-list-reader";
import { GoogleSheetsOrderWriter } from "./infrastructure/google-sheets/order-writer";

import { getOrderDetail as executeGetOrderDetail } from "./application/get-order-detail";
import type { OrderDetailShipmentProjectionReader } from "./application/ports/order-detail-shipment-projection";
import { GoogleSheetsOrderDetailReader } from "./infrastructure/google-sheets/order-detail-reader";

// Existing server callers keep passing the existing service. Only this
// composition boundary knows the concrete adapter, clock and ID generator.
export async function listOrders({
  googleSheetsService,
}: { googleSheetsService: IGoogleSheetsService }): Promise<OrderListItem[]> {
  return executeListOrders(new GoogleSheetsOrderListReader(googleSheetsService));
}

export async function createOrder({
  googleSheetsService, id, seller, totalPrice, remark, createdBy,
}: CreateOrderInput & { googleSheetsService: IGoogleSheetsService }): Promise<CreatedOrder> {
  return executeCreateOrder({ id, seller, totalPrice, remark, createdBy }, {
    writer: new GoogleSheetsOrderWriter(googleSheetsService),
    now: () => new Date().toISOString(),
    createId: createSortableId,
  });
}

export async function getOrderDetail({
  googleSheetsService,
  orderId,
  shipmentProjection,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
  shipmentProjection: OrderDetailShipmentProjectionReader;
}): Promise<OrderDetail | undefined> {
  return await executeGetOrderDetail(new GoogleSheetsOrderDetailReader(googleSheetsService), shipmentProjection, orderId);
}
import * as mutations from "./application/order-mutations";
import { createOrderMutationStore } from "./infrastructure/google-sheets/order-mutations";
import type { OrderItemQuantityType, UpdateOrderItemQuantityResult, UpdateOrderItemProductCodeResult, UpdateOrderDetailsResult, CompleteWebOrderPriceResult, OrderProductUpdate, UpdatedOrderProduct } from "./contracts";
const mutationRuntime = { now: () => new Date().toISOString() };
export async function updateOrderItemQuantity({ googleSheetsService, orderId, orderItemId, quantity, quantityType, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    orderItemId: string;
    quantity: number;
    quantityType: OrderItemQuantityType;
}): Promise<UpdateOrderItemQuantityResult> {
    return mutations.updateOrderItemQuantity({ store: createOrderMutationStore(googleSheetsService), orderId, orderItemId, quantity, quantityType, runtime: mutationRuntime });
}
export async function updateOrderItemProductCode({ googleSheetsService, orderId, orderItemId, productCode, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    orderItemId: string;
    productCode: string;
}): Promise<UpdateOrderItemProductCodeResult> {
    return mutations.updateOrderItemProductCode({ store: createOrderMutationStore(googleSheetsService), orderId, orderItemId, productCode, runtime: mutationRuntime });
}
export async function updateOrderDetails({ googleSheetsService, orderId, remark, totalPrice, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    remark?: string;
    totalPrice?: number;
}): Promise<UpdateOrderDetailsResult> {
    return mutations.updateOrderDetails({ store: createOrderMutationStore(googleSheetsService), orderId, remark, totalPrice, runtime: mutationRuntime });
}
export async function completeWebOrderPrice({ googleSheetsService, orderId, totalPrice, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    totalPrice: number;
}): Promise<CompleteWebOrderPriceResult> {
    return mutations.completeWebOrderPrice({ store: createOrderMutationStore(googleSheetsService), orderId, totalPrice, runtime: mutationRuntime });
}
export async function updateOrderProducts({ googleSheetsService, orderId, items, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    items: OrderProductUpdate[];
}): Promise<{
    outcome: "updated";
    items: UpdatedOrderProduct[];
} | {
    outcome: "not_found";
    itemId: string;
}> {
    return mutations.updateOrderProducts({ store: createOrderMutationStore(googleSheetsService), orderId, items, runtime: mutationRuntime });
}
export async function orderExists({ googleSheetsService, orderId }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
}): Promise<boolean> { return mutations.orderExists(createOrderMutationStore(googleSheetsService), orderId); }
export async function findOrderRowNumber({ googleSheetsService, orderId }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
}): Promise<number> { return createOrderMutationStore(googleSheetsService).findOrderRowNumber(orderId); }
export async function prepareOrderTransition({ googleSheetsService, orderId }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
}) { return mutations.prepareOrderTransition(createOrderMutationStore(googleSheetsService), orderId); }
import * as attachments from "./application/order-attachments";
import { createOrderAttachmentStore } from "./infrastructure/google-sheets/order-attachments";
import type { Order, OrderBill, OrderItem } from "./contracts";
const attachmentRuntime = { now: () => new Date().toISOString(), createId: createSortableId };
export async function createOrderBill({ googleSheetsService, orderId, imageUrl, createdBy, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    imageUrl: string;
    createdBy: string;
}): Promise<OrderBill> {
    return attachments.createOrderBill({ store: createOrderAttachmentStore(googleSheetsService), orderId, imageUrl, createdBy, runtime: attachmentRuntime });
}
export async function createOrderItem({ googleSheetsService, orderId, imageUrl, quoteQuantity = "", deliveredQuantity = "", productCode = "", createdBy, }: {
    googleSheetsService: IGoogleSheetsService;
    orderId: string;
    imageUrl: string;
    quoteQuantity?: string;
    deliveredQuantity?: string;
    productCode?: string;
    createdBy: string;
}): Promise<OrderItem> {
    return attachments.createOrderItem({ store: createOrderAttachmentStore(googleSheetsService), orderId, imageUrl, quoteQuantity, deliveredQuantity, productCode, createdBy, runtime: attachmentRuntime });
}
export async function createDraftRecord({ googleSheetsService, createdBy }: {
    googleSheetsService: IGoogleSheetsService;
    createdBy: string;
}): Promise<Order> { return attachments.createDraftRecord({ store: createOrderAttachmentStore(googleSheetsService), createdBy, runtime: attachmentRuntime }); }
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import type { OrderImageUpload as ImageUpload } from "./application/ports/order-images";
import type { ReplacedOrderProductImage } from "./contracts";
import { createOrderWithImages as executeCreateImages } from "./application/order-images";
import { replaceOrderProductImage as executeReplaceImage } from "./application/replace-product-image";
import { createOrderImageStorage, createProductImageStorage } from "./infrastructure/google-drive/order-images";
export type { OrderImageType } from "./contracts";
export type OrderImageUpload = ImageUpload<Buffer>;
export async function createOrderWithImages({ googleDriveService, googleSheetsService, images, seller, totalPrice, remark, createdBy, }: {
    googleDriveService: IGoogleDriveService;
    googleSheetsService: IGoogleSheetsService;
    images: OrderImageUpload[];
    seller?: string;
    totalPrice?: number | null;
    remark?: string;
    createdBy: string;
}): Promise<CreatedOrder> {
    return executeCreateImages({ storage: createOrderImageStorage(googleDriveService), records: { create: input => createOrder({ ...input, googleSheetsService }), bill: input => createOrderBill({ ...input, googleSheetsService }), item: input => createOrderItem({ ...input, googleSheetsService }) }, images, seller, totalPrice, remark, createdBy, runtime: { createId: createSortableId, uploadTimestamp: () => Date.now() } });
}
export async function replaceOrderProductImage({ googleSheetsService, googleDriveService, orderId, itemId, image, }: {
    googleSheetsService: IGoogleSheetsService;
    googleDriveService: IGoogleDriveService;
    orderId: string;
    itemId: string;
    image: File;
}): Promise<ReplacedOrderProductImage | undefined> {
    return executeReplaceImage({ store: createOrderMutationStore(googleSheetsService), storage: createProductImageStorage(googleDriveService, createSortableId), orderId, itemId, image, runtime: mutationRuntime });
}
