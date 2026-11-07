import "server-only";
import type { IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { ReceiptSyncStore, ReceiptSyncSource, ReceiptSyncBatch } from "../../application/ports/receipt-sync";
import type { ReceiptSource } from "../../application/ports/receipt-source";
import { SALES_RECEIPT_HEADERS } from "./receipts/const";
import { SALES_RECEIPT_ITEM_HEADERS } from "./receipt-items/const";
import { SALES_RECEIPT_PAYMENT_HEADERS } from "./receipt-payments/const";
import { SALES_RECEIPT_SYNC_HEADERS } from "./receipt-syncs/const";
import { createSalesReceiptId, createSalesReceiptItemId, createSalesReceiptPaymentId, } from "../../domain/receipt-ids";
import { salesReceiptItemToRow, salesReceiptPaymentToRow, salesReceiptToRow, } from "./receipt-row-mapping";
import { getLoyverseReceiptsForSalesDate } from "../../application/receipts-for-date";
type IGoogleSheetsService = {
    salesReceipts: IGoogleRowsSheet;
    salesReceiptItems: IGoogleRowsSheet;
    salesReceiptPayments: IGoogleRowsSheet;
    salesReceiptSyncs: IGoogleRowsSheet;
};
export function createReceiptSync(googleSheetsService: IGoogleSheetsService, account: {
    id: string;
    shopName: string;
    storeId?: string;
    service: ReceiptSource;
}): {
    store: ReceiptSyncStore;
    source: ReceiptSyncSource;
} {
    const batches = new WeakMap<ReceiptSyncBatch, {
        receiptRows: string[][];
        itemRows: string[][];
        paymentRows: string[][];
    }>();
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
                        batches.set(batch, { receiptRows, itemRows, paymentRows });
                        return batch;
                    } };
            } },
        store: {
            async isComplete(syncId) {
                const syncRows = await googleSheetsService.salesReceiptSyncs.readRows("A:I");
                return Boolean(syncRows.find((row, index) => index > 0 && row[0] === syncId && row[4] === "complete"));
            },
            prepare: () => ensureSalesHeaders(googleSheetsService),
            async append(batch) {
                const { receiptRows, itemRows, paymentRows } = batches.get(batch)!;
                await Promise.all([appendIfNotEmpty(googleSheetsService.salesReceipts, "A:Z", receiptRows), appendIfNotEmpty(googleSheetsService.salesReceiptItems, "A:U", itemRows), appendIfNotEmpty(googleSheetsService.salesReceiptPayments, "A:J", paymentRows)]);
            },
            async complete(syncId, salesDate, batch, syncedAt) {
                await googleSheetsService.salesReceiptSyncs.appendRows("A:I", [[syncId, salesDate, account.id, account.shopName, "complete", String(batch.receiptCount), String(batch.itemCount), String(batch.paymentCount), syncedAt]]);
            }
        }
    };
}

async function ensureSalesHeaders(
  googleSheetsService: IGoogleSheetsService,
): Promise<void> {
  await Promise.all([
    ensureHeaderRow(
      googleSheetsService.salesReceipts,
      "A1:Z1",
      SALES_RECEIPT_HEADERS,
    ),
    ensureHeaderRow(
      googleSheetsService.salesReceiptItems,
      "A1:U1",
      SALES_RECEIPT_ITEM_HEADERS,
    ),
    ensureHeaderRow(
      googleSheetsService.salesReceiptPayments,
      "A1:J1",
      SALES_RECEIPT_PAYMENT_HEADERS,
    ),
    ensureHeaderRow(
      googleSheetsService.salesReceiptSyncs,
      "A1:I1",
      SALES_RECEIPT_SYNC_HEADERS,
    ),
  ]);
}

async function ensureHeaderRow(
  sheet: {
    readRows(range?: string): Promise<unknown[][]>;
    updateRows(range: string, values: string[][]): Promise<void>;
  },
  range: string,
  headers: string[],
): Promise<void> {
  const rows = await sheet.readRows(range);
  if (rows[0]?.join("|") === headers.join("|")) {
    return;
  }
  await sheet.updateRows(range, [headers]);
}

async function appendIfNotEmpty(
  sheet: {
    appendRows(range: string, values: string[][]): Promise<void>;
  },
  range: string,
  rows: string[][],
): Promise<void> {
  if (rows.length > 0) {
    await sheet.appendRows(range, rows);
  }
}
