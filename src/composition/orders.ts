import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { OrderDetail } from "@/modules/orders/contracts";
import { getOrderDetail as executeGetOrderDetail } from "@/modules/orders/server";
import { GoogleSheetsOrderDetailShipmentProjection } from "@/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection";
export { type OrderListItem, type OrderProductImage, type OrderBillImage, type OrderDetail } from "@/modules/orders/contracts";
export { listOrders } from "@/modules/orders/server";

// Temporary legacy-only composition; Orders module never imports Shipments.
export async function getOrderDetail({
  googleSheetsService,
  orderId,
}: {
  googleSheetsService: IGoogleSheetsService;
  orderId: string;
}): Promise<OrderDetail | undefined> {
  return await executeGetOrderDetail({
    googleSheetsService,
    orderId,
    shipmentProjection: new GoogleSheetsOrderDetailShipmentProjection(googleSheetsService),
  });
}
