type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
import type { StockCountsSheet as LegacyCount } from "../src/externals/google/sheet/sheets/stock-counts/StockCountsSheet";
import type { StockCountsSheet as IndexCount } from "../src/externals/google/sheet/sheets";
import type { StockCountsSheet as PublicCount } from "../src/externals/google/sheet";
import type { StockCountsSheet } from "../src/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet";
import type { STOCK_COUNT_HEADERS as LegacyHeaders } from "../src/externals/google/sheet/sheets/stock-counts/const";
import type { STOCK_COUNT_HEADERS } from "../src/modules/inventory/infrastructure/google-sheets/stock-counts/const";
import type { MovementSheet as LegacyMovement } from "../src/externals/google/sheet/sheets/movements/MovementSheet";
import type { MovementSheet } from "../src/modules/inventory/infrastructure/google-sheets/movements/MovementSheet";
export type InventoryWorksheetCompatibility = [
 Assert<Equal<typeof LegacyCount,typeof StockCountsSheet>>,Assert<Equal<LegacyCount,StockCountsSheet>>,
 Assert<Equal<typeof IndexCount,typeof StockCountsSheet>>,Assert<Equal<typeof PublicCount,typeof StockCountsSheet>>,
 Assert<Equal<typeof LegacyHeaders,typeof STOCK_COUNT_HEADERS>>,
 Assert<Equal<typeof LegacyMovement,typeof MovementSheet>>,Assert<Equal<LegacyMovement,MovementSheet>>,
 Assert<Equal<Parameters<MovementSheet["deleteRow"]>,[rowNumber:number]>>,
 Assert<Equal<ReturnType<MovementSheet["deleteRow"]>,Promise<void>>>
];
