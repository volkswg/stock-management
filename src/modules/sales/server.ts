import "server-only";
import type { Storage } from "./infrastructure/postgres/storage";
import type { DailySalesReport, SalesDashboardReport, ProfitSummary, ProfitExpense, SalesProfitCostOverride } from "./contracts";
export { projectProfitExpenses } from "./application/project-profit-expenses";
import { createSalesReports } from "./application/reports";
import { createSalesReader } from "./infrastructure/postgres/sales-reader";
const reports = createSalesReports(createSalesReader);
export const getDailySales: (input: {
    accountId: string;
    storage: Storage;
    salesDate: string;
}) => Promise<DailySalesReport> = reports.getDailySales;
export const getSalesDashboard: (input: {
    accountIds?: string[];
    fromDate: string;
    storage: Storage;
    toDate: string;
}) => Promise<SalesDashboardReport> = reports.getSalesDashboard;
export const getProfitSummary: (input: {
    accounts: Array<{
        id: string;
        shopName: string;
    }>;
    costOverrides: SalesProfitCostOverride[];
    expenses: ProfitExpense[];
    storage: Storage;
    year: string;
}) => Promise<ProfitSummary> = reports.getProfitSummary;
import type { ReceiptSource } from "./application/ports/receipt-source";
import { syncReceipts } from "./application/sync-receipts";
import { createReceiptSync } from "./infrastructure/postgres/receipt-sync";
import type { SyncLoyverseDailySalesResult } from "./application/ports/receipt-sync";
export async function syncLoyverseDailySales({ account, storage, salesDate, }: {
    account: { id: string; shopName: string; storeId?: string; service: ReceiptSource };
    storage: Storage;
    salesDate: string;
}): Promise<SyncLoyverseDailySalesResult> {
    const { store, source } = createReceiptSync(storage, account);
    return syncReceipts(account.id, salesDate, store, source, { now: () => new Date().toISOString() });
}
import { randomUUID } from "node:crypto";
import * as costs from "./application/cost-overrides";
import { createCostOverrideStore } from "./infrastructure/postgres/cost-overrides";
export async function listSalesProfitCostOverrides({ storage, year, }: {
    storage: Storage;
    year: string;
}): Promise<SalesProfitCostOverride[]> {
    return costs.listSalesProfitCostOverrides({ store: createCostOverrideStore(storage), year });
}
export async function setSalesProfitCostOverride({ accountId, averageItemCost, createdBy, storage, month, note, }: {
    accountId: string;
    averageItemCost: number;
    createdBy: string;
    storage: Storage;
    month: string;
    note: string;
}): Promise<SalesProfitCostOverride> {
    return costs.setSalesProfitCostOverride({ accountId, averageItemCost, createdBy, store: createCostOverrideStore(storage), month, note, runtime: { now: () => new Date().toISOString(), uuid: randomUUID } });
}
export async function removeSalesProfitCostOverride({ accountId, storage, month, }: {
    accountId: string;
    storage: Storage;
    month: string;
}): Promise<boolean> {
    return costs.removeSalesProfitCostOverride({ accountId, store: createCostOverrideStore(storage), month });
}
import type { SalesSyncStatusRow, SalesSyncStatusSummary } from "./contracts";
import { listSalesSyncStatus as executeSyncStatus } from "./application/sync-status";
import { createSyncStatusReader } from "./infrastructure/postgres/sync-status";
export async function listSalesSyncStatus({ accountId, storage, month, }: {
    accountId?: string;
    storage: Storage;
    month: string;
}): Promise<{
    rows: SalesSyncStatusRow[];
    summary: SalesSyncStatusSummary;
}> {
    return executeSyncStatus({ accountId, reader: createSyncStatusReader(storage), month });
}
import type { SalesStorage } from "./infrastructure/postgres/sales-reader";
import type { ILoyverseService, LoyverseReceipt } from "@/infrastructure/external/loyverse";
import { getLoyverseReceiptsForSalesDate as readReceiptsForDate } from "./application/receipts-for-date";
export { isValidBangkokSalesDate } from "./application/receipts-for-date";
export async function getLoyverseReceiptsForSalesDate({ loyverseService, salesDate, storeId }: {
    loyverseService: ILoyverseService;
    salesDate: string;
    storeId?: string;
}): Promise<LoyverseReceipt[]> {
    return readReceiptsForDate({ loyverseService, salesDate, storeId });
}
// Public consumer seam: HR/Inventory supply their own consumer-owned interface.
export function createSalesDashboardReader(service: SalesStorage) {
    return { readSales: (input: {
            accountIds: string[];
            fromDate: string;
            toDate: string;
        }) => reports.getSalesDashboard({ ...input, storage: service }) };
}
