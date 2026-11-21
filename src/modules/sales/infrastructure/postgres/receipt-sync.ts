import { singleReceiptPayments, singlePaymentReceipts, withReceiptPayment } from "./receipt-payment";
import { PersistenceFailure } from "@/infrastructure/persistence/postgres/database";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
import "server-only";
import type { ReceiptSyncStore, ReceiptSyncSource, ReceiptSyncBatch } from "../../application/ports/receipt-sync";
import type { ReceiptSource } from "../../application/ports/receipt-source";
import { createSalesReceiptId, createSalesReceiptItemId, createSalesReceiptPaymentId, } from "../../domain/receipt-ids";
import { salesReceiptItemToRecord, salesReceiptPaymentToRecord, salesReceiptToRecord, } from "./receipt-record-mapping";
import { getLoyverseReceiptsForSalesDate } from "../../application/receipts-for-date";
export function createReceiptSync(storage: Storage, account: {
    id: string;
    shopName: string;
    storeId?: string;
    service: ReceiptSource;
}): {
    store: ReceiptSyncStore;
    source: ReceiptSyncSource;
} {
    const batches = new WeakMap<ReceiptSyncBatch, {
        receiptRows: NativeRecord[];
        itemRows: NativeRecord[];
        paymentRows: NativeRecord[];
    }>();
    return {
        source: { async load(salesDate) {
                const receipts = await getLoyverseReceiptsForSalesDate({ loyverseService: account.service, salesDate, storeId: account.storeId });
                return { project(syncedAt) {
                        const receiptRows: NativeRecord[] = [];
                        const itemRows: NativeRecord[] = [];
                        const paymentRows: NativeRecord[] = [];
                        for (const receipt of receipts) {
                            if (!Array.isArray(receipt.payments ?? []) || (receipt.payments?.length ?? 0) > 1) throw new PersistenceFailure(409, "A receipt has multiple or invalid payments. No sales were saved; review the receipt in Loyverse.");
                            const receiptId = createSalesReceiptId(account.id, receipt.receipt_number);
                            receiptRows.push(salesReceiptToRecord({
                                accountId: account.id,
                                id: receiptId,
                                receipt,
                                salesDate,
                                shopName: account.shopName,
                                syncedAt,
                            }));
                            for (const [index, item] of (receipt.line_items || []).entries()) {
                                itemRows.push(salesReceiptItemToRecord({
                                    id: createSalesReceiptItemId(receiptId, item.id, index),
                                    item,
                                    receiptId,
                                    syncedAt,
                                }));
                            }
                            for (const [index, payment] of (receipt.payments || []).entries()) {
                                paymentRows.push(salesReceiptPaymentToRecord({
                                    id: createSalesReceiptPaymentId(receiptId, index),
                                    payment,
                                    paymentIndex: index,
                                    receiptId,
                                    syncedAt,
                                }));
                            }
                        }
                        const batch = { get receiptCount() { return receipts.length; }, get itemCount() { return itemRows.length; }, get paymentCount() { return paymentRows.length; } };
                        batches.set(batch, { receiptRows, itemRows, paymentRows });
                        return batch;
                    } };
            } },
        store: {
            async isComplete(syncId) {
                const syncRows = await storage.salesReceiptSyncs.all();
                return Boolean(syncRows.find(record => record.id === syncId && record.status === "complete"));
            },
            prepare: async () => { await Promise.all([storage.salesReceipts.prepare(), storage.salesReceiptItems.prepare(), storage.salesReceiptPayments.prepare(), storage.salesReceiptSyncs.prepare()]); },
            async append(batch) {
                const { receiptRows, itemRows, paymentRows } = batches.get(batch)!;
                const single = await singleReceiptPayments();
                const payments = new Map(paymentRows.map(row => [row.receiptId, row]));
                for (const record of receiptRows) {
                    if (single) await singlePaymentReceipts.insert(withReceiptPayment(record, payments.get(record.id)));
                    else await storage.salesReceipts.insert(record);
                }
                for (const record of itemRows) await storage.salesReceiptItems.insert(record);
                if (!single) for (const record of paymentRows) await storage.salesReceiptPayments.insert(record);
            },
            async complete(syncId, salesDate, batch, syncedAt) {
                await storage.salesReceiptSyncs.insert({ id: syncId, salesDate, accountId: account.id, shopName: account.shopName, status: "complete", receiptCount: String(batch.receiptCount), itemCount: String(batch.itemCount), paymentCount: String(batch.paymentCount), syncedAt });
            }
        }
    };
}
