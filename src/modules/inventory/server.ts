import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import type { StockCountAccount, AdjustmentEmployee } from "./contracts";
import { readMovementShopDirectory } from "@/modules/expenses/server";
import { readEmployeeDirectory } from "@/modules/hr/server";
import { listAdjustmentEmployees as executeListAdjustmentEmployees } from "./application/list-adjustment-employees";
import { createAdjustmentStore } from "./infrastructure/postgres/adjustments";
import * as adjustments from "./application/adjustments";
import { StockAdjustmentError } from "./domain/adjustment-rules";
export { StockAdjustmentError, validStockMonth } from "./domain/adjustment-rules";
export { stockAdjustmentTotals } from "./application/adjustments";
export const stockToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const runtime = { now: () => new Date().toISOString(), today: stockToday };
export function listAdjustmentEmployees(service: Storage): Promise<AdjustmentEmployee[]> {
    return executeListAdjustmentEmployees({ listEmployees: () => readEmployeeDirectory({ storage: service, unavailableError: () => new StockAdjustmentError("Employee storage headers do not match.", 503) }) });
}
export async function listStockAdjustments(service: Storage) { return adjustments.listStockAdjustments(createAdjustmentStore(service)); }
export async function createStockAdjustment(service: Storage, accounts: StockCountAccount[], value: unknown) {
    return adjustments.createStockAdjustment(createAdjustmentStore(service), accounts, value, { listEmployees: () => listAdjustmentEmployees(service) }, runtime);
}
export async function reverseStockAdjustment(service: Storage, value: unknown) { return adjustments.reverseStockAdjustment(createAdjustmentStore(service), value, runtime); }
import { randomUUID } from "node:crypto";
import { createSalesDashboardReader } from "@/modules/sales/server";
import * as counts from "./application/stock-counts";
import { createStockCountStore } from "./infrastructure/postgres/stock-counts";
import type { StockCountRecord, MonthlyShopStockCount } from "./contracts";
export async function getMonthlyStockCounts({ accounts, storage, month, }: {
    accounts: StockCountAccount[];
    storage: Storage;
    month: string;
}): Promise<MonthlyShopStockCount[]> {
    return counts.getMonthlyStockCounts({ accounts, store: createStockCountStore(storage), month, runtime: { ...runtime, uuid: randomUUID }, readers: { shops: () => readMovementShopDirectory(), movements: () => listMovements({ filter: {}, storage }), adjustments: () => listStockAdjustments(storage), sales: createSalesDashboardReader(storage).readSales } });
}
export async function saveMonthlyStockCount({ account, storage, month, note, physicalCount, updatedBy, }: {
    account: StockCountAccount;
    storage: Storage;
    month: string;
    note: string;
    physicalCount: number;
    updatedBy: string;
}): Promise<StockCountRecord> {
    return counts.saveMonthlyStockCount({ account, store: createStockCountStore(storage), month, note, physicalCount, updatedBy, runtime: { ...runtime, uuid: randomUUID } });
}
import type { MovementDateFilter, ProductMovementRecord, ProductMovementMasterRecord } from "./contracts";
import * as movements from "./application/movements";
import { createMovementStore } from "./infrastructure/postgres/movements";
export { MovementQuantityRequiredError } from "./quantity";
export async function listMovements({ filter, storage, }: {
    filter: MovementDateFilter;
    storage: Storage;
}): Promise<ProductMovementMasterRecord[]> {
    return movements.listMovements({ filter, store: createMovementStore(storage) });
}
export async function getMovementItems({ storage, movementMasterId, }: {
    storage: Storage;
    movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
    return movements.getMovementItems({ store: createMovementStore(storage), movementMasterId });
}
export async function movementExists({ storage, movementMasterId, }: {
    storage: Storage;
    movementMasterId: string;
}): Promise<boolean> {
    return movements.movementExists({ store: createMovementStore(storage), movementMasterId });
}
export async function deleteMovementItem({ storage, movementId, movementMasterId, }: {
    storage: Storage;
    movementId: string;
    movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
    return movements.deleteMovementItem({ store: createMovementStore(storage), movementId, movementMasterId, runtime });
}
export async function updateMovementItem({ storage, movementId, movementMasterId, quantity, remark, stockCounted, isNewArrival, }: {
    storage: Storage;
    movementId: string;
    movementMasterId: string;
    quantity?: string;
    remark?: string;
    stockCounted?: boolean;
    isNewArrival?: boolean;
}): Promise<ProductMovementRecord[] | null> {
    return movements.updateMovementItem({ store: createMovementStore(storage), movementId, movementMasterId, quantity, remark, stockCounted, isNewArrival, runtime });
}
export async function updateMovementImage({ storage, imageUrl, movementId, movementMasterId, }: {
    storage: Storage;
    imageUrl: string;
    movementId: string;
    movementMasterId: string;
}): Promise<ProductMovementRecord[] | null> {
    return movements.updateMovementImage({ store: createMovementStore(storage), imageUrl, movementId, movementMasterId, runtime });
}
export async function markMovementDelivered({ storage, movementMasterId, }: {
    storage: Storage;
    movementMasterId: string;
}): Promise<{
    movementMaster: ProductMovementMasterRecord;
    records: ProductMovementRecord[];
} | null> {
    return movements.markMovementDelivered({ store: createMovementStore(storage), movementMasterId, runtime });
}
export type { MovementDateFilter } from "./contracts";
import { createMovementJourneyAdapter } from "./infrastructure/postgres/movement-journeys";
import * as movementJourneys from "./application/movement-journeys";
import type { MovementJourneyIdentity, MovementJourneyItem } from "./contracts";
// Server-only batch participants/projection for the existing LINE + Inventory snapshot read.
export { createMovementJourneyAdapter } from "./infrastructure/postgres/movement-journeys";
export async function movementJourneyItems(storage: Pick<Storage, "movementMasters" | "movementDetails">, masterId: string) { return movementJourneys.movementJourneyItems(createMovementJourneyAdapter(storage).store, masterId); }
export async function synchronizeMovementJourney(storage: Pick<Storage, "movementMasters" | "movementDetails">, state: MovementJourneyIdentity, complete = false) { return movementJourneys.synchronizeMovementJourney(createMovementJourneyAdapter(storage).store, state, complete, () => new Date().toISOString()); }
export async function findResumableMovementJourney(storage: Pick<Storage, "movementMasters" | "movementDetails">, userId: string) { return movementJourneys.findResumableMovementJourney(createMovementJourneyAdapter(storage).store, userId); }
export async function appendMovementJourneyItem(storage: Pick<Storage, "movementMasters" | "movementDetails">, readItem: () => MovementJourneyItem) { return movementJourneys.appendMovementJourneyItem(createMovementJourneyAdapter(storage).store, readItem); }

export { readMovementShopAliases } from "./infrastructure/postgres/movement-shop-aliases";
