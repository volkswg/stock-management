export type SyncLoyverseDailySalesResult = {
    outcome: "synced";
    receiptCount: number;
    itemCount: number;
    paymentCount: number;
    syncedAt: string;
} | {
    outcome: "already_synced";
};
export type ReceiptSyncBatch = {
    receiptCount: number;
    itemCount: number;
    paymentCount: number;
};
export interface ReceiptSyncStore {
    isComplete(syncId: string): Promise<boolean>;
    prepare(): Promise<void>;
    append(batch: ReceiptSyncBatch): Promise<void>;
    complete(syncId: string, salesDate: string, batch: ReceiptSyncBatch, syncedAt: string): Promise<void>;
}
export interface ReceiptSyncSource {
    load(salesDate: string): Promise<{
        project(syncedAt: string): ReceiptSyncBatch;
    }>;
}
export type ReceiptSyncRuntime = {
    now(): string;
};
