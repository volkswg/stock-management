-- OPERATOR ONLY. Separate live maintenance approval and fresh52-table recovery.
-- URL alias normalization to media.sourceUrl was explicitly approved. Files stay intact.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_media_url_compatibility',true)='reviewed-media-ids-v1',false)::int;
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
SELECT 1/(stock_operational.media_catalog_v1()='media-v1' AND stock_operational.lexeme_mapping_contract_v1()='typed' AND to_regprocedure('stock_operational.media_record_contract_v1()') IS NULL)::int;
DO $witness$ DECLARE item record; BEGIN
 FOR item IN SELECT * FROM (VALUES ('typed_project_order_items(stock_operational.order_items)','8f16cb810b98d3b0e7555c368441cbf4'),('typed_input_order_items(jsonb)','3b217a7a7a331c7ea38a22a0cdf13c88'),('typed_project_order_bills(stock_operational.order_bills)','f647325fbd1c443aae4087f730d2bd1c'),('typed_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('typed_project_movement_details(stock_operational.movement_details)','b300286a03444a483a7688a1cc8328f9'),('typed_input_movement_details(jsonb)','54516495048ec2ee2014d6e97b79a862'),('typed_project_shipments(stock_operational.shipments)','89b0fe9946e8d002237f5c98e4eee040'),('typed_input_shipments(jsonb)','9e17a62ee77ffd56d35022924a334297'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','eea0eccacc7e8c9cf338e9ac53ab9479'),('typed_input_stock_adjustments(jsonb)','340fc2660897abe15f86dbb2db289c6b'),('lexeme_mapping_contract_v1()','d6bff8c325bc80100e0993f09296a948'),('bind_media_v1()','dccb7eb6dfa6630b973d80b7a3dced96'),('media_catalog_v1()','53a8d92e152e8fc537afc4d3551d2dd9'),('prepare_record_write()','a5db8e1ea1d6a9d3c52db2e97f9a3356')) e(sig,hash) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.sig) AND md5(prosrc)=item.hash AND NOT prosecdef) THEN RAISE EXCEPTION 'Unreviewed media function drift: %',item.sig; END IF;
 END LOOP;
END $witness$;
SELECT 1/(NOT EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE c.oid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass) AND a.privilege_type='SELECT' AND a.grantee<>c.relowner
 AND (a.grantee=0 OR NOT has_table_privilege(a.grantee,'stock_operational.media','SELECT') OR NOT EXISTS(
 SELECT FROM pg_policy p WHERE p.polrelid='stock_operational.media'::regclass AND p.polcmd IN ('r','*') AND p.polpermissive AND pg_get_expr(p.polqual,p.polrelid)='true' AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END))
 OR EXISTS(SELECT FROM pg_policy p WHERE p.polrelid='stock_operational.media'::regclass AND p.polcmd IN ('r','*') AND NOT p.polpermissive AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END)))))::int;
CREATE FUNCTION stock_operational.media_url_v1(media_id uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE url text;
BEGIN
 IF media_id IS NULL THEN RETURN ''; END IF;
 SELECT "sourceUrl" INTO url FROM stock_operational.media WHERE id=media_id AND "deletedAt" IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing, hidden or deleted media reference'; END IF;
 RETURN url;
END $$;
REVOKE ALL ON FUNCTION stock_operational.media_url_v1(uuid) FROM PUBLIC,anon,authenticated;
DO $acl$ DECLARE a record; BEGIN
 FOR a IN SELECT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure),acldefault('f',(SELECT proowner FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure)))) WHERE privilege_type='EXECUTE' AND grantee<>0 LOOP
  IF pg_get_userbyid(a.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public mapper grant'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.media_url_v1(uuid) TO %I',pg_get_userbyid(a.grantee));
 END LOOP;
END $acl$;
CREATE FUNCTION stock_operational.media_ref_for_url_v1(url text) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE item stock_operational.media; location record;
BEGIN
 IF url IS NULL OR url='' THEN RETURN NULL; END IF;
 SELECT * INTO item FROM stock_operational.media WHERE md5("sourceUrl")=md5(url) AND "sourceUrl"=url FOR SHARE;
 IF FOUND THEN
  IF item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Referenced media is deleted'; END IF;
  RETURN item.id;
 END IF;
 SELECT * INTO location FROM stock_operational.media_location_v1(url);
 RETURN stock_operational.media_for_location_v1(location.provider,location.file_id,url);
END $$;
REVOKE ALL ON FUNCTION stock_operational.media_ref_for_url_v1(text) FROM PUBLIC,anon,authenticated;
DO $acl$ DECLARE a record; BEGIN
 FOR a IN SELECT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid='stock_operational.typed_input_order_items(jsonb)'::regprocedure),acldefault('f',(SELECT proowner FROM pg_proc WHERE oid='stock_operational.typed_input_order_items(jsonb)'::regprocedure)))) WHERE privilege_type='EXECUTE' AND grantee<>0 LOOP
  IF pg_get_userbyid(a.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public mapper grant'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.media_ref_for_url_v1(text) TO %I',pg_get_userbyid(a.grantee));
 END LOOP;
