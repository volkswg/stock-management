-- Operator-only additive compatibility release. Never automatically discover/apply.
-- Requires separately approved maintenance, a verified complete recovery checkpoint
-- and exact frozen target/revision. No remote file reads/uploads/deletes.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT 1/coalesce(current_setting('stock.allow_media_catalog',true)='reviewed-media-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_restore_verified',true)='complete-private-checkpoint-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_reviewed_source',true)~'^[a-f0-9]{40}$' AND current_setting('stock.media_reviewed_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment),false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.order_items,stock_operational.order_bills,stock_operational.movement_details,stock_operational.shipments,stock_operational.stock_adjustments IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.media_reviewed_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;
SELECT 1/(to_regclass('stock_operational.media') IS NULL AND to_regprocedure('stock_operational.media_catalog_v1()') IS NULL)::int;
SELECT 1/((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='stock_operational.order_items'::regclass AND tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure) AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.order_items'::regclass AND attname='imageMediaId' AND NOT attisdropped))::int;
SELECT 1/((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='stock_operational.order_bills'::regclass AND tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure) AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.order_bills'::regclass AND attname='imageMediaId' AND NOT attisdropped))::int;
SELECT 1/((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='stock_operational.movement_details'::regclass AND tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure) AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='productImageMediaId' AND NOT attisdropped))::int;
SELECT 1/((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='stock_operational.shipments'::regclass AND tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure) AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.shipments'::regclass AND attname='shippingBillMediaId' AND NOT attisdropped))::int;
SELECT 1/((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='stock_operational.stock_adjustments'::regclass AND tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure) AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.stock_adjustments'::regclass AND attname='photoMediaId' AND NOT attisdropped))::int;
CREATE TABLE stock_operational.media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK(provider IN ('google_drive','external_url')),
 "providerFileId" text,
 "sourceUrl" text NOT NULL CHECK(length("sourceUrl")>0),
 "fileName" text,
 "mimeType" text,
 "sizeBytes" bigint CHECK("sizeBytes">=0),
 "createdBy" text,
 "createdAt" timestamptz NOT NULL DEFAULT now(),
 "updatedAt" timestamptz NOT NULL DEFAULT now(),
 "deletedAt" timestamptz,
 CONSTRAINT media_location CHECK(
   (provider='google_drive' AND coalesce("providerFileId"~'^[A-Za-z0-9_-]+$',false)) OR
   (provider='external_url' AND "providerFileId" IS NULL)),
 CONSTRAINT media_dates CHECK(extract(year FROM "createdAt") BETWEEN 1 AND 9999 AND extract(year FROM "updatedAt") BETWEEN 1 AND 9999 AND ("deletedAt" IS NULL OR extract(year FROM "deletedAt") BETWEEN 1 AND 9999))
);
CREATE UNIQUE INDEX media_provider_file ON stock_operational.media(provider,"providerFileId") WHERE "providerFileId" IS NOT NULL;
CREATE UNIQUE INDEX media_source_url ON stock_operational.media(md5("sourceUrl"));
ALTER TABLE stock_operational.media ENABLE ROW LEVEL SECURITY;
-- Remove defaults on this NEW relation before granting the explicit runtime profile.
DO $$DECLARE a record; BEGIN
 FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='stock_operational.media'::regclass),acldefault('r',(SELECT relowner FROM pg_class WHERE oid='stock_operational.media'::regclass)))) WHERE grantee<>(SELECT relowner FROM pg_class WHERE oid='stock_operational.media'::regclass) LOOP
  EXECUTE 'REVOKE ALL ON stock_operational.media FROM '||CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
 END LOOP;
