import "server-only";
import { utcTimestampComparisonKey } from "@/shared/lib/utc-timestamp";
import { currentTransaction, PersistenceFailure } from "@/infrastructure/persistence/postgres/database";
import { NativeRecords, type NativeRecord } from "@/infrastructure/persistence/postgres/native-records";

// The old schema stays readable until the guarded owner-only rebuild commits.
// A partial/unknown installation must never silently select another layout.
const layouts = new WeakMap<object, Promise<boolean>>();
export function singleReceiptPayments(): Promise<boolean> {
  const client = currentTransaction();
  let pending = layouts.get(client);
  if (!pending) {
    pending = (async () => {
      const { rows } = await client.query<{ contract: string | null; columns: string; present: string }>(`SELECT to_regprocedure('stock_operational.receipt_payment_storage_v1()')::text AS contract,
        (SELECT count(*)::text FROM pg_attribute a JOIN (VALUES ('paymentId','text'),('paymentTypeId','text'),('paymentName','text'),('paymentType','text'),('paymentAmount','numeric'),('paymentCreatedAt','timestamp with time zone')) e(name,kind) ON a.attname=e.name AND format_type(a.atttypid,a.atttypmod)=e.kind WHERE a.attrelid='stock_operational.sales_receipts'::regclass AND NOT a.attisdropped) AS columns,
        (SELECT count(*)::text FROM pg_attribute WHERE attrelid='stock_operational.sales_receipts'::regclass AND NOT attisdropped AND attname IN ('paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt')) AS present`);
      if (rows[0]?.contract === null && rows[0]?.present === "0") return false;
      if (!rows[0]?.contract || rows[0]?.columns !== "6" || rows[0]?.present !== "6") throw new PersistenceFailure(503,"Incomplete receipt payment storage. No fallback was attempted.");
      const version = await client.query<{ version: string }>("SELECT stock_operational.receipt_payment_storage_v1() AS version");
      if (version.rows[0]?.version !== "single-receipt-payment-v1") throw new PersistenceFailure(503,"Unsupported receipt payment storage.");
      return true;
    })();
    layouts.set(client, pending);
  }
  return pending;
}

export const singlePaymentReceipts = new NativeRecords("sales_receipts", {
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
  paymentId: { column: "paymentId", kind: "text" },
  paymentTypeId: { column: "paymentTypeId", kind: "text" },
  paymentName: { column: "paymentName", kind: "text" },
  paymentType: { column: "paymentType", kind: "text" },
  paymentAmount: { column: "paymentAmount", kind: "numeric" },
  paymentCreatedAt: { column: "paymentCreatedAt", kind: "timestamp" },
} as const);

export function withReceiptPayment(receipt: NativeRecord, payment?: NativeRecord): NativeRecord {
  return { ...receipt,
    paymentId: payment?.id ?? null,
    paymentTypeId: payment?.paymentTypeId ?? null,
    paymentName: payment?.paymentName ?? null,
    paymentType: payment?.paymentType ?? null,
    paymentAmount: payment?.moneyAmount ?? null,
    ...(payment ? {} : { paymentCreatedAt: null }),
  };
}

// Keep the existing report port/HTTP shape. One receipt yields zero or one
// payment projection; products remain separate and never multiply payments.
export function receiptPaymentRows(receipts: NativeRecord[]): NativeRecord[] {
  return receipts.filter(r => typeof r.paymentId === "string" && r.paymentId !== "").sort((a,b) => {
    const left = String(a.paymentCreatedAt ?? ""), right = String(b.paymentCreatedAt ?? "");
    if (left && !right) return -1; if (!left && right) return 1;
    const l = utcTimestampComparisonKey(left), r = utcTimestampComparisonKey(right);
    return l < r ? -1 : l > r ? 1 : Buffer.compare(Buffer.from(String(a.paymentId)),Buffer.from(String(b.paymentId)));
  }).map(r => ({
    id: r.paymentId, receiptId: r.id, paymentTypeId: r.paymentTypeId,
    paymentName: r.paymentName, paymentType: r.paymentType,
    moneyAmount: r.paymentAmount, syncedAt: r.syncedAt,
  }));
}
