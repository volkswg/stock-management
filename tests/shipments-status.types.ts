import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { ShipmentStatus, ShipmentStatusUpdate } from "../src/modules/shipments/contracts";
import type { updateShipmentStatus as Direct, UpdateShipmentStatusResult as DirectResult, ShipmentStatusUpdate as DirectDTO } from "../src/services/shipments/updateShipmentStatus";
import type { updateShipmentStatus as Barrel, UpdateShipmentStatusResult as BarrelResult } from "../src/services/shipments";
import type { updateShipmentStatus as Server } from "../src/modules/shipments/server";
import type { updateShipmentStatus as Application, UpdateShipmentStatusInput, UpdateShipmentStatusDependencies, UpdateShipmentStatusResult } from "../src/modules/shipments/application/update-shipment-status";
import type { ShipmentStatusStore, ShipmentStatusTarget } from "../src/modules/shipments/application/ports/shipment-status-store";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type OriginalInput = { deliveryFee?: number; googleSheetsService: IGoogleSheetsService; poNumber?: string; shippingBillUrl?: string; shipmentId: string; status: ShipmentStatus };
type OriginalResult = { outcome: "updated"; shipment: ShipmentStatusUpdate } | { outcome: "not_found" } | { outcome: "invalid_transition" } | { outcome: "invalid_delivery_fee" } | { outcome: "invalid_po_number" };
export type StatusCompatibility = [
  Assert<Equal<Parameters<typeof Direct>[0], OriginalInput>>,
  Assert<Equal<typeof Direct, typeof Barrel>>, Assert<Equal<typeof Direct, typeof Server>>,
  Assert<Equal<ReturnType<typeof Direct>, Promise<OriginalResult>>>,
  Assert<Equal<DirectResult, UpdateShipmentStatusResult>>, Assert<Equal<DirectResult, BarrelResult>>,
  Assert<Equal<DirectDTO, ShipmentStatusUpdate>>,
  Assert<Equal<UpdateShipmentStatusInput, Omit<OriginalInput, "googleSheetsService">>>,
  Assert<Equal<Parameters<typeof Application>, [UpdateShipmentStatusInput, UpdateShipmentStatusDependencies]>>,
  Assert<Equal<ReturnType<typeof Application>, Promise<OriginalResult>>>,
  Assert<Equal<UpdateShipmentStatusDependencies, { store: ShipmentStatusStore; now: () => string }>>,
  Assert<Equal<keyof ShipmentStatusStore, "prepareStatusUpdate">>,
  Assert<Equal<Parameters<ShipmentStatusStore["prepareStatusUpdate"]>, [string]>>,
  Assert<Equal<ReturnType<ShipmentStatusStore["prepareStatusUpdate"]>, Promise<ShipmentStatusTarget | undefined>>>,
  Assert<Equal<Parameters<ShipmentStatusTarget["saveStatusUpdate"]>, [ShipmentStatusUpdate]>>,
  Assert<Equal<ReturnType<ShipmentStatusTarget["saveStatusUpdate"]>, Promise<void>>>,
  Assert<Equal<ReturnType<ShipmentStatusTarget["readShippingFee"]>, number | null>>,
];