END $$;
REVOKE ALL ON stock_operational.media FROM PUBLIC,anon,authenticated,stock_runtime;
GRANT SELECT ON stock_operational.media TO stock_runtime;
GRANT INSERT(id,provider,"providerFileId","sourceUrl","fileName","mimeType","sizeBytes","createdBy") ON stock_operational.media TO stock_runtime;
GRANT UPDATE("fileName","mimeType","sizeBytes","createdBy") ON stock_operational.media TO stock_runtime;
CREATE POLICY media_runtime_read ON stock_operational.media FOR SELECT TO stock_runtime USING(true);
CREATE POLICY media_runtime_insert ON stock_operational.media FOR INSERT TO stock_runtime WITH CHECK("deletedAt" IS NULL);
CREATE POLICY media_runtime_update ON stock_operational.media FOR UPDATE TO stock_runtime USING("deletedAt" IS NULL) WITH CHECK("deletedAt" IS NULL);
-- Extend only explicit existing unconditional business readers, never public/API roles.
DO $$DECLARE a record; BEGIN
 FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='stock_operational.orders'::regclass),acldefault('r',(SELECT relowner FROM pg_class WHERE oid='stock_operational.orders'::regclass)))) WHERE privilege_type='SELECT' AND grantee NOT IN (0,(SELECT relowner FROM pg_class WHERE oid='stock_operational.orders'::regclass),'stock_runtime'::regrole,'anon'::regrole,'authenticated'::regrole) LOOP
  -- A central catalog must not expose other features to an Orders-only reader.
  -- Only readers already able to see all five attachment tables get catalog access.
  IF NOT (SELECT bool_and(has_table_privilege(a.grantee,c.oid,'SELECT') AND
   (NOT c.relrowsecurity OR (
    EXISTS(SELECT FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd IN ('r','*') AND p.polpermissive AND pg_get_expr(p.polqual,p.polrelid)='true' AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END))
    AND NOT EXISTS(SELECT FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd IN ('r','*') AND NOT p.polpermissive AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END))
   ))) FROM pg_class c WHERE c.oid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass)) THEN CONTINUE; END IF;
  EXECUTE format('GRANT SELECT ON stock_operational.media TO %I',pg_get_userbyid(a.grantee));
  EXECUTE format('CREATE POLICY %I ON stock_operational.media FOR SELECT TO %I USING(true)','media_reader_'||a.grantee,pg_get_userbyid(a.grantee));
 END LOOP;
END $$;

CREATE FUNCTION stock_operational.media_catalog_v1() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
SELECT CASE WHEN
 (SELECT count(*)=11 FROM pg_attribute WHERE attrelid='stock_operational.media'::regclass AND attnum>0 AND NOT attisdropped)
 AND (SELECT count(*)=5 FROM pg_constraint WHERE confrelid='stock_operational.media'::regclass AND contype='f' AND convalidated AND confdeltype='r')
 AND (SELECT count(*)=5 FROM pg_trigger t JOIN pg_proc f ON f.oid=t.tgfoid JOIN pg_namespace n ON n.oid=f.pronamespace WHERE t.tgname='b_media_reference' AND t.tgenabled='O' AND f.proname='bind_media_v1' AND n.nspname='stock_operational')
 THEN 'media-v1' ELSE 'unsupported-media-layout' END
$$;
CREATE FUNCTION stock_operational.media_location_v1(url text) RETURNS TABLE(provider text,file_id text)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE found text;
BEGIN
 IF url~'^https?://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+([/?#]|$)' THEN
  found := (regexp_match(url,'^https?://drive[.]google[.]com/file/d/([A-Za-z0-9_-]+)'))[1];
 ELSIF url~'^https?://drive[.]google[.]com/(open|uc|thumbnail)[?]' THEN
  found := (regexp_match(url,'[?&]id=([A-Za-z0-9_-]+)(&|#|$)'))[1];
 END IF;
 RETURN QUERY SELECT CASE WHEN found IS NULL THEN 'external_url' ELSE 'google_drive' END,found;
END $$;

