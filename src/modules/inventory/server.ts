import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { StockCountAccount, AdjustmentEmployee } from "./contracts";
import { readEmployeeDirectory } from "@/modules/hr/server";
import { listAdjustmentEmployees as executeListAdjustmentEmployees } from "./application/list-adjustment-employees";
import { createAdjustmentStore } from "./infrastructure/google-sheets/adjustments";
import * as adjustments from "./application/adjustments";
import { StockAdjustmentError } from "./domain/adjustment-rules";
export { StockAdjustmentError, validStockMonth } from "./domain/adjustment-rules";
export { stockAdjustmentTotals } from "./application/adjustments";
export const stockToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const runtime = { now: () => new Date().toISOString(), today: stockToday };
export function listAdjustmentEmployees(service: IGoogleSheetsService): Promise<AdjustmentEmployee[]> {
    return executeListAdjustmentEmployees({ listEmployees: () => readEmployeeDirectory({ googleSheetsService: service, unavailableError: () => new StockAdjustmentError("Employee storage headers do not match.", 503) }) });
}
export async function listStockAdjustments(service: IGoogleSheetsService) { return adjustments.listStockAdjustments(createAdjustmentStore(service)); }
export async function createStockAdjustment(service: IGoogleSheetsService, accounts: StockCountAccount[], value: unknown) {
    return adjustments.createStockAdjustment(createAdjustmentStore(service), accounts, value, { listEmployees: () => listAdjustmentEmployees(service) }, runtime);
}
export async function reverseStockAdjustment(service: IGoogleSheetsService, value: unknown) { return adjustments.reverseStockAdjustment(createAdjustmentStore(service), value, runtime); }
import { randomUUID } from "node:crypto";
import { createSalesDashboardReader } from "@/modules/sales/server";
import * as counts from "./application/stock-counts";
import { createStockCountStore } from "./infrastructure/google-sheets/stock-counts";
import type { StockCountRecord, MonthlyShopStockCount } from "./contracts";
export async function getMonthlyStockCounts({ accounts, googleSheetsService, month, }: {
    accounts: StockCountAccount[];
    googleSheetsService: IGoogleSheetsService;
    month: string;
}): Promise<MonthlyShopStockCount[]> {
    return counts.getMonthlyStockCounts({ accounts, store: createStockCountStore(googleSheetsService), month, runtime: { ...runtime, uuid: randomUUID }, readers: { movements: () => listMovements({ filter: {}, googleSheetsService }), adjustments: () => listStockAdjustments(googleSheetsService), sales: createSalesDashboardReader(googleSheetsService).readSales } });
}
export async function saveMonthlyStockCount({ account, googleSheetsService, month, note, physicalCount, updatedBy, }: {
    account: StockCountAccount;
    googleSheetsService: IGoogleSheetsService;
    month: string;
    note: string;
    physicalCount: number;
    updatedBy: string;
}): Promise<StockCountRecord> {
    return counts.saveMonthlyStockCount({ account, store: createStockCountStore(googleSheetsService), month, note, physicalCount, updatedBy, runtime: { ...runtime, uuid: randomUUID } });
}
import type { MovementDateFilter, ProductMovementRecord, ProductMovementMasterRecord } from "./contracts";
import * as movements from "./application/movements";
import { createMovementStore } from "./infrastructure/google-sheets/movements";
export { MovementQuantityRequiredError } from "./quantity";
export async function listMovements({ filter, googleSheetsService, }: {
    filter: MovementDateFilter;
    googleSheetsService: IGoogleSheetsService;
}): Promise<ProductMovementMasterRecord[]> {
    return movements.listMovements({ filter, store: createMovementStore(googleSheetsService) });
}
export async function getMovementItems({ googleSheetsService, movementMasterId, }: {
    googleSheetsService: IGoogleSheetsService;
    movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
    return movements.getMovementItems({ store: createMovementStore(googleSheetsService), movementMasterId });
}
export async function movementExists({ googleSheetsService, movementMasterId, }: {
    googleSheetsService: IGoogleSheetsService;
    movementMasterId: string;
}): Promise<boolean> {
    return movements.movementExists({ store: createMovementStore(googleSheetsService), movementMasterId });
}
export async function deleteMovementItem({ googleSheetsService, movementId, movementMasterId, }: {
    googleSheetsService: IGoogleSheetsService;
    movementId: string;
    movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
    return movements.deleteMovementItem({ store: createMovementStore(googleSheetsService), movementId, movementMasterId, runtime });
}
export async function updateMovementItem({ googleSheetsService, movementId, movementMasterId, quantity, remark, stockCounted, isNewArrival, }: {
    googleSheetsService: IGoogleSheetsService;
    movementId: string;
    movementMasterId: string;
    quantity?: string;
    remark?: string;
    stockCounted?: boolean;
    isNewArrival?: boolean;
}): Promise<ProductMovementRecord[] | null> {
    return movements.updateMovementItem({ store: createMovementStore(googleSheetsService), movementId, movementMasterId, quantity, remark, stockCounted, isNewArrival, runtime });
}
export async function updateMovementImage({ googleSheetsService, imageUrl, movementId, movementMasterId, }: {
    googleSheetsService: IGoogleSheetsService;
    imageUrl: string;
    movementId: string;
    movementMasterId: string;
}): Promise<ProductMovementRecord[] | null> {
    return movements.updateMovementImage({ store: createMovementStore(googleSheetsService), imageUrl, movementId, movementMasterId, runtime });
}
export async function markMovementDelivered({ googleSheetsService, movementMasterId, }: {
    googleSheetsService: IGoogleSheetsService;
    movementMasterId: string;
}): Promise<{
    movementMaster: ProductMovementMasterRecord;
    records: ProductMovementRecord[];
} | null> {
    return movements.markMovementDelivered({ store: createMovementStore(googleSheetsService), movementMasterId, runtime });
}
export type { MovementDateFilter } from "./contracts";
