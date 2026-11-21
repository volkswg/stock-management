-- OPERATOR ONLY. Rebuild legacy payment rows for new receipts before rolling
-- the app back. Keep existing historical detail rows exactly; no restore over
-- later writes. Separate approval and fresh recovery/writer freeze required.
BEGIN;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SELECT 1/coalesce(current_setting('stock.allow_receipt_payment_inverse',true)='reviewed-receipt-payments-jsonb-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_restore_verified',true)='business-and-config-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_source',true)~'^[a-f0-9]{40}$' AND current_setting('stock.payment_source',true)<>repeat('0',40),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.sales_receipts,stock_operational.sales_receipt_payments IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity) FROM pg_class WHERE oid IN ('stock_operational.sales_receipts'::regclass,'stock_operational.sales_receipt_payments'::regclass)))::int;
SELECT 1/(stock_operational.receipt_payment_storage_v1()='receipt-payments-jsonb-v1')::int;
SELECT 1/(NOT has_any_column_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT'))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(tgenabled='O' AND tgname IN ('a_validate','advance_revision')) FROM pg_trigger WHERE tgrelid='stock_operational.sales_receipt_payments'::regclass AND NOT tgisinternal))::int;
CREATE TEMP TABLE receipt_payments_inverse_receipts ON COMMIT DROP AS SELECT id,encode(sha256(convert_to((to_jsonb(t)-'payments')::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t;
CREATE TEMP TABLE receipt_payments_inverse_before ON COMMIT DROP AS
 SELECT 'receipts'::text name,id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t
 UNION ALL SELECT 'payments',id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM stock_operational.sales_receipt_payments t;
SELECT 1/coalesce((SELECT encode(sha256(convert_to(coalesce(string_agg(jsonb_build_array(name,id,hash)::text,E'\n' ORDER BY name COLLATE "C",id COLLATE "C"),''),'UTF8')),'hex')=current_setting('stock.payment_fingerprint',true) FROM receipt_payments_inverse_before),false)::int;
CREATE TEMP TABLE receipt_payments_entries ON COMMIT DROP AS
 SELECT r.id "receiptId",entry->>'id' id,entry->>'paymentTypeId' "paymentTypeId",entry->>'paymentName' "paymentName",entry->>'paymentType' "paymentType",entry->>'moneyAmount' "moneyAmount",entry->>'syncedAt' "syncedAt",entry->>'createdAt' "createdAt"
 FROM stock_operational.sales_receipts r CROSS JOIN LATERAL jsonb_array_elements(r.payments) entry;
SELECT 1/(NOT EXISTS(SELECT id FROM receipt_payments_entries GROUP BY id HAVING count(*)>1))::int;
-- Every retained active ledger entry must still be represented exactly. Never
-- overwrite deleted/divergent history or attach an existing ID to another row.
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.sales_receipt_payments p LEFT JOIN receipt_payments_entries e ON p.id=e.id WHERE p."deletedAt" IS NULL AND ROW(e.id,e."receiptId",e."paymentTypeId",e."paymentName",e."paymentType",e."moneyAmount",e."syncedAt",e."createdAt") IS DISTINCT FROM ROW(p.id,p."receiptId",p."paymentTypeId",p."paymentName",p."paymentType",p."moneyAmount"::text,p."syncedAt",stock_operational.native_timestamp_text(p."createdAt"))))::int;
SELECT 1/(NOT EXISTS(SELECT FROM receipt_payments_entries e JOIN stock_operational.sales_receipt_payments p ON p.id=e.id WHERE p."receiptId"<>e."receiptId" OR p."deletedAt" IS NOT NULL))::int;
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER advance_revision;
INSERT INTO stock_operational.sales_receipt_payments(id,"receiptId","paymentTypeId","paymentName","paymentType","moneyAmount","syncedAt","createdAt")
 SELECT e.id,e."receiptId",e."paymentTypeId",e."paymentName",e."paymentType",e."moneyAmount"::numeric,e."syncedAt",stock_operational.native_timestamp_input(e."createdAt")
 FROM receipt_payments_entries e WHERE NOT EXISTS(SELECT FROM stock_operational.sales_receipt_payments p WHERE p.id=e.id);
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE stock_operational.sales_receipt_payments ENABLE TRIGGER advance_revision;
SELECT 1/(NOT EXISTS(SELECT FROM receipt_payments_entries e LEFT JOIN stock_operational.sales_receipt_payments p ON p.id=e.id WHERE ROW(e.id,e."receiptId",e."paymentTypeId",e."paymentName",e."paymentType",e."moneyAmount",e."syncedAt",e."createdAt") IS DISTINCT FROM ROW(p.id,p."receiptId",p."paymentTypeId",p."paymentName",p."paymentType",p."moneyAmount"::text,p."syncedAt",stock_operational.native_timestamp_text(p."createdAt"))))::int;
SELECT 1/(NOT EXISTS(SELECT FROM receipt_payments_inverse_before b LEFT JOIN stock_operational.sales_receipt_payments p ON p.id=b.id WHERE b.name='payments' AND b.hash IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')) )::int;
DROP FUNCTION stock_operational.receipt_payment_storage_v1();
ALTER TABLE stock_operational.sales_receipts DROP CONSTRAINT sales_receipts_payments_shape,DROP COLUMN payments RESTRICT;
DROP FUNCTION stock_operational.valid_receipt_payments_v1(jsonb);
GRANT INSERT ON stock_operational.sales_receipt_payments TO stock_runtime;
SELECT 1/(NOT EXISTS(SELECT FROM receipt_payments_inverse_receipts b FULL JOIN (SELECT id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t) a USING(id) WHERE b.hash IS DISTINCT FROM a.hash))::int;
SELECT 1/((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton))::int;
COMMIT;
