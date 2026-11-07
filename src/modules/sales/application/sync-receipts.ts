import type { ReceiptSyncStore, ReceiptSyncSource, ReceiptSyncRuntime, SyncLoyverseDailySalesResult } from "./ports/receipt-sync";
import { createSalesReceiptSyncId } from "../domain/receipt-ids";
export async function syncReceipts(accountId: string, salesDate: string, store: ReceiptSyncStore, source: ReceiptSyncSource, runtime: ReceiptSyncRuntime): Promise<SyncLoyverseDailySalesResult> {
    const syncId = createSalesReceiptSyncId(accountId, salesDate);
    if (await store.isComplete(syncId))
        return { outcome: "already_synced" };
    const input = await source.load(salesDate);
    const syncedAt = runtime.now();
    const batch = input.project(syncedAt);
    await store.prepare();
    await store.append(batch);
    await store.complete(syncId, salesDate, batch, syncedAt);
    return { outcome: "synced", receiptCount: batch.receiptCount, itemCount: batch.itemCount, paymentCount: batch.paymentCount, syncedAt };
}
