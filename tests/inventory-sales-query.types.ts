import type { SalesProfitCostOverride as Public } from "../src/modules/sales/contracts";
import type { SalesProfitCostOverride as Legacy } from "../src/services/sales/manageSalesProfitCostOverrides";
import type { SalesProfitCostOverride as Barrel, getGoogleSheetsSalesDashboard as BarrelQuery, GoogleSheetsSalesDashboardReport } from "../src/services/sales";
import type { getGoogleSheetsSalesDashboard as Query } from "../src/services/sales/getGoogleSheetsDailySales";
import type { IGoogleSheetsService } from "../src/externals/google/sheet/types";
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type InventorySalesQueryCompatibility=[
 Assert<Equal<Public,Legacy>>,Assert<Equal<Public,Barrel>>,Assert<Equal<typeof Query,typeof BarrelQuery>>,
 Assert<Equal<Parameters<typeof Query>,[{accountIds?:string[];fromDate:string;googleSheetsService:IGoogleSheetsService;toDate:string}]>>,
 Assert<Equal<ReturnType<typeof Query>,Promise<GoogleSheetsSalesDashboardReport>>>
];
