import "server-only";
import type { GoogleSheetRow, IGoogleRowsSheet } from "@/infrastructure/persistence/google-sheets/types";
import type { SalesReader, SalesRecord as SheetRecord } from "../../application/ports/sales-reader";
import { SALES_RECEIPT_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipts/const";
import { SALES_RECEIPT_ITEM_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-items/const";
import { SALES_RECEIPT_PAYMENT_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-payments/const";
import { SALES_RECEIPT_SYNC_HEADERS } from "@/modules/sales/infrastructure/google-sheets/receipt-syncs/const";
export type SalesSheets = {
    salesReceipts: IGoogleRowsSheet;
    salesReceiptItems: IGoogleRowsSheet;
    salesReceiptPayments: IGoogleRowsSheet;
    salesReceiptSyncs: IGoogleRowsSheet;
};
export function createSalesReader(service: SalesSheets): SalesReader {
    return { receipts: () => readRecords(service.salesReceipts, SALES_RECEIPT_HEADERS), items: () => readRecords(service.salesReceiptItems, SALES_RECEIPT_ITEM_HEADERS), payments: () => readRecords(service.salesReceiptPayments, SALES_RECEIPT_PAYMENT_HEADERS), syncs: () => readRecords(service.salesReceiptSyncs, SALES_RECEIPT_SYNC_HEADERS) };
}

async function readRecords(
  sheet: IGoogleRowsSheet,
  headers: string[],
): Promise<SheetRecord[]> {
  const rows = await sheet.readRows();
  return rows
    .filter((row) => row[0] !== headers[0])
    .map((row) => rowToRecord(row, headers));
}

function rowToRecord(row: GoogleSheetRow, headers: string[]): SheetRecord {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? null]),
  );
}

