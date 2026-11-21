import "server-only";
import { utcTimestampComparisonKey } from "@/shared/lib/utc-timestamp";
import { currentTransaction, PersistenceFailure } from "@/infrastructure/persistence/postgres/database";
import { NativeRecords, type NativeRecord } from "@/infrastructure/persistence/postgres/native-records";

const layouts = new WeakMap<object, Promise<boolean>>();
export function receiptPaymentsEnabled(): Promise<boolean> {
  const client = currentTransaction();
  let pending = layouts.get(client);
  if (!pending) {
    pending = (async () => {
      const { rows } = await client.query<{ contract: string | null; validator: string | null; columns: string; present: string }>(`SELECT
        to_regprocedure('stock_operational.receipt_payment_storage_v1()')::text AS contract,
        to_regprocedure('stock_operational.valid_receipt_payments_v1(jsonb)')::text AS validator,
        (SELECT count(*)::text FROM pg_attribute WHERE attrelid='stock_operational.sales_receipts'::regclass AND NOT attisdropped AND attname='payments' AND atttypid='jsonb'::regtype AND attnotnull) AS columns,
        (SELECT count(*)::text FROM pg_attribute WHERE attrelid='stock_operational.sales_receipts'::regclass AND NOT attisdropped AND attname IN ('payments','paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt')) AS present`);
      const row = rows[0];
      if (row?.contract === null && row.validator === null && row.present === "0") return false;
      if (!row?.contract || !row.validator || row.columns !== "1" || row.present !== "1") throw new PersistenceFailure(503, "Incomplete receipt payment storage. No fallback was attempted.");
      const version = await client.query<{ version: string }>("SELECT stock_operational.receipt_payment_storage_v1() AS version");
      if (version.rows[0]?.version !== "receipt-payments-jsonb-v1") throw new PersistenceFailure(503, "Unsupported receipt payment storage.");
      return true;
    })();
    layouts.set(client, pending);
  }
  return pending;
}

export const paymentReceipts = new NativeRecords("sales_receipts", {
  id: { column: "id", kind: "text" },
  salesDate: { column: "salesDate", kind: "text" },
  accountId: { column: "accountId", kind: "text" },
  receiptNumber: { column: "receiptNumber", kind: "text" },
  receiptType: { column: "receiptType", kind: "text" },
  receiptDate: { column: "receiptDate", kind: "text" },
  createdAt: { column: "createdAt", kind: "timestamp" },
  updatedAt: { column: "updatedAt", kind: "timestamp" },
  cancelledAt: { column: "cancelledAt", kind: "text" },
  syncedAt: { column: "syncedAt", kind: "text" },
  payments: { column: "payments", kind: "jsonb" },
} as const);

const fields = ["id", "paymentTypeId", "paymentName", "paymentType", "moneyAmount", "syncedAt", "createdAt"] as const;
type Payment = { [K in typeof fields[number]]: string | null } & { id: string };
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string" && value !== "";
const numericText = /^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|NaN|-?Infinity)$/;
function validPayment(value: unknown): value is Payment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== fields.length || !fields.every(key => Object.hasOwn(row, key) && nullableText(row[key]))) return false;
  return typeof row.id === "string" && row.id !== ""
    && (row.moneyAmount === null || numericText.test(row.moneyAmount as string))
    && (row.createdAt === null || typeof row.createdAt === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}(?:[0-9]{3})?Z$/.test(row.createdAt) && Number.isFinite(Date.parse(row.createdAt)));
}

export function withReceiptPayments(receipt: NativeRecord, payments: NativeRecord[]): NativeRecord {
  const values = payments.map(payment => Object.fromEntries(fields.map(key => [key, payment[key] === "" ? null : payment[key] ?? null])));
  // Validate before encoding; never let JSON.stringify round a numeric amount.
  if (!values.every(validPayment) || new Set(values.map(p => p.id)).size !== values.length) throw new PersistenceFailure(503, "Invalid receipt payment data.");
  return { ...receipt, payments: JSON.stringify(values) };
}

// Same numeric normalization and database clock as legacy INSERT defaults. Each
// payment gets its own statement in provider order, without a ledger INSERT.
export async function prepareReceiptPayments(payments: NativeRecord[]): Promise<NativeRecord[]> {
  const result: NativeRecord[] = [];
  for (const payment of payments) {
    const { rows } = await currentTransaction().query<{ moneyAmount: string | null; createdAt: string }>(
      `SELECT nullif($1::text,'')::numeric::text AS "moneyAmount",stock_operational.native_timestamp_text(statement_timestamp()) AS "createdAt"`, [payment.moneyAmount ?? null]);
    result.push({ ...payment, ...rows[0] });
  }
  return result;
}

// Expand receipt-owned arrays to the existing internal report port. Product rows
// remain separate. Preserve global legacy payment order, including NULLS LAST.
export function receiptPaymentRows(receipts: NativeRecord[]): NativeRecord[] {
  const entries: (Payment & { receiptId: string })[] = [], ids = new Set<string>();
  for (const receipt of receipts) {
    let values: unknown;
    try { values = JSON.parse(String(receipt.payments)); } catch { throw new PersistenceFailure(503, "Invalid receipt payment data."); }
    if (!Array.isArray(values) || !values.every(validPayment)) throw new PersistenceFailure(503, "Invalid receipt payment data.");
    for (const payment of values) {
      if (ids.has(payment.id)) throw new PersistenceFailure(503, "Duplicate receipt payment identity.");
      ids.add(payment.id); entries.push({ ...payment, receiptId: String(receipt.id) });
    }
  }
  return entries.sort((a, b) => {
    if (a.createdAt && !b.createdAt) return -1; if (!a.createdAt && b.createdAt) return 1;
    const left = utcTimestampComparisonKey(a.createdAt ?? ""), right = utcTimestampComparisonKey(b.createdAt ?? "");
    return left < right ? -1 : left > right ? 1 : Buffer.compare(Buffer.from(a.id), Buffer.from(b.id));
  }).map(payment => ({
    id: payment.id, receiptId: payment.receiptId, paymentTypeId: payment.paymentTypeId ?? "",
    paymentName: payment.paymentName ?? "", paymentType: payment.paymentType ?? "",
    moneyAmount: payment.moneyAmount ?? "", syncedAt: payment.syncedAt ?? "",
  }));
}