CREATE FUNCTION stock_operational.media_for_location_v1(p_provider text,p_file_id text,p_url text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item stock_operational.media;
BEGIN
 SELECT * INTO item FROM stock_operational.media WHERE
  (p_provider='google_drive' AND provider=p_provider AND "providerFileId"=p_file_id) OR
  (p_provider='external_url' AND provider=p_provider AND md5("sourceUrl")=md5(p_url) AND "sourceUrl"=p_url) FOR SHARE;
 IF NOT FOUND THEN
  INSERT INTO stock_operational.media(provider,"providerFileId","sourceUrl") VALUES(p_provider,p_file_id,p_url) ON CONFLICT DO NOTHING RETURNING * INTO item;
  IF NOT FOUND THEN
   SELECT * INTO item FROM stock_operational.media WHERE
    (p_provider='google_drive' AND provider=p_provider AND "providerFileId"=p_file_id) OR
    (p_provider='external_url' AND provider=p_provider AND md5("sourceUrl")=md5(p_url) AND "sourceUrl"=p_url) FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Conflicting media location identity'; END IF;
  END IF;
 END IF;
 IF item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Referenced media is deleted'; END IF;
 RETURN item.id;
END $$;

CREATE FUNCTION stock_operational.bind_media_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb := to_jsonb(NEW); previous jsonb; url text; ref uuid; ref_changed boolean; url_changed boolean; item stock_operational.media; location record;
BEGIN
 IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
 url:=shape->>TG_ARGV[0]; ref:=(shape->>TG_ARGV[1])::uuid;
 ref_changed:=CASE WHEN TG_OP='INSERT' THEN ref IS NOT NULL ELSE (previous->>TG_ARGV[1]) IS DISTINCT FROM (shape->>TG_ARGV[1]) END;
 url_changed:=TG_OP='INSERT' OR (previous->>TG_ARGV[0]) IS DISTINCT FROM url;
 IF ref_changed THEN
  IF ref IS NULL THEN
   IF url_changed AND url IS NOT NULL THEN RAISE EXCEPTION 'Conflicting media reference and URL'; END IF;
   url:=NULL;
  ELSE
   SELECT * INTO item FROM stock_operational.media WHERE id=ref FOR SHARE;
   IF NOT FOUND OR item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Missing or deleted media reference'; END IF;
   IF url_changed AND url IS NOT NULL THEN
    SELECT * INTO location FROM stock_operational.media_location_v1(url);
    IF url<>item."sourceUrl" AND NOT(location.provider='google_drive' AND item.provider='google_drive' AND location.file_id=item."providerFileId") THEN RAISE EXCEPTION 'Conflicting media reference and URL'; END IF;
   ELSE url:=item."sourceUrl"; END IF;
  END IF;
 ELSIF url_changed OR ref IS NULL THEN
  IF url IS NULL OR url='' THEN ref:=NULL;
  ELSE
   -- Prefer a provider-confirmed location, including synthetic adapter fixtures.
   SELECT * INTO item FROM stock_operational.media WHERE md5("sourceUrl")=md5(url) AND "sourceUrl"=url FOR SHARE;
   IF FOUND THEN
    IF item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Referenced media is deleted'; END IF;
    ref:=item.id;
   ELSE
    SELECT * INTO location FROM stock_operational.media_location_v1(url);
    ref:=stock_operational.media_for_location_v1(location.provider,location.file_id,url);
   END IF;
  END IF;
 END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[0],url,TG_ARGV[1],ref));
 RETURN NEW;
END $$;

CREATE FUNCTION stock_operational.guard_media_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.provider IS DISTINCT FROM OLD.provider OR NEW."providerFileId" IS DISTINCT FROM OLD."providerFileId" OR NEW."sourceUrl" IS DISTINCT FROM OLD."sourceUrl" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR OLD."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Immutable media identity or deleted file'; END IF;
 IF NEW."deletedAt" IS NOT NULL AND (
EXISTS(SELECT FROM stock_operational.order_items WHERE "imageMediaId"=OLD.id)
 OR EXISTS(SELECT FROM stock_operational.order_bills WHERE "imageMediaId"=OLD.id)
 OR EXISTS(SELECT FROM stock_operational.movement_details WHERE "productImageMediaId"=OLD.id)
 OR EXISTS(SELECT FROM stock_operational.shipments WHERE "shippingBillMediaId"=OLD.id)
 OR EXISTS(SELECT FROM stock_operational.stock_adjustments WHERE "photoMediaId"=OLD.id)) THEN RAISE EXCEPTION 'Media still has business references'; END IF;
 NEW."updatedAt":=now();
 RETURN NEW;
