import "server-only";
import type { SalesReader } from "../../application/ports/sales-reader";
import type { Storage } from "./storage";
export type SalesStorage = Pick<Storage, "salesReceipts" | "salesReceiptItems" | "salesReceiptPayments" | "salesReceiptSyncs">;
// Preserve the existing reserved identity without a worksheet/header dependency.
const visible = (records: Awaited<ReturnType<SalesStorage["salesReceipts"]["all"]>>) => records.filter(record => record.id !== "id");
export function createSalesReader(storage: SalesStorage): SalesReader {
  return { receipts: () => storage.salesReceipts.all().then(visible), items: () => storage.salesReceiptItems.all().then(visible), payments: () => storage.salesReceiptPayments.all().then(visible), syncs: () => storage.salesReceiptSyncs.all().then(visible) };
}
