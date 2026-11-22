-- Operator-only frozen-data backfill. Set the explicit label -> ID array privately.
-- Example shape ONLY: stock.movement_shop_map='[{"label":"legacy-label","shopId":"existing-id"}]'.
-- No source/business values belong in Git or CI artifacts.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT 1/coalesce(current_setting('stock.movement_shop_backfill',true)='reviewed-movement-shop-backfill-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.environment,stock_operational.revision,stock_operational.shops,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') AND (purpose<>'production' OR isolation_id='349b9289-f684-4ec5-ac22-924b2be1946b'::uuid) FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.expected_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
CREATE TEMP TABLE reviewed_movement_shop_map(label text PRIMARY KEY,shop_id text NOT NULL) ON COMMIT DROP;
DO $$DECLARE mapping jsonb;entry jsonb;saved record;body jsonb;BEGIN
 mapping:=current_setting('stock.movement_shop_map',true)::jsonb;
 IF mapping IS NULL OR jsonb_typeof(mapping)<>'array' THEN RAISE EXCEPTION 'Explicit movement shop map must be an array';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(mapping) LOOP
  IF jsonb_typeof(entry)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(entry))<>2 OR jsonb_typeof(entry->'label')<>'string' OR jsonb_typeof(entry->'shopId')<>'string' OR nullif(btrim(entry->>'label'),'') IS NULL OR nullif(btrim(entry->>'shopId'),'') IS NULL THEN RAISE EXCEPTION 'Malformed explicit movement shop map';END IF;
  INSERT INTO reviewed_movement_shop_map VALUES(upper(btrim(entry->>'label')),entry->>'shopId');
 END LOOP;
 IF EXISTS(SELECT FROM reviewed_movement_shop_map m LEFT JOIN stock_operational.shops s ON s.id=m.shop_id WHERE s.id IS NULL) THEN RAISE EXCEPTION 'Mapped shop is missing or deleted';END IF;
 -- Include deleted movement history; do not strand old references or reuse aliases.
 IF EXISTS(SELECT FROM stock_operational.movement_details d LEFT JOIN reviewed_movement_shop_map m ON m.label=upper(btrim(d."shopName")) WHERE m.shop_id IS NULL OR (d."shopId" IS NOT NULL AND d."shopId"<>m.shop_id)) THEN RAISE EXCEPTION 'Unmapped or conflicting movement destination';END IF;
 -- A current session must retain the same validated workflow identity/step.
 IF EXISTS(SELECT FROM stock_operational.user_state u WHERE u.flowname='MovementCreate' AND u."deletedAt" IS NULL AND u.state<>'complete' AND nullif(btrim(u.context::text),'') IS NULL) THEN RAISE EXCEPTION 'Active movement context is missing';END IF;
 FOR saved IN SELECT u."userId",u."referenceId",u.state,u.context FROM stock_operational.user_state u WHERE u.flowname='MovementCreate' AND nullif(btrim(u.context::text),'') IS NOT NULL LOOP
  body:=saved.context::jsonb;
  IF jsonb_typeof(body)<>'object' OR EXISTS(SELECT FROM unnest(ARRAY['masterId','itemId','userId','startedAt','shop','quantity','remark','imageUrl','lastEventId']) k WHERE jsonb_typeof(body->k) IS DISTINCT FROM 'string') OR body->>'masterId' IS DISTINCT FROM saved."referenceId" OR body->>'userId' IS DISTINCT FROM saved."userId" OR body->>'step' IS DISTINCT FROM saved.state OR body->>'step' NOT IN ('shop','quantity','product_image','close_bag','bag_closed','complete') OR (body ? 'shopId' AND (jsonb_typeof(body->'shopId') IS DISTINCT FROM 'string' OR nullif(btrim(body->>'shopId'),'') IS NULL)) THEN RAISE EXCEPTION 'Malformed saved movement workflow identity';END IF;
 END LOOP;
 -- Validate and retain every saved context before changing any records.
 IF EXISTS(SELECT FROM stock_operational.user_state u WHERE u.flowname='MovementCreate' AND nullif(btrim(u.context::text),'') IS NOT NULL AND jsonb_typeof(u.context::jsonb)<>'object') THEN RAISE EXCEPTION 'Malformed movement context';END IF;
 IF EXISTS(SELECT FROM stock_operational.user_state u LEFT JOIN reviewed_movement_shop_map m ON m.label=upper(btrim(u.context::jsonb->>'shop')) WHERE u.flowname='MovementCreate' AND nullif(btrim(u.context::text),'') IS NOT NULL AND nullif(u.context::jsonb->>'shop','') IS NOT NULL AND (m.shop_id IS NULL OR (u.context::jsonb ? 'shopId' AND u.context::jsonb->>'shopId' IS DISTINCT FROM m.shop_id))) THEN RAISE EXCEPTION 'Unmapped or conflicting saved movement destination';END IF;
END$$;
SELECT 1/(SELECT count(*)=4 FROM pg_trigger WHERE tgrelid IN ('stock_operational.movement_details'::regclass,'stock_operational.user_state'::regclass) AND tgname IN ('a_validate','advance_revision') AND tgenabled='O')::int;
-- Only the reviewed references/context change. Preserve business row revisions,
-- global revision, timestamps and every existing value under the fenced locks.
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.user_state DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.user_state DISABLE TRIGGER advance_revision;
UPDATE stock_operational.movement_details d SET "shopId"=m.shop_id FROM reviewed_movement_shop_map m WHERE m.label=upper(btrim(d."shopName")) AND d."shopId" IS NULL;
UPDATE stock_operational.user_state u SET context=u.context::jsonb||jsonb_build_object('shopId',m.shop_id) FROM reviewed_movement_shop_map m WHERE u.flowname='MovementCreate' AND nullif(btrim(u.context::text),'') IS NOT NULL AND m.label=upper(btrim(u.context::jsonb->>'shop')) AND NOT (u.context::jsonb ? 'shopId');
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.user_state ENABLE TRIGGER a_validate;
ALTER TABLE stock_operational.user_state ENABLE TRIGGER advance_revision;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.movement_details WHERE "shopId" IS NULL))::int;
COMMIT;
