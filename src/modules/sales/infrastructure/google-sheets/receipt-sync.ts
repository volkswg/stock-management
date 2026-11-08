import "server-only";
import { createHash } from "node:crypto";
import type { SalesSyncWrite } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { ReceiptSyncStore, ReceiptSyncSource, ReceiptSyncBatch, ReceiptSyncAttempt } from "../../application/ports/receipt-sync";
import type { ReceiptSource } from "../../application/ports/receipt-source";
import { SALES_RECEIPT_HEADERS } from "./receipts/const";
import { SALES_RECEIPT_ITEM_HEADERS } from "./receipt-items/const";
import { SALES_RECEIPT_PAYMENT_HEADERS } from "./receipt-payments/const";
import { SALES_RECEIPT_SYNC_HEADERS } from "./receipt-syncs/const";
import { createSalesReceiptId, createSalesReceiptItemId, createSalesReceiptPaymentId, createSalesReceiptSyncId, } from "../../domain/receipt-ids";
import { salesReceiptItemToRow, salesReceiptPaymentToRow, salesReceiptToRow, } from "./receipt-row-mapping";
import { getLoyverseReceiptsForSalesDate } from "../../application/receipts-for-date";
type IGoogleSheetsService = {
    salesReceipts: IGoogleRowsSheet;
    salesReceiptItems: IGoogleRowsSheet;
    salesReceiptPayments: IGoogleRowsSheet;
    salesReceiptSyncs: IGoogleRowsSheet;
    writeSalesSync?(updates: SalesSyncWrite[], beforeWrite: () => Promise<void>): Promise<void>;
};
export function createReceiptSync(googleSheetsService: IGoogleSheetsService, account: {
    id: string;
    shopName: string;
    storeId?: string;
    service: ReceiptSource;
}, attempt: ReceiptSyncAttempt): {
    store: ReceiptSyncStore;
    source: ReceiptSyncSource;
} {
    const batches = new WeakMap<ReceiptSyncBatch, {
        salesDate: string;
        receiptRows: string[][];
        itemRows: string[][];
        paymentRows: string[][];
    }>();
    let snapshot: Snapshot;
    return {
        source: { async load(salesDate) {
                const receipts = await getLoyverseReceiptsForSalesDate({ loyverseService: account.service, salesDate, storeId: account.storeId });
                return { project(syncedAt) {
                        const receiptRows: string[][] = [];
                        const itemRows: string[][] = [];
                        const paymentRows: string[][] = [];
                        for (const receipt of receipts) {
                            const receiptId = createSalesReceiptId(account.id, receipt.receipt_number);
                            receiptRows.push(salesReceiptToRow({
                                accountId: account.id,
                                id: receiptId,
                                receipt,
                                salesDate,
                                shopName: account.shopName,
                                syncedAt,
                            }));
                            for (const [index, item] of (receipt.line_items || []).entries()) {
                                itemRows.push(salesReceiptItemToRow({
                                    id: createSalesReceiptItemId(receiptId, item.id, index),
                                    item,
                                    receiptId,
                                    syncedAt,
                                }));
                            }
                            for (const [index, payment] of (receipt.payments || []).entries()) {
                                paymentRows.push(salesReceiptPaymentToRow({
                                    id: createSalesReceiptPaymentId(receiptId, index),
                                    payment,
                                    paymentIndex: index,
                                    receiptId,
                                    syncedAt,
                                }));
                            }
                        }
                        const batch = { get receiptCount() { return receipts.length; }, get itemCount() { return itemRows.length; }, get paymentCount() { return paymentRows.length; } };
                        batches.set(batch, { salesDate, receiptRows, itemRows, paymentRows });
                        return batch;
                    } };
            } },
        store: {
            async isComplete(syncId) {
                snapshot = await readSnapshot(googleSheetsService);
                const sync = snapshot[3].byId.get(syncId);
                if (!sync) return false;
                verifyMarker(sync, account.id);
                if (createSalesReceiptSyncId(account.id, sync[1]) !== syncId) fail("Sync marker date does not match its ID.");
                const published = rowsForDate(snapshot, account.id, sync[1]);
                verifyCounts(sync, published);
                if (attempt.pendingFingerprint !== null) {
                    if (fingerprint(published, sync) !== attempt.pendingFingerprint) fail("Stored outcome differs from the pending intent; operator review required.");
                    await attempt.confirmWrite();
                }
                return true;
            },
            async prepare() { snapshot = await readSnapshot(googleSheetsService); },
            async append(batch) {
                const projected = batches.get(batch);
                if (!projected) fail("Unknown projected batch.");
                const rows = [projected.receiptRows, projected.itemRows, projected.paymentRows];
                if (batch.receiptCount !== rows[0].length || batch.itemCount !== rows[1].length || batch.paymentCount !== rows[2].length) fail("Projected counts changed before publication.");
                validateProjected(rows);
                // Check all existing matching rows before making any mutation.
                reconcile(snapshot, rows, account.id, projected.salesDate);
            },
            async complete(syncId, salesDate, batch, syncedAt) {
                if (!googleSheetsService.writeSalesSync) fail("Atomic workbook writer is not configured.");
                const projected = batches.get(batch)!;
                const rows = [projected.receiptRows, projected.itemRows, projected.paymentRows];
                const marker = [syncId, salesDate, account.id, account.shopName, "complete", String(batch.receiptCount), String(batch.itemCount), String(batch.paymentCount), syncedAt];
                const intent = fingerprint(rows, marker);
                const pending = attempt.pendingFingerprint;
                if (pending !== null && pending !== intent) fail("Pending payload differs from current Loyverse data; operator review required.");
                if (pending !== null) {
                    // A timeout may still commit after an immediate empty read.
                    // Never resend it, even if rows are currently absent.
                    await verifyPublished(googleSheetsService, rows, marker);
                    await attempt.confirmWrite();
                    return;
                }
                const missing = reconcile(snapshot, rows, account.id, salesDate);
                const updates: SalesSyncWrite[] = specs.map(([sheet, headers], index) => {
                    const values = index === 3 ? [marker] : missing[index];
                    const empty = snapshot[index].rows.length === 0;
                    const append = empty ? [headers, ...values] : values;
                    return { sheet, range: `A${empty ? 1 : snapshot[index].rows.length + 1}:${columns[index]}${(empty ? 0 : snapshot[index].rows.length) + append.length}`, values: append };
                }).filter(update => update.values.length > 0);
                let started = false;
                try {
                    await googleSheetsService.writeSalesSync(updates, async () => {
                        await attempt.beginWrite(intent);
                        started = true;
                    });
                } catch (error) {
                    if (!started) {
                        if (error instanceof Error && /^(Invalid (or overlapping atomic|atomic)|Sales sync (batch exceeds safe limits|target grid))/.test(error.message)) throw error;
                        fail("Atomic preflight or durable intent failed. No new batch was sent; check storage/coordinator health before retrying.");
                    }
                    // A rejected response is not proof of a rejected write.
                    await verifyPublished(googleSheetsService, rows, marker);
                    await attempt.confirmWrite();
                    return;
                }
                await verifyPublished(googleSheetsService, rows, marker);
                await attempt.confirmWrite();
            }
        }
    };
}

