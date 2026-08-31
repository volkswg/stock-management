import {
  SALES_RECEIPT_HEADERS,
  SALES_RECEIPT_ITEM_HEADERS,
  SALES_RECEIPT_PAYMENT_HEADERS,
  SALES_RECEIPT_SYNC_HEADERS,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import type { ConfiguredLoyverseAccount } from "@/externals/loyverse";
import {
  createSalesReceiptId,
  createSalesReceiptItemId,
  createSalesReceiptPaymentId,
  createSalesReceiptSyncId,
} from "./idBuilders";
import {
  salesReceiptItemToRow,
  salesReceiptPaymentToRow,
  salesReceiptToRow,
} from "./rowMappers";
import { getLoyverseReceiptsForSalesDate } from "./getLoyverseReceiptsForSalesDate";

export type SyncLoyverseDailySalesResult =
  | {
      outcome: "synced";
      receiptCount: number;
      itemCount: number;
      paymentCount: number;
      syncedAt: string;
    }
  | {
      outcome: "already_synced";
    };

export async function syncLoyverseDailySales({
  account,
  googleSheetsService,
  salesDate,
}: {
  account: ConfiguredLoyverseAccount;
  googleSheetsService: IGoogleSheetsService;
  salesDate: string;
}): Promise<SyncLoyverseDailySalesResult> {
  const syncId = createSalesReceiptSyncId(account.id, salesDate);
  const syncRows = await googleSheetsService.salesReceiptSyncs.readRows("A:I");
  const completeSyncRow = syncRows.find(
    (row, index) => index > 0 && row[0] === syncId && row[4] === "complete",
  );
  if (completeSyncRow) {
    return { outcome: "already_synced" };
  }

  const receipts = await getLoyverseReceiptsForSalesDate({
    loyverseService: account.service,
    salesDate,
    storeId: account.storeId,
  });
  const syncedAt = new Date().toISOString();
  const receiptRows: string[][] = [];
  const itemRows: string[][] = [];
  const paymentRows: string[][] = [];

  for (const receipt of receipts) {
    const receiptId = createSalesReceiptId(account.id, receipt.receipt_number);
    receiptRows.push(
      salesReceiptToRow({
        accountId: account.id,
        id: receiptId,
        receipt,
        salesDate,
        shopName: account.shopName,
        syncedAt,
      }),
    );

    for (const [index, item] of (receipt.line_items || []).entries()) {
      itemRows.push(
        salesReceiptItemToRow({
          id: createSalesReceiptItemId(receiptId, item.id, index),
          item,
          receiptId,
          syncedAt,
        }),
      );
    }

    for (const [index, payment] of (receipt.payments || []).entries()) {
      paymentRows.push(
        salesReceiptPaymentToRow({
          id: createSalesReceiptPaymentId(receiptId, index),
          payment,
          paymentIndex: index,
          receiptId,
          syncedAt,
        }),
      );
    }
  }

  await ensureSalesHeaders(googleSheetsService);
  await Promise.all([
    appendIfNotEmpty(
      googleSheetsService.salesReceipts,
      "A:Z",
      receiptRows,
    ),
    appendIfNotEmpty(
      googleSheetsService.salesReceiptItems,
      "A:U",
      itemRows,
    ),
    appendIfNotEmpty(
      googleSheetsService.salesReceiptPayments,
      "A:J",
      paymentRows,
    ),
  ]);
  await googleSheetsService.salesReceiptSyncs.appendRows("A:I", [
    [
      syncId,
      salesDate,
      account.id,
      account.shopName,
      "complete",
      String(receipts.length),
      String(itemRows.length),
      String(paymentRows.length),
      syncedAt,
    ],
  ]);

  return {
    outcome: "synced",
    receiptCount: receipts.length,
    itemCount: itemRows.length,
    paymentCount: paymentRows.length,
    syncedAt,
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
