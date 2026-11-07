import type { MASTER_HEADERS as LegacyMaster, DETAIL_HEADERS as LegacyDetail, ensureHeader as LegacyEnsure } from "../src/services/movements/state";
import type { MASTER_HEADERS, DETAIL_HEADERS, ensureHeader } from "../src/services/movements/worksheet-schema";
import type { IGoogleRowsSheet } from "../src/infrastructure/persistence/google-sheets/types";
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
export type MovementSchemaCompatibility = [
 Assert<Equal<typeof LegacyMaster,typeof MASTER_HEADERS>>,
 Assert<Equal<typeof LegacyDetail,typeof DETAIL_HEADERS>>,
 Assert<Equal<typeof LegacyEnsure,typeof ensureHeader>>,
 Assert<Equal<Parameters<typeof ensureHeader>,[sheet:IGoogleRowsSheet,headers:string[],end:string]>>,
 Assert<Equal<ReturnType<typeof ensureHeader>,Promise<void>>>
];
