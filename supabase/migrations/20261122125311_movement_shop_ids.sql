-- Explicitly approved schema stage only. No historical labels are guessed here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT 1/coalesce(current_setting('stock.movement_shop_install',true)='reviewed-movement-shop-ids-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.environment,stock_operational.revision,stock_operational.shops,stock_operational.movement_details IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') AND (purpose<>'production' OR isolation_id='349b9289-f684-4ec5-ac22-924b2be1946b'::uuid) FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.expected_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='shopId' AND NOT attisdropped))::int;
ALTER TABLE stock_operational.movement_details ADD COLUMN "shopId" text REFERENCES stock_operational.shops(id) ON DELETE RESTRICT;
CREATE INDEX movement_details_shop ON stock_operational.movement_details("shopId");
GRANT INSERT("shopId"),UPDATE("shopId") ON stock_operational.movement_details TO stock_runtime;
COMMIT;
