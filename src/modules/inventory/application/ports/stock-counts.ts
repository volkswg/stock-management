import type { StockCountRecord, ProductMovementMasterRecord, StockAdjustment } from "../../contracts";
export interface StockCountSnapshot {
    records(): StockCountRecord[];
    find(month: string, accountId: string): {
        record(): StockCountRecord | null;
        save(record: StockCountRecord): Promise<void>;
    } | undefined;
}
export interface StockCountStore {
    prepare(): Promise<void>;
    read(): Promise<StockCountSnapshot>;
    append(record: StockCountRecord): Promise<void>;
}
export type StockCountRuntime = {
    now(): string;
    today(): string;
    uuid(): string;
};
export interface StockCountReaders {
    movements(): Promise<ProductMovementMasterRecord[]>;
    adjustments(): Promise<StockAdjustment[]>;
    sales(input: {
        accountIds: string[];
        fromDate: string;
        toDate: string;
    }): Promise<{
        shopSeries: Array<{
            accountId: string;
            dailySales: Array<{
                salesDate: string;
                itemsSold: number;
                itemsRefunded: number;
            }>;
        }>;
    }>;
}
