-- OPERATOR ONLY. Requires separate live approval, supervised writer freeze,
-- fresh restored recovery, exact target/source/fingerprint/revision packet.
-- Rebuild existing rows locally from the retained payment ledger; no providers.
-- Refuse every multi-payment receipt, including deleted history. No guessing.
BEGIN;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SELECT 1/coalesce(current_setting('stock.allow_receipt_payment_rebuild',true)='reviewed-single-receipt-payment-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_restore_verified',true)='business-and-config-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.payment_source',true)~'^[a-f0-9]{40}$' AND current_setting('stock.payment_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.payment_fingerprint',true)~'^[a-f0-9]{64}$' AND current_setting('stock.payment_fingerprint',true)<>repeat('0',64),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.sales_receipts,stock_operational.sales_receipt_payments IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/(stock_operational.soft_delete_contract_v1()='deletedAt' AND stock_operational.media_record_contract_v1()='id-only' AND stock_operational.lexeme_mapping_contract_v1()='typed')::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(relkind='r' AND NOT relispartition AND relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity) FROM pg_class WHERE oid IN ('stock_operational.sales_receipts'::regclass,'stock_operational.sales_receipt_payments'::regclass)))::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_inherits WHERE inhparent IN ('stock_operational.sales_receipts'::regclass,'stock_operational.sales_receipt_payments'::regclass) OR inhrelid IN ('stock_operational.sales_receipts'::regclass,'stock_operational.sales_receipt_payments'::regclass)))::int;
SELECT 1/(to_regprocedure('stock_operational.receipt_payment_storage_v1()') IS NULL)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.sales_receipts'::regclass AND NOT attisdropped AND attname IN ('paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt')))::int;
SELECT 1/has_table_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT')::int;
-- The reviewed predecessor uses a table-level INSERT grant, no hidden column
-- grants. This makes the later write fence and inverse exact and reviewable.
SELECT 1/(NOT EXISTS(SELECT FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) g WHERE a.attrelid='stock_operational.sales_receipt_payments'::regclass AND g.grantee='stock_runtime'::regrole AND g.privilege_type='INSERT'))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(tgenabled='O' AND tgname IN ('a_validate','advance_revision')) FROM pg_trigger WHERE tgrelid='stock_operational.sales_receipts'::regclass AND NOT tgisinternal))::int;
SELECT 1/(NOT EXISTS(SELECT "receiptId" FROM stock_operational.sales_receipt_payments GROUP BY "receiptId" HAVING count(*)>1))::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.sales_receipt_payments p LEFT JOIN stock_operational.sales_receipts r ON r.id=p."receiptId" WHERE r.id IS NULL))::int;
CREATE TEMP TABLE single_payment_before ON COMMIT DROP AS
 SELECT 'receipts'::text name,id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t
 UNION ALL SELECT 'payments',id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM stock_operational.sales_receipt_payments t;
SELECT 1/coalesce((SELECT encode(sha256(convert_to(coalesce(string_agg(jsonb_build_array(name,id,hash)::text,E'\n' ORDER BY name COLLATE "C",id COLLATE "C"),''),'UTF8')),'hex')=current_setting('stock.payment_fingerprint',true) FROM single_payment_before),false)::int;
CREATE TEMP TABLE single_payment_triggers ON COMMIT DROP AS SELECT tgname,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE tgrelid='stock_operational.sales_receipts'::regclass AND NOT tgisinternal;
ALTER TABLE stock_operational.sales_receipts
 ADD COLUMN "paymentId" text,
 ADD COLUMN "paymentTypeId" text,
 ADD COLUMN "paymentName" text,
 ADD COLUMN "paymentType" text,
 ADD COLUMN "paymentAmount" numeric,
 ADD COLUMN "paymentCreatedAt" timestamptz,
 ADD CONSTRAINT sales_receipts_single_payment_shape CHECK (
  ("paymentId" IS NULL AND "paymentTypeId" IS NULL AND "paymentName" IS NULL AND "paymentType" IS NULL AND "paymentAmount" IS NULL AND "paymentCreatedAt" IS NULL)
  OR ("paymentId" IS NOT NULL AND btrim("paymentId")<>'')),
 ADD CONSTRAINT sales_receipts_single_payment_id UNIQUE ("paymentId"),
 ADD CONSTRAINT sales_receipts_payment_time CHECK ("paymentCreatedAt" IS NULL OR ("paymentCreatedAt">=TIMESTAMPTZ '0001-01-01 00:00:00+00' AND "paymentCreatedAt"<TIMESTAMPTZ '10000-01-01 00:00:00+00'));
-- Representation-only rebuild: preserve every old field, revision, timestamp,
-- deletion flag and ledger row. Only these two reviewed triggers are suspended,
-- inside this locked transaction, then restored before validation/COMMIT.
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipts r SET
 "paymentId"=p.id,"paymentTypeId"=p."paymentTypeId","paymentName"=p."paymentName",
 "paymentType"=p."paymentType","paymentAmount"=p."moneyAmount","paymentCreatedAt"=p."createdAt"
 FROM stock_operational.sales_receipt_payments p WHERE p."receiptId"=r.id AND p."deletedAt" IS NULL;
ALTER TABLE stock_operational.sales_receipts ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipts ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_receipts ALTER COLUMN "paymentCreatedAt" SET DEFAULT statement_timestamp();
SELECT 1/(NOT EXISTS(
 SELECT FROM stock_operational.sales_receipts r LEFT JOIN stock_operational.sales_receipt_payments p ON p."receiptId"=r.id AND p."deletedAt" IS NULL
 WHERE ROW(r."paymentId",r."paymentTypeId",r."paymentName",r."paymentType",r."paymentAmount",r."paymentCreatedAt") IS DISTINCT FROM ROW(p.id,p."paymentTypeId",p."paymentName",p."paymentType",p."moneyAmount",p."createdAt")))::int;
WITH after_rows AS (
 SELECT 'receipts'::text name,id,encode(sha256(convert_to((to_jsonb(t)-ARRAY['paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt'])::text,'UTF8')),'hex') hash FROM stock_operational.sales_receipts t
 UNION ALL SELECT 'payments',id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM stock_operational.sales_receipt_payments t
)
SELECT 1/(NOT EXISTS(SELECT FROM single_payment_before b FULL JOIN after_rows a USING(name,id) WHERE b.hash IS DISTINCT FROM a.hash))::int;
SELECT 1/((SELECT value::text=current_setting('stock.payment_revision',true) FROM stock_operational.revision WHERE singleton))::int;
SELECT 1/(NOT EXISTS(SELECT FROM single_payment_triggers b FULL JOIN (SELECT tgname,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE tgrelid='stock_operational.sales_receipts'::regclass AND NOT tgisinternal) a USING(tgname) WHERE a.definition IS DISTINCT FROM b.definition))::int;
-- Fence the retired write path. Read grants and all retained rows remain.
REVOKE INSERT ON stock_operational.sales_receipt_payments FROM stock_runtime;
SELECT 1/(NOT has_any_column_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT'))::int;
CREATE FUNCTION stock_operational.receipt_payment_storage_v1() RETURNS text
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT 'single-receipt-payment-v1'::text $$;
REVOKE ALL ON FUNCTION stock_operational.receipt_payment_storage_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.receipt_payment_storage_v1() TO stock_runtime;
DO $$BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_reader') THEN GRANT EXECUTE ON FUNCTION stock_operational.receipt_payment_storage_v1() TO stock_prod_reader; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN GRANT EXECUTE ON FUNCTION stock_operational.receipt_payment_storage_v1() TO stock_prod_backup; END IF;
END$$;
COMMIT;
