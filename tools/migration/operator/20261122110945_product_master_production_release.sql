-- Operator-only production packet. PREPARATION DOES NOT AUTHORIZE EXECUTION.
-- Review file hash, source, fresh recovery and maintenance approval before use.
-- Never run this through an unreviewed db push or change the UAT purpose label.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT 1/coalesce(current_setting('stock.product_master_release',true)='reviewed-product-master-production-install-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.expected_isolation_id',true)='349b9289-f684-4ec5-ac22-924b2be1946b',false)::int;
SELECT 1/coalesce(current_setting('stock.expected_revision',true)~'^[0-9]+$',false)::int;
SELECT 1/coalesce((SELECT purpose='production' AND isolation_id='349b9289-f684-4ec5-ac22-924b2be1946b'::uuid FROM stock_operational.environment WHERE singleton),false)::int;
SELECT pg_advisory_xact_lock(835107241),pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.environment,stock_operational.revision,stock_operational.order_items,stock_operational.media IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT purpose='production' AND isolation_id='349b9289-f684-4ec5-ac22-924b2be1946b'::uuid FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value=current_setting('stock.expected_revision')::bigint FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1/(to_regclass('stock_operational.products') IS NULL AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.order_items'::regclass AND attname='productId' AND NOT attisdropped))::int;
SELECT 1/(SELECT count(*)=3 FROM pg_roles WHERE rolname IN ('stock_runtime','stock_prod_reader','stock_prod_backup') AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole)::int;
SELECT 1/(stock_operational.soft_delete_contract_v1()='deletedAt' AND stock_operational.media_record_contract_v1()='id-only' AND stock_operational.receipt_payment_storage_v1()='receipt-payments-jsonb-v1')::int;
-- Preserve the existing five media bindings while permitting this new owner’s FK.
SELECT 1/(SELECT md5(prosrc)='b11ff043a3a2f91237f0991611f7ba5a' FROM pg_proc WHERE oid='stock_operational.media_record_contract_v1()'::regprocedure)::int;
CREATE OR REPLACE FUNCTION stock_operational.media_record_contract_v1() RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE refs integer; urls integer; triggers integer;
BEGIN
 SELECT count(*) INTO refs FROM (VALUES ('order_items','imageMediaId'),('order_bills','imageMediaId'),('movement_details','productImageMediaId'),('shipments','shippingBillMediaId'),('stock_adjustments','photoMediaId')) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='uuid'::regtype;
 SELECT count(*) INTO urls FROM (VALUES ('order_items','imageUrl'),('order_bills','imageUrl'),('movement_details','productImageUrl'),('shipments','shippingBillUrl'),('stock_adjustments','photoUrl')) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='text'::regtype;
 SELECT count(*) INTO triggers FROM pg_trigger WHERE tgname='b_media_reference' AND tgenabled='O' AND tgfoid='stock_operational.bind_media_v1()'::regprocedure AND tgrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass) AND tgnargs=CASE WHEN urls=5 THEN 2 ELSE 1 END;
 IF refs<>5 OR triggers<>5
 OR (SELECT count(*)<>11 FROM pg_attribute WHERE attrelid=to_regclass('stock_operational.media') AND attnum>0 AND NOT attisdropped)
 OR (SELECT count(*)<>5 FROM pg_constraint WHERE confrelid=to_regclass('stock_operational.media') AND contype='f' AND convalidated AND confdeltype='r' AND conrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass))
 OR (SELECT count(*)<>10 FROM (VALUES ('typed_input_order_items(jsonb)','v'),('typed_project_order_items(stock_operational.order_items)','s'),('typed_input_order_bills(jsonb)','v'),('typed_project_order_bills(stock_operational.order_bills)','s'),('typed_input_movement_details(jsonb)','v'),('typed_project_movement_details(stock_operational.movement_details)','s'),('typed_input_shipments(jsonb)','v'),('typed_project_shipments(stock_operational.shipments)','s'),('typed_input_stock_adjustments(jsonb)','v'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','s')) e(sig,vol)
     JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.sig) AND p.provolatile::text=e.vol AND NOT p.prosecdef)
 OR to_regclass('stock_operational.media') IS NULL OR to_regprocedure('stock_operational.media_url_v1(uuid)') IS NULL OR to_regprocedure('stock_operational.media_ref_for_url_v1(text)') IS NULL THEN RAISE EXCEPTION 'Incomplete media record schema'; END IF;
 IF urls=5 THEN RETURN 'retained'; END IF;
 IF urls=0 THEN RETURN 'id-only'; END IF;
 RAISE EXCEPTION 'Partial media URL retirement';
END $$;
SELECT 1/(SELECT md5(prosrc)='65f394d838a481468249bcd9caccf868' FROM pg_proc WHERE oid='stock_operational.media_catalog_v1()'::regprocedure)::int;
CREATE OR REPLACE FUNCTION stock_operational.media_catalog_v1() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
SELECT CASE WHEN
 (SELECT count(*)=11 FROM pg_attribute WHERE attrelid='stock_operational.media'::regclass AND attnum>0 AND NOT attisdropped)
 AND (SELECT count(*)=5 FROM pg_constraint WHERE confrelid='stock_operational.media'::regclass AND contype='f' AND convalidated AND confdeltype='r' AND conrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass))
 AND (SELECT count(*)=5 FROM pg_trigger t JOIN pg_proc f ON f.oid=t.tgfoid JOIN pg_namespace n ON n.oid=f.pronamespace WHERE t.tgname='b_media_reference' AND t.tgenabled='O' AND f.proname='bind_media_v1' AND n.nspname='stock_operational')
 THEN CASE stock_operational.media_record_contract_v1() WHEN 'retained' THEN 'media-v1' WHEN 'id-only' THEN 'media-v2' ELSE 'unsupported-media-layout' END ELSE 'unsupported-media-layout' END
