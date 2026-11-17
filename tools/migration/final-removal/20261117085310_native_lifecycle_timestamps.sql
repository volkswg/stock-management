-- OPERATOR ONLY. Deploy the compatible reader first, then execute under an approved freeze.
-- Existing names become native timestamptz; no timestamp text sidecars or inferred history.
-- Outside automatic migration discovery. Reviewed recovery/semantic evidence is mandatory.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_native_timestamps',true)='reviewed-lifecycle-timestamptz-v1',false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.timestamp_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / coalesce(current_setting('stock.timestamp_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.timestamp_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename LIKE 'stock_%' AND xact_start IS NOT NULL))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('row_order','business_cells')))::int;
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant' AND data_type='timestamp with time zone'))::int;
LOCK TABLE stock_operational.environment,stock_operational.revision,stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.timestamp_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
-- Validate all predecessor bodies before rewriting any schema or functions.
DO $witnesses$
DECLARE item record; actual text;
BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','e16b410e512178e68fdf472e52a46de6'),('project_orders(stock_operational.orders)','301b97f6fe25063dbfd5db894a8d6f1e'),('validate_orders()','10a81bc54c3eb98d1ed473431c7e4d52'),('input_order_items(jsonb)','20a1f10a45d84da2b392572025e79629'),('project_order_items(stock_operational.order_items)','7f5fdc485d43e0151e252b3452ed60ce'),('validate_order_items()','877d3259c397045ad9a79eec0e9e7d1d'),('input_order_bills(jsonb)','2b0d323c4a139319c45ced7524e4eb7f'),('project_order_bills(stock_operational.order_bills)','07bb53abeeee083615bb24bc611a752a'),('validate_order_bills()','fda7e4908afe18419a40c89aee30048f'),('input_shipments(jsonb)','23e9031ee16bd6efbb2506ec626b0aa3'),('project_shipments(stock_operational.shipments)','f6643db2b482aeac207c276d7b09e6ff'),('validate_shipments()','103e2003169279e0f4504ba02d5c81cc'),('input_shipment_orders(jsonb)','07cce0c23afb989f45c9057a3a3ce286'),('project_shipment_orders(stock_operational.shipment_orders)','ff1f8ea81e34d6f5afc1ca84bfbdd4d6'),('validate_shipment_orders()','fe69e9733113495bae7a1bbf69f085e4'),('input_employees(jsonb)','781a9f65b5128221a755f6fe6b407045'),('project_employees(stock_operational.employees)','c2aa0e70b7a073ebe1834c1d81b68ca9'),('validate_employees()','70800e841d729cbac6a4867273188186'),('input_employee_compensations(jsonb)','7764750b8c9d650c7697be57e4d89b2a'),('project_employee_compensations(stock_operational.employee_compensations)','4b3805e9cf220b098e9ec8b86b5c674f'),('validate_employee_compensations()','ffc315764453107b5b3085a1f1306f67'),('input_employee_timesheets(jsonb)','d4467407d1ec37befff70ac615762c50'),('project_employee_timesheets(stock_operational.employee_timesheets)','985e106d04cc8135e559634779397207'),('validate_employee_timesheets()','5543f97547bf0be15052a73b1c4eae98'),('input_employee_advances(jsonb)','8325416e17be61687273132717023fda'),('project_employee_advances(stock_operational.employee_advances)','6efa68118a80c1af0173cf46f42c39c3'),('validate_employee_advances()','f7f040014a8640f9c710575b8bcaffaa'),('input_payroll_settlements(jsonb)','7bd48a80095d2346ebb9919f42ddf8ea'),('project_payroll_settlements(stock_operational.payroll_settlements)','fa51a6b6056fde7f62347b3eb5fb1b92'),('validate_payroll_settlements()','c4e387179198bd53bccfac71b8fdd1b1'),('input_expenses(jsonb)','f5b0de1117dc1f11da855013de5ef253'),('project_expenses(stock_operational.expenses)','c16c088b313cfb35b4514b182b72d7f9'),('validate_expenses()','73ce892918c9058c4be289718be0c75b'),('input_expense_categories(jsonb)','749c531d3ea2c47f1afa7c770f66c691'),('project_expense_categories(stock_operational.expense_categories)','848fe178ee6552ad4b8aa3f16400ef1d'),('validate_expense_categories()','121fc85272d85c8639a2f948972a8a0f'),('input_shops(jsonb)','31617f99714a7623ea9501588289d372'),('project_shops(stock_operational.shops)','33d870c995132788b2c6d82047b58b34'),('validate_shops()','9659eaca352aa5ca9180d71077e1b4e3'),('input_sales_receipts(jsonb)','43fd35713b4a1dad9f38a3c18841e848'),('project_sales_receipts(stock_operational.sales_receipts)','82b52ce8de568c4828400112ceae4d65'),('validate_sales_receipts()','0e8a97e6ce72e7bb10da431e91eeb82d'),('input_sales_receipt_items(jsonb)','543194b8dbd7046c82f8dcb6194e7104'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','d95880392b392a81bb9d9738816a51f7'),('validate_sales_receipt_items()','682a8ce80aee6065212ecf2a33e319e5'),('input_sales_receipt_payments(jsonb)','d8114668797aaaa4a4e2d047fcbb0656'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','2a714e26c41b250fe6cc970c9cb40ee7'),('validate_sales_receipt_payments()','70b8979e465cf58fa04739282579ea30'),('input_sales_receipt_syncs(jsonb)','c6ebc3d2f2154c463b99d2d045d9d4c4'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7b951d44b0738ae4fbc3c7020ec1e3ae'),('validate_sales_receipt_syncs()','1a8455ac49a0f24cc21d316b5cc9c6ba'),('input_sales_profit_cost_overrides(jsonb)','81df58dcf2e4eb251d670e8e33bf8c6c'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','4ad90328cc5cd1bdc369d9effb6af77b'),('validate_sales_profit_cost_overrides()','c9be673e5acedb1d18eb46ed0c77df38'),('input_stock_counts(jsonb)','fb53de6fe5fb15d4e2beeee23750d172'),('project_stock_counts(stock_operational.stock_counts)','9aa39459b2849671ca7299e94136693d'),('validate_stock_counts()','18b8bccd39bd392ab448d450709bec35'),('input_stock_adjustments(jsonb)','f465044068f174fa6b6bde79b81908be'),('project_stock_adjustments(stock_operational.stock_adjustments)','a689d1bad12fc16c7135ff296807106f'),('validate_stock_adjustments()','0526d3f71500aa02ee33c0678aaac7d4'),('input_movements(jsonb)','8fbc3a2aef0e4a228fdd262df03964e6'),('project_movements(stock_operational.movements)','afd7a4c1baed34a1dbeaf58188bd782d'),('validate_movements()','290ff6eb02dc6ea0a0fd5df09ee7afbe'),('input_movement_details(jsonb)','0babb18cf850ecc63f6d7e71e6f529a6'),('project_movement_details(stock_operational.movement_details)','4aa6038c403b8b7513244722164fdb26'),('validate_movement_details()','87cebe6727093649092570c91d4d2c9b'),('input_user_state(jsonb)','0dae153165e07534dde3ca21acb11e1c'),('project_user_state(stock_operational.user_state)','3e950a0a921d7522fd6d0e4d74a40671'),('validate_user_state()','0fc47b5865c4d92ef3e8e77a6707619d'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7'),('set_created_at_instant()','87e4ef0805e5cb23e72abd517cf1edfb')) expected(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed timestamp mapper/validator drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
CREATE FUNCTION stock_operational.native_timestamp_text(value timestamptz) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
BEGIN
 IF value IS NULL THEN RETURN NULL; END IF;
 IF NOT isfinite(value) OR extract(year FROM value)<1 OR extract(year FROM value)>9999 THEN RAISE EXCEPTION 'Timestamp outside supported finite ISO range'; END IF;
 IF mod(extract(microseconds FROM value)::bigint,1000)=0 THEN
  RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 END IF;
 RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
END $$;
CREATE FUNCTION stock_operational.native_timestamp_input(value text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
DECLARE instant timestamptz;
BEGIN
 IF value IS NULL OR value='' THEN RETURN NULL; END IF;
 instant := stock_operational.created_at_timestamp(value);
 IF instant IS NULL THEN RAISE EXCEPTION 'Nonempty timestamp requires an unambiguous valid ISO date/time'; END IF;
 PERFORM stock_operational.native_timestamp_text(instant);
 RETURN instant;
END $$;
REVOKE ALL ON FUNCTION stock_operational.native_timestamp_text(timestamptz),stock_operational.native_timestamp_input(text) FROM PUBLIC,anon,authenticated;
-- Preserve existing mapper callers' capabilities, without granting a role,
-- granting business writes, exposing data or changing existing function ACLs.
DO $callers$
DECLARE item record;
BEGIN
 FOR item IN SELECT DISTINCT pg_get_userbyid(a.grantee) AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname='stock_operational' AND (p.proname LIKE 'input\_%' ESCAPE '\' OR p.proname LIKE 'project\_%' ESCAPE '\') AND a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.native_timestamp_text(timestamptz) TO %I',item.name);
 END LOOP;
 FOR item IN SELECT DISTINCT pg_get_userbyid(a.grantee) AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname='stock_operational' AND p.proname LIKE 'input\_%' ESCAPE '\' AND a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.native_timestamp_input(text) TO %I',item.name);
 END LOOP;
END $callers$;
-- Check every active AND archived value first. Invalid/ambiguous nonempty text
-- aborts the whole transaction; blanks remain NULL, and time precision is kept.
DO $values$
DECLARE item record; actual regtype; bad boolean;
BEGIN
 FOR item IN SELECT * FROM (VALUES ('orders','createdAt',5),('orders','updatedAt',6),('orders','deletedAt',7),('order_items','createdAt',6),('order_items','updatedAt',7),('order_items','deletedAt',8),('order_bills','createdAt',3),('order_bills','updatedAt',4),('order_bills','deletedAt',5),('shipments','createdAt',8),('shipments','updatedAt',9),('shipments','deletedAt',10),('shipment_orders','createdAt',3),('shipment_orders','updatedAt',4),('shipment_orders','deletedAt',5),('employees','createdAt',6),('employees','updatedAt',7),('employee_compensations','createdAt',3),('employee_compensations','updatedAt',4),('employee_timesheets','createdAt',4),('employee_timesheets','updatedAt',5),('employee_advances','createdAt',11),('employee_advances','updatedAt',12),('payroll_settlements','createdAt',5),('expenses','createdAt',9),('expenses','updatedAt',10),('expenses','deletedAt',12),('expense_categories','createdAt',3),('expense_categories','updatedAt',4),('shops','createdAt',4),('shops','updatedAt',5),('sales_receipts','createdAt',9),('sales_receipts','updatedAt',10),('sales_receipt_items','createdAt',NULL),('sales_receipt_payments','createdAt',NULL),('sales_receipt_syncs','createdAt',NULL),('sales_profit_cost_overrides','createdAt',5),('sales_profit_cost_overrides','updatedAt',6),('stock_counts','createdAt',NULL),('stock_counts','updatedAt',7),('stock_adjustments','createdAt',14),('movements','createdAt',6),('movements','updatedAt',7),('movement_details','createdAt',10),('movement_details','updatedAt',11),('user_state','createdAt',5),('user_state','updatedAt',6)) f(name,column_name,cell_index) LOOP
  SELECT atttypid::regtype INTO STRICT actual FROM pg_attribute WHERE attrelid=('stock_operational.'||item.name)::regclass AND attname=item.column_name AND NOT attisdropped;
  IF actual<>'text'::regtype THEN RAISE EXCEPTION 'Unexpected predecessor timestamp type'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT FROM stock_operational.%I WHERE %I IS NOT NULL AND %I<>'''' AND stock_operational.created_at_timestamp(%I) IS NULL)',item.name,item.column_name,item.column_name,item.column_name) INTO bad;
  IF bad THEN RAISE EXCEPTION 'Unconvertible timestamp in %.%; inspect privately, never coerce to NULL',item.name,item.column_name; END IF;
  EXECUTE format('SELECT count(stock_operational.native_timestamp_text(stock_operational.native_timestamp_input(%I))) FROM stock_operational.%I',item.column_name,item.name);
 END LOOP;
END $values$;
DROP TRIGGER b_created_at_instant ON stock_operational.orders;
DROP TRIGGER b_created_at_instant ON stock_operational.order_items;
DROP TRIGGER b_created_at_instant ON stock_operational.order_bills;
DROP TRIGGER b_created_at_instant ON stock_operational.shipments;
DROP TRIGGER b_created_at_instant ON stock_operational.shipment_orders;
DROP TRIGGER b_created_at_instant ON stock_operational.employees;
DROP TRIGGER b_created_at_instant ON stock_operational.employee_compensations;
DROP TRIGGER b_created_at_instant ON stock_operational.employee_timesheets;
DROP TRIGGER b_created_at_instant ON stock_operational.employee_advances;
DROP TRIGGER b_created_at_instant ON stock_operational.payroll_settlements;
DROP TRIGGER b_created_at_instant ON stock_operational.expenses;
DROP TRIGGER b_created_at_instant ON stock_operational.expense_categories;
DROP TRIGGER b_created_at_instant ON stock_operational.shops;
DROP TRIGGER b_created_at_instant ON stock_operational.sales_receipts;
DROP TRIGGER b_created_at_instant ON stock_operational.sales_receipt_items;
DROP TRIGGER b_created_at_instant ON stock_operational.sales_receipt_payments;
DROP TRIGGER b_created_at_instant ON stock_operational.sales_receipt_syncs;
DROP TRIGGER b_created_at_instant ON stock_operational.sales_profit_cost_overrides;
DROP TRIGGER b_created_at_instant ON stock_operational.stock_counts;
DROP TRIGGER b_created_at_instant ON stock_operational.stock_adjustments;
DROP TRIGGER b_created_at_instant ON stock_operational.movements;
DROP TRIGGER b_created_at_instant ON stock_operational.movement_details;
DROP TRIGGER b_created_at_instant ON stock_operational.user_state;
ALTER TABLE stock_operational.orders ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.order_items ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.order_bills ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.shipments ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.shipment_orders ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.employees ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.employee_compensations ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.employee_timesheets ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.employee_advances ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.payroll_settlements ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt");
ALTER TABLE stock_operational.expenses ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt"),ALTER COLUMN "deletedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("deletedAt");
ALTER TABLE stock_operational.expense_categories ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.shops ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.sales_receipts ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.sales_receipt_items ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE stock_operational.sales_receipt_items ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt");
ALTER TABLE stock_operational.sales_receipt_items ALTER COLUMN "createdAt" SET DEFAULT statement_timestamp();
ALTER TABLE stock_operational.sales_receipt_payments ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE stock_operational.sales_receipt_payments ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt");
ALTER TABLE stock_operational.sales_receipt_payments ALTER COLUMN "createdAt" SET DEFAULT statement_timestamp();
ALTER TABLE stock_operational.sales_receipt_syncs ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE stock_operational.sales_receipt_syncs ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt");
ALTER TABLE stock_operational.sales_receipt_syncs ALTER COLUMN "createdAt" SET DEFAULT statement_timestamp();
ALTER TABLE stock_operational.sales_profit_cost_overrides ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.stock_counts ALTER COLUMN "createdAt" DROP DEFAULT;
ALTER TABLE stock_operational.stock_counts ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.stock_counts ALTER COLUMN "createdAt" SET DEFAULT statement_timestamp();
ALTER TABLE stock_operational.stock_adjustments ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt");
ALTER TABLE stock_operational.movements ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.movement_details ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
ALTER TABLE stock_operational.user_state ALTER COLUMN "createdAt" TYPE timestamptz USING stock_operational.native_timestamp_input("createdAt"),ALTER COLUMN "updatedAt" TYPE timestamptz USING stock_operational.native_timestamp_input("updatedAt");
DO $mappers$
DECLARE item record; field record; signature text; definition text; replacement text; old_fragment text; new_fragment text;
BEGIN
 FOR item IN SELECT unnest(ARRAY['orders','order_items','order_bills','shipments','shipment_orders','employees','employee_compensations','employee_timesheets','employee_advances','payroll_settlements','expenses','expense_categories','shops','sales_receipts','sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','sales_profit_cost_overrides','stock_counts','stock_adjustments','movements','movement_details','user_state']) AS name LOOP
  FOREACH signature IN ARRAY ARRAY['input_'||item.name||'(jsonb)','project_'||item.name||'(stock_operational.'||item.name||')','validate_'||item.name||'()'] LOOP
   SELECT pg_get_functiondef(to_regprocedure('stock_operational.'||signature)) INTO STRICT definition;
   replacement:=definition;
   FOR field IN SELECT * FROM (VALUES ('orders','createdAt',5),('orders','updatedAt',6),('orders','deletedAt',7),('order_items','createdAt',6),('order_items','updatedAt',7),('order_items','deletedAt',8),('order_bills','createdAt',3),('order_bills','updatedAt',4),('order_bills','deletedAt',5),('shipments','createdAt',8),('shipments','updatedAt',9),('shipments','deletedAt',10),('shipment_orders','createdAt',3),('shipment_orders','updatedAt',4),('shipment_orders','deletedAt',5),('employees','createdAt',6),('employees','updatedAt',7),('employee_compensations','createdAt',3),('employee_compensations','updatedAt',4),('employee_timesheets','createdAt',4),('employee_timesheets','updatedAt',5),('employee_advances','createdAt',11),('employee_advances','updatedAt',12),('payroll_settlements','createdAt',5),('expenses','createdAt',9),('expenses','updatedAt',10),('expenses','deletedAt',12),('expense_categories','createdAt',3),('expense_categories','updatedAt',4),('shops','createdAt',4),('shops','updatedAt',5),('sales_receipts','createdAt',9),('sales_receipts','updatedAt',10),('sales_receipt_items','createdAt',NULL),('sales_receipt_payments','createdAt',NULL),('sales_receipt_syncs','createdAt',NULL),('sales_profit_cost_overrides','createdAt',5),('sales_profit_cost_overrides','updatedAt',6),('stock_counts','createdAt',NULL),('stock_counts','updatedAt',7),('stock_adjustments','createdAt',14),('movements','createdAt',6),('movements','updatedAt',7),('movement_details','createdAt',10),('movement_details','updatedAt',11),('user_state','createdAt',5),('user_state','updatedAt',6)) f(name,column_name,cell_index) WHERE name=item.name AND cell_index IS NOT NULL LOOP
    IF signature LIKE 'input\_%' ESCAPE '\' THEN
     old_fragment:=format('r.%I := nullif((cells->>%s),'''')::text;',field.column_name,field.cell_index);
     -- pg_get_functiondef retains quoted camelCase identifiers in the body.
     new_fragment:=format('r.%I := stock_operational.native_timestamp_input(cells->>%s);',field.column_name,field.cell_index);
    ELSIF signature LIKE 'project\_%' ESCAPE '\' THEN
     old_fragment:=format('to_jsonb(r.%I)',field.column_name);
     new_fragment:=format('to_jsonb(stock_operational.native_timestamp_text(r.%I))',field.column_name);
    ELSE
     old_fragment:=format('NEW.%I := nullif(NEW.%I,'''');',field.column_name,field.column_name);
     new_fragment:=format('PERFORM stock_operational.native_timestamp_text(NEW.%I);',field.column_name);
    END IF;
    IF (length(replacement)-length(replace(replacement,old_fragment,'')))/length(old_fragment)<>1 THEN RAISE EXCEPTION 'Unexpected timestamp mapper fragment'; END IF;
    replacement:=replace(replacement,old_fragment,new_fragment);
   END LOOP;
   IF signature LIKE 'validate\_%' ESCAPE '\' AND item.name IN ('sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','stock_counts') THEN
    replacement:=replace(replacement,'PERFORM stock_operational.project_'||item.name||'(NEW);','PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_'||item.name||'(NEW);');
   END IF;
   EXECUTE replacement;
  END LOOP;
 END LOOP;
END $mappers$;
ALTER TABLE stock_operational.orders DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.order_items DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.order_bills DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.shipments DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.shipment_orders DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.employees DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.employee_timesheets DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.employee_advances DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.payroll_settlements DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.expenses DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.expense_categories DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.shops DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.sales_profit_cost_overrides DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.stock_counts DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.stock_adjustments DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.movements DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN created_at_instant RESTRICT;
ALTER TABLE stock_operational.user_state DROP COLUMN created_at_instant RESTRICT;
DROP FUNCTION stock_operational.set_created_at_instant() RESTRICT;
SELECT 1 / (NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant'))::int;
SELECT 1 / ((SELECT count(*)=47 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'))::int;
COMMIT;