const specs = [
    ["salesReceipts", SALES_RECEIPT_HEADERS],
    ["salesReceiptItems", SALES_RECEIPT_ITEM_HEADERS],
    ["salesReceiptPayments", SALES_RECEIPT_PAYMENT_HEADERS],
    ["salesReceiptSyncs", SALES_RECEIPT_SYNC_HEADERS],
] as const;
const columns = ["Z", "U", "J", "I"];
type Table = { rows: string[][]; byId: Map<string, string[]> };
type Snapshot = Table[];
function fail(message: string): never { throw new Error(`Sales sync blocked: ${message}`); }
async function readSnapshot(service: IGoogleSheetsService): Promise<Snapshot> {
    try {
        return await Promise.all(specs.map(async ([sheet, headers], index) => {
            const raw = await service[sheet].readRows(`A:${columns[index]}`);
            if (raw.length && (raw[0].length !== headers.length || raw[0].some((value, i) => value !== headers[i]))) fail("Invalid worksheet headers; review storage without overwriting historical rows.");
            const rows = raw.map(row => Array.from({ length: headers.length }, (_, i) => String(row[i] ?? "")));
            const byId = new Map<string, string[]>();
            for (const row of rows.slice(1)) {
                if (row.every(value => value === "")) continue;
                if (!row[0] || byId.has(row[0])) fail("Missing or duplicate stored IDs; operator review required.");
                byId.set(row[0], row);
            }
            return { rows, byId };
        }));
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("Sales sync blocked:")) throw error;
        fail("Unable to read storage safely. Check workbook access and retry; do not clear existing rows.");
    }
}
function validateProjected(rows: string[][][]): void {
    for (const [index, table] of rows.entries()) {
        const seen = new Set<string>();
        for (const row of table) {
            if (row.length !== specs[index][1].length || !row[0] || seen.has(row[0])) fail("Duplicate projected IDs or invalid row dimensions; check receipt/item identities.");
            seen.add(row[0]);
        }
    }
}
function same(left: string[], right: string[]): boolean {
    // syncedAt is operational metadata, not a new version of a financial row.
    return left.slice(0, -1).every((value, i) => value === right[i]);
}
function rowsForDate(snapshot: Snapshot, accountId: string, salesDate: string): string[][][] {
    const receipts = [...snapshot[0].byId.values()].filter(row => row[1] === salesDate && row[2] === accountId);
    const parents = new Set(receipts.map(row => row[0]));
    return [receipts, ...snapshot.slice(1, 3).map(table => [...table.byId.values()].filter(row => parents.has(row[1])))];
}
function verifyMarker(marker: string[], accountId: string): void {
    if (marker[2] !== accountId || marker[4] !== "complete" || marker.slice(5, 8).some(value => !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))) fail("Conflicting sync marker; operator review required.");
}
function verifyCounts(marker: string[], rows: string[][][]): void {
    if (rows.some((table, i) => table.length !== Number(marker[i + 5]))) fail("Stored sync counts do not match receipt/item/payment rows; operator review required.");
}
function reconcile(snapshot: Snapshot, expected: string[][][], accountId: string, salesDate: string): string[][][] {
    const scoped = rowsForDate(snapshot, accountId, salesDate);
    const parents = new Set([...expected[0], ...scoped[0]].map(row => row[0]));
    const related = [scoped[0], ...snapshot.slice(1, 3).map(table => [...table.byId.values()].filter(row => parents.has(row[1])))];
    for (let i = 0; i < 3; i++) {
        const expectedIds = new Set(expected[i].map(row => row[0]));
        if (related[i].some(row => !expectedIds.has(row[0]))) fail("Existing date contains unexpected rows; no historical data was changed.");
    }
    return expected.map((rows, index) => rows.filter(row => {
        const stored = snapshot[index].byId.get(row[0]);
        if (stored && !same(row, stored)) fail("Existing row conflicts with Loyverse; no historical data was changed.");
        return !stored;
    }));
}
function fingerprint(rows: string[][][], marker: string[]): string {
    return createHash("sha256").update(JSON.stringify([
        ...rows.map(table => table.map(row => row.slice(0, -1)).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)), marker.slice(0, -1),
    ])).digest("hex");
}
async function verifyPublished(service: IGoogleSheetsService, rows: string[][][], marker: string[]): Promise<void> {
    try {
        const snapshot = await readSnapshot(service);
        const stored = snapshot[3].byId.get(marker[0]);
        if (!stored || !same(marker, stored)) fail("Completion marker not visible.");
        const missing = reconcile(snapshot, rows, marker[2], marker[1]);
        if (missing.some(table => table.length)) fail("Expected rows not visible.");
        verifyCounts(stored, rowsForDate(snapshot, marker[2], marker[1]));
    } catch {
        fail("Write outcome unconfirmed. The durable coordinator must keep this workbook quarantined; retry verification only, never resend or delete rows. Contact the operator if unresolved.");
    }
}
