import type * as Sales from '../src/modules/sales/server';
import type * as LegacySales from '../src/services/sales';
import type * as Inventory from '../src/modules/inventory/server';
import type * as LegacyMovement from '../src/services/movements';
import type * as LegacyCount from '../src/services/stock-counts';
import type * as LegacyAdjustment from '../src/services/stock-adjustments/manageStockAdjustments';
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { StockCountAccount, StockCountRecord, MonthlyShopStockCount, MovementDateFilter, ProductMovementMasterRecord } from '../src/modules/inventory/contracts';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type Compatibility=[
 Assert<Equal<typeof Sales.getGoogleSheetsDailySales,typeof LegacySales.getGoogleSheetsDailySales>>,
 Assert<Equal<typeof Sales.getGoogleSheetsSalesDashboard,typeof LegacySales.getGoogleSheetsSalesDashboard>>,
 Assert<Equal<typeof Sales.getGoogleSheetsProfitSummary,typeof LegacySales.getGoogleSheetsProfitSummary>>,
 Assert<Equal<typeof Sales.syncLoyverseDailySales,typeof LegacySales.syncLoyverseDailySales>>,
 Assert<Equal<typeof Sales.listSalesProfitCostOverrides,typeof LegacySales.listSalesProfitCostOverrides>>,
 Assert<Equal<typeof Sales.setSalesProfitCostOverride,typeof LegacySales.setSalesProfitCostOverride>>,
 Assert<Equal<typeof Sales.removeSalesProfitCostOverride,typeof LegacySales.removeSalesProfitCostOverride>>,
 Assert<Equal<typeof Inventory.listMovements,typeof LegacyMovement.listMovements>>,
 Assert<Equal<typeof Inventory.updateMovementItem,typeof LegacyMovement.updateMovementItem>>,
 Assert<Equal<typeof Inventory.deleteMovementItem,typeof LegacyMovement.deleteMovementItem>>,
 Assert<Equal<typeof Inventory.markMovementDelivered,typeof LegacyMovement.markMovementDelivered>>,
 Assert<Equal<typeof Inventory.getMonthlyStockCounts,typeof LegacyCount.getMonthlyStockCounts>>,
 Assert<Equal<typeof Inventory.saveMonthlyStockCount,typeof LegacyCount.saveMonthlyStockCount>>,
 Assert<Equal<typeof Inventory.createStockAdjustment,typeof LegacyAdjustment.createStockAdjustment>>,
 Assert<Equal<typeof Inventory.reverseStockAdjustment,typeof LegacyAdjustment.reverseStockAdjustment>>,
 Assert<Equal<Parameters<typeof Inventory.getMonthlyStockCounts>,[{accounts:StockCountAccount[];googleSheetsService:IGoogleSheetsService;month:string}]>>,
 Assert<Equal<ReturnType<typeof Inventory.getMonthlyStockCounts>,Promise<MonthlyShopStockCount[]>>>,
 Assert<Equal<Parameters<typeof Inventory.saveMonthlyStockCount>,[{account:StockCountAccount;googleSheetsService:IGoogleSheetsService;month:string;note:string;physicalCount:number;updatedBy:string}]>>,
 Assert<Equal<ReturnType<typeof Inventory.saveMonthlyStockCount>,Promise<StockCountRecord>>>,
 Assert<Equal<Parameters<typeof Inventory.listMovements>,[{filter:MovementDateFilter;googleSheetsService:IGoogleSheetsService}]>>,
 Assert<Equal<ReturnType<typeof Inventory.listMovements>,Promise<ProductMovementMasterRecord[]>>>,
 Assert<Equal<Parameters<typeof Inventory.createStockAdjustment>,[IGoogleSheetsService,StockCountAccount[],unknown]>>
];
