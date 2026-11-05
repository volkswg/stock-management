import type { isUpdatableStatus, isValidDeliveryFee, isValidPoNumber, readJsonBody } from "../src/features/backend/shipments/utils";
import type { ShipmentStatus } from "../src/modules/shipments/contracts";
import type { ShipmentStatus as Physical } from "../src/modules/shipments/status";
import type { ShipmentStatus as Legacy } from "../src/services/shipments";
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type ValidationCompatibility=[
  Assert<Equal<typeof isUpdatableStatus,(value:unknown)=>value is ShipmentStatus>>,
  Assert<Equal<ShipmentStatus,Physical>>,Assert<Equal<ShipmentStatus,Legacy>>,
  Assert<Equal<typeof isValidDeliveryFee,(value:unknown)=>value is number>>,
  Assert<Equal<typeof isValidPoNumber,(value:unknown)=>value is string>>,
  Assert<Equal<typeof readJsonBody,(request:Request)=>Promise<unknown>>>,
];
