-- OPERATOR ONLY: deploy/verify the ID-only writer first; keep all producers frozen.
-- A matching private recovery and semantic selection review is required. No old-snapshot rollback.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'))::int;
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant'))::int;
SELECT 1 / coalesce(current_setting('stock.allow_final_row_order_removal',true)='reviewed-id-created-order-v1',false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.row_order_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / coalesce(current_setting('stock.row_order_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.row_order_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1 / ((SELECT count(*)=0 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='business_cells'))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename LIKE 'stock_%' AND xact_start IS NOT NULL))::int;
LOCK TABLE stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
DO $remove$
DECLARE item record; body text; definition text; expected text;
BEGIN
 FOR item IN SELECT * FROM (VALUES ('orders','57267de22acc1ea6c0049f746509b4d4'),('order_items','7446402536fc07481e84c88023b00ef7'),('order_bills','6901e4e0820bdf760ae2095979fefc28'),('shipments','0eaab4b90da7f9bb11c94b80569442f0'),('shipment_orders','d92fb29a067d12be944d3843969b9cfa'),('employees','4397d989dfa0fe4eb3c17ca0cffd4cf8'),('employee_compensations','a87ebc3093ff5a670a9fc1d9efdc470d'),('employee_timesheets','6011698bb7eb6046743b71fb49f0f3d0'),('employee_advances','59de1017fe1ccfaa99eadd1d940fc9a0'),('payroll_settlements','e7eebbd650c2d08ce7b498973ad9d205'),('expenses','9045e17b6da3507846517397b9d4cb08'),('expense_categories','d16efdd8d13369ec14bce4f3482ffa73'),('shops','6d6525b612ff788e3d30c7e71b827a35'),('sales_receipts','8f49df479a536b56c2622a8fe8b452a5'),('sales_receipt_items','96d31a8fe117243aea386dd866e9f6b4'),('sales_receipt_payments','7d787ffb70e5d38f8e4ab91d01ee1b90'),('sales_receipt_syncs','5c5fbdaaca5831398ac084a86c9948ae'),('sales_profit_cost_overrides','5920aea3aa0f239a3688c787e75c9590'),('stock_counts','01cf6106ef9c80a3e086e4429b895794'),('stock_adjustments','bfddea1227ba7edae1e46f85bf430c69'),('movements','28c20bc902bb009b0df8ee3831b9be76'),('movement_details','a1ea00c0c3d7f9c6c8d47ab2350703b7'),('user_state','0b5850badbe5b79a32ab0e149bab1382')) AS functions(name,hash) LOOP
  SELECT p.prosrc,pg_get_functiondef(p.oid) INTO STRICT body,definition FROM pg_proc p WHERE p.oid=to_regprocedure('stock_operational.validate_'||item.name||'()');
  IF md5(body)<>item.hash THEN RAISE EXCEPTION 'Validation function drift: %',item.name; END IF;
  expected := replace(definition,' OR NEW.row_order IS DISTINCT FROM OLD.row_order','');
  IF expected=definition OR position('row_order' IN expected)>0 THEN RAISE EXCEPTION 'Unexpected validation dependency'; END IF;
  -- Preserve all validation, ID/archive/revision rules, ownership and ACLs.
  EXECUTE expected;
 END LOOP;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND (n.nspname='stock_operational' OR position('stock_operational' IN p.prosrc)>0) AND position('row_order' IN p.prosrc)>0) THEN RAISE EXCEPTION 'Unreviewed function still uses ordinal column'; END IF;
END $remove$;
ALTER TABLE stock_operational.orders DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.order_items DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.order_bills DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.shipments DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.shipment_orders DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.employees DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.employee_timesheets DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.employee_advances DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.payroll_settlements DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.expenses DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.expense_categories DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.shops DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.sales_profit_cost_overrides DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.stock_counts DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.stock_adjustments DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.movements DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN row_order RESTRICT;
ALTER TABLE stock_operational.user_state DROP COLUMN row_order RESTRICT;
SELECT 1 / ((SELECT count(*)=0 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'))::int;
COMMIT;
