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

// Infrastructure prerequisite, not a process-local lock. Implementations must
// durably serialize the workbook's append positions AND each account/date,
// retain write intent across crashes/timeouts, and quarantine the workbook while
// an earlier request might still commit. Lease expiry alone cannot fence Sheets.
export interface ReceiptSyncCoordinator {
    run<T>(key: { accountId: string; salesDate: string }, work: (attempt: ReceiptSyncAttempt) => Promise<T>): Promise<T>;
}
export interface ReceiptSyncAttempt {
    readonly pendingFingerprint: string | null;
    // Atomically check durable owner/generation and persist intent before IO.
    // A stale owner must fail here; after intent, quarantine cannot expire.
    beginWrite(fingerprint: string): Promise<void>;
    confirmWrite(): Promise<void>;
}
