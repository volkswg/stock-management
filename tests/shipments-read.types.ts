import type { IGoogleSheetsService } from "../src/externals/google/sheet/types";
import type { ShipmentListItem, ShipmentStatus } from "../src/modules/shipments/contracts";
import type { listShipments as Direct, getShipmentDetail as DirectDetail } from "../src/services/shipments/listShipments";
import type { listShipments as Barrel, getShipmentDetail as BarrelDetail } from "../src/services/shipments";
import type { listShipments as Server, getShipmentDetail as ServerDetail } from "../src/modules/shipments/server";
import type { ShipmentListReader, ShipmentReadModel } from "../src/modules/shipments/application/ports/shipment-list-reader";
import type { listShipments as Application, getShipmentDetail as ApplicationDetail } from "../src/modules/shipments/application/list-shipments";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type ReadCompatibility = [
  Assert<Equal<Parameters<typeof Direct>[0], { googleSheetsService: IGoogleSheetsService; includeOrders?: boolean; excludeStatuses?: readonly ShipmentStatus[] }>>,
  Assert<Equal<Parameters<typeof DirectDetail>[0], { googleSheetsService: IGoogleSheetsService; shipmentId: string }>>,
  Assert<Equal<typeof Direct, typeof Barrel>>, Assert<Equal<typeof Direct, typeof Server>>,
  Assert<Equal<typeof DirectDetail, typeof BarrelDetail>>, Assert<Equal<typeof DirectDetail, typeof ServerDetail>>,
  Assert<Equal<ReturnType<typeof Direct>, Promise<ShipmentListItem[]>>>,
  Assert<Equal<ReturnType<typeof DirectDetail>, Promise<ShipmentListItem | undefined>>>,
  Assert<Equal<ReturnType<typeof Application>, Promise<ShipmentListItem[]>>>,
  Assert<Equal<ReturnType<typeof ApplicationDetail>, Promise<ShipmentListItem | undefined>>>,
  Assert<Equal<keyof ShipmentListReader, "readShipmentList">>,
  Assert<Equal<Parameters<ShipmentListReader["readShipmentList"]>, [{ includeOrders: boolean }]>>,
  Assert<Equal<ReturnType<ShipmentListReader["readShipmentList"]>, Promise<ShipmentReadModel>>>,
];
