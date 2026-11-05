import type { IGoogleSheetsService } from "../src/externals/google/sheet/types";
import type { Shipment } from "../src/modules/shipments/contracts";
import type { createShipment as Direct } from "../src/services/shipments/createShipment";
import type { createShipment as Barrel } from "../src/services/shipments";
import type { createShipment as Server } from "../src/modules/shipments/server";
import type { createShipment as Application, CreateShipmentInput, CreateShipmentDependencies } from "../src/modules/shipments/application/create-shipment";
import type { CreatedShipmentWriter } from "../src/modules/shipments/application/ports/created-shipment-writer";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type OriginalInput = { googleSheetsService: IGoogleSheetsService; poNumber: string; carrier?: string; createdBy: string };
export type CreationCompatibility = [
  Assert<Equal<Parameters<typeof Direct>[0], OriginalInput>>,
  Assert<Equal<typeof Direct, typeof Barrel>>,
  Assert<Equal<typeof Direct, typeof Server>>,
  Assert<Equal<ReturnType<typeof Direct>, Promise<Shipment>>>,
  Assert<Equal<CreateShipmentInput, Omit<OriginalInput, "googleSheetsService">>>,
  Assert<Equal<Parameters<typeof Application>, [CreateShipmentInput, CreateShipmentDependencies]>>,
  Assert<Equal<ReturnType<typeof Application>, Promise<Shipment>>>,
  Assert<Equal<keyof CreatedShipmentWriter, "appendCreatedShipment">>,
  Assert<Equal<Parameters<CreatedShipmentWriter["appendCreatedShipment"]>, [Shipment]>>,
  Assert<Equal<ReturnType<CreatedShipmentWriter["appendCreatedShipment"]>, Promise<void>>>,
];
