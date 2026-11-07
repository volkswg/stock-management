import * as workflow from "@/modules/line-workflows/server";
// Identity bindings retain the original mutable CommonJS export descriptors.
export const MOVEMENT_FLOW = workflow.MOVEMENT_FLOW;
export const MASTER_HEADERS = workflow.MASTER_HEADERS;
export const DETAIL_HEADERS = workflow.DETAIL_HEADERS;
export const ensureHeader = workflow.ensureHeader;
export const readMovementTables = workflow.readMovementTables;
export const readMovementSession = workflow.readMovementSession;
export const saveMovementState = workflow.saveMovementState;
export const movementItems = workflow.movementItems;
export const saveMaster = workflow.saveMaster;
export const resumeLegacyMovement = workflow.resumeLegacyMovement;
export type { MovementState, MovementStep } from "@/modules/line-workflows/contracts";
