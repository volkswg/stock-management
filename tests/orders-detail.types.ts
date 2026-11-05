import type { IGoogleSheetsService } from "../src/externals/google/sheet/types";
import type { OrderDetail, OrderShipment } from "../src/modules/orders/contracts";
import type { getOrderDetail as Direct } from "../src/services/orders/listOrders";
import type { getOrderDetail as Barrel } from "../src/services/orders";
import type { getOrderDetail as Server } from "../src/modules/orders/server";
import type { getOrderDetail as Application } from "../src/modules/orders/application/get-order-detail";
import type { OrderDetailReader } from "../src/modules/orders/application/ports/order-detail-reader";
import type { OrderDetailShipmentProjectionReader, OrderShipmentCandidates } from "../src/modules/orders/application/ports/order-detail-shipment-projection";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type DetailCompatibility = [
  Assert<Equal<Parameters<typeof Direct>[0], { googleSheetsService: IGoogleSheetsService; orderId: string }>>,
  Assert<Equal<typeof Direct, typeof Barrel>>,
  Assert<Equal<ReturnType<typeof Direct>, Promise<OrderDetail | undefined>>>,
  Assert<Equal<Parameters<typeof Server>[0], { googleSheetsService: IGoogleSheetsService; orderId: string; shipmentProjection: OrderDetailShipmentProjectionReader }>>,
  Assert<Equal<ReturnType<typeof Server>, Promise<OrderDetail | undefined>>>,
  Assert<Equal<Parameters<typeof Application>, [OrderDetailReader, OrderDetailShipmentProjectionReader, string]>>,
  Assert<Equal<ReturnType<typeof Application>, Promise<OrderDetail | undefined>>>,
  Assert<Equal<ReturnType<OrderShipmentCandidates["findShipmentById"]>, OrderShipment | null>>,
  Assert<Equal<keyof OrderDetailShipmentProjectionReader, "readLinks" | "readShipments">>,
  Assert<Equal<keyof OrderDetailReader, "readOrders" | "readProductImages" | "readBillImages">>,
];
