-- OPERATOR ONLY: additive compatibility; every cell_kinds column remains.
-- Deployable code also supports the unprepared schema. No normalization approved.
-- Private data review and final removal require separate authorization.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_cell_kinds_compatibility',true)='reviewed-per-column-compatibility-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / ((SELECT count(*)=23 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND a.atttypid='text'::regtype))::int;
SELECT 1 / (to_regprocedure('stock_operational.column_mapping_contract_v1()') IS NULL)::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','34cb69f3eb7a4ee84a883a220ec5283a'),('project_orders(stock_operational.orders)','6a7f41b2d41c5a864f8d2cb0552df6a2'),('validate_orders()','6ef1229e7e3e3add3a20a129b4ff8f34'),('input_order_items(jsonb)','1eb764c973bf4702b7f6a50f97003e25'),('project_order_items(stock_operational.order_items)','03ae4676dfc4bc16161a6b58bb11bd14'),('validate_order_items()','91491fa7646b3638cd9f01fe96efab01'),('input_order_bills(jsonb)','e72fd055aac8654d5745c67816ae251b'),('project_order_bills(stock_operational.order_bills)','9932e74af9fb5fe960dc29d1de7f69a7'),('validate_order_bills()','08077e621013916cc5a1320f5554422f'),('input_shipments(jsonb)','e5a2bd88c5109116c3e5e7d9fc1ff37b'),('project_shipments(stock_operational.shipments)','e4fc1121fa5606246c6af79c83f97531'),('validate_shipments()','d04a0df34d5bc10c5a3fdd1b3bd3ad76'),('input_shipment_orders(jsonb)','14c2e20f157fc65f348d961c6deb6e15'),('project_shipment_orders(stock_operational.shipment_orders)','48a655b66a5f7f5baa8b81ee44b5a519'),('validate_shipment_orders()','8ba6208b66026b17be9c1b1bb3695a5a'),('input_employees(jsonb)','c9371069e67edb806961aaea2e051415'),('project_employees(stock_operational.employees)','986fbc18440682e1d646b2d6195e6b24'),('validate_employees()','4a0219a633cfa2f9c93ef0e0f9379ba0'),('input_employee_compensations(jsonb)','95ed4149c28750942e290405f8fecb96'),('project_employee_compensations(stock_operational.employee_compensations)','962ad8435150cc79d979db806820222c'),('validate_employee_compensations()','90def57aa8e02425da3b0f85497683c1'),('input_employee_timesheets(jsonb)','ac17974340a32ec058ddb0b1daceeb3d'),('project_employee_timesheets(stock_operational.employee_timesheets)','1d9197a5cdca11a6c23a5c524794fbc6'),('validate_employee_timesheets()','7f2f1670462c0bb6a9d4110b3991dee2'),('input_employee_advances(jsonb)','c7dce3c7c35b31c83cd38aac6bced94c'),('project_employee_advances(stock_operational.employee_advances)','1081154c177e66a6135db14f132d0392'),('validate_employee_advances()','0a15fdd0f505a0054969e95432eb5215'),('input_payroll_settlements(jsonb)','2b60fa2d1b5b218e5392c356abc313e3'),('project_payroll_settlements(stock_operational.payroll_settlements)','32ba53cbe0ad0bb7b89b128554072576'),('validate_payroll_settlements()','d9ed836fec8a004ed3d263ebda3ff922'),('input_expenses(jsonb)','1babb669ec9dd8cbfcc5fd81256038fe'),('project_expenses(stock_operational.expenses)','c5a4bd8a47775998404ce6d90fb608c7'),('validate_expenses()','70e5d0b399d69030ed4a3012afe73195'),('input_expense_categories(jsonb)','cd2bae2b0838a1226ecf5b47d5d2fd80'),('project_expense_categories(stock_operational.expense_categories)','554f3816a38b634dfc7e3298a3fba799'),('validate_expense_categories()','85c0efb05a2eb752364237b2358eb349'),('input_shops(jsonb)','774244579b1fbafbc1e5f639f0c9b3db'),('project_shops(stock_operational.shops)','359344d0f24788084e1d1c660fd24f8e'),('validate_shops()','4eeca1ffd101d966afb3e18ff7ae7b39'),('input_sales_receipts(jsonb)','2fd985788543024daa2f7db42272ecdc'),('project_sales_receipts(stock_operational.sales_receipts)','150f69bd14c6ef6d95e3415f7833f0f0'),('validate_sales_receipts()','c2cbe6446d7b37699b8bf6c9e300254c'),('input_sales_receipt_items(jsonb)','543194b8dbd7046c82f8dcb6194e7104'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','d95880392b392a81bb9d9738816a51f7'),('validate_sales_receipt_items()','4daa5f9476d56bffa4968af73dc37822'),('input_sales_receipt_payments(jsonb)','d8114668797aaaa4a4e2d047fcbb0656'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','2a714e26c41b250fe6cc970c9cb40ee7'),('validate_sales_receipt_payments()','d47cafad9303fe28e2821a1d38d4750d'),('input_sales_receipt_syncs(jsonb)','c6ebc3d2f2154c463b99d2d045d9d4c4'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7b951d44b0738ae4fbc3c7020ec1e3ae'),('validate_sales_receipt_syncs()','1872bd8686848194416a277015ac5a2f'),('input_sales_profit_cost_overrides(jsonb)','5193bb5561253c6ae3d88e392ac974b4'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','44dc7bf1629fe22fa86fede7f18799e3'),('validate_sales_profit_cost_overrides()','b11d1e7290658e3fb5a6a4d08b61fe55'),('input_stock_counts(jsonb)','713a64e36b2beb85e83e53ed925f2ead'),('project_stock_counts(stock_operational.stock_counts)','d0b5cf3fd21672cb189a9db44198c3d2'),('validate_stock_counts()','b8794ccf34da0dd43a7d25e429810700'),('input_stock_adjustments(jsonb)','82c0fa38e2eb7834e0631075b7163880'),('project_stock_adjustments(stock_operational.stock_adjustments)','144abbfc09777e02c19075695233c0b9'),('validate_stock_adjustments()','f8b0d91248d27dc20c3ad1cf008a92f7'),('input_movements(jsonb)','be211ac43589ff5b15b81e81f5ba98fd'),('project_movements(stock_operational.movements)','6fe71670d5edc3ede7078aa035d47d8e'),('validate_movements()','f90b159b1c8aab198dea6fd8babcb14d'),('input_movement_details(jsonb)','bfcc90189bd3d5de4135103f3158a30c'),('project_movement_details(stock_operational.movement_details)','6a359840cb06d0d808738c5870bd0009'),('validate_movement_details()','eb6f28a135ce66de7b82b7823659e2b4'),('input_user_state(jsonb)','92d4b0dbaec1a1e8e5be4c9e24914796'),('project_user_state(stock_operational.user_state)','cf3eb231bdd2059f91fec39b808a0313'),('validate_user_state()','a9f543afe663547bab79f0ec9fa62031'),('native_timestamp_input(text)','5555bc26987e15a622b9b50797caefa6'),('native_timestamp_text(timestamptz)','5ad1f4189fa453fedf54eb9dfe7b5e0e'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7'),('cell_projection(jsonb,text,text,text)','02b242473ff302e3100dbbfe65645f7b')) e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed mapping predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
CREATE FUNCTION stock_operational.column_numeric_v1(value numeric,lexeme text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF lexeme IS NOT NULL THEN
  IF to_jsonb(lexeme::numeric) IS DISTINCT FROM nullif(to_jsonb(value),'null'::jsonb) THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
  RETURN to_jsonb(lexeme);
 END IF;
 RETURN coalesce(to_jsonb(value),'""'::jsonb);
END $$;
CREATE FUNCTION stock_operational.column_bigint_v1(value bigint,lexeme text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF lexeme IS NOT NULL THEN
  IF to_jsonb(lexeme::bigint) IS DISTINCT FROM nullif(to_jsonb(value),'null'::jsonb) THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
  RETURN to_jsonb(lexeme);
 END IF;
 RETURN coalesce(to_jsonb(value),'""'::jsonb);
END $$;
CREATE FUNCTION stock_operational.column_boolean_v1(value boolean,lexeme text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF lexeme IS NOT NULL THEN
  IF to_jsonb(lexeme::boolean) IS DISTINCT FROM nullif(to_jsonb(value),'null'::jsonb) THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
  RETURN to_jsonb(lexeme);
 END IF;
 RETURN coalesce(to_jsonb(value),'""'::jsonb);
END $$;
CREATE FUNCTION stock_operational.column_jsonb_v1(value jsonb,lexeme text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF lexeme IS NOT NULL THEN
  IF to_jsonb(nullif(lexeme::jsonb,'null'::jsonb)) IS DISTINCT FROM nullif(to_jsonb(value),'null'::jsonb) THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
  RETURN to_jsonb(lexeme);
 END IF;
 RETURN to_jsonb(coalesce(nullif(value,'null'::jsonb)::text,''));
END $$;
CREATE FUNCTION stock_operational.column_project_orders(r stock_operational.orders) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."seller",'')),
 stock_operational.column_numeric_v1(r."totalPrice",r."totalPrice__lexeme"),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_orders(cells jsonb) RETURNS stock_operational.orders
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.orders; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."status" := nullif((cells->>1),'')::text;
r."seller" := nullif((cells->>2),'')::text;
r."totalPrice" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."totalPrice__lexeme" := (cells->>3); END IF;
r."remark" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>7);
r."createdBy" := nullif((cells->>8),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_orders(r stock_operational.orders) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_orders(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || CASE WHEN r."totalPrice__lexeme" IS NOT NULL OR r."totalPrice" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',9)) THEN
  RETURN stock_operational.column_project_orders(r);
 END IF;
 RETURN stock_operational.project_orders(r);
END $$;
CREATE FUNCTION stock_operational.column_project_order_items(r stock_operational.order_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(r."imageUrl",'')),
 stock_operational.column_numeric_v1(r."quoteQuantity",r."quoteQuantity__lexeme"),
 stock_operational.column_numeric_v1(r."deliveredQuantity",r."deliveredQuantity__lexeme"),
 to_jsonb(coalesce(r."productCode",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_order_items(cells jsonb) RETURNS stock_operational.order_items
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.order_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."orderId" := nullif((cells->>1),'')::text;
r."imageUrl" := nullif((cells->>2),'')::text;
r."quoteQuantity" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."quoteQuantity__lexeme" := (cells->>3); END IF;
r."deliveredQuantity" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."deliveredQuantity__lexeme" := (cells->>4); END IF;
r."productCode" := nullif((cells->>5),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>8);
r."createdBy" := nullif((cells->>9),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_order_items(r stock_operational.order_items) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_order_items(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || CASE WHEN r."quoteQuantity__lexeme" IS NOT NULL OR r."quoteQuantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."deliveredQuantity__lexeme" IS NOT NULL OR r."deliveredQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',10)) THEN
  RETURN stock_operational.column_project_order_items(r);
 END IF;
 RETURN stock_operational.project_order_items(r);
END $$;
CREATE FUNCTION stock_operational.column_project_order_bills(r stock_operational.order_bills) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(r."imageUrl",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_order_bills(cells jsonb) RETURNS stock_operational.order_bills
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.order_bills; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."orderId" := nullif((cells->>1),'')::text;
r."imageUrl" := nullif((cells->>2),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>5);
r."createdBy" := nullif((cells->>6),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_order_bills(r stock_operational.order_bills) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_order_bills(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',7)) THEN
  RETURN stock_operational.column_project_order_bills(r);
 END IF;
 RETURN stock_operational.project_order_bills(r);
END $$;
CREATE FUNCTION stock_operational.column_project_shipments(r stock_operational.shipments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."carrier",'')),
 to_jsonb(coalesce(r."poNumber",'')),
 stock_operational.column_numeric_v1(r."shippingFee",r."shippingFee__lexeme"),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(r."shippedAt",'')),
 to_jsonb(coalesce(r."deliveredAt",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 to_jsonb(coalesce(r."shippingBillUrl",'')));
$$;
CREATE FUNCTION stock_operational.column_input_shipments(cells jsonb) RETURNS stock_operational.shipments
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shipments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."status" := nullif((cells->>1),'')::text;
r."carrier" := nullif((cells->>2),'')::text;
r."poNumber" := nullif((cells->>3),'')::text;
r."shippingFee" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."shippingFee__lexeme" := (cells->>4); END IF;
r."remark" := nullif((cells->>5),'')::text;
r."shippedAt" := nullif((cells->>6),'')::text;
r."deliveredAt" := nullif((cells->>7),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>8);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>9);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'')::text;
r."shippingBillUrl" := nullif((cells->>12),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_shipments(r stock_operational.shipments) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_shipments(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || CASE WHEN r."shippingFee__lexeme" IS NOT NULL OR r."shippingFee" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',13)) THEN
  RETURN stock_operational.column_project_shipments(r);
 END IF;
 RETURN stock_operational.project_shipments(r);
END $$;
CREATE FUNCTION stock_operational.column_project_shipment_orders(r stock_operational.shipment_orders) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."shipmentId",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_shipment_orders(cells jsonb) RETURNS stock_operational.shipment_orders
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shipment_orders; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."shipmentId" := nullif((cells->>1),'')::text;
r."orderId" := nullif((cells->>2),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>5);
r."createdBy" := nullif((cells->>6),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_shipment_orders(r stock_operational.shipment_orders) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_shipment_orders(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',7)) THEN
  RETURN stock_operational.column_project_shipment_orders(r);
 END IF;
 RETURN stock_operational.project_shipment_orders(r);
END $$;
CREATE FUNCTION stock_operational.column_project_employees(r stock_operational.employees) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."name",'')),
 to_jsonb(coalesce(r."phone",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."hiredDate",'')),
 to_jsonb(coalesce(r."terminatedDate",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_employees(cells jsonb) RETURNS stock_operational.employees
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employees; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."name" := nullif((cells->>1),'')::text;
r."phone" := nullif((cells->>2),'')::text;
r."status" := nullif((cells->>3),'')::text;
r."hiredDate" := nullif((cells->>4),'')::text;
r."terminatedDate" := nullif((cells->>5),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."createdBy" := nullif((cells->>8),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_employees(r stock_operational.employees) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_employees(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',9)) THEN
  RETURN stock_operational.column_project_employees(r);
 END IF;
 RETURN stock_operational.project_employees(r);
END $$;
CREATE FUNCTION stock_operational.column_project_employee_compensations(r stock_operational.employee_compensations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."employeeId",'')),
 stock_operational.column_numeric_v1(r."baseSalary",r."baseSalary__lexeme"),
 stock_operational.column_numeric_v1(r."commission",r."commission__lexeme"),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."updatedBy",'')),
 to_jsonb(coalesce(r."effectiveFrom",'')),
 to_jsonb(coalesce(r."compensationType",'')),
 to_jsonb(coalesce(r."commissionType",'')),
 stock_operational.column_numeric_v1(r."commissionBucketSales",r."commissionBucketSales__lexeme"),
 stock_operational.column_numeric_v1(r."commissionBucketAmount",r."commissionBucketAmount__lexeme"),
 stock_operational.column_numeric_v1(r."commissionRoundupThreshold",r."commissionRoundupThreshold__lexeme"));
$$;
CREATE FUNCTION stock_operational.column_input_employee_compensations(cells jsonb) RETURNS stock_operational.employee_compensations
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_compensations; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>12 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."employeeId" := nullif((cells->>0),'')::text;
r."baseSalary" := nullif((cells->>1),'')::numeric;
IF jsonb_typeof((cells->1))='string' AND (cells->>1)<>'' THEN r."baseSalary__lexeme" := (cells->>1); END IF;
r."commission" := nullif((cells->>2),'')::numeric;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."commission__lexeme" := (cells->>2); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedBy" := nullif((cells->>5),'')::text;
r."effectiveFrom" := nullif((cells->>6),'')::text;
r."compensationType" := nullif((cells->>7),'')::text;
r."commissionType" := nullif((cells->>8),'')::text;
r."commissionBucketSales" := nullif((cells->>9),'')::numeric;
IF jsonb_typeof((cells->9))='string' AND (cells->>9)<>'' THEN r."commissionBucketSales__lexeme" := (cells->>9); END IF;
r."commissionBucketAmount" := nullif((cells->>10),'')::numeric;
IF jsonb_typeof((cells->10))='string' AND (cells->>10)<>'' THEN r."commissionBucketAmount__lexeme" := (cells->>10); END IF;
r."commissionRoundupThreshold" := nullif((cells->>11),'')::numeric;
IF jsonb_typeof((cells->11))='string' AND (cells->>11)<>'' THEN r."commissionRoundupThreshold__lexeme" := (cells->>11); END IF;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_employee_compensations(r stock_operational.employee_compensations) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_employee_compensations(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || CASE WHEN r."baseSalary__lexeme" IS NOT NULL OR r."baseSalary" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."commission__lexeme" IS NOT NULL OR r."commission" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."commissionBucketSales__lexeme" IS NOT NULL OR r."commissionBucketSales" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."commissionBucketAmount__lexeme" IS NOT NULL OR r."commissionBucketAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."commissionRoundupThreshold__lexeme" IS NOT NULL OR r."commissionRoundupThreshold" IS NULL THEN 's' ELSE 'n' END;
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',12)) THEN
  RETURN stock_operational.column_project_employee_compensations(r);
 END IF;
 RETURN stock_operational.project_employee_compensations(r);
END $$;
CREATE FUNCTION stock_operational.column_project_employee_timesheets(r stock_operational.employee_timesheets) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."workdayType",'')));
$$;
CREATE FUNCTION stock_operational.column_input_employee_timesheets(cells jsonb) RETURNS stock_operational.employee_timesheets
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_timesheets; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."employeeId" := nullif((cells->>1),'')::text;
r."shopId" := nullif((cells->>2),'')::text;
r."status" := nullif((cells->>3),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>5);
r."workdayType" := nullif((cells->>6),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_employee_timesheets(r stock_operational.employee_timesheets) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_employee_timesheets(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',7)) THEN
  RETURN stock_operational.column_project_employee_timesheets(r);
 END IF;
 RETURN stock_operational.project_employee_timesheets(r);
END $$;
CREATE FUNCTION stock_operational.column_project_employee_advances(r stock_operational.employee_advances) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."requestedDate",'')),
 to_jsonb(coalesce(r."payrollMonth",'')),
 stock_operational.column_numeric_v1(r."requestedAmount",r."requestedAmount__lexeme"),
 stock_operational.column_numeric_v1(r."paidAmount",r."paidAmount__lexeme"),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."paidDate",'')),
 to_jsonb(coalesce(r."reference",'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.column_input_employee_advances(cells jsonb) RETURNS stock_operational.employee_advances
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_advances; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."employeeId" := nullif((cells->>1),'')::text;
r."shopId" := nullif((cells->>2),'')::text;
r."requestedDate" := nullif((cells->>3),'')::text;
r."payrollMonth" := nullif((cells->>4),'')::text;
r."requestedAmount" := nullif((cells->>5),'')::numeric;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."requestedAmount__lexeme" := (cells->>5); END IF;
r."paidAmount" := nullif((cells->>6),'')::numeric;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."paidAmount__lexeme" := (cells->>6); END IF;
r."status" := nullif((cells->>7),'')::text;
r."paidDate" := nullif((cells->>8),'')::text;
r."reference" := nullif((cells->>9),'')::text;
r."note" := nullif((cells->>10),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>11);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>12);
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_employee_advances(r stock_operational.employee_advances) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_employee_advances(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || CASE WHEN r."requestedAmount__lexeme" IS NOT NULL OR r."requestedAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."paidAmount__lexeme" IS NOT NULL OR r."paidAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',13)) THEN
  RETURN stock_operational.column_project_employee_advances(r);
 END IF;
 RETURN stock_operational.project_employee_advances(r);
END $$;
CREATE FUNCTION stock_operational.column_project_payroll_settlements(r stock_operational.payroll_settlements) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."paidDate",'')),
 to_jsonb(coalesce(r."reference",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 stock_operational.column_jsonb_v1(r."snapshot",r."snapshot__lexeme"));
$$;
CREATE FUNCTION stock_operational.column_input_payroll_settlements(cells jsonb) RETURNS stock_operational.payroll_settlements
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.payroll_settlements; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."employeeId" := nullif((cells->>1),'')::text;
r."month" := nullif((cells->>2),'')::text;
r."paidDate" := nullif((cells->>3),'')::text;
r."reference" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."snapshot" := nullif(nullif((cells->>6),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."snapshot__lexeme" := (cells->>6); END IF;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_payroll_settlements(r stock_operational.payroll_settlements) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_payroll_settlements(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',7)) THEN
  RETURN stock_operational.column_project_payroll_settlements(r);
 END IF;
 RETURN stock_operational.project_payroll_settlements(r);
END $$;
CREATE FUNCTION stock_operational.column_project_expenses(r stock_operational.expenses) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."expenseDate",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."scope",'')),
 to_jsonb(coalesce(r."categoryId",'')),
 to_jsonb(coalesce(r."name",'')),
 stock_operational.column_numeric_v1(r."amount",r."amount__lexeme"),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')));
$$;
CREATE FUNCTION stock_operational.column_input_expenses(cells jsonb) RETURNS stock_operational.expenses
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.expenses; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."month" := nullif((cells->>1),'')::text;
r."expenseDate" := nullif((cells->>2),'')::text;
r."shopId" := nullif((cells->>3),'')::text;
r."scope" := nullif((cells->>4),'')::text;
r."categoryId" := nullif((cells->>5),'')::text;
r."name" := nullif((cells->>6),'')::text;
r."amount" := nullif((cells->>7),'')::numeric;
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."amount__lexeme" := (cells->>7); END IF;
r."note" := nullif((cells->>8),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>9);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'')::text;
r."deletedAt" := stock_operational.native_timestamp_input(cells->>12);
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_expenses(r stock_operational.expenses) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_expenses(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."amount__lexeme" IS NOT NULL OR r."amount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',13)) THEN
  RETURN stock_operational.column_project_expenses(r);
 END IF;
 RETURN stock_operational.project_expenses(r);
END $$;
CREATE FUNCTION stock_operational.column_project_expense_categories(r stock_operational.expense_categories) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."name",'')),
 stock_operational.column_boolean_v1(r."active",r."active__lexeme"),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.column_input_expense_categories(cells jsonb) RETURNS stock_operational.expense_categories
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.expense_categories; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>5 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."name" := nullif((cells->>1),'')::text;
r."active" := nullif((cells->>2),'')::boolean;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."active__lexeme" := (cells->>2); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_expense_categories(r stock_operational.expense_categories) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_expense_categories(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || CASE WHEN r."active__lexeme" IS NOT NULL OR r."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',5)) THEN
  RETURN stock_operational.column_project_expense_categories(r);
 END IF;
 RETURN stock_operational.project_expense_categories(r);
END $$;
CREATE FUNCTION stock_operational.column_project_shops(r stock_operational.shops) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."name",'')),
 stock_operational.column_boolean_v1(r."active",r."active__lexeme"),
 to_jsonb(coalesce(r."loyverseAccountId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.column_input_shops(cells jsonb) RETURNS stock_operational.shops
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shops; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>6 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."name" := nullif((cells->>1),'')::text;
r."active" := nullif((cells->>2),'')::boolean;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."active__lexeme" := (cells->>2); END IF;
r."loyverseAccountId" := nullif((cells->>3),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>5);
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_shops(r stock_operational.shops) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_shops(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || CASE WHEN r."active__lexeme" IS NOT NULL OR r."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',6)) THEN
  RETURN stock_operational.column_project_shops(r);
 END IF;
 RETURN stock_operational.project_shops(r);
END $$;
CREATE FUNCTION stock_operational.column_project_sales_receipts(r stock_operational.sales_receipts) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."salesDate",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."receiptNumber",'')),
 to_jsonb(coalesce(r."receiptType",'')),
 to_jsonb(coalesce(r."refundFor",'')),
 to_jsonb(coalesce(r."order",'')),
 to_jsonb(coalesce(r."receiptDate",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."cancelledAt",'')),
 to_jsonb(coalesce(r."source",'')),
 to_jsonb(coalesce(r."storeId",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."customerId",'')),
 to_jsonb(coalesce(r."posDeviceId",'')),
 to_jsonb(coalesce(r."diningOption",'')),
 stock_operational.column_numeric_v1(r."totalMoney",r."totalMoney__lexeme"),
 stock_operational.column_numeric_v1(r."totalTax",r."totalTax__lexeme"),
 stock_operational.column_numeric_v1(r."totalDiscount",r."totalDiscount__lexeme"),
 stock_operational.column_numeric_v1(r."tip",r."tip__lexeme"),
 stock_operational.column_numeric_v1(r."surcharge",r."surcharge__lexeme"),
 stock_operational.column_numeric_v1(r."pointsEarned",r."pointsEarned__lexeme"),
 stock_operational.column_numeric_v1(r."pointsDeducted",r."pointsDeducted__lexeme"),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.column_input_sales_receipts(cells jsonb) RETURNS stock_operational.sales_receipts
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipts; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>26 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."salesDate" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."shopName" := nullif((cells->>3),'')::text;
r."receiptNumber" := nullif((cells->>4),'')::text;
r."receiptType" := nullif((cells->>5),'')::text;
r."refundFor" := nullif((cells->>6),'')::text;
r."order" := nullif((cells->>7),'')::text;
r."receiptDate" := nullif((cells->>8),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>9);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>10);
r."cancelledAt" := nullif((cells->>11),'')::text;
r."source" := nullif((cells->>12),'')::text;
r."storeId" := nullif((cells->>13),'')::text;
r."employeeId" := nullif((cells->>14),'')::text;
r."customerId" := nullif((cells->>15),'')::text;
r."posDeviceId" := nullif((cells->>16),'')::text;
r."diningOption" := nullif((cells->>17),'')::text;
r."totalMoney" := nullif((cells->>18),'')::numeric;
IF jsonb_typeof((cells->18))='string' AND (cells->>18)<>'' THEN r."totalMoney__lexeme" := (cells->>18); END IF;
r."totalTax" := nullif((cells->>19),'')::numeric;
IF jsonb_typeof((cells->19))='string' AND (cells->>19)<>'' THEN r."totalTax__lexeme" := (cells->>19); END IF;
r."totalDiscount" := nullif((cells->>20),'')::numeric;
IF jsonb_typeof((cells->20))='string' AND (cells->>20)<>'' THEN r."totalDiscount__lexeme" := (cells->>20); END IF;
r."tip" := nullif((cells->>21),'')::numeric;
IF jsonb_typeof((cells->21))='string' AND (cells->>21)<>'' THEN r."tip__lexeme" := (cells->>21); END IF;
r."surcharge" := nullif((cells->>22),'')::numeric;
IF jsonb_typeof((cells->22))='string' AND (cells->>22)<>'' THEN r."surcharge__lexeme" := (cells->>22); END IF;
r."pointsEarned" := nullif((cells->>23),'')::numeric;
IF jsonb_typeof((cells->23))='string' AND (cells->>23)<>'' THEN r."pointsEarned__lexeme" := (cells->>23); END IF;
r."pointsDeducted" := nullif((cells->>24),'')::numeric;
IF jsonb_typeof((cells->24))='string' AND (cells->>24)<>'' THEN r."pointsDeducted__lexeme" := (cells->>24); END IF;
r."syncedAt" := nullif((cells->>25),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_sales_receipts(r stock_operational.sales_receipts) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_sales_receipts(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."totalMoney__lexeme" IS NOT NULL OR r."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."totalTax__lexeme" IS NOT NULL OR r."totalTax" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."totalDiscount__lexeme" IS NOT NULL OR r."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."tip__lexeme" IS NOT NULL OR r."tip" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."surcharge__lexeme" IS NOT NULL OR r."surcharge" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."pointsEarned__lexeme" IS NOT NULL OR r."pointsEarned" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."pointsDeducted__lexeme" IS NOT NULL OR r."pointsDeducted" IS NULL THEN 's' ELSE 'n' END || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',26)) THEN
  RETURN stock_operational.column_project_sales_receipts(r);
 END IF;
 RETURN stock_operational.project_sales_receipts(r);
END $$;
CREATE FUNCTION stock_operational.column_project_sales_receipt_items(r stock_operational.sales_receipt_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."receiptId",'')),
 to_jsonb(coalesce(r."lineItemId",'')),
 to_jsonb(coalesce(r."itemId",'')),
 to_jsonb(coalesce(r."variantId",'')),
 to_jsonb(coalesce(r."itemName",'')),
 to_jsonb(coalesce(r."variantName",'')),
 to_jsonb(coalesce(r."sku",'')),
 stock_operational.column_numeric_v1(r."quantity",r."quantity__lexeme"),
 stock_operational.column_numeric_v1(r."price",r."price__lexeme"),
 stock_operational.column_numeric_v1(r."grossTotalMoney",r."grossTotalMoney__lexeme"),
 stock_operational.column_numeric_v1(r."totalDiscount",r."totalDiscount__lexeme"),
 stock_operational.column_numeric_v1(r."totalMoney",r."totalMoney__lexeme"),
 stock_operational.column_numeric_v1(r."cost",r."cost__lexeme"),
 stock_operational.column_numeric_v1(r."costTotal",r."costTotal__lexeme"),
 stock_operational.column_numeric_v1(r."taxes",r."taxes__lexeme"),
 to_jsonb(coalesce(r."lineNote",'')),
 stock_operational.column_jsonb_v1(r."lineDiscountsJson",r."lineDiscountsJson__lexeme"),
 stock_operational.column_jsonb_v1(r."lineTaxesJson",r."lineTaxesJson__lexeme"),
 stock_operational.column_jsonb_v1(r."lineModifiersJson",r."lineModifiersJson__lexeme"),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.column_input_sales_receipt_items(cells jsonb) RETURNS stock_operational.sales_receipt_items
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>21 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."receiptId" := nullif((cells->>1),'')::text;
r."lineItemId" := nullif((cells->>2),'')::text;
r."itemId" := nullif((cells->>3),'')::text;
r."variantId" := nullif((cells->>4),'')::text;
r."itemName" := nullif((cells->>5),'')::text;
r."variantName" := nullif((cells->>6),'')::text;
r."sku" := nullif((cells->>7),'')::text;
r."quantity" := nullif((cells->>8),'')::numeric;
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."quantity__lexeme" := (cells->>8); END IF;
r."price" := nullif((cells->>9),'')::numeric;
IF jsonb_typeof((cells->9))='string' AND (cells->>9)<>'' THEN r."price__lexeme" := (cells->>9); END IF;
r."grossTotalMoney" := nullif((cells->>10),'')::numeric;
IF jsonb_typeof((cells->10))='string' AND (cells->>10)<>'' THEN r."grossTotalMoney__lexeme" := (cells->>10); END IF;
r."totalDiscount" := nullif((cells->>11),'')::numeric;
IF jsonb_typeof((cells->11))='string' AND (cells->>11)<>'' THEN r."totalDiscount__lexeme" := (cells->>11); END IF;
r."totalMoney" := nullif((cells->>12),'')::numeric;
IF jsonb_typeof((cells->12))='string' AND (cells->>12)<>'' THEN r."totalMoney__lexeme" := (cells->>12); END IF;
r."cost" := nullif((cells->>13),'')::numeric;
IF jsonb_typeof((cells->13))='string' AND (cells->>13)<>'' THEN r."cost__lexeme" := (cells->>13); END IF;
r."costTotal" := nullif((cells->>14),'')::numeric;
IF jsonb_typeof((cells->14))='string' AND (cells->>14)<>'' THEN r."costTotal__lexeme" := (cells->>14); END IF;
r."taxes" := nullif((cells->>15),'')::numeric;
IF jsonb_typeof((cells->15))='string' AND (cells->>15)<>'' THEN r."taxes__lexeme" := (cells->>15); END IF;
r."lineNote" := nullif((cells->>16),'')::text;
r."lineDiscountsJson" := nullif(nullif((cells->>17),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->17))='string' AND (cells->>17)<>'' THEN r."lineDiscountsJson__lexeme" := (cells->>17); END IF;
r."lineTaxesJson" := nullif(nullif((cells->>18),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->18))='string' AND (cells->>18)<>'' THEN r."lineTaxesJson__lexeme" := (cells->>18); END IF;
r."lineModifiersJson" := nullif(nullif((cells->>19),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->19))='string' AND (cells->>19)<>'' THEN r."lineModifiersJson__lexeme" := (cells->>19); END IF;
r."syncedAt" := nullif((cells->>20),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_sales_receipt_items(r stock_operational.sales_receipt_items) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_sales_receipt_items(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."quantity__lexeme" IS NOT NULL OR r."quantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."price__lexeme" IS NOT NULL OR r."price" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."grossTotalMoney__lexeme" IS NOT NULL OR r."grossTotalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."totalDiscount__lexeme" IS NOT NULL OR r."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."totalMoney__lexeme" IS NOT NULL OR r."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."cost__lexeme" IS NOT NULL OR r."cost" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."costTotal__lexeme" IS NOT NULL OR r."costTotal" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."taxes__lexeme" IS NOT NULL OR r."taxes" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',21)) THEN
  RETURN stock_operational.column_project_sales_receipt_items(r);
 END IF;
 RETURN stock_operational.project_sales_receipt_items(r);
END $$;
CREATE FUNCTION stock_operational.column_project_sales_receipt_payments(r stock_operational.sales_receipt_payments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."receiptId",'')),
 stock_operational.column_bigint_v1(r."paymentIndex",r."paymentIndex__lexeme"),
 to_jsonb(coalesce(r."paymentTypeId",'')),
 to_jsonb(coalesce(r."paymentName",'')),
 to_jsonb(coalesce(r."paymentType",'')),
 stock_operational.column_numeric_v1(r."moneyAmount",r."moneyAmount__lexeme"),
 to_jsonb(coalesce(r."paidAt",'')),
 stock_operational.column_jsonb_v1(r."paymentDetailsJson",r."paymentDetailsJson__lexeme"),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.column_input_sales_receipt_payments(cells jsonb) RETURNS stock_operational.sales_receipt_payments
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_payments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."receiptId" := nullif((cells->>1),'')::text;
r."paymentIndex" := nullif((cells->>2),'')::bigint;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."paymentIndex__lexeme" := (cells->>2); END IF;
r."paymentTypeId" := nullif((cells->>3),'')::text;
r."paymentName" := nullif((cells->>4),'')::text;
r."paymentType" := nullif((cells->>5),'')::text;
r."moneyAmount" := nullif((cells->>6),'')::numeric;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."moneyAmount__lexeme" := (cells->>6); END IF;
r."paidAt" := nullif((cells->>7),'')::text;
r."paymentDetailsJson" := nullif(nullif((cells->>8),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."paymentDetailsJson__lexeme" := (cells->>8); END IF;
r."syncedAt" := nullif((cells->>9),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_sales_receipt_payments(r stock_operational.sales_receipt_payments) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_sales_receipt_payments(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || CASE WHEN r."paymentIndex__lexeme" IS NOT NULL OR r."paymentIndex" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || CASE WHEN r."moneyAmount__lexeme" IS NOT NULL OR r."moneyAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',10)) THEN
  RETURN stock_operational.column_project_sales_receipt_payments(r);
 END IF;
 RETURN stock_operational.project_sales_receipt_payments(r);
END $$;
CREATE FUNCTION stock_operational.column_project_sales_receipt_syncs(r stock_operational.sales_receipt_syncs) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."salesDate",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."status",'')),
 stock_operational.column_bigint_v1(r."receiptCount",r."receiptCount__lexeme"),
 stock_operational.column_bigint_v1(r."itemCount",r."itemCount__lexeme"),
 stock_operational.column_bigint_v1(r."paymentCount",r."paymentCount__lexeme"),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.column_input_sales_receipt_syncs(cells jsonb) RETURNS stock_operational.sales_receipt_syncs
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_syncs; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."salesDate" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."shopName" := nullif((cells->>3),'')::text;
r."status" := nullif((cells->>4),'')::text;
r."receiptCount" := nullif((cells->>5),'')::bigint;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."receiptCount__lexeme" := (cells->>5); END IF;
r."itemCount" := nullif((cells->>6),'')::bigint;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."itemCount__lexeme" := (cells->>6); END IF;
r."paymentCount" := nullif((cells->>7),'')::bigint;
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."paymentCount__lexeme" := (cells->>7); END IF;
r."syncedAt" := nullif((cells->>8),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_sales_receipt_syncs(r stock_operational.sales_receipt_syncs) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_sales_receipt_syncs(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || CASE WHEN r."receiptCount__lexeme" IS NOT NULL OR r."receiptCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."itemCount__lexeme" IS NOT NULL OR r."itemCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN r."paymentCount__lexeme" IS NOT NULL OR r."paymentCount" IS NULL THEN 's' ELSE 'n' END || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',9)) THEN
  RETURN stock_operational.column_project_sales_receipt_syncs(r);
 END IF;
 RETURN stock_operational.project_sales_receipt_syncs(r);
END $$;
CREATE FUNCTION stock_operational.column_project_sales_profit_cost_overrides(r stock_operational.sales_profit_cost_overrides) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."accountId",'')),
 stock_operational.column_numeric_v1(r."averageItemCost",r."averageItemCost__lexeme"),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_sales_profit_cost_overrides(cells jsonb) RETURNS stock_operational.sales_profit_cost_overrides
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_profit_cost_overrides; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."month" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."averageItemCost" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."averageItemCost__lexeme" := (cells->>3); END IF;
r."note" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."createdBy" := nullif((cells->>7),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_sales_profit_cost_overrides(r stock_operational.sales_profit_cost_overrides) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_sales_profit_cost_overrides(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || CASE WHEN r."averageItemCost__lexeme" IS NOT NULL OR r."averageItemCost" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',8)) THEN
  RETURN stock_operational.column_project_sales_profit_cost_overrides(r);
 END IF;
 RETURN stock_operational.project_sales_profit_cost_overrides(r);
END $$;
CREATE FUNCTION stock_operational.column_project_stock_counts(r stock_operational.stock_counts) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 stock_operational.column_numeric_v1(r."physicalCount",r."physicalCount__lexeme"),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(r."countedAt",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."updatedBy",'')));
$$;
CREATE FUNCTION stock_operational.column_input_stock_counts(cells jsonb) RETURNS stock_operational.stock_counts
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.stock_counts; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."month" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."shopName" := nullif((cells->>3),'')::text;
r."physicalCount" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."physicalCount__lexeme" := (cells->>4); END IF;
r."note" := nullif((cells->>5),'')::text;
r."countedAt" := nullif((cells->>6),'')::text;
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."updatedBy" := nullif((cells->>8),'')::text;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_stock_counts(r stock_operational.stock_counts) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_stock_counts(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || CASE WHEN r."physicalCount__lexeme" IS NOT NULL OR r."physicalCount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',9)) THEN
  RETURN stock_operational.column_project_stock_counts(r);
 END IF;
 RETURN stock_operational.project_stock_counts(r);
END $$;
CREATE FUNCTION stock_operational.column_project_stock_adjustments(r stock_operational.stock_adjustments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."date",'')),
 to_jsonb(coalesce(r."direction",'')),
 to_jsonb(coalesce(r."reason",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."employeeName",'')),
 stock_operational.column_numeric_v1(r."quantity",r."quantity__lexeme"),
 to_jsonb(coalesce(r."itemDescription",'')),
 to_jsonb(coalesce(r."photoUrl",'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(r."reversesId",'')),
 to_jsonb(coalesce(r."replacesId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 stock_operational.column_boolean_v1(r."notInLoyverse",r."notInLoyverse__lexeme"));
$$;
CREATE FUNCTION stock_operational.column_input_stock_adjustments(cells jsonb) RETURNS stock_operational.stock_adjustments
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.stock_adjustments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>17 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."accountId" := nullif((cells->>1),'')::text;
r."shopName" := nullif((cells->>2),'')::text;
r."date" := nullif((cells->>3),'')::text;
r."direction" := nullif((cells->>4),'')::text;
r."reason" := nullif((cells->>5),'')::text;
r."employeeId" := nullif((cells->>6),'')::text;
r."employeeName" := nullif((cells->>7),'')::text;
r."quantity" := nullif((cells->>8),'')::numeric;
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."quantity__lexeme" := (cells->>8); END IF;
r."itemDescription" := nullif((cells->>9),'')::text;
r."photoUrl" := nullif((cells->>10),'')::text;
r."note" := nullif((cells->>11),'')::text;
r."reversesId" := nullif((cells->>12),'')::text;
r."replacesId" := nullif((cells->>13),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>14);
r."createdBy" := nullif((cells->>15),'')::text;
r."notInLoyverse" := nullif((cells->>16),'')::boolean;
IF jsonb_typeof((cells->16))='string' AND (cells->>16)<>'' THEN r."notInLoyverse__lexeme" := (cells->>16); END IF;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_stock_adjustments(r stock_operational.stock_adjustments) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_stock_adjustments(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."quantity__lexeme" IS NOT NULL OR r."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."notInLoyverse__lexeme" IS NOT NULL OR r."notInLoyverse" IS NULL THEN 's' ELSE 'b' END;
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',17)) THEN
  RETURN stock_operational.column_project_stock_adjustments(r);
 END IF;
 RETURN stock_operational.project_stock_adjustments(r);
END $$;
CREATE FUNCTION stock_operational.column_project_movements(r stock_operational.movements) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."userId",'')),
 to_jsonb(coalesce(r."packingDate",'')),
 to_jsonb(coalesce(r."deliverDateTime",'')),
 to_jsonb(coalesce(r."status",'')),
 stock_operational.column_numeric_v1(r."totalQuantity",r."totalQuantity__lexeme"),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.column_input_movements(cells jsonb) RETURNS stock_operational.movements
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.movements; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."userId" := nullif((cells->>1),'')::text;
r."packingDate" := nullif((cells->>2),'')::text;
r."deliverDateTime" := nullif((cells->>3),'')::text;
r."status" := nullif((cells->>4),'')::text;
r."totalQuantity" := nullif((cells->>5),'')::numeric;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."totalQuantity__lexeme" := (cells->>5); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_movements(r stock_operational.movements) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_movements(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || CASE WHEN r."totalQuantity__lexeme" IS NOT NULL OR r."totalQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',8)) THEN
  RETURN stock_operational.column_project_movements(r);
 END IF;
 RETURN stock_operational.project_movements(r);
END $$;
CREATE FUNCTION stock_operational.column_project_movement_details(r stock_operational.movement_details) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."movementMasterId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 stock_operational.column_numeric_v1(r."quantity",r."quantity__lexeme"),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(r."fromLocation",'')),
 to_jsonb(coalesce(r."toLocation",'')),
 to_jsonb(coalesce(r."productImageUrl",'')),
 to_jsonb(coalesce(r."purchaseDetailId",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 stock_operational.column_boolean_v1(r."stockCounted",r."stockCounted__lexeme"),
 stock_operational.column_boolean_v1(r."isNewArrival",r."isNewArrival__lexeme"));
$$;
CREATE FUNCTION stock_operational.column_input_movement_details(cells jsonb) RETURNS stock_operational.movement_details
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.movement_details; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>14 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."movementMasterId" := nullif((cells->>1),'')::text;
r."shopName" := nullif((cells->>2),'')::text;
r."quantity" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."quantity__lexeme" := (cells->>3); END IF;
r."remark" := nullif((cells->>4),'')::text;
r."fromLocation" := nullif((cells->>5),'')::text;
r."toLocation" := nullif((cells->>6),'')::text;
r."productImageUrl" := nullif((cells->>7),'')::text;
r."purchaseDetailId" := nullif((cells->>8),'')::text;
r."status" := nullif((cells->>9),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>10);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>11);
r."stockCounted" := nullif((cells->>12),'')::boolean;
IF jsonb_typeof((cells->12))='string' AND (cells->>12)<>'' THEN r."stockCounted__lexeme" := (cells->>12); END IF;
r."isNewArrival" := nullif((cells->>13),'')::boolean;
IF jsonb_typeof((cells->13))='string' AND (cells->>13)<>'' THEN r."isNewArrival__lexeme" := (cells->>13); END IF;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_movement_details(r stock_operational.movement_details) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_movement_details(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || CASE WHEN r."quantity__lexeme" IS NOT NULL OR r."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN r."stockCounted__lexeme" IS NOT NULL OR r."stockCounted" IS NULL THEN 's' ELSE 'b' END || CASE WHEN r."isNewArrival__lexeme" IS NOT NULL OR r."isNewArrival" IS NULL THEN 's' ELSE 'b' END;
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',14)) THEN
  RETURN stock_operational.column_project_movement_details(r);
 END IF;
 RETURN stock_operational.project_movement_details(r);
END $$;
CREATE FUNCTION stock_operational.column_project_user_state(r stock_operational.user_state) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."userId",'')),
 to_jsonb(coalesce(r."flowname",'')),
 to_jsonb(coalesce(r."referenceId",'')),
 to_jsonb(coalesce(r."state",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 stock_operational.column_jsonb_v1(r."context",r."context__lexeme"));
$$;
CREATE FUNCTION stock_operational.column_input_user_state(cells jsonb) RETURNS stock_operational.user_state
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.user_state; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."userId" := nullif((cells->>1),'')::text;
r."flowname" := nullif((cells->>2),'')::text;
r."referenceId" := nullif((cells->>3),'')::text;
r."state" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."context" := nullif(nullif((cells->>7),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."context__lexeme" := (cells->>7); END IF;
IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.column_compatible_user_state(r stock_operational.user_state) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_user_state(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',8)) THEN
  RETURN stock_operational.column_project_user_state(r);
 END IF;
 RETURN stock_operational.project_user_state(r);
END $$;
CREATE FUNCTION stock_operational.column_mapping_contract_v1() RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE kinds integer; all_kinds integer; valid integer;
BEGIN
 SELECT count(*) INTO valid FROM (VALUES ('orders','id','text'),('orders','status','text'),('orders','seller','text'),('orders','totalPrice','numeric'),('orders','totalPrice__lexeme','text'),('orders','remark','text'),('orders','createdAt','timestamp with time zone'),('orders','updatedAt','timestamp with time zone'),('orders','deletedAt','timestamp with time zone'),('orders','createdBy','text'),('orders','revision','bigint'),('orders','archived_at','timestamp with time zone'),('order_items','id','text'),('order_items','orderId','text'),('order_items','imageUrl','text'),('order_items','quoteQuantity','numeric'),('order_items','quoteQuantity__lexeme','text'),('order_items','deliveredQuantity','numeric'),('order_items','deliveredQuantity__lexeme','text'),('order_items','productCode','text'),('order_items','createdAt','timestamp with time zone'),('order_items','updatedAt','timestamp with time zone'),('order_items','deletedAt','timestamp with time zone'),('order_items','createdBy','text'),('order_items','revision','bigint'),('order_items','archived_at','timestamp with time zone'),('order_bills','id','text'),('order_bills','orderId','text'),('order_bills','imageUrl','text'),('order_bills','createdAt','timestamp with time zone'),('order_bills','updatedAt','timestamp with time zone'),('order_bills','deletedAt','timestamp with time zone'),('order_bills','createdBy','text'),('order_bills','revision','bigint'),('order_bills','archived_at','timestamp with time zone'),('shipments','id','text'),('shipments','status','text'),('shipments','carrier','text'),('shipments','poNumber','text'),('shipments','shippingFee','numeric'),('shipments','shippingFee__lexeme','text'),('shipments','remark','text'),('shipments','shippedAt','text'),('shipments','deliveredAt','text'),('shipments','createdAt','timestamp with time zone'),('shipments','updatedAt','timestamp with time zone'),('shipments','deletedAt','timestamp with time zone'),('shipments','createdBy','text'),('shipments','shippingBillUrl','text'),('shipments','revision','bigint'),('shipments','archived_at','timestamp with time zone'),('shipment_orders','id','text'),('shipment_orders','shipmentId','text'),('shipment_orders','orderId','text'),('shipment_orders','createdAt','timestamp with time zone'),('shipment_orders','updatedAt','timestamp with time zone'),('shipment_orders','deletedAt','timestamp with time zone'),('shipment_orders','createdBy','text'),('shipment_orders','revision','bigint'),('shipment_orders','archived_at','timestamp with time zone'),('employees','id','text'),('employees','name','text'),('employees','phone','text'),('employees','status','text'),('employees','hiredDate','text'),('employees','terminatedDate','text'),('employees','createdAt','timestamp with time zone'),('employees','updatedAt','timestamp with time zone'),('employees','createdBy','text'),('employees','revision','bigint'),('employees','archived_at','timestamp with time zone'),('employee_compensations','employeeId','text'),('employee_compensations','baseSalary','numeric'),('employee_compensations','baseSalary__lexeme','text'),('employee_compensations','commission','numeric'),('employee_compensations','commission__lexeme','text'),('employee_compensations','createdAt','timestamp with time zone'),('employee_compensations','updatedAt','timestamp with time zone'),('employee_compensations','updatedBy','text'),('employee_compensations','effectiveFrom','text'),('employee_compensations','compensationType','text'),('employee_compensations','commissionType','text'),('employee_compensations','commissionBucketSales','numeric'),('employee_compensations','commissionBucketSales__lexeme','text'),('employee_compensations','commissionBucketAmount','numeric'),('employee_compensations','commissionBucketAmount__lexeme','text'),('employee_compensations','commissionRoundupThreshold','numeric'),('employee_compensations','commissionRoundupThreshold__lexeme','text'),('employee_compensations','revision','bigint'),('employee_compensations','archived_at','timestamp with time zone'),('employee_compensations','migration_id','text'),('employee_timesheets','id','text'),('employee_timesheets','employeeId','text'),('employee_timesheets','shopId','text'),('employee_timesheets','status','text'),('employee_timesheets','createdAt','timestamp with time zone'),('employee_timesheets','updatedAt','timestamp with time zone'),('employee_timesheets','workdayType','text'),('employee_timesheets','revision','bigint'),('employee_timesheets','archived_at','timestamp with time zone'),('employee_advances','id','text'),('employee_advances','employeeId','text'),('employee_advances','shopId','text'),('employee_advances','requestedDate','text'),('employee_advances','payrollMonth','text'),('employee_advances','requestedAmount','numeric'),('employee_advances','requestedAmount__lexeme','text'),('employee_advances','paidAmount','numeric'),('employee_advances','paidAmount__lexeme','text'),('employee_advances','status','text'),('employee_advances','paidDate','text'),('employee_advances','reference','text'),('employee_advances','note','text'),('employee_advances','createdAt','timestamp with time zone'),('employee_advances','updatedAt','timestamp with time zone'),('employee_advances','revision','bigint'),('employee_advances','archived_at','timestamp with time zone'),('payroll_settlements','id','text'),('payroll_settlements','employeeId','text'),('payroll_settlements','month','text'),('payroll_settlements','paidDate','text'),('payroll_settlements','reference','text'),('payroll_settlements','createdAt','timestamp with time zone'),('payroll_settlements','snapshot','jsonb'),('payroll_settlements','snapshot__lexeme','text'),('payroll_settlements','revision','bigint'),('payroll_settlements','archived_at','timestamp with time zone'),('expenses','id','text'),('expenses','month','text'),('expenses','expenseDate','text'),('expenses','shopId','text'),('expenses','scope','text'),('expenses','categoryId','text'),('expenses','name','text'),('expenses','amount','numeric'),('expenses','amount__lexeme','text'),('expenses','note','text'),('expenses','createdAt','timestamp with time zone'),('expenses','updatedAt','timestamp with time zone'),('expenses','createdBy','text'),('expenses','deletedAt','timestamp with time zone'),('expenses','revision','bigint'),('expenses','archived_at','timestamp with time zone'),('expense_categories','id','text'),('expense_categories','name','text'),('expense_categories','active','boolean'),('expense_categories','active__lexeme','text'),('expense_categories','createdAt','timestamp with time zone'),('expense_categories','updatedAt','timestamp with time zone'),('expense_categories','revision','bigint'),('expense_categories','archived_at','timestamp with time zone'),('shops','id','text'),('shops','name','text'),('shops','active','boolean'),('shops','active__lexeme','text'),('shops','loyverseAccountId','text'),('shops','createdAt','timestamp with time zone'),('shops','updatedAt','timestamp with time zone'),('shops','revision','bigint'),('shops','archived_at','timestamp with time zone'),('sales_receipts','id','text'),('sales_receipts','salesDate','text'),('sales_receipts','accountId','text'),('sales_receipts','shopName','text'),('sales_receipts','receiptNumber','text'),('sales_receipts','receiptType','text'),('sales_receipts','refundFor','text'),('sales_receipts','order','text'),('sales_receipts','receiptDate','text'),('sales_receipts','createdAt','timestamp with time zone'),('sales_receipts','updatedAt','timestamp with time zone'),('sales_receipts','cancelledAt','text'),('sales_receipts','source','text'),('sales_receipts','storeId','text'),('sales_receipts','employeeId','text'),('sales_receipts','customerId','text'),('sales_receipts','posDeviceId','text'),('sales_receipts','diningOption','text'),('sales_receipts','totalMoney','numeric'),('sales_receipts','totalMoney__lexeme','text'),('sales_receipts','totalTax','numeric'),('sales_receipts','totalTax__lexeme','text'),('sales_receipts','totalDiscount','numeric'),('sales_receipts','totalDiscount__lexeme','text'),('sales_receipts','tip','numeric'),('sales_receipts','tip__lexeme','text'),('sales_receipts','surcharge','numeric'),('sales_receipts','surcharge__lexeme','text'),('sales_receipts','pointsEarned','numeric'),('sales_receipts','pointsEarned__lexeme','text'),('sales_receipts','pointsDeducted','numeric'),('sales_receipts','pointsDeducted__lexeme','text'),('sales_receipts','syncedAt','text'),('sales_receipts','revision','bigint'),('sales_receipts','archived_at','timestamp with time zone'),('sales_receipt_items','id','text'),('sales_receipt_items','receiptId','text'),('sales_receipt_items','lineItemId','text'),('sales_receipt_items','itemId','text'),('sales_receipt_items','variantId','text'),('sales_receipt_items','itemName','text'),('sales_receipt_items','variantName','text'),('sales_receipt_items','sku','text'),('sales_receipt_items','quantity','numeric'),('sales_receipt_items','quantity__lexeme','text'),('sales_receipt_items','price','numeric'),('sales_receipt_items','price__lexeme','text'),('sales_receipt_items','grossTotalMoney','numeric'),('sales_receipt_items','grossTotalMoney__lexeme','text'),('sales_receipt_items','totalDiscount','numeric'),('sales_receipt_items','totalDiscount__lexeme','text'),('sales_receipt_items','totalMoney','numeric'),('sales_receipt_items','totalMoney__lexeme','text'),('sales_receipt_items','cost','numeric'),('sales_receipt_items','cost__lexeme','text'),('sales_receipt_items','costTotal','numeric'),('sales_receipt_items','costTotal__lexeme','text'),('sales_receipt_items','taxes','numeric'),('sales_receipt_items','taxes__lexeme','text'),('sales_receipt_items','lineNote','text'),('sales_receipt_items','lineDiscountsJson','jsonb'),('sales_receipt_items','lineDiscountsJson__lexeme','text'),('sales_receipt_items','lineTaxesJson','jsonb'),('sales_receipt_items','lineTaxesJson__lexeme','text'),('sales_receipt_items','lineModifiersJson','jsonb'),('sales_receipt_items','lineModifiersJson__lexeme','text'),('sales_receipt_items','syncedAt','text'),('sales_receipt_items','createdAt','timestamp with time zone'),('sales_receipt_items','revision','bigint'),('sales_receipt_items','archived_at','timestamp with time zone'),('sales_receipt_payments','id','text'),('sales_receipt_payments','receiptId','text'),('sales_receipt_payments','paymentIndex','bigint'),('sales_receipt_payments','paymentIndex__lexeme','text'),('sales_receipt_payments','paymentTypeId','text'),('sales_receipt_payments','paymentName','text'),('sales_receipt_payments','paymentType','text'),('sales_receipt_payments','moneyAmount','numeric'),('sales_receipt_payments','moneyAmount__lexeme','text'),('sales_receipt_payments','paidAt','text'),('sales_receipt_payments','paymentDetailsJson','jsonb'),('sales_receipt_payments','paymentDetailsJson__lexeme','text'),('sales_receipt_payments','syncedAt','text'),('sales_receipt_payments','createdAt','timestamp with time zone'),('sales_receipt_payments','revision','bigint'),('sales_receipt_payments','archived_at','timestamp with time zone'),('sales_receipt_syncs','id','text'),('sales_receipt_syncs','salesDate','text'),('sales_receipt_syncs','accountId','text'),('sales_receipt_syncs','shopName','text'),('sales_receipt_syncs','status','text'),('sales_receipt_syncs','receiptCount','bigint'),('sales_receipt_syncs','receiptCount__lexeme','text'),('sales_receipt_syncs','itemCount','bigint'),('sales_receipt_syncs','itemCount__lexeme','text'),('sales_receipt_syncs','paymentCount','bigint'),('sales_receipt_syncs','paymentCount__lexeme','text'),('sales_receipt_syncs','syncedAt','text'),('sales_receipt_syncs','createdAt','timestamp with time zone'),('sales_receipt_syncs','revision','bigint'),('sales_receipt_syncs','archived_at','timestamp with time zone'),('sales_profit_cost_overrides','id','text'),('sales_profit_cost_overrides','month','text'),('sales_profit_cost_overrides','accountId','text'),('sales_profit_cost_overrides','averageItemCost','numeric'),('sales_profit_cost_overrides','averageItemCost__lexeme','text'),('sales_profit_cost_overrides','note','text'),('sales_profit_cost_overrides','createdAt','timestamp with time zone'),('sales_profit_cost_overrides','updatedAt','timestamp with time zone'),('sales_profit_cost_overrides','createdBy','text'),('sales_profit_cost_overrides','revision','bigint'),('sales_profit_cost_overrides','archived_at','timestamp with time zone'),('stock_counts','id','text'),('stock_counts','month','text'),('stock_counts','accountId','text'),('stock_counts','shopName','text'),('stock_counts','physicalCount','numeric'),('stock_counts','physicalCount__lexeme','text'),('stock_counts','note','text'),('stock_counts','countedAt','text'),('stock_counts','updatedAt','timestamp with time zone'),('stock_counts','updatedBy','text'),('stock_counts','createdAt','timestamp with time zone'),('stock_counts','revision','bigint'),('stock_counts','archived_at','timestamp with time zone'),('stock_adjustments','id','text'),('stock_adjustments','accountId','text'),('stock_adjustments','shopName','text'),('stock_adjustments','date','text'),('stock_adjustments','direction','text'),('stock_adjustments','reason','text'),('stock_adjustments','employeeId','text'),('stock_adjustments','employeeName','text'),('stock_adjustments','quantity','numeric'),('stock_adjustments','quantity__lexeme','text'),('stock_adjustments','itemDescription','text'),('stock_adjustments','photoUrl','text'),('stock_adjustments','note','text'),('stock_adjustments','reversesId','text'),('stock_adjustments','replacesId','text'),('stock_adjustments','createdAt','timestamp with time zone'),('stock_adjustments','createdBy','text'),('stock_adjustments','notInLoyverse','boolean'),('stock_adjustments','notInLoyverse__lexeme','text'),('stock_adjustments','revision','bigint'),('stock_adjustments','archived_at','timestamp with time zone'),('movements','id','text'),('movements','userId','text'),('movements','packingDate','text'),('movements','deliverDateTime','text'),('movements','status','text'),('movements','totalQuantity','numeric'),('movements','totalQuantity__lexeme','text'),('movements','createdAt','timestamp with time zone'),('movements','updatedAt','timestamp with time zone'),('movements','revision','bigint'),('movements','archived_at','timestamp with time zone'),('movement_details','id','text'),('movement_details','movementMasterId','text'),('movement_details','shopName','text'),('movement_details','quantity','numeric'),('movement_details','quantity__lexeme','text'),('movement_details','remark','text'),('movement_details','fromLocation','text'),('movement_details','toLocation','text'),('movement_details','productImageUrl','text'),('movement_details','purchaseDetailId','text'),('movement_details','status','text'),('movement_details','createdAt','timestamp with time zone'),('movement_details','updatedAt','timestamp with time zone'),('movement_details','stockCounted','boolean'),('movement_details','stockCounted__lexeme','text'),('movement_details','isNewArrival','boolean'),('movement_details','isNewArrival__lexeme','text'),('movement_details','revision','bigint'),('movement_details','archived_at','timestamp with time zone'),('user_state','id','text'),('user_state','userId','text'),('user_state','flowname','text'),('user_state','referenceId','text'),('user_state','state','text'),('user_state','createdAt','timestamp with time zone'),('user_state','updatedAt','timestamp with time zone'),('user_state','context','jsonb'),('user_state','context__lexeme','text'),('user_state','revision','bigint'),('user_state','archived_at','timestamp with time zone')) e(name,column_name,datatype)
 JOIN pg_class c ON c.relname=e.name AND c.relnamespace='stock_operational'::regnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype;
 IF valid<>347 THEN RAISE EXCEPTION 'Unsupported per-column schema'; END IF;
 SELECT count(*) INTO kinds FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND a.atttypid='text'::regtype;
 SELECT count(*) INTO all_kinds FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped;
 IF kinds=23 AND all_kinds=23 AND NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND c.relname NOT IN ('orders','order_items','order_bills','shipments','shipment_orders','employees','employee_compensations','employee_timesheets','employee_advances','payroll_settlements','expenses','expense_categories','shops','sales_receipts','sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','sales_profit_cost_overrides','stock_counts','stock_adjustments','movements','movement_details','user_state')) THEN RETURN 'retained'; END IF;
 IF kinds=0 AND all_kinds=0 THEN RETURN 'final'; END IF;
 RAISE EXCEPTION 'Partial encoding-column schema';
END $$;
REVOKE ALL ON FUNCTION stock_operational.column_project_orders(stock_operational.orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_orders(stock_operational.orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_orders(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_order_items(stock_operational.order_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_order_items(stock_operational.order_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_order_items(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_order_bills(stock_operational.order_bills) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_order_bills(stock_operational.order_bills) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_order_bills(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_shipments(stock_operational.shipments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_shipments(stock_operational.shipments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_shipments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_shipment_orders(stock_operational.shipment_orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_shipment_orders(stock_operational.shipment_orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_shipment_orders(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_employees(stock_operational.employees) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_employees(stock_operational.employees) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_employees(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_employee_compensations(stock_operational.employee_compensations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_employee_compensations(stock_operational.employee_compensations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_employee_compensations(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_employee_timesheets(stock_operational.employee_timesheets) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_employee_timesheets(stock_operational.employee_timesheets) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_employee_timesheets(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_employee_advances(stock_operational.employee_advances) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_employee_advances(stock_operational.employee_advances) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_employee_advances(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_payroll_settlements(stock_operational.payroll_settlements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_payroll_settlements(stock_operational.payroll_settlements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_payroll_settlements(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_expenses(stock_operational.expenses) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_expenses(stock_operational.expenses) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_expenses(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_expense_categories(stock_operational.expense_categories) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_expense_categories(stock_operational.expense_categories) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_expense_categories(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_shops(stock_operational.shops) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_shops(stock_operational.shops) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_shops(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_sales_receipts(stock_operational.sales_receipts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_sales_receipts(stock_operational.sales_receipts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_sales_receipts(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_sales_receipt_items(stock_operational.sales_receipt_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_sales_receipt_items(stock_operational.sales_receipt_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_sales_receipt_items(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_sales_receipt_payments(stock_operational.sales_receipt_payments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_sales_receipt_payments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_sales_receipt_syncs(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_sales_profit_cost_overrides(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_stock_counts(stock_operational.stock_counts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_stock_counts(stock_operational.stock_counts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_stock_counts(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_stock_adjustments(stock_operational.stock_adjustments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_stock_adjustments(stock_operational.stock_adjustments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_stock_adjustments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_movements(stock_operational.movements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_movements(stock_operational.movements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_movements(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_movement_details(stock_operational.movement_details) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_movement_details(stock_operational.movement_details) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_movement_details(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_project_user_state(stock_operational.user_state) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_compatible_user_state(stock_operational.user_state) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_input_user_state(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_mapping_contract_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_numeric_v1(numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_bigint_v1(bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_boolean_v1(boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.column_jsonb_v1(jsonb,text) FROM PUBLIC,anon,authenticated;
DO $callers$ DECLARE item record; helper text; BEGIN
 FOR item IN SELECT e.new_signature,pg_get_userbyid(a.grantee) AS name FROM (VALUES ('column_project_orders(stock_operational.orders)','project_orders(stock_operational.orders)'),('column_compatible_orders(stock_operational.orders)','project_orders(stock_operational.orders)'),('column_input_orders(jsonb)','input_orders(jsonb)'),('column_project_order_items(stock_operational.order_items)','project_order_items(stock_operational.order_items)'),('column_compatible_order_items(stock_operational.order_items)','project_order_items(stock_operational.order_items)'),('column_input_order_items(jsonb)','input_order_items(jsonb)'),('column_project_order_bills(stock_operational.order_bills)','project_order_bills(stock_operational.order_bills)'),('column_compatible_order_bills(stock_operational.order_bills)','project_order_bills(stock_operational.order_bills)'),('column_input_order_bills(jsonb)','input_order_bills(jsonb)'),('column_project_shipments(stock_operational.shipments)','project_shipments(stock_operational.shipments)'),('column_compatible_shipments(stock_operational.shipments)','project_shipments(stock_operational.shipments)'),('column_input_shipments(jsonb)','input_shipments(jsonb)'),('column_project_shipment_orders(stock_operational.shipment_orders)','project_shipment_orders(stock_operational.shipment_orders)'),('column_compatible_shipment_orders(stock_operational.shipment_orders)','project_shipment_orders(stock_operational.shipment_orders)'),('column_input_shipment_orders(jsonb)','input_shipment_orders(jsonb)'),('column_project_employees(stock_operational.employees)','project_employees(stock_operational.employees)'),('column_compatible_employees(stock_operational.employees)','project_employees(stock_operational.employees)'),('column_input_employees(jsonb)','input_employees(jsonb)'),('column_project_employee_compensations(stock_operational.employee_compensations)','project_employee_compensations(stock_operational.employee_compensations)'),('column_compatible_employee_compensations(stock_operational.employee_compensations)','project_employee_compensations(stock_operational.employee_compensations)'),('column_input_employee_compensations(jsonb)','input_employee_compensations(jsonb)'),('column_project_employee_timesheets(stock_operational.employee_timesheets)','project_employee_timesheets(stock_operational.employee_timesheets)'),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','project_employee_timesheets(stock_operational.employee_timesheets)'),('column_input_employee_timesheets(jsonb)','input_employee_timesheets(jsonb)'),('column_project_employee_advances(stock_operational.employee_advances)','project_employee_advances(stock_operational.employee_advances)'),('column_compatible_employee_advances(stock_operational.employee_advances)','project_employee_advances(stock_operational.employee_advances)'),('column_input_employee_advances(jsonb)','input_employee_advances(jsonb)'),('column_project_payroll_settlements(stock_operational.payroll_settlements)','project_payroll_settlements(stock_operational.payroll_settlements)'),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','project_payroll_settlements(stock_operational.payroll_settlements)'),('column_input_payroll_settlements(jsonb)','input_payroll_settlements(jsonb)'),('column_project_expenses(stock_operational.expenses)','project_expenses(stock_operational.expenses)'),('column_compatible_expenses(stock_operational.expenses)','project_expenses(stock_operational.expenses)'),('column_input_expenses(jsonb)','input_expenses(jsonb)'),('column_project_expense_categories(stock_operational.expense_categories)','project_expense_categories(stock_operational.expense_categories)'),('column_compatible_expense_categories(stock_operational.expense_categories)','project_expense_categories(stock_operational.expense_categories)'),('column_input_expense_categories(jsonb)','input_expense_categories(jsonb)'),('column_project_shops(stock_operational.shops)','project_shops(stock_operational.shops)'),('column_compatible_shops(stock_operational.shops)','project_shops(stock_operational.shops)'),('column_input_shops(jsonb)','input_shops(jsonb)'),('column_project_sales_receipts(stock_operational.sales_receipts)','project_sales_receipts(stock_operational.sales_receipts)'),('column_compatible_sales_receipts(stock_operational.sales_receipts)','project_sales_receipts(stock_operational.sales_receipts)'),('column_input_sales_receipts(jsonb)','input_sales_receipts(jsonb)'),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)','project_sales_receipt_items(stock_operational.sales_receipt_items)'),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','project_sales_receipt_items(stock_operational.sales_receipt_items)'),('column_input_sales_receipt_items(jsonb)','input_sales_receipt_items(jsonb)'),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','project_sales_receipt_payments(stock_operational.sales_receipt_payments)'),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','project_sales_receipt_payments(stock_operational.sales_receipt_payments)'),('column_input_sales_receipt_payments(jsonb)','input_sales_receipt_payments(jsonb)'),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'),('column_input_sales_receipt_syncs(jsonb)','input_sales_receipt_syncs(jsonb)'),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'),('column_input_sales_profit_cost_overrides(jsonb)','input_sales_profit_cost_overrides(jsonb)'),('column_project_stock_counts(stock_operational.stock_counts)','project_stock_counts(stock_operational.stock_counts)'),('column_compatible_stock_counts(stock_operational.stock_counts)','project_stock_counts(stock_operational.stock_counts)'),('column_input_stock_counts(jsonb)','input_stock_counts(jsonb)'),('column_project_stock_adjustments(stock_operational.stock_adjustments)','project_stock_adjustments(stock_operational.stock_adjustments)'),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','project_stock_adjustments(stock_operational.stock_adjustments)'),('column_input_stock_adjustments(jsonb)','input_stock_adjustments(jsonb)'),('column_project_movements(stock_operational.movements)','project_movements(stock_operational.movements)'),('column_compatible_movements(stock_operational.movements)','project_movements(stock_operational.movements)'),('column_input_movements(jsonb)','input_movements(jsonb)'),('column_project_movement_details(stock_operational.movement_details)','project_movement_details(stock_operational.movement_details)'),('column_compatible_movement_details(stock_operational.movement_details)','project_movement_details(stock_operational.movement_details)'),('column_input_movement_details(jsonb)','input_movement_details(jsonb)'),('column_project_user_state(stock_operational.user_state)','project_user_state(stock_operational.user_state)'),('column_compatible_user_state(stock_operational.user_state)','project_user_state(stock_operational.user_state)'),('column_input_user_state(jsonb)','input_user_state(jsonb)')) e(new_signature,old_signature)
 JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.old_signature)
 CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',item.new_signature,item.name);
  FOREACH helper IN ARRAY ARRAY['column_mapping_contract_v1()','column_numeric_v1(numeric,text)','column_bigint_v1(bigint,text)','column_boolean_v1(boolean,text)','column_jsonb_v1(jsonb,text)'] LOOP
   EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',helper,item.name);
  END LOOP;
 END LOOP;
END $callers$;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;
COMMIT;