$$;
CREATE TABLE stock_operational.products (
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY CHECK(id>0),
 "productCode" text NOT NULL DEFAULT '' CHECK(length("productCode")<=100),
 "productName" text NOT NULL CHECK(length(btrim("productName")) BETWEEN 1 AND 200),
 variant text NOT NULL DEFAULT '' CHECK(length(variant)<=100),
 "referenceImageMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT,
 "createdAt" timestamptz NOT NULL DEFAULT now() CHECK(isfinite("createdAt")),
 "updatedAt" timestamptz NOT NULL DEFAULT now() CHECK(isfinite("updatedAt")),
 "deletedAt" timestamptz CHECK("deletedAt" IS NULL OR isfinite("deletedAt")),
 "createdBy" text NOT NULL DEFAULT 'web',
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE INDEX products_code_search ON stock_operational.products(lower("productCode") text_pattern_ops) WHERE "deletedAt" IS NULL;
CREATE INDEX products_name_search ON stock_operational.products(lower("productName") text_pattern_ops) WHERE "deletedAt" IS NULL;
CREATE INDEX products_reference_media ON stock_operational.products("referenceImageMediaId");
ALTER TABLE stock_operational.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_operational.products FROM PUBLIC,anon,authenticated;
GRANT SELECT ON stock_operational.products TO stock_runtime;
GRANT INSERT("productCode","productName",variant,"referenceImageMediaId","createdBy") ON stock_operational.products TO stock_runtime;
GRANT UPDATE("productCode","productName",variant,"referenceImageMediaId","updatedAt","deletedAt") ON stock_operational.products TO stock_runtime;
GRANT USAGE ON SEQUENCE stock_operational.products_id_seq TO stock_runtime;
CREATE POLICY products_runtime ON stock_operational.products TO stock_runtime USING(true) WITH CHECK(true);
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.products FOR EACH ROW EXECUTE FUNCTION stock_operational.prepare_record_write('id');
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.products FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
ALTER TABLE stock_operational.order_items ADD COLUMN "productId" bigint REFERENCES stock_operational.products(id) ON DELETE RESTRICT;
CREATE INDEX order_items_product ON stock_operational.order_items("productId");
GRANT UPDATE("productId") ON stock_operational.order_items TO stock_runtime;
DO $$DECLARE r text;BEGIN
 FOREACH r IN ARRAY ARRAY['stock_prod_reader','stock_prod_backup'] LOOP
  IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('GRANT SELECT ON stock_operational.products TO %I',r);
   EXECUTE format('CREATE POLICY %I ON stock_operational.products FOR SELECT TO %I USING(true)', 'products_'||r,r);
   IF r='stock_prod_backup' THEN EXECUTE format('GRANT SELECT ON SEQUENCE stock_operational.products_id_seq TO %I',r);END IF;
  END IF;
 END LOOP;
END$$;
SELECT 1/(stock_operational.media_record_contract_v1()='id-only')::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.products) AND NOT EXISTS(SELECT FROM stock_operational.order_items WHERE "productId" IS NOT NULL))::int;
COMMIT;
