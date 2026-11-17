-- OPERATOR ONLY: prepare retained identity defaults BEFORE deploying the ID-only writer.
-- Outside automatic migration discovery; requires the approved writer freeze.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'))::int;
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant'))::int;
SELECT 1 / coalesce(current_setting('stock.allow_row_order_preparation',true)='reviewed-id-created-order-v1',false)::int;
LOCK TABLE stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
DO $prepare$
DECLARE item record; sequence_name text; highwater numeric; last_value numeric; called boolean; next_value numeric; settings record;
BEGIN
 FOR item IN SELECT * FROM (VALUES ('orders'),('order_items'),('order_bills'),('shipments'),('shipment_orders'),('employees'),('employee_compensations'),('employee_timesheets'),('employee_advances'),('payroll_settlements'),('expenses'),('expense_categories'),('shops'),('sales_receipts'),('sales_receipt_items'),('sales_receipt_payments'),('sales_receipt_syncs'),('sales_profit_cost_overrides'),('stock_counts'),('stock_adjustments'),('movements'),('movement_details'),('user_state')) AS tables(name) LOOP
  sequence_name := pg_get_serial_sequence('stock_operational.'||item.name,'row_order');
  IF sequence_name IS NULL THEN RAISE EXCEPTION 'Expected retained identity sequence'; END IF;
  SELECT seqincrement,seqmin,seqmax,seqcache,seqcycle INTO STRICT settings FROM pg_sequence WHERE seqrelid=sequence_name::regclass;
  IF settings.seqincrement<>1 OR settings.seqmin<>1 OR settings.seqcache<>1 OR settings.seqcycle THEN RAISE EXCEPTION 'Unexpected identity sequence settings'; END IF;
  EXECUTE format('SELECT coalesce(max(row_order),0)::numeric+1 FROM stock_operational.%I',item.name) INTO highwater;
  EXECUTE format('SELECT last_value::numeric,is_called FROM %s',sequence_name::regclass) INTO last_value,called;
  next_value := greatest(highwater,last_value+CASE WHEN called THEN 1 ELSE 0 END);
  IF next_value>settings.seqmax THEN RAISE EXCEPTION 'Identity sequence exhausted'; END IF;
  -- RESTART is transactional; rollback must not consume or regress a sequence.
  EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s',sequence_name::regclass,next_value);
 END LOOP;
END $prepare$;
COMMIT;
