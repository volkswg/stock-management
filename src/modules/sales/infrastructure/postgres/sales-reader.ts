import { currentTransaction } from "@/infrastructure/persistence/postgres/database";
import { requireReceiptPayments, paymentReceipts, receiptPaymentRows } from "./receipt-payment";
import "server-only";
import type { SalesReader } from "../../application/ports/sales-reader";
import type { SalesReadScope } from "../../application/ports/sales-reader";
import { trimmedSql } from "@/infrastructure/persistence/postgres/text";
import type { Storage } from "./storage";
export type SalesStorage = Pick<Storage, "salesReceipts" | "salesReceiptItems" | "salesReceiptSyncs">;
// Preserve the existing reserved identity without a worksheet/header dependency.
const visible = (records: Awaited<ReturnType<SalesStorage["salesReceipts"]["all"]>>) => records.filter(record => record.id !== "id");
export function createSalesReader(storage: SalesStorage, scope?: SalesReadScope): SalesReader {
  const values: (string | readonly string[])[] = [];
  const clauses = (alias: string) => {
    const parts: string[] = [];
    const bind = (value: string | readonly string[]) => { values.push(value); return `$${values.length}`; };
    if (scope?.fromDate !== undefined) parts.push(`${trimmedSql(`${alias}."salesDate"`)} COLLATE "C" >= ${bind(scope.fromDate)}::text COLLATE "C"`);
    if (scope?.toDate !== undefined) parts.push(`${trimmedSql(`${alias}."salesDate"`)} COLLATE "C" <= ${bind(scope.toDate)}::text COLLATE "C"`);
    if (scope?.year !== undefined) parts.push(`starts_with(${trimmedSql(`${alias}."salesDate"`)},${bind(scope.year + "-")}::text)`);
    if (scope?.accountIds !== undefined) parts.push(`${trimmedSql(`${alias}."accountId"`)} = ANY(${bind(scope.accountIds)}::text[])`);
    return parts.length ? parts.join(" AND ") : "true";
  };
  const receiptPredicate = clauses("t"), receiptValues = [...values];
  values.length = 0;
  const itemPredicate = `EXISTS (SELECT 1 FROM stock_operational.sales_receipts r WHERE r."deletedAt" IS NULL AND ${trimmedSql('r.id')} = ${trimmedSql('t."receiptId"')} AND ${clauses("r")})`, itemValues = [...values];
  const snapshots = new WeakMap<object, Promise<Awaited<ReturnType<SalesStorage["salesReceipts"]["all"]>>>>();
  function receipts() {
    const client = currentTransaction();let pending = snapshots.get(client);
    if (!pending) { pending = requireReceiptPayments().then(() => scope ? paymentReceipts.select(receiptPredicate, receiptValues) : paymentReceipts.all()).then(visible);snapshots.set(client,pending); }
    return pending;
  }
  return { receipts, items: () => (scope ? storage.salesReceiptItems.select(itemPredicate, itemValues) : storage.salesReceiptItems.all()).then(visible), payments: async () => receiptPaymentRows(await receipts()), syncs: () => (scope ? storage.salesReceiptSyncs.select(receiptPredicate, receiptValues) : storage.salesReceiptSyncs.all()).then(visible) };
}