END $acl$;
CREATE FUNCTION stock_operational.media_record_contract_v1() RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE refs integer; urls integer; triggers integer;
BEGIN
 SELECT count(*) INTO refs FROM (VALUES ('order_items','imageMediaId'),('order_bills','imageMediaId'),('movement_details','productImageMediaId'),('shipments','shippingBillMediaId'),('stock_adjustments','photoMediaId')) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='uuid'::regtype;
 SELECT count(*) INTO urls FROM (VALUES ('order_items','imageUrl'),('order_bills','imageUrl'),('movement_details','productImageUrl'),('shipments','shippingBillUrl'),('stock_adjustments','photoUrl')) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='text'::regtype;
 SELECT count(*) INTO triggers FROM pg_trigger WHERE tgname='b_media_reference' AND tgenabled='O' AND tgfoid='stock_operational.bind_media_v1()'::regprocedure AND tgrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass) AND tgnargs=CASE WHEN urls=5 THEN 2 ELSE 1 END;
 IF refs<>5 OR triggers<>5
 OR (SELECT count(*)<>11 FROM pg_attribute WHERE attrelid=to_regclass('stock_operational.media') AND attnum>0 AND NOT attisdropped)
 OR (SELECT count(*)<>5 FROM pg_constraint WHERE confrelid=to_regclass('stock_operational.media') AND contype='f' AND convalidated AND confdeltype='r')
 OR (SELECT count(*)<>10 FROM (VALUES ('typed_input_order_items(jsonb)','v'),('typed_project_order_items(stock_operational.order_items)','s'),('typed_input_order_bills(jsonb)','v'),('typed_project_order_bills(stock_operational.order_bills)','s'),('typed_input_movement_details(jsonb)','v'),('typed_project_movement_details(stock_operational.movement_details)','s'),('typed_input_shipments(jsonb)','v'),('typed_project_shipments(stock_operational.shipments)','s'),('typed_input_stock_adjustments(jsonb)','v'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','s')) e(sig,vol)
     JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.sig) AND p.provolatile::text=e.vol AND NOT p.prosecdef)
 OR to_regclass('stock_operational.media') IS NULL OR to_regprocedure('stock_operational.media_url_v1(uuid)') IS NULL OR to_regprocedure('stock_operational.media_ref_for_url_v1(text)') IS NULL THEN RAISE EXCEPTION 'Incomplete media record schema'; END IF;
 IF urls=5 THEN RETURN 'retained'; END IF;
 IF urls=0 THEN RETURN 'id-only'; END IF;
 RAISE EXCEPTION 'Partial media URL retirement';
END $$;
REVOKE ALL ON FUNCTION stock_operational.media_record_contract_v1() FROM PUBLIC,anon,authenticated;
DO $acl$ DECLARE a record; BEGIN
 FOR a IN SELECT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure),acldefault('f',(SELECT proowner FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure)))) WHERE privilege_type='EXECUTE' AND grantee<>0 LOOP
  IF pg_get_userbyid(a.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public mapper grant'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.media_record_contract_v1() TO %I',pg_get_userbyid(a.grantee));
 END LOOP;
