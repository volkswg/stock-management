-- OPERATOR ONLY. Separate live maintenance approval and fresh52-table recovery.
-- URL alias normalization to media.sourceUrl was explicitly approved. Files stay intact.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_media_url_rollback',true)='reviewed-media-ids-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_restore_verified',true)='52-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_source',true)~'^[a-f0-9]{40}$' AND current_setting('stock.media_url_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_fingerprint',true)~'^[a-f0-9]{64}$',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_alias_policy',true)='use-media-sourceUrl',false)::int;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.order_items,stock_operational.order_bills,stock_operational.movement_details,stock_operational.shipments,stock_operational.stock_adjustments,stock_operational.media IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.media_url_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/((SELECT count(*)=5 FROM pg_trigger WHERE tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure AND tgrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass)))::int;
SELECT 1/(stock_operational.media_record_contract_v1()='id-only')::int;
DO $witness$ DECLARE item record; BEGIN
 FOR item IN SELECT * FROM (VALUES ('typed_project_order_items(stock_operational.order_items)','d78c2d01e98dc73d50618fdf2d1897ea'),('typed_input_order_items(jsonb)','1ecb7a09c6f0b2f3f75b04b79f317bad'),('typed_project_order_bills(stock_operational.order_bills)','8b8d8701595b149d35c9a7d725ab0323'),('typed_input_order_bills(jsonb)','2383a50a2483f0e78f51c71a76248053'),('typed_project_movement_details(stock_operational.movement_details)','7c4fd691a114db20668a252e6f02a735'),('typed_input_movement_details(jsonb)','88cf5fb55dea12292e9c1244ddda6b01'),('typed_project_shipments(stock_operational.shipments)','3b48322ba50157fdeab13634e3a3065f'),('typed_input_shipments(jsonb)','4d8f6bfcb6bae81d78cadb2a2d25bcb2'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','f111778ec01ffc2adc10da8316070b39'),('typed_input_stock_adjustments(jsonb)','2d42194a50494c8305f8826a3dee0169'),('lexeme_mapping_contract_v1()','d0d9de4a15ee9ba536c04b031ce0b8bd'),('bind_media_v1()','a69ddb16a781eeb7932481388aaf65b8'),('media_catalog_v1()','65f394d838a481468249bcd9caccf868'),('media_url_v1(uuid)','10cfcba98e18edc33c5011d2182d6627'),('media_ref_for_url_v1(text)','3d5906a9ffe6e42eef3f809cc11067f1'),('media_record_contract_v1()','748db229c625d1b21708a94ffaef005d'),('prepare_record_write()','a5db8e1ea1d6a9d3c52db2e97f9a3356')) e(sig,hash) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.sig) AND md5(prosrc)=item.hash AND NOT prosecdef) THEN RAISE EXCEPTION 'Unreviewed media function drift: %',item.sig; END IF;
 END LOOP;
END $witness$;
DROP TRIGGER b_media_reference ON stock_operational.order_items;
ALTER TABLE stock_operational.order_items ADD COLUMN "imageUrl" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.order_items DISABLE TRIGGER a_validate;
UPDATE stock_operational.order_items SET "imageUrl"=nullif(stock_operational.media_url_v1("imageMediaId"),'');
ALTER TABLE stock_operational.order_items ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "imageUrl","imageMediaId" ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('imageUrl','imageMediaId');
DROP TRIGGER b_media_reference ON stock_operational.order_bills;
ALTER TABLE stock_operational.order_bills ADD COLUMN "imageUrl" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER a_validate;
UPDATE stock_operational.order_bills SET "imageUrl"=nullif(stock_operational.media_url_v1("imageMediaId"),'');
ALTER TABLE stock_operational.order_bills ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "imageUrl","imageMediaId" ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('imageUrl','imageMediaId');
DROP TRIGGER b_media_reference ON stock_operational.movement_details;
ALTER TABLE stock_operational.movement_details ADD COLUMN "productImageUrl" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER a_validate;
UPDATE stock_operational.movement_details SET "productImageUrl"=nullif(stock_operational.media_url_v1("productImageMediaId"),'');
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "productImageUrl","productImageMediaId" ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('productImageUrl','productImageMediaId');
DROP TRIGGER b_media_reference ON stock_operational.shipments;
ALTER TABLE stock_operational.shipments ADD COLUMN "shippingBillUrl" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.shipments DISABLE TRIGGER a_validate;
UPDATE stock_operational.shipments SET "shippingBillUrl"=nullif(stock_operational.media_url_v1("shippingBillMediaId"),'');
ALTER TABLE stock_operational.shipments ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "shippingBillUrl","shippingBillMediaId" ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('shippingBillUrl','shippingBillMediaId');
DROP TRIGGER b_media_reference ON stock_operational.stock_adjustments;
ALTER TABLE stock_operational.stock_adjustments ADD COLUMN "photoUrl" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER a_validate;
UPDATE stock_operational.stock_adjustments SET "photoUrl"=nullif(stock_operational.media_url_v1("photoMediaId"),'');
ALTER TABLE stock_operational.stock_adjustments ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "photoUrl","photoMediaId" ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('photoUrl','photoMediaId');
SELECT 1/(stock_operational.media_record_contract_v1()='retained' AND stock_operational.media_catalog_v1()='media-v1')::int;
COMMIT;
