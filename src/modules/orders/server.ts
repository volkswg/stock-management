import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { createSortableId } from "@/services/utils/createSortableId";
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
