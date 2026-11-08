import "server-only";
import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { Expense } from "@/modules/expenses/contracts";
import type { GoogleSheetsDailySalesReport, GoogleSheetsSalesDashboardReport, GoogleSheetsProfitSummary, SalesProfitCostOverride } from "./contracts";
import { createSalesReports } from "./application/reports";
import { createSalesReader } from "./infrastructure/google-sheets/sales-reader";
const reports = createSalesReports(createSalesReader);
export const getGoogleSheetsDailySales: (input: {
    accountId: string;
    googleSheetsService: IGoogleSheetsService;
    salesDate: string;
}) => Promise<GoogleSheetsDailySalesReport> = reports.getGoogleSheetsDailySales;
export const getGoogleSheetsSalesDashboard: (input: {
    accountIds?: string[];
    fromDate: string;
    googleSheetsService: IGoogleSheetsService;
    toDate: string;
}) => Promise<GoogleSheetsSalesDashboardReport> = reports.getGoogleSheetsSalesDashboard;
export const getGoogleSheetsProfitSummary: (input: {
    accounts: Array<{
        id: string;
        shopName: string;
    }>;
    costOverrides: SalesProfitCostOverride[];
    expenses: Expense[];
    googleSheetsService: IGoogleSheetsService;
    year: string;
}) => Promise<GoogleSheetsProfitSummary> = reports.getGoogleSheetsProfitSummary;
import type { ReceiptSource } from "./application/ports/receipt-source";
import { syncReceipts } from "./application/sync-receipts";
import { createReceiptSync } from "./infrastructure/google-sheets/receipt-sync";
import type { ReceiptSyncCoordinator, SyncLoyverseDailySalesResult } from "./application/ports/receipt-sync";
export async function syncLoyverseDailySales({ account, googleSheetsService, salesDate, coordinator, }: {
    account: { id: string; shopName: string; storeId?: string; service: ReceiptSource };
    googleSheetsService: IGoogleSheetsService;
    salesDate: string;
    coordinator?: ReceiptSyncCoordinator;
}): Promise<SyncLoyverseDailySalesResult> {
    // No implicit unsafe fallback. Existing deployment composition intentionally
    // fails closed until a reviewed durable coordinator is supplied.
    if (!coordinator) throw new Error("Sales sync blocked: durable workbook/account/date coordinator is not configured. Reports remain available; contact the operator.");
    return coordinator.run({ accountId: account.id, salesDate }, async attempt => {
        const { store, source } = createReceiptSync(googleSheetsService, account, attempt);
        return syncReceipts(account.id, salesDate, store, source, { now: () => new Date().toISOString() });
    });
}
import { randomUUID } from "node:crypto";
import * as costs from "./application/cost-overrides";
import { createCostOverrideStore } from "./infrastructure/google-sheets/cost-overrides";
export async function listSalesProfitCostOverrides({ googleSheetsService, year, }: {
    googleSheetsService: IGoogleSheetsService;
    year: string;
}): Promise<SalesProfitCostOverride[]> {
    return costs.listSalesProfitCostOverrides({ store: createCostOverrideStore(googleSheetsService), year });
}
export async function setSalesProfitCostOverride({ accountId, averageItemCost, createdBy, googleSheetsService, month, note, }: {
    accountId: string;
    averageItemCost: number;
    createdBy: string;
    googleSheetsService: IGoogleSheetsService;
    month: string;
    note: string;
}): Promise<SalesProfitCostOverride> {
    return costs.setSalesProfitCostOverride({ accountId, averageItemCost, createdBy, store: createCostOverrideStore(googleSheetsService), month, note, runtime: { now: () => new Date().toISOString(), uuid: randomUUID } });
}
export async function removeSalesProfitCostOverride({ accountId, googleSheetsService, month, }: {
    accountId: string;
    googleSheetsService: IGoogleSheetsService;
    month: string;
}): Promise<boolean> {
    return costs.removeSalesProfitCostOverride({ accountId, store: createCostOverrideStore(googleSheetsService), month });
}
import type { SalesSyncStatusRow, SalesSyncStatusSummary } from "./contracts";
import { listSalesSyncStatus as executeSyncStatus } from "./application/sync-status";
import { createSyncStatusReader } from "./infrastructure/google-sheets/sync-status";
export async function listSalesSyncStatus({ accountId, googleSheetsService, month, }: {
    accountId?: string;
    googleSheetsService: IGoogleSheetsService;
    month: string;
}): Promise<{
    rows: SalesSyncStatusRow[];
    summary: SalesSyncStatusSummary;
}> {
    return executeSyncStatus({ accountId, reader: createSyncStatusReader(googleSheetsService), month });
}
import type { SalesSheets } from "./infrastructure/google-sheets/sales-reader";
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
export function createSalesDashboardReader(service: SalesSheets) {
    return { readSales: (input: {
            accountIds: string[];
            fromDate: string;
            toDate: string;
        }) => reports.getGoogleSheetsSalesDashboard({ ...input, googleSheetsService: service }) };
}
