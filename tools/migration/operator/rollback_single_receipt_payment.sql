-- OPERATOR ONLY. Rebuild legacy payment rows for new receipts before rolling
-- the app back. Keep existing historical detail rows exactly; no restore over
-- later writes. Separate approval and fresh recovery/writer freeze required.
BEGIN;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SELECT 1/coalesce(current_setting('stock.allow_receipt_payment_inverse',true)='reviewed-single-receipt-payment-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_restore_verified',true)='business-and-config-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_source',true)~'^[a-f0-9]{40}$' AND current_setting('stock.payment_source',true)<>repeat('0',40),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.sales_receipts,stock_operational.sales_receipt_payments IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity) FROM pg_class WHERE oid IN ('stock_operational.sales_receipts'::regclass,'stock_operational.sales_receipt_payments'::regclass)))::int;
SELECT 1/(stock_operational.receipt_payment_storage_v1()='single-receipt-payment-v1')::int;
SELECT 1/(NOT has_any_column_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT'))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(tgenabled='O' AND tgname IN ('a_validate','advance_revision')) FROM pg_trigger WHERE tgrelid='stock_operational.sales_receipt_payments'::regclass AND NOT tgisinternal))::int;
CREATE TEMP TABLE single_payment_inverse_receipts ON COMMIT DROP AS SELECT id,encode(sha256(convert_to((to_jsonb(t)-ARRAY['paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt'])::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t;
CREATE TEMP TABLE single_payment_inverse_before ON COMMIT DROP AS
 SELECT 'receipts'::text name,id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t
 UNION ALL SELECT 'payments',id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM stock_operational.sales_receipt_payments t;
SELECT 1/coalesce((SELECT encode(sha256(convert_to(coalesce(string_agg(jsonb_build_array(name,id,hash)::text,E'\n' ORDER BY name COLLATE "C",id COLLATE "C"),''),'UTF8')),'hex')=current_setting('stock.payment_fingerprint',true) FROM single_payment_inverse_before),false)::int;
-- Stop on divergent/extra legacy entries instead of overwriting or guessing.
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.sales_receipt_payments p JOIN stock_operational.sales_receipts r ON r.id=p."receiptId" WHERE p."deletedAt" IS NULL AND ROW(r."paymentId",r."paymentTypeId",r."paymentName",r."paymentType",r."paymentAmount",r."paymentCreatedAt") IS DISTINCT FROM ROW(p.id,p."paymentTypeId",p."paymentName",p."paymentType",p."moneyAmount",p."createdAt")))::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.sales_receipts r JOIN stock_operational.sales_receipt_payments p ON p.id=r."paymentId" WHERE p."receiptId"<>r.id OR p."deletedAt" IS NOT NULL))::int;
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER advance_revision;
INSERT INTO stock_operational.sales_receipt_payments(id,"receiptId","paymentIndex","paymentTypeId","paymentName","paymentType","moneyAmount","syncedAt","createdAt")
 SELECT r."paymentId",r.id,0,r."paymentTypeId",r."paymentName",r."paymentType",r."paymentAmount",r."syncedAt",r."paymentCreatedAt"
 FROM stock_operational.sales_receipts r WHERE r."paymentId" IS NOT NULL AND NOT EXISTS(SELECT FROM stock_operational.sales_receipt_payments p WHERE p.id=r."paymentId");
-- Flush existing deferred FK events before changing trigger/schema metadata.
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE stock_operational.sales_receipt_payments ENABLE TRIGGER advance_revision;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.sales_receipts r LEFT JOIN stock_operational.sales_receipt_payments p ON p.id=r."paymentId" AND p."receiptId"=r.id AND p."deletedAt" IS NULL WHERE r."paymentId" IS NOT NULL AND ROW(r."paymentId",r."paymentTypeId",r."paymentName",r."paymentType",r."paymentAmount",r."paymentCreatedAt") IS DISTINCT FROM ROW(p.id,p."paymentTypeId",p."paymentName",p."paymentType",p."moneyAmount",p."createdAt")))::int;
-- Every pre-existing ledger row must remain byte-equivalent, including details.
SELECT 1/(NOT EXISTS(SELECT FROM single_payment_inverse_before b LEFT JOIN stock_operational.sales_receipt_payments p ON p.id=b.id WHERE b.name='payments' AND b.hash IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')) )::int;
DROP FUNCTION stock_operational.receipt_payment_storage_v1();
ALTER TABLE stock_operational.sales_receipts
 DROP CONSTRAINT sales_receipts_single_payment_shape,
 DROP CONSTRAINT sales_receipts_single_payment_id,
 DROP CONSTRAINT sales_receipts_payment_time,
 DROP COLUMN "paymentId" RESTRICT, DROP COLUMN "paymentTypeId" RESTRICT,
 DROP COLUMN "paymentName" RESTRICT, DROP COLUMN "paymentType" RESTRICT,
 DROP COLUMN "paymentAmount" RESTRICT, DROP COLUMN "paymentCreatedAt" RESTRICT;
GRANT INSERT ON stock_operational.sales_receipt_payments TO stock_runtime;
SELECT 1/(NOT EXISTS(SELECT FROM single_payment_inverse_receipts b FULL JOIN (SELECT id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t) a USING(id) WHERE b.hash IS DISTINCT FROM a.hash))::int;
SELECT 1/((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton))::int;
COMMIT;
