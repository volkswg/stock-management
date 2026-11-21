import { currentTransaction } from "@/infrastructure/persistence/postgres/database";
import { receiptPaymentsEnabled, paymentReceipts, receiptPaymentRows } from "./receipt-payment";
import "server-only";
import type { SalesReader } from "../../application/ports/sales-reader";
import type { Storage } from "./storage";
export type SalesStorage = Pick<Storage, "salesReceipts" | "salesReceiptItems" | "salesReceiptPayments" | "salesReceiptSyncs">;
// Preserve the existing reserved identity without a worksheet/header dependency.
const visible = (records: Awaited<ReturnType<SalesStorage["salesReceipts"]["all"]>>) => records.filter(record => record.id !== "id");
export function createSalesReader(storage: SalesStorage): SalesReader {
  const snapshots = new WeakMap<object, Promise<Awaited<ReturnType<SalesStorage["salesReceipts"]["all"]>>>>();
  function receipts() {
    const client = currentTransaction();let pending = snapshots.get(client);
    if (!pending) { pending = receiptPaymentsEnabled().then(inline => inline ? paymentReceipts.all() : storage.salesReceipts.all()).then(visible);snapshots.set(client,pending); }
    return pending;
  }
  return { receipts, items: () => storage.salesReceiptItems.all().then(visible), payments: async () => await receiptPaymentsEnabled() ? receiptPaymentRows(await receipts()) : storage.salesReceiptPayments.all().then(visible), syncs: () => storage.salesReceiptSyncs.all().then(visible) };
}