END $$;
CREATE TRIGGER media_guard BEFORE UPDATE ON stock_operational.media FOR EACH ROW EXECUTE FUNCTION stock_operational.guard_media_v1();
ALTER TABLE stock_operational.order_items ADD COLUMN "imageMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT;
CREATE INDEX order_items_media_ref ON stock_operational.order_items("imageMediaId") WHERE "imageMediaId" IS NOT NULL;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "imageUrl","imageMediaId" ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('imageUrl','imageMediaId');
ALTER TABLE stock_operational.order_bills ADD COLUMN "imageMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT;
CREATE INDEX order_bills_media_ref ON stock_operational.order_bills("imageMediaId") WHERE "imageMediaId" IS NOT NULL;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "imageUrl","imageMediaId" ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('imageUrl','imageMediaId');
ALTER TABLE stock_operational.movement_details ADD COLUMN "productImageMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT;
CREATE INDEX movement_details_media_ref ON stock_operational.movement_details("productImageMediaId") WHERE "productImageMediaId" IS NOT NULL;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "productImageUrl","productImageMediaId" ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('productImageUrl','productImageMediaId');
ALTER TABLE stock_operational.shipments ADD COLUMN "shippingBillMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT;
CREATE INDEX shipments_media_ref ON stock_operational.shipments("shippingBillMediaId") WHERE "shippingBillMediaId" IS NOT NULL;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "shippingBillUrl","shippingBillMediaId" ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('shippingBillUrl','shippingBillMediaId');
ALTER TABLE stock_operational.stock_adjustments ADD COLUMN "photoMediaId" uuid REFERENCES stock_operational.media(id) ON DELETE RESTRICT;
CREATE INDEX stock_adjustments_media_ref ON stock_operational.stock_adjustments("photoMediaId") WHERE "photoMediaId" IS NOT NULL;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "photoUrl","photoMediaId" ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('photoUrl','photoMediaId');
REVOKE ALL ON FUNCTION stock_operational.media_catalog_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.media_catalog_v1() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.media_location_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.media_location_v1(text) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.media_for_location_v1(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.media_for_location_v1(text,text,text) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.bind_media_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.bind_media_v1() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.guard_media_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.guard_media_v1() TO stock_runtime;
-- Only populate the NEW reference columns. Hold all five tables exclusively;
-- suspend only the exact checked row guard within this atomic transaction so
-- archived identities, values, row revisions and timestamps remain untouched.
-- The existing statement counter stays enabled and advances five statements.
ALTER TABLE stock_operational.order_items DISABLE TRIGGER a_validate;
UPDATE stock_operational.order_items SET "imageMediaId"=NULL WHERE "imageUrl" IS NOT NULL;
ALTER TABLE stock_operational.order_items ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER a_validate;
UPDATE stock_operational.order_bills SET "imageMediaId"=NULL WHERE "imageUrl" IS NOT NULL;
ALTER TABLE stock_operational.order_bills ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER a_validate;
UPDATE stock_operational.movement_details SET "productImageMediaId"=NULL WHERE "productImageUrl" IS NOT NULL;
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.shipments DISABLE TRIGGER a_validate;
UPDATE stock_operational.shipments SET "shippingBillMediaId"=NULL WHERE "shippingBillUrl" IS NOT NULL;
ALTER TABLE stock_operational.shipments ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER a_validate;
UPDATE stock_operational.stock_adjustments SET "photoMediaId"=NULL WHERE "photoUrl" IS NOT NULL;
ALTER TABLE stock_operational.stock_adjustments ENABLE TRIGGER a_validate;
COMMIT;
