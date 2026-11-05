import type { ShipmentBillStorage, ShipmentBillUploadResult, UploadedShipmentBill } from "../src/modules/shipments/application/ports/shipment-bill-storage";
import type { ShipmentStatusUpdater, AdvanceShipmentStatusWithBillResult } from "../src/modules/shipments/application/advance-shipment-status-with-bill";
import type { UpdateShipmentStatusResult } from "../src/modules/shipments/application/update-shipment-status";
import type { advanceShipmentStatusWithBill as Server } from "../src/modules/shipments/server";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type ShippingBillCompatibility = [
  Assert<Equal<keyof ShipmentBillStorage, "upload" | "cleanup">>,
  Assert<Equal<Parameters<ShipmentBillStorage["upload"]>, []>>,
  Assert<Equal<ReturnType<ShipmentBillStorage["upload"]>, Promise<ShipmentBillUploadResult>>>,
  Assert<Equal<Parameters<ShipmentBillStorage["cleanup"]>, [string | undefined]>>,
  Assert<Equal<UploadedShipmentBill, { id: string; webViewLink: string }>>,
  Assert<Equal<ReturnType<ShipmentStatusUpdater>, Promise<UpdateShipmentStatusResult>>>,
  Assert<Equal<Parameters<ShipmentStatusUpdater>, [string | undefined]>>,
  Assert<Equal<ReturnType<typeof Server>, Promise<AdvanceShipmentStatusWithBillResult>>>,
  Assert<Equal<Extract<AdvanceShipmentStatusWithBillResult, { outcome: "completed" }>["result"], UpdateShipmentStatusResult>>,
];
