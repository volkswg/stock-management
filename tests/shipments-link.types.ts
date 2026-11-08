import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { ShipmentOrder } from "../src/modules/shipments/contracts";
import type { linkOrderToShipment as Direct, LinkOrderToShipmentError as DirectError, ShipmentOrder as LegacyOrder, LinkOrderToShipmentResult as DirectResult, LinkOrderToShipmentErrorCode as Code } from "../src/services/shipments/linkOrderToShipment";
import type { linkOrderToShipment as Barrel, LinkOrderToShipmentError as BarrelError, LinkOrderToShipmentResult as BarrelResult } from "../src/services/shipments";
import type { linkOrderToShipment as Server } from "../src/modules/shipments/server";
import type { linkOrderToShipment as Application, LinkOrderToShipmentError as ApplicationError, LinkOrderToShipmentResult, LinkOrderInput, LinkOrderDependencies } from "../src/modules/shipments/application/link-order-to-shipment";
import type { ActiveShipmentCandidate, ShipmentLinkSnapshot, ShipmentOrderLinkStore } from "../src/modules/shipments/application/ports/shipment-order-link-store";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type OriginalInput = { googleSheetsService: IGoogleSheetsService; shipmentId: string; orderId: string; createdBy: string };
export type LinkingCompatibility = [
  Assert<Equal<Parameters<typeof Direct>[0], OriginalInput>>,
  Assert<Equal<typeof Direct, typeof Barrel>>, Assert<Equal<typeof Direct, typeof Server>>,
  Assert<Equal<ReturnType<typeof Direct>, Promise<LinkOrderToShipmentResult>>>,
  Assert<Equal<DirectResult, BarrelResult>>, Assert<Equal<DirectResult, LinkOrderToShipmentResult>>,
  Assert<Equal<typeof DirectError, typeof BarrelError>>, Assert<Equal<typeof DirectError, typeof ApplicationError>>,
  Assert<Equal<Code, "shipment_not_found" | "order_not_found" | "order_already_linked" | "shipment_not_linkable">>,
  Assert<Equal<LegacyOrder, ShipmentOrder>>,
  Assert<Equal<ShipmentOrder, { id: string; shipmentId: string; orderId: string; createdAt: string; updatedAt: string; deletedAt: string; createdBy: string }>>,
  Assert<Equal<LinkOrderToShipmentResult, { shipmentOrder: ShipmentOrder; created: boolean }>>,
  Assert<Equal<LinkOrderInput, Omit<OriginalInput, "googleSheetsService">>>,
  Assert<Equal<Parameters<typeof Application>, [LinkOrderInput, LinkOrderDependencies]>>,
  Assert<Equal<ReturnType<typeof Application>, Promise<LinkOrderToShipmentResult>>>,
  Assert<Equal<LinkOrderDependencies, { store: ShipmentOrderLinkStore; now: () => string; createId: () => string }>>,
  Assert<Equal<keyof ShipmentOrderLinkStore, "readLinkSnapshot" | "appendShipmentOrder">>,
  Assert<Equal<Parameters<ShipmentOrderLinkStore["readLinkSnapshot"]>, []>>,
  Assert<Equal<ReturnType<ShipmentOrderLinkStore["readLinkSnapshot"]>, Promise<ShipmentLinkSnapshot>>>,
  Assert<Equal<Parameters<ShipmentOrderLinkStore["appendShipmentOrder"]>, [ShipmentOrder]>>,
  Assert<Equal<ReturnType<ShipmentOrderLinkStore["appendShipmentOrder"]>, Promise<void>>>,
  Assert<Equal<ReturnType<ShipmentLinkSnapshot["findActiveShipment"]>, ActiveShipmentCandidate | undefined>>,
  Assert<Equal<ReturnType<ActiveShipmentCandidate["readStatus"]>, string>>,
];
