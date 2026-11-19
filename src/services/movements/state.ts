import * as workflow from "@/modules/line-workflows/server";
// Identity bindings retain the original mutable CommonJS export descriptors.
export const MOVEMENT_FLOW = workflow.MOVEMENT_FLOW;
export const saveMovementState = workflow.saveMovementState;
export const resumeLegacyMovement = workflow.resumeLegacyMovement;
export type { MovementState, MovementStep } from "@/modules/line-workflows/contracts";