END $acl$;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_project_order_items(stock_operational.order_items)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."orderId",'''')),
 to_jsonb(stock_operational.media_url_v1(r."imageMediaId")),
 to_jsonb(coalesce(r."quoteQuantity"::text,'''')),
 to_jsonb(coalesce(r."deliveredQuantity"::text,'''')),
 to_jsonb(coalesce(r."productCode",'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'''')),
 to_jsonb(coalesce(r."createdBy",'''')));
');
END $replace$;
ALTER FUNCTION stock_operational.typed_project_order_items(stock_operational.order_items) STABLE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_input_order_items(jsonb)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE r stock_operational.order_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."orderId" := nullif((cells->>1),'''')::text;
-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object(''imageUrl'',nullif((cells->>2),'''')::text));
r."imageMediaId" := stock_operational.media_ref_for_url_v1(nullif((cells->>2),'''')::text);
r."quoteQuantity" := nullif((cells->>3),'''')::numeric;
r."deliveredQuantity" := nullif((cells->>4),'''')::numeric;
r."productCode" := nullif((cells->>5),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>8);
r."createdBy" := nullif((cells->>9),'''')::text;

RETURN r; END ');
END $replace$;
ALTER FUNCTION stock_operational.typed_input_order_items(jsonb) VOLATILE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_project_order_bills(stock_operational.order_bills)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."orderId",'''')),
 to_jsonb(stock_operational.media_url_v1(r."imageMediaId")),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'''')),
 to_jsonb(coalesce(r."createdBy",'''')));
');
END $replace$;
ALTER FUNCTION stock_operational.typed_project_order_bills(stock_operational.order_bills) STABLE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_input_order_bills(jsonb)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE r stock_operational.order_bills; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."orderId" := nullif((cells->>1),'''')::text;
-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object(''imageUrl'',nullif((cells->>2),'''')::text));
r."imageMediaId" := stock_operational.media_ref_for_url_v1(nullif((cells->>2),'''')::text);
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>5);
r."createdBy" := nullif((cells->>6),'''')::text;

RETURN r; END ');
END $replace$;
ALTER FUNCTION stock_operational.typed_input_order_bills(jsonb) VOLATILE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_project_movement_details(stock_operational.movement_details)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."movementMasterId",'''')),
 to_jsonb(coalesce(r."shopName",'''')),
 to_jsonb(coalesce(r."quantity"::text,'''')),
 to_jsonb(coalesce(r."remark",'''')),
 to_jsonb(coalesce(r."fromLocation",'''')),
 to_jsonb(coalesce(r."toLocation",'''')),
 to_jsonb(stock_operational.media_url_v1(r."productImageMediaId")),
 to_jsonb(coalesce(r."purchaseDetailId",'''')),
 to_jsonb(coalesce(r."status",'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'''')),
 coalesce(to_jsonb(r."stockCounted"),''""''::jsonb),
 coalesce(to_jsonb(r."isNewArrival"),''""''::jsonb));
');
END $replace$;
ALTER FUNCTION stock_operational.typed_project_movement_details(stock_operational.movement_details) STABLE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_input_movement_details(jsonb)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE r stock_operational.movement_details; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>14 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."movementMasterId" := nullif((cells->>1),'''')::text;
r."shopName" := nullif((cells->>2),'''')::text;
r."quantity" := nullif((cells->>3),'''')::numeric;
r."remark" := nullif((cells->>4),'''')::text;
r."fromLocation" := nullif((cells->>5),'''')::text;
r."toLocation" := nullif((cells->>6),'''')::text;
-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object(''productImageUrl'',nullif((cells->>7),'''')::text));
r."productImageMediaId" := stock_operational.media_ref_for_url_v1(nullif((cells->>7),'''')::text);
r."purchaseDetailId" := nullif((cells->>8),'''')::text;
r."status" := nullif((cells->>9),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>10);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>11);
IF cells->>12 IS NULL OR cells->>12='''' THEN r."stockCounted" := NULL;
ELSIF jsonb_typeof(cells->12)=''boolean'' OR (lower(cells->>12)) IN (''true'',''false'') THEN r."stockCounted" := (lower(cells->>12))::boolean;
ELSE RAISE EXCEPTION ''Ambiguous boolean requires an explicit true/false value''; END IF;
IF cells->>13 IS NULL OR cells->>13='''' THEN r."isNewArrival" := NULL;
ELSIF jsonb_typeof(cells->13)=''boolean'' OR (lower(cells->>13)) IN (''true'',''false'') THEN r."isNewArrival" := (lower(cells->>13))::boolean;
ELSE RAISE EXCEPTION ''Ambiguous boolean requires an explicit true/false value''; END IF;
RETURN r; END ');
END $replace$;
ALTER FUNCTION stock_operational.typed_input_movement_details(jsonb) VOLATILE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_project_shipments(stock_operational.shipments)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."status",'''')),
 to_jsonb(coalesce(r."carrier",'''')),
 to_jsonb(coalesce(r."poNumber",'''')),
 to_jsonb(coalesce(r."shippingFee"::text,'''')),
 to_jsonb(coalesce(r."remark",'''')),
 to_jsonb(coalesce(r."shippedAt",'''')),
 to_jsonb(coalesce(r."deliveredAt",'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'''')),
 to_jsonb(coalesce(r."createdBy",'''')),
 to_jsonb(stock_operational.media_url_v1(r."shippingBillMediaId")));
');
END $replace$;
ALTER FUNCTION stock_operational.typed_project_shipments(stock_operational.shipments) STABLE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_input_shipments(jsonb)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE r stock_operational.shipments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."status" := nullif((cells->>1),'''')::text;
r."carrier" := nullif((cells->>2),'''')::text;
r."poNumber" := nullif((cells->>3),'''')::text;
r."shippingFee" := nullif((cells->>4),'''')::numeric;
r."remark" := nullif((cells->>5),'''')::text;
r."shippedAt" := nullif((cells->>6),'''')::text;
r."deliveredAt" := nullif((cells->>7),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>8);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>9);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'''')::text;
-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object(''shippingBillUrl'',nullif((cells->>12),'''')::text));
r."shippingBillMediaId" := stock_operational.media_ref_for_url_v1(nullif((cells->>12),'''')::text);

RETURN r; END ');
END $replace$;
ALTER FUNCTION stock_operational.typed_input_shipments(jsonb) VOLATILE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_project_stock_adjustments(stock_operational.stock_adjustments)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."accountId",'''')),
 to_jsonb(coalesce(r."shopName",'''')),
 to_jsonb(coalesce(r."date",'''')),
 to_jsonb(coalesce(r."direction",'''')),
 to_jsonb(coalesce(r."reason",'''')),
 to_jsonb(coalesce(r."employeeId",'''')),
 to_jsonb(coalesce(r."employeeName",'''')),
 to_jsonb(coalesce(r."quantity"::text,'''')),
 to_jsonb(coalesce(r."itemDescription",'''')),
 to_jsonb(stock_operational.media_url_v1(r."photoMediaId")),
 to_jsonb(coalesce(r."note",'''')),
 to_jsonb(coalesce(r."reversesId",'''')),
 to_jsonb(coalesce(r."replacesId",'''')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'''')),
 to_jsonb(coalesce(r."createdBy",'''')),
 coalesce(to_jsonb(r."notInLoyverse"),''""''::jsonb));
');
END $replace$;
ALTER FUNCTION stock_operational.typed_project_stock_adjustments(stock_operational.stock_adjustments) STABLE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.typed_input_stock_adjustments(jsonb)'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE r stock_operational.stock_adjustments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>17 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."accountId" := nullif((cells->>1),'''')::text;
r."shopName" := nullif((cells->>2),'''')::text;
r."date" := nullif((cells->>3),'''')::text;
r."direction" := nullif((cells->>4),'''')::text;
r."reason" := nullif((cells->>5),'''')::text;
r."employeeId" := nullif((cells->>6),'''')::text;
r."employeeName" := nullif((cells->>7),'''')::text;
r."quantity" := nullif((cells->>8),'''')::numeric;
r."itemDescription" := nullif((cells->>9),'''')::text;
-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object(''photoUrl'',nullif((cells->>10),'''')::text));
r."photoMediaId" := stock_operational.media_ref_for_url_v1(nullif((cells->>10),'''')::text);
r."note" := nullif((cells->>11),'''')::text;
r."reversesId" := nullif((cells->>12),'''')::text;
r."replacesId" := nullif((cells->>13),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>14);
r."createdBy" := nullif((cells->>15),'''')::text;
IF cells->>16 IS NULL OR cells->>16='''' THEN r."notInLoyverse" := NULL;
ELSIF jsonb_typeof(cells->16)=''boolean'' OR (lower(cells->>16)) IN (''true'',''false'') THEN r."notInLoyverse" := (lower(cells->>16))::boolean;
ELSE RAISE EXCEPTION ''Ambiguous boolean requires an explicit true/false value''; END IF;
RETURN r; END ');
END $replace$;
ALTER FUNCTION stock_operational.typed_input_stock_adjustments(jsonb) VOLATILE;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE valid integer; lexemes integer; total integer;
BEGIN
 PERFORM stock_operational.media_record_contract_v1();
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace=''stock_operational''::regnamespace AND NOT a.attisdropped AND a.attname IN (''business_cells'',''row_order'',''cell_kinds'',''created_at_instant'');
 IF total<>0 THEN RAISE EXCEPTION ''Unsupported predecessor schema''; END IF;
 SELECT (SELECT count(*) FROM (VALUES (''orders'',''id'',''text''),(''orders'',''status'',''text''),(''orders'',''seller'',''text''),(''orders'',''totalPrice'',''numeric''),(''orders'',''remark'',''text''),(''orders'',''createdAt'',''timestamp with time zone''),(''orders'',''updatedAt'',''timestamp with time zone''),(''orders'',''deletedAt'',''timestamp with time zone''),(''orders'',''createdBy'',''text''),(''orders'',''revision'',''bigint''),(''orders'',''archived_at'',''timestamp with time zone''),(''order_items'',''id'',''text''),(''order_items'',''orderId'',''text''),(''order_items'',''quoteQuantity'',''numeric''),(''order_items'',''deliveredQuantity'',''numeric''),(''order_items'',''productCode'',''text''),(''order_items'',''createdAt'',''timestamp with time zone''),(''order_items'',''updatedAt'',''timestamp with time zone''),(''order_items'',''deletedAt'',''timestamp with time zone''),(''order_items'',''createdBy'',''text''),(''order_items'',''revision'',''bigint''),(''order_items'',''archived_at'',''timestamp with time zone''),(''order_bills'',''id'',''text''),(''order_bills'',''orderId'',''text''),(''order_bills'',''createdAt'',''timestamp with time zone''),(''order_bills'',''updatedAt'',''timestamp with time zone''),(''order_bills'',''deletedAt'',''timestamp with time zone''),(''order_bills'',''createdBy'',''text''),(''order_bills'',''revision'',''bigint''),(''order_bills'',''archived_at'',''timestamp with time zone''),(''shipments'',''id'',''text''),(''shipments'',''status'',''text''),(''shipments'',''carrier'',''text''),(''shipments'',''poNumber'',''text''),(''shipments'',''shippingFee'',''numeric''),(''shipments'',''remark'',''text''),(''shipments'',''shippedAt'',''text''),(''shipments'',''deliveredAt'',''text''),(''shipments'',''createdAt'',''timestamp with time zone''),(''shipments'',''updatedAt'',''timestamp with time zone''),(''shipments'',''deletedAt'',''timestamp with time zone''),(''shipments'',''createdBy'',''text''),(''shipments'',''revision'',''bigint''),(''shipments'',''archived_at'',''timestamp with time zone''),(''shipment_orders'',''id'',''text''),(''shipment_orders'',''shipmentId'',''text''),(''shipment_orders'',''orderId'',''text''),(''shipment_orders'',''createdAt'',''timestamp with time zone''),(''shipment_orders'',''updatedAt'',''timestamp with time zone''),(''shipment_orders'',''deletedAt'',''timestamp with time zone''),(''shipment_orders'',''createdBy'',''text''),(''shipment_orders'',''revision'',''bigint''),(''shipment_orders'',''archived_at'',''timestamp with time zone''),(''employees'',''id'',''text''),(''employees'',''name'',''text''),(''employees'',''phone'',''text''),(''employees'',''status'',''text''),(''employees'',''hiredDate'',''text''),(''employees'',''terminatedDate'',''text''),(''employees'',''createdAt'',''timestamp with time zone''),(''employees'',''updatedAt'',''timestamp with time zone''),(''employees'',''createdBy'',''text''),(''employees'',''revision'',''bigint''),(''employees'',''archived_at'',''timestamp with time zone''),(''employee_compensations'',''employeeId'',''text''),(''employee_compensations'',''baseSalary'',''numeric''),(''employee_compensations'',''commission'',''numeric''),(''employee_compensations'',''createdAt'',''timestamp with time zone''),(''employee_compensations'',''updatedAt'',''timestamp with time zone''),(''employee_compensations'',''updatedBy'',''text''),(''employee_compensations'',''effectiveFrom'',''text''),(''employee_compensations'',''compensationType'',''text''),(''employee_compensations'',''commissionType'',''text''),(''employee_compensations'',''commissionBucketSales'',''numeric''),(''employee_compensations'',''commissionBucketAmount'',''numeric''),(''employee_compensations'',''commissionRoundupThreshold'',''numeric''),(''employee_compensations'',''revision'',''bigint''),(''employee_compensations'',''archived_at'',''timestamp with time zone''),(''employee_compensations'',''migration_id'',''text''),(''employee_timesheets'',''id'',''text''),(''employee_timesheets'',''employeeId'',''text''),(''employee_timesheets'',''shopId'',''text''),(''employee_timesheets'',''status'',''text''),(''employee_timesheets'',''createdAt'',''timestamp with time zone''),(''employee_timesheets'',''updatedAt'',''timestamp with time zone''),(''employee_timesheets'',''workdayType'',''text''),(''employee_timesheets'',''revision'',''bigint''),(''employee_timesheets'',''archived_at'',''timestamp with time zone''),(''employee_advances'',''id'',''text''),(''employee_advances'',''employeeId'',''text''),(''employee_advances'',''shopId'',''text''),(''employee_advances'',''requestedDate'',''text''),(''employee_advances'',''payrollMonth'',''text''),(''employee_advances'',''requestedAmount'',''numeric''),(''employee_advances'',''paidAmount'',''numeric''),(''employee_advances'',''status'',''text''),(''employee_advances'',''paidDate'',''text''),(''employee_advances'',''reference'',''text''),(''employee_advances'',''note'',''text''),(''employee_advances'',''createdAt'',''timestamp with time zone''),(''employee_advances'',''updatedAt'',''timestamp with time zone''),(''employee_advances'',''revision'',''bigint''),(''employee_advances'',''archived_at'',''timestamp with time zone''),(''payroll_settlements'',''id'',''text''),(''payroll_settlements'',''employeeId'',''text''),(''payroll_settlements'',''month'',''text''),(''payroll_settlements'',''paidDate'',''text''),(''payroll_settlements'',''reference'',''text''),(''payroll_settlements'',''createdAt'',''timestamp with time zone''),(''payroll_settlements'',''snapshot'',''jsonb''),(''payroll_settlements'',''revision'',''bigint''),(''payroll_settlements'',''archived_at'',''timestamp with time zone''),(''expenses'',''id'',''text''),(''expenses'',''month'',''text''),(''expenses'',''expenseDate'',''text''),(''expenses'',''shopId'',''text''),(''expenses'',''scope'',''text''),(''expenses'',''categoryId'',''text''),(''expenses'',''name'',''text''),(''expenses'',''amount'',''numeric''),(''expenses'',''note'',''text''),(''expenses'',''createdAt'',''timestamp with time zone''),(''expenses'',''updatedAt'',''timestamp with time zone''),(''expenses'',''createdBy'',''text''),(''expenses'',''deletedAt'',''timestamp with time zone''),(''expenses'',''revision'',''bigint''),(''expenses'',''archived_at'',''timestamp with time zone''),(''expense_categories'',''id'',''text''),(''expense_categories'',''name'',''text''),(''expense_categories'',''active'',''boolean''),(''expense_categories'',''createdAt'',''timestamp with time zone''),(''expense_categories'',''updatedAt'',''timestamp with time zone''),(''expense_categories'',''revision'',''bigint''),(''expense_categories'',''archived_at'',''timestamp with time zone''),(''shops'',''id'',''text''),(''shops'',''name'',''text''),(''shops'',''active'',''boolean''),(''shops'',''loyverseAccountId'',''text''),(''shops'',''createdAt'',''timestamp with time zone''),(''shops'',''updatedAt'',''timestamp with time zone''),(''shops'',''revision'',''bigint''),(''shops'',''archived_at'',''timestamp with time zone''),(''sales_receipts'',''id'',''text''),(''sales_receipts'',''salesDate'',''text''),(''sales_receipts'',''accountId'',''text''),(''sales_receipts'',''shopName'',''text''),(''sales_receipts'',''receiptNumber'',''text''),(''sales_receipts'',''receiptType'',''text''),(''sales_receipts'',''refundFor'',''text''),(''sales_receipts'',''order'',''text''),(''sales_receipts'',''receiptDate'',''text''),(''sales_receipts'',''createdAt'',''timestamp with time zone''),(''sales_receipts'',''updatedAt'',''timestamp with time zone''),(''sales_receipts'',''cancelledAt'',''text''),(''sales_receipts'',''source'',''text''),(''sales_receipts'',''storeId'',''text''),(''sales_receipts'',''employeeId'',''text''),(''sales_receipts'',''customerId'',''text''),(''sales_receipts'',''posDeviceId'',''text''),(''sales_receipts'',''diningOption'',''text''),(''sales_receipts'',''totalMoney'',''numeric''),(''sales_receipts'',''totalTax'',''numeric''),(''sales_receipts'',''totalDiscount'',''numeric''),(''sales_receipts'',''tip'',''numeric''),(''sales_receipts'',''surcharge'',''numeric''),(''sales_receipts'',''pointsEarned'',''numeric''),(''sales_receipts'',''pointsDeducted'',''numeric''),(''sales_receipts'',''syncedAt'',''text''),(''sales_receipts'',''revision'',''bigint''),(''sales_receipts'',''archived_at'',''timestamp with time zone''),(''sales_receipt_items'',''id'',''text''),(''sales_receipt_items'',''receiptId'',''text''),(''sales_receipt_items'',''lineItemId'',''text''),(''sales_receipt_items'',''itemId'',''text''),(''sales_receipt_items'',''variantId'',''text''),(''sales_receipt_items'',''itemName'',''text''),(''sales_receipt_items'',''variantName'',''text''),(''sales_receipt_items'',''sku'',''text''),(''sales_receipt_items'',''quantity'',''numeric''),(''sales_receipt_items'',''price'',''numeric''),(''sales_receipt_items'',''grossTotalMoney'',''numeric''),(''sales_receipt_items'',''totalDiscount'',''numeric''),(''sales_receipt_items'',''totalMoney'',''numeric''),(''sales_receipt_items'',''cost'',''numeric''),(''sales_receipt_items'',''costTotal'',''numeric''),(''sales_receipt_items'',''taxes'',''numeric''),(''sales_receipt_items'',''lineNote'',''text''),(''sales_receipt_items'',''lineDiscountsJson'',''jsonb''),(''sales_receipt_items'',''lineTaxesJson'',''jsonb''),(''sales_receipt_items'',''lineModifiersJson'',''jsonb''),(''sales_receipt_items'',''syncedAt'',''text''),(''sales_receipt_items'',''createdAt'',''timestamp with time zone''),(''sales_receipt_items'',''revision'',''bigint''),(''sales_receipt_items'',''archived_at'',''timestamp with time zone''),(''sales_receipt_payments'',''id'',''text''),(''sales_receipt_payments'',''receiptId'',''text''),(''sales_receipt_payments'',''paymentIndex'',''bigint''),(''sales_receipt_payments'',''paymentTypeId'',''text''),(''sales_receipt_payments'',''paymentName'',''text''),(''sales_receipt_payments'',''paymentType'',''text''),(''sales_receipt_payments'',''moneyAmount'',''numeric''),(''sales_receipt_payments'',''paidAt'',''text''),(''sales_receipt_payments'',''paymentDetailsJson'',''jsonb''),(''sales_receipt_payments'',''syncedAt'',''text''),(''sales_receipt_payments'',''createdAt'',''timestamp with time zone''),(''sales_receipt_payments'',''revision'',''bigint''),(''sales_receipt_payments'',''archived_at'',''timestamp with time zone''),(''sales_receipt_syncs'',''id'',''text''),(''sales_receipt_syncs'',''salesDate'',''text''),(''sales_receipt_syncs'',''accountId'',''text''),(''sales_receipt_syncs'',''shopName'',''text''),(''sales_receipt_syncs'',''status'',''text''),(''sales_receipt_syncs'',''receiptCount'',''bigint''),(''sales_receipt_syncs'',''itemCount'',''bigint''),(''sales_receipt_syncs'',''paymentCount'',''bigint''),(''sales_receipt_syncs'',''syncedAt'',''text''),(''sales_receipt_syncs'',''createdAt'',''timestamp with time zone''),(''sales_receipt_syncs'',''revision'',''bigint''),(''sales_receipt_syncs'',''archived_at'',''timestamp with time zone''),(''sales_profit_cost_overrides'',''id'',''text''),(''sales_profit_cost_overrides'',''month'',''text''),(''sales_profit_cost_overrides'',''accountId'',''text''),(''sales_profit_cost_overrides'',''averageItemCost'',''numeric''),(''sales_profit_cost_overrides'',''note'',''text''),(''sales_profit_cost_overrides'',''createdAt'',''timestamp with time zone''),(''sales_profit_cost_overrides'',''updatedAt'',''timestamp with time zone''),(''sales_profit_cost_overrides'',''createdBy'',''text''),(''sales_profit_cost_overrides'',''revision'',''bigint''),(''sales_profit_cost_overrides'',''archived_at'',''timestamp with time zone''),(''stock_counts'',''id'',''text''),(''stock_counts'',''month'',''text''),(''stock_counts'',''accountId'',''text''),(''stock_counts'',''shopName'',''text''),(''stock_counts'',''physicalCount'',''numeric''),(''stock_counts'',''note'',''text''),(''stock_counts'',''countedAt'',''text''),(''stock_counts'',''updatedAt'',''timestamp with time zone''),(''stock_counts'',''updatedBy'',''text''),(''stock_counts'',''createdAt'',''timestamp with time zone''),(''stock_counts'',''revision'',''bigint''),(''stock_counts'',''archived_at'',''timestamp with time zone''),(''stock_adjustments'',''id'',''text''),(''stock_adjustments'',''accountId'',''text''),(''stock_adjustments'',''shopName'',''text''),(''stock_adjustments'',''date'',''text''),(''stock_adjustments'',''direction'',''text''),(''stock_adjustments'',''reason'',''text''),(''stock_adjustments'',''employeeId'',''text''),(''stock_adjustments'',''employeeName'',''text''),(''stock_adjustments'',''quantity'',''numeric''),(''stock_adjustments'',''itemDescription'',''text''),(''stock_adjustments'',''note'',''text''),(''stock_adjustments'',''reversesId'',''text''),(''stock_adjustments'',''replacesId'',''text''),(''stock_adjustments'',''createdAt'',''timestamp with time zone''),(''stock_adjustments'',''createdBy'',''text''),(''stock_adjustments'',''notInLoyverse'',''boolean''),(''stock_adjustments'',''revision'',''bigint''),(''stock_adjustments'',''archived_at'',''timestamp with time zone''),(''movements'',''id'',''text''),(''movements'',''userId'',''text''),(''movements'',''packingDate'',''text''),(''movements'',''deliverDateTime'',''text''),(''movements'',''status'',''text''),(''movements'',''totalQuantity'',''numeric''),(''movements'',''createdAt'',''timestamp with time zone''),(''movements'',''updatedAt'',''timestamp with time zone''),(''movements'',''revision'',''bigint''),(''movements'',''archived_at'',''timestamp with time zone''),(''movement_details'',''id'',''text''),(''movement_details'',''movementMasterId'',''text''),(''movement_details'',''shopName'',''text''),(''movement_details'',''quantity'',''numeric''),(''movement_details'',''remark'',''text''),(''movement_details'',''fromLocation'',''text''),(''movement_details'',''toLocation'',''text''),(''movement_details'',''purchaseDetailId'',''text''),(''movement_details'',''status'',''text''),(''movement_details'',''createdAt'',''timestamp with time zone''),(''movement_details'',''updatedAt'',''timestamp with time zone''),(''movement_details'',''stockCounted'',''boolean''),(''movement_details'',''isNewArrival'',''boolean''),(''movement_details'',''revision'',''bigint''),(''movement_details'',''archived_at'',''timestamp with time zone''),(''user_state'',''id'',''text''),(''user_state'',''userId'',''text''),(''user_state'',''flowname'',''text''),(''user_state'',''referenceId'',''text''),(''user_state'',''state'',''text''),(''user_state'',''createdAt'',''timestamp with time zone''),(''user_state'',''updatedAt'',''timestamp with time zone''),(''user_state'',''context'',''jsonb''),(''user_state'',''revision'',''bigint''),(''user_state'',''archived_at'',''timestamp with time zone'')) e(name,column_name,datatype) JOIN pg_class c ON c.relname=e.name AND c.relnamespace=''stock_operational''::regnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype) INTO valid;
 IF valid<>294 THEN RAISE EXCEPTION ''Unsupported typed-column schema''; END IF;
 SELECT (SELECT count(*) FROM (VALUES (''orders'',''totalPrice__lexeme'',''text''),(''order_items'',''quoteQuantity__lexeme'',''text''),(''order_items'',''deliveredQuantity__lexeme'',''text''),(''shipments'',''shippingFee__lexeme'',''text''),(''employee_compensations'',''baseSalary__lexeme'',''text''),(''employee_compensations'',''commission__lexeme'',''text''),(''employee_compensations'',''commissionBucketSales__lexeme'',''text''),(''employee_compensations'',''commissionBucketAmount__lexeme'',''text''),(''employee_compensations'',''commissionRoundupThreshold__lexeme'',''text''),(''employee_advances'',''requestedAmount__lexeme'',''text''),(''employee_advances'',''paidAmount__lexeme'',''text''),(''payroll_settlements'',''snapshot__lexeme'',''text''),(''expenses'',''amount__lexeme'',''text''),(''expense_categories'',''active__lexeme'',''text''),(''shops'',''active__lexeme'',''text''),(''sales_receipts'',''totalMoney__lexeme'',''text''),(''sales_receipts'',''totalTax__lexeme'',''text''),(''sales_receipts'',''totalDiscount__lexeme'',''text''),(''sales_receipts'',''tip__lexeme'',''text''),(''sales_receipts'',''surcharge__lexeme'',''text''),(''sales_receipts'',''pointsEarned__lexeme'',''text''),(''sales_receipts'',''pointsDeducted__lexeme'',''text''),(''sales_receipt_items'',''quantity__lexeme'',''text''),(''sales_receipt_items'',''price__lexeme'',''text''),(''sales_receipt_items'',''grossTotalMoney__lexeme'',''text''),(''sales_receipt_items'',''totalDiscount__lexeme'',''text''),(''sales_receipt_items'',''totalMoney__lexeme'',''text''),(''sales_receipt_items'',''cost__lexeme'',''text''),(''sales_receipt_items'',''costTotal__lexeme'',''text''),(''sales_receipt_items'',''taxes__lexeme'',''text''),(''sales_receipt_items'',''lineDiscountsJson__lexeme'',''text''),(''sales_receipt_items'',''lineTaxesJson__lexeme'',''text''),(''sales_receipt_items'',''lineModifiersJson__lexeme'',''text''),(''sales_receipt_payments'',''paymentIndex__lexeme'',''text''),(''sales_receipt_payments'',''moneyAmount__lexeme'',''text''),(''sales_receipt_payments'',''paymentDetailsJson__lexeme'',''text''),(''sales_receipt_syncs'',''receiptCount__lexeme'',''text''),(''sales_receipt_syncs'',''itemCount__lexeme'',''text''),(''sales_receipt_syncs'',''paymentCount__lexeme'',''text''),(''sales_profit_cost_overrides'',''averageItemCost__lexeme'',''text''),(''stock_counts'',''physicalCount__lexeme'',''text''),(''stock_adjustments'',''quantity__lexeme'',''text''),(''stock_adjustments'',''notInLoyverse__lexeme'',''text''),(''movements'',''totalQuantity__lexeme'',''text''),(''movement_details'',''quantity__lexeme'',''text''),(''movement_details'',''stockCounted__lexeme'',''text''),(''movement_details'',''isNewArrival__lexeme'',''text''),(''user_state'',''context__lexeme'',''text'')) e(name,column_name,datatype) JOIN pg_class c ON c.relname=e.name AND c.relnamespace=''stock_operational''::regnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype) INTO lexemes;
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace=''stock_operational''::regnamespace AND NOT a.attisdropped AND right(a.attname,8)=''__lexeme'';
 IF lexemes=48 AND total=48 THEN RETURN ''retained''; END IF;
 IF lexemes=0 AND total=0 THEN
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace=''stock_operational''::regnamespace
   AND p.oid<>''stock_operational.lexeme_mapping_contract_v1()''::regprocedure
   AND strpos(p.prosrc,''__lexeme'')>0) THEN RAISE EXCEPTION ''Incomplete lexeme function retirement''; END IF;
  RETURN ''typed'';
 END IF;
 RAISE EXCEPTION ''Partial lexeme schema'';
END ');
END $replace$;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.bind_media_v1()'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
DECLARE shape jsonb := to_jsonb(NEW); previous jsonb; url text; ref uuid; ref_changed boolean; url_changed boolean; item stock_operational.media; location record;
BEGIN

 IF TG_NARGS=1 THEN
  ref:=(shape->>TG_ARGV[0])::uuid;
  IF ref IS NOT NULL THEN
   SELECT * INTO item FROM stock_operational.media WHERE id=ref FOR SHARE;
   IF NOT FOUND OR item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION ''Missing or deleted media reference''; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP=''UPDATE'' THEN previous:=to_jsonb(OLD); END IF;
 url:=shape->>TG_ARGV[0]; ref:=(shape->>TG_ARGV[1])::uuid;
 ref_changed:=CASE WHEN TG_OP=''INSERT'' THEN ref IS NOT NULL ELSE (previous->>TG_ARGV[1]) IS DISTINCT FROM (shape->>TG_ARGV[1]) END;
 url_changed:=TG_OP=''INSERT'' OR (previous->>TG_ARGV[0]) IS DISTINCT FROM url;
 IF ref_changed THEN
  IF ref IS NULL THEN
   IF url_changed AND url IS NOT NULL THEN RAISE EXCEPTION ''Conflicting media reference and URL''; END IF;
   url:=NULL;
  ELSE
   SELECT * INTO item FROM stock_operational.media WHERE id=ref FOR SHARE;
   IF NOT FOUND OR item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION ''Missing or deleted media reference''; END IF;
   IF url_changed AND url IS NOT NULL THEN
    SELECT * INTO location FROM stock_operational.media_location_v1(url);
    IF url<>item."sourceUrl" AND NOT(location.provider=''google_drive'' AND item.provider=''google_drive'' AND location.file_id=item."providerFileId") THEN RAISE EXCEPTION ''Conflicting media reference and URL''; END IF;
   ELSE url:=item."sourceUrl"; END IF;
  END IF;
 ELSIF url_changed OR ref IS NULL THEN
  IF url IS NULL OR url='''' THEN ref:=NULL;
  ELSE
   -- Prefer a provider-confirmed location, including synthetic adapter fixtures.
   SELECT * INTO item FROM stock_operational.media WHERE md5("sourceUrl")=md5(url) AND "sourceUrl"=url FOR SHARE;
   IF FOUND THEN
    IF item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION ''Referenced media is deleted''; END IF;
    ref:=item.id;
   ELSE
    SELECT * INTO location FROM stock_operational.media_location_v1(url);
    ref:=stock_operational.media_for_location_v1(location.provider,location.file_id,url);
   END IF;
  END IF;
 END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[0],url,TG_ARGV[1],ref));
 RETURN NEW;
END ');
END $replace$;
DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.media_catalog_v1()'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,'
SELECT CASE WHEN
 (SELECT count(*)=11 FROM pg_attribute WHERE attrelid=''stock_operational.media''::regclass AND attnum>0 AND NOT attisdropped)
 AND (SELECT count(*)=5 FROM pg_constraint WHERE confrelid=''stock_operational.media''::regclass AND contype=''f'' AND convalidated AND confdeltype=''r'')
 AND (SELECT count(*)=5 FROM pg_trigger t JOIN pg_proc f ON f.oid=t.tgfoid JOIN pg_namespace n ON n.oid=f.pronamespace WHERE t.tgname=''b_media_reference'' AND t.tgenabled=''O'' AND f.proname=''bind_media_v1'' AND n.nspname=''stock_operational'')
 THEN CASE stock_operational.media_record_contract_v1() WHEN ''retained'' THEN ''media-v1'' WHEN ''id-only'' THEN ''media-v2'' ELSE ''unsupported-media-layout'' END ELSE ''unsupported-media-layout'' END
');
END $replace$;
SELECT 1/(stock_operational.media_record_contract_v1()='retained' AND stock_operational.lexeme_mapping_contract_v1()='typed')::int;
COMMIT;
