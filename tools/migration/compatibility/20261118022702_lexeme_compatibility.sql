-- OPERATOR ONLY: additive compatibility, all48 lexeme columns retained.
-- No existing function replacement, table DDL, record rewrite or normalization.
-- Outside automatic migration discovery; hosted execution needs separate approval.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_lexeme_compatibility',true)='reviewed-typed-columns-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='final')::int;
SELECT 1 / (to_regprocedure('stock_operational.lexeme_mapping_contract_v1()') IS NULL)::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','50719cbebc5bae92893a0372c36c8cd7'),('project_orders(stock_operational.orders)','5ad9464213d153c42111098fce21b17b'),('validate_orders()','a0bfeec665bfefc2a0a5d5006152a4d2'),('input_order_items(jsonb)','ab355c7b479eaad42248ea2db01c2747'),('project_order_items(stock_operational.order_items)','d6111869845458c559c91008a5bcf195'),('validate_order_items()','39f9c8f9d89b5a97e133c52d14994129'),('input_order_bills(jsonb)','d3e907f4efdb3b1b67486d81085af026'),('project_order_bills(stock_operational.order_bills)','8fadad71f337cdc9e478296054ef5690'),('validate_order_bills()','72722aee092af047de74b7bd1a6e6644'),('input_shipments(jsonb)','2480203ae95e3f4e5878df7d6afd29f5'),('project_shipments(stock_operational.shipments)','026b30cee1f3c726b0ea3d2a24370561'),('validate_shipments()','3cfb6b5585093d91ba59f47f2b490c4e'),('input_shipment_orders(jsonb)','b5d7ec9deb37bc83ccba4e4a8b7338a1'),('project_shipment_orders(stock_operational.shipment_orders)','3d34b32b70971418f9e026386a6c541e'),('validate_shipment_orders()','06fa77f9bd707fd2e73948213c7c5ff8'),('input_employees(jsonb)','1d75a8883ceaaaad1dde4052a44b43e8'),('project_employees(stock_operational.employees)','ffaad41277d95a2e99d94144c599f493'),('validate_employees()','39bc43cf3c17759220e24e9eaa3c6ff6'),('input_employee_compensations(jsonb)','e8de230f61f41b25c837c6bb27bc2cfd'),('project_employee_compensations(stock_operational.employee_compensations)','41433896eadd94409838239de5fda96e'),('validate_employee_compensations()','4e8f9c97cd93c4e6b482a5ebbc84d6af'),('input_employee_timesheets(jsonb)','d28f292f4a01cfded1b0aea0e8de9f90'),('project_employee_timesheets(stock_operational.employee_timesheets)','39031659ed6a88dc730e9c756781c370'),('validate_employee_timesheets()','35a1c9d84bdb621b8f8753f82f89bc3c'),('input_employee_advances(jsonb)','17a34a0c3cfc2db7f756a18b5175c5e1'),('project_employee_advances(stock_operational.employee_advances)','b334d251529f45d4f53362f5aa2233d4'),('validate_employee_advances()','98f9783f33a963462768041570856344'),('input_payroll_settlements(jsonb)','59715c303cf3fc068ae130011fd8b8ec'),('project_payroll_settlements(stock_operational.payroll_settlements)','d4984927187a49013604c16c994ff25a'),('validate_payroll_settlements()','3608d8ee42d9a1f018803ca238e71300'),('input_expenses(jsonb)','b7084726cf14b0ad37af1dc394a81223'),('project_expenses(stock_operational.expenses)','fde4ea51720f3b56291a679086622a3e'),('validate_expenses()','cf6e98fa27b0876e43f56d948d3db1e0'),('input_expense_categories(jsonb)','d5e928e37c0cc28a3bada7b6b026d0e4'),('project_expense_categories(stock_operational.expense_categories)','fadd388ba96d6c84e407c39fd7635b96'),('validate_expense_categories()','a7fd060d4e0e7995cb97e6a78a3ccf73'),('input_shops(jsonb)','fb71ca3cdb9af383fb9d258f6a3bcfc0'),('project_shops(stock_operational.shops)','bc76781acc3372af27b0febcb4ebbda8'),('validate_shops()','40222020a4068b705a8915a6cb9f0f67'),('input_sales_receipts(jsonb)','9dc15db3026bcd6224caa11c70908f04'),('project_sales_receipts(stock_operational.sales_receipts)','65fe3137f0145a8a9ea71ecb7ae3a5e4'),('validate_sales_receipts()','2fcde387626beec3bd7533f763a4580c'),('input_sales_receipt_items(jsonb)','2293c379be4bc71a1eeb5260f63c32fe'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','4906e30c6d9cbab5662929e187b20976'),('validate_sales_receipt_items()','258f58d54b6d359ad7b98367c64b5d1c'),('input_sales_receipt_payments(jsonb)','99e0cd773a80910fde101bc3dde24984'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','899359ac074bff91e8ab9410f658870b'),('validate_sales_receipt_payments()','0fb29df9e3b326db3562824b19e67cd5'),('input_sales_receipt_syncs(jsonb)','3f5b6154b687fc631d4c76c3178ed34d'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','cc5bceb9b9608cec80ca05c1e37cb1e8'),('validate_sales_receipt_syncs()','534be012ea29293d689178fc0683a345'),('input_sales_profit_cost_overrides(jsonb)','07cf48a230d44893e60413f1f8926220'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','9904af48e1ae15571174828a50607b67'),('validate_sales_profit_cost_overrides()','20241420d89c651a09a9cb5924085ab6'),('input_stock_counts(jsonb)','47ce4e17ccfd43f624422fc4bcd650cb'),('project_stock_counts(stock_operational.stock_counts)','b75143df9c0b4c120c3f5103a65d281c'),('validate_stock_counts()','f024596006db80ff9c384868ea890941'),('input_stock_adjustments(jsonb)','7b257e593935fe1e9f62ca30eb6f27da'),('project_stock_adjustments(stock_operational.stock_adjustments)','ca5ed676c0e6f82346152208b575c5a2'),('validate_stock_adjustments()','13f2dbcae594d18f3dc40735d7a8dd4d'),('input_movements(jsonb)','19f0b805da03a6f23aa63ce46f7e9146'),('project_movements(stock_operational.movements)','8a00237d7397be8d77017f0e006994d2'),('validate_movements()','49152534d41ae2bc1c1f7ca8abf9af99'),('input_movement_details(jsonb)','9da3052c2250ce94757325d856ff4ba6'),('project_movement_details(stock_operational.movement_details)','011607e8fbe655d5a06b65f88ff9fb60'),('validate_movement_details()','6369c0daf49dc2c9303ca211683ca670'),('input_user_state(jsonb)','81f2510e3a6d774f457471afa3b73303'),('project_user_state(stock_operational.user_state)','2257b09f73473c96ec28640886a228a3'),('validate_user_state()','31d73e9b532148408c7ae0a5cb333848'),('column_numeric_v1(numeric,text)','b6c65a84062cd56a9b5d8f438d554851'),('column_bigint_v1(bigint,text)','a8cbab7e0cf32fcfc720a2572963ddbf'),('column_boolean_v1(boolean,text)','5ead1dc7f1e9ca77fd885e79a9852d5d'),('column_jsonb_v1(jsonb,text)','a12994e1234e85cc602ad0e6390fee76'),('column_project_orders(stock_operational.orders)','11f0c525444dcdb05f6e90632d148c66'),('column_input_orders(jsonb)','7335bdee08b3f88b4f1832094fa85f1a'),('column_compatible_orders(stock_operational.orders)','e9cee7bd155c2384b6c883259384a28f'),('column_project_order_items(stock_operational.order_items)','fe9dd62431436a64491ad66fee837eb4'),('column_input_order_items(jsonb)','d5b2fb5331af90fb8e94ff56c70b53bd'),('column_compatible_order_items(stock_operational.order_items)','8de0a8af1ccaf955342069c16ef08b55'),('column_project_order_bills(stock_operational.order_bills)','8019b047deef8e88eeb60f92d17cd987'),('column_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('column_compatible_order_bills(stock_operational.order_bills)','d2ad69ae251a1406b0d4c429c2c29b1e'),('column_project_shipments(stock_operational.shipments)','95099880736ab6ba6d75c9bc21a048a7'),('column_input_shipments(jsonb)','4710c0c2c701361f13fa379d78cf7679'),('column_compatible_shipments(stock_operational.shipments)','0264055758e639bd9deafa1534436773'),('column_project_shipment_orders(stock_operational.shipment_orders)','e8e608f2a1355e9a6fe0c63908fa2d0f'),('column_input_shipment_orders(jsonb)','33e66d5247e6b546a7b345de98363f52'),('column_compatible_shipment_orders(stock_operational.shipment_orders)','b534f0ade3b588b62245a038b73fa687'),('column_project_employees(stock_operational.employees)','f65a472e40a1a63abb3d517ad807cc83'),('column_input_employees(jsonb)','d7b4b7d4a6e29cabe227a60fe004e5f3'),('column_compatible_employees(stock_operational.employees)','4c8fc7ff8e50a4ac4c057a1ad357bb90'),('column_project_employee_compensations(stock_operational.employee_compensations)','f45432a433d0015140443d011c8f9c6d'),('column_input_employee_compensations(jsonb)','848a6e7c20be8017456ef9004bc43964'),('column_compatible_employee_compensations(stock_operational.employee_compensations)','66d8774a3c63c454c8b5824dcd1b7dda'),('column_project_employee_timesheets(stock_operational.employee_timesheets)','e53a2faf2dae4dfdb879653dca99cc31'),('column_input_employee_timesheets(jsonb)','7ca5c001f61187582fb7e6fdd54b953e'),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','0b3803d4338cb548dde098159ca1ec4e'),('column_project_employee_advances(stock_operational.employee_advances)','345e18cd79750c6203f720ab3478a35e'),('column_input_employee_advances(jsonb)','b6ab3b2d12b710da83f59ca7e7a9ffe2'),('column_compatible_employee_advances(stock_operational.employee_advances)','ab8028dac4c8d54d7f70c07c7828b675'),('column_project_payroll_settlements(stock_operational.payroll_settlements)','97d19bf717c94321700215616a9e1dde'),('column_input_payroll_settlements(jsonb)','54df20d4ebc688535fa5e82d103e3efa'),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','dab9dc8f37cb69ddc75d895272d0c67f'),('column_project_expenses(stock_operational.expenses)','be1da2b05c5c3280d17ac21eebd4d7f7'),('column_input_expenses(jsonb)','6defedb02397eacb3d4f9befe58e4642'),('column_compatible_expenses(stock_operational.expenses)','d3e0afbe2536a15bb5ac2a1c7afb64ba'),('column_project_expense_categories(stock_operational.expense_categories)','2a487f01323a1cf0ae3884b8a0d30b64'),('column_input_expense_categories(jsonb)','aec32a171ad93917239ec0b794239734'),('column_compatible_expense_categories(stock_operational.expense_categories)','af7c7363f50dc0c5dcfafe014b5f7664'),('column_project_shops(stock_operational.shops)','7e5b09b0b4aacac1d29e55d863bec7a2'),('column_input_shops(jsonb)','063c947d1127202ed26505d2d643aded'),('column_compatible_shops(stock_operational.shops)','65fe40e5bf62ea817a339d88140c98f0'),('column_project_sales_receipts(stock_operational.sales_receipts)','5f6e10f6a9ec9d9d0e00e15279dcbb99'),('column_input_sales_receipts(jsonb)','5e8fd530b7b6d67eb34ada8e398d8397'),('column_compatible_sales_receipts(stock_operational.sales_receipts)','602a06dcfc554ee9b82734b20e8663c7'),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)','3c62e77d7a976901707c767147b62dd4'),('column_input_sales_receipt_items(jsonb)','94f5445356f0463f7a8ee3500fdfb5c7'),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','7e7f71e313184ec11512a142436a1feb'),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','72ffe0420b16251a08ddd55837d6e63f'),('column_input_sales_receipt_payments(jsonb)','4add5b12604cbc543aadd16889f87890'),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','d9fb8aa2a8909ad85cfa3944cc8a6364'),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','a5fae88e6a96f7f5448d2f2608248df2'),('column_input_sales_receipt_syncs(jsonb)','03ff2bf2e1c6b5dc4a152cb532fea20e'),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7d7b62370f1293d1f8538b453d3c9e19'),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','bba12c9a7351d04a51af3100319c558c'),('column_input_sales_profit_cost_overrides(jsonb)','0e87250f1a18cc7ac3784225993aa482'),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','57cafe6e3972c08da09615953060863e'),('column_project_stock_counts(stock_operational.stock_counts)','c79a797996b5b2be87df0e6b09e60370'),('column_input_stock_counts(jsonb)','6fe86c68c3ead71975ba04e35520e5a2'),('column_compatible_stock_counts(stock_operational.stock_counts)','1965b7ed5af05cdee2ff16d318b02794'),('column_project_stock_adjustments(stock_operational.stock_adjustments)','f94cd9aed024578b8ab72b7c399473bd'),('column_input_stock_adjustments(jsonb)','a40c52ef2277a5c45587b39e08873c56'),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','41b2a7a20c6ebefbc68e79723bd9a3d4'),('column_project_movements(stock_operational.movements)','5e16c86604f30d405eab3c13a7cd89e8'),('column_input_movements(jsonb)','4b71c0f354c79327861307662e77a23a'),('column_compatible_movements(stock_operational.movements)','37ff0bb8cfbd69299b855d7728dcfd5e'),('column_project_movement_details(stock_operational.movement_details)','1f41da392a375f6ad23a1fc3b1118cee'),('column_input_movement_details(jsonb)','8051e8d985727846324ef6da6cee5c1b'),('column_compatible_movement_details(stock_operational.movement_details)','1333f7c7dfb4a56b9e5e9b2d04874a1b'),('column_project_user_state(stock_operational.user_state)','b5e74e66f7a93af6eaea61fb235d03be'),('column_input_user_state(jsonb)','6ac3f912559140a166d01ef0949f3101'),('column_compatible_user_state(stock_operational.user_state)','e1e5f22d86d53443d957a2bef4239e66'),('column_mapping_contract_v1()','9196f1a4b00eeee35d3834370a2e87d4'),('native_timestamp_input(text)','5555bc26987e15a622b9b50797caefa6'),('native_timestamp_text(timestamptz)','5ad1f4189fa453fedf54eb9dfe7b5e0e'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7')) e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed lexeme predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
CREATE FUNCTION stock_operational.typed_project_orders(r stock_operational.orders) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."seller",'')),
 to_jsonb(coalesce(r."totalPrice"::text,'')),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_orders(cells jsonb) RETURNS stock_operational.orders
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.orders; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."status" := nullif((cells->>1),'')::text;
r."seller" := nullif((cells->>2),'')::text;
r."totalPrice" := nullif((cells->>3),'')::numeric;
r."remark" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>7);
r."createdBy" := nullif((cells->>8),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_order_items(r stock_operational.order_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(r."imageUrl",'')),
 to_jsonb(coalesce(r."quoteQuantity"::text,'')),
 to_jsonb(coalesce(r."deliveredQuantity"::text,'')),
 to_jsonb(coalesce(r."productCode",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_order_items(cells jsonb) RETURNS stock_operational.order_items
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.order_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."orderId" := nullif((cells->>1),'')::text;
r."imageUrl" := nullif((cells->>2),'')::text;
r."quoteQuantity" := nullif((cells->>3),'')::numeric;
r."deliveredQuantity" := nullif((cells->>4),'')::numeric;
r."productCode" := nullif((cells->>5),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>8);
r."createdBy" := nullif((cells->>9),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_order_bills(r stock_operational.order_bills) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(r."imageUrl",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_order_bills(cells jsonb) RETURNS stock_operational.order_bills
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

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_shipments(r stock_operational.shipments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."carrier",'')),
 to_jsonb(coalesce(r."poNumber",'')),
 to_jsonb(coalesce(r."shippingFee"::text,'')),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(r."shippedAt",'')),
 to_jsonb(coalesce(r."deliveredAt",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 to_jsonb(coalesce(r."shippingBillUrl",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_shipments(cells jsonb) RETURNS stock_operational.shipments
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shipments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."status" := nullif((cells->>1),'')::text;
r."carrier" := nullif((cells->>2),'')::text;
r."poNumber" := nullif((cells->>3),'')::text;
r."shippingFee" := nullif((cells->>4),'')::numeric;
r."remark" := nullif((cells->>5),'')::text;
r."shippedAt" := nullif((cells->>6),'')::text;
r."deliveredAt" := nullif((cells->>7),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>8);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>9);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'')::text;
r."shippingBillUrl" := nullif((cells->>12),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_shipment_orders(r stock_operational.shipment_orders) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."shipmentId",'')),
 to_jsonb(coalesce(r."orderId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_shipment_orders(cells jsonb) RETURNS stock_operational.shipment_orders
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

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_employees(r stock_operational.employees) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
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
CREATE FUNCTION stock_operational.typed_input_employees(cells jsonb) RETURNS stock_operational.employees
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

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_employee_compensations(r stock_operational.employee_compensations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."baseSalary"::text,'')),
 to_jsonb(coalesce(r."commission"::text,'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."updatedBy",'')),
 to_jsonb(coalesce(r."effectiveFrom",'')),
 to_jsonb(coalesce(r."compensationType",'')),
 to_jsonb(coalesce(r."commissionType",'')),
 to_jsonb(coalesce(r."commissionBucketSales"::text,'')),
 to_jsonb(coalesce(r."commissionBucketAmount"::text,'')),
 to_jsonb(coalesce(r."commissionRoundupThreshold"::text,'')));
$$;
CREATE FUNCTION stock_operational.typed_input_employee_compensations(cells jsonb) RETURNS stock_operational.employee_compensations
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_compensations; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>12 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."employeeId" := nullif((cells->>0),'')::text;
r."baseSalary" := nullif((cells->>1),'')::numeric;
r."commission" := nullif((cells->>2),'')::numeric;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedBy" := nullif((cells->>5),'')::text;
r."effectiveFrom" := nullif((cells->>6),'')::text;
r."compensationType" := nullif((cells->>7),'')::text;
r."commissionType" := nullif((cells->>8),'')::text;
r."commissionBucketSales" := nullif((cells->>9),'')::numeric;
r."commissionBucketAmount" := nullif((cells->>10),'')::numeric;
r."commissionRoundupThreshold" := nullif((cells->>11),'')::numeric;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_employee_timesheets(r stock_operational.employee_timesheets) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."workdayType",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_employee_timesheets(cells jsonb) RETURNS stock_operational.employee_timesheets
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

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_employee_advances(r stock_operational.employee_advances) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."requestedDate",'')),
 to_jsonb(coalesce(r."payrollMonth",'')),
 to_jsonb(coalesce(r."requestedAmount"::text,'')),
 to_jsonb(coalesce(r."paidAmount"::text,'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."paidDate",'')),
 to_jsonb(coalesce(r."reference",'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.typed_input_employee_advances(cells jsonb) RETURNS stock_operational.employee_advances
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
r."paidAmount" := nullif((cells->>6),'')::numeric;
r."status" := nullif((cells->>7),'')::text;
r."paidDate" := nullif((cells->>8),'')::text;
r."reference" := nullif((cells->>9),'')::text;
r."note" := nullif((cells->>10),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>11);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>12);

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_payroll_settlements(r stock_operational.payroll_settlements) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."paidDate",'')),
 to_jsonb(coalesce(r."reference",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(r."snapshot"::text,'')));
$$;
CREATE FUNCTION stock_operational.typed_input_payroll_settlements(cells jsonb) RETURNS stock_operational.payroll_settlements
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
r."snapshot" := nullif((cells->>6),'')::jsonb;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_expenses(r stock_operational.expenses) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."expenseDate",'')),
 to_jsonb(coalesce(r."shopId",'')),
 to_jsonb(coalesce(r."scope",'')),
 to_jsonb(coalesce(r."categoryId",'')),
 to_jsonb(coalesce(r."name",'')),
 to_jsonb(coalesce(r."amount"::text,'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."deletedAt"),'')));
$$;
CREATE FUNCTION stock_operational.typed_input_expenses(cells jsonb) RETURNS stock_operational.expenses
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
r."note" := nullif((cells->>8),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>9);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'')::text;
r."deletedAt" := stock_operational.native_timestamp_input(cells->>12);

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_expense_categories(r stock_operational.expense_categories) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."name",'')),
 coalesce(to_jsonb(r."active"),'""'::jsonb),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.typed_input_expense_categories(cells jsonb) RETURNS stock_operational.expense_categories
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.expense_categories; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>5 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."name" := nullif((cells->>1),'')::text;
IF cells->>2 IS NULL OR cells->>2='' THEN r."active" := NULL;
ELSIF jsonb_typeof(cells->2)='boolean' OR (lower(btrim(cells->>2))) IN ('true','false') THEN r."active" := (lower(btrim(cells->>2)))::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_shops(r stock_operational.shops) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."name",'')),
 coalesce(to_jsonb(r."active"),'""'::jsonb),
 to_jsonb(coalesce(r."loyverseAccountId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.typed_input_shops(cells jsonb) RETURNS stock_operational.shops
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shops; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>6 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."name" := nullif((cells->>1),'')::text;
IF cells->>2 IS NULL OR cells->>2='' THEN r."active" := NULL;
ELSIF jsonb_typeof(cells->2)='boolean' OR (lower(btrim(cells->>2))) IN ('true','false') THEN r."active" := (lower(btrim(cells->>2)))::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;
r."loyverseAccountId" := nullif((cells->>3),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>5);
RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_sales_receipts(r stock_operational.sales_receipts) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
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
 to_jsonb(coalesce(r."totalMoney"::text,'')),
 to_jsonb(coalesce(r."totalTax"::text,'')),
 to_jsonb(coalesce(r."totalDiscount"::text,'')),
 to_jsonb(coalesce(r."tip"::text,'')),
 to_jsonb(coalesce(r."surcharge"::text,'')),
 to_jsonb(coalesce(r."pointsEarned"::text,'')),
 to_jsonb(coalesce(r."pointsDeducted"::text,'')),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_sales_receipts(cells jsonb) RETURNS stock_operational.sales_receipts
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
r."totalTax" := nullif((cells->>19),'')::numeric;
r."totalDiscount" := nullif((cells->>20),'')::numeric;
r."tip" := nullif((cells->>21),'')::numeric;
r."surcharge" := nullif((cells->>22),'')::numeric;
r."pointsEarned" := nullif((cells->>23),'')::numeric;
r."pointsDeducted" := nullif((cells->>24),'')::numeric;
r."syncedAt" := nullif((cells->>25),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_sales_receipt_items(r stock_operational.sales_receipt_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."receiptId",'')),
 to_jsonb(coalesce(r."lineItemId",'')),
 to_jsonb(coalesce(r."itemId",'')),
 to_jsonb(coalesce(r."variantId",'')),
 to_jsonb(coalesce(r."itemName",'')),
 to_jsonb(coalesce(r."variantName",'')),
 to_jsonb(coalesce(r."sku",'')),
 to_jsonb(coalesce(r."quantity"::text,'')),
 to_jsonb(coalesce(r."price"::text,'')),
 to_jsonb(coalesce(r."grossTotalMoney"::text,'')),
 to_jsonb(coalesce(r."totalDiscount"::text,'')),
 to_jsonb(coalesce(r."totalMoney"::text,'')),
 to_jsonb(coalesce(r."cost"::text,'')),
 to_jsonb(coalesce(r."costTotal"::text,'')),
 to_jsonb(coalesce(r."taxes"::text,'')),
 to_jsonb(coalesce(r."lineNote",'')),
 to_jsonb(coalesce(r."lineDiscountsJson"::text,'')),
 to_jsonb(coalesce(r."lineTaxesJson"::text,'')),
 to_jsonb(coalesce(r."lineModifiersJson"::text,'')),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_sales_receipt_items(cells jsonb) RETURNS stock_operational.sales_receipt_items
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
r."price" := nullif((cells->>9),'')::numeric;
r."grossTotalMoney" := nullif((cells->>10),'')::numeric;
r."totalDiscount" := nullif((cells->>11),'')::numeric;
r."totalMoney" := nullif((cells->>12),'')::numeric;
r."cost" := nullif((cells->>13),'')::numeric;
r."costTotal" := nullif((cells->>14),'')::numeric;
r."taxes" := nullif((cells->>15),'')::numeric;
r."lineNote" := nullif((cells->>16),'')::text;
r."lineDiscountsJson" := nullif((cells->>17),'')::jsonb;
r."lineTaxesJson" := nullif((cells->>18),'')::jsonb;
r."lineModifiersJson" := nullif((cells->>19),'')::jsonb;
r."syncedAt" := nullif((cells->>20),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_sales_receipt_payments(r stock_operational.sales_receipt_payments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."receiptId",'')),
 to_jsonb(coalesce(r."paymentIndex"::text,'')),
 to_jsonb(coalesce(r."paymentTypeId",'')),
 to_jsonb(coalesce(r."paymentName",'')),
 to_jsonb(coalesce(r."paymentType",'')),
 to_jsonb(coalesce(r."moneyAmount"::text,'')),
 to_jsonb(coalesce(r."paidAt",'')),
 to_jsonb(coalesce(r."paymentDetailsJson"::text,'')),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_sales_receipt_payments(cells jsonb) RETURNS stock_operational.sales_receipt_payments
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_payments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."receiptId" := nullif((cells->>1),'')::text;
r."paymentIndex" := nullif((cells->>2),'')::bigint;
r."paymentTypeId" := nullif((cells->>3),'')::text;
r."paymentName" := nullif((cells->>4),'')::text;
r."paymentType" := nullif((cells->>5),'')::text;
r."moneyAmount" := nullif((cells->>6),'')::numeric;
r."paidAt" := nullif((cells->>7),'')::text;
r."paymentDetailsJson" := nullif((cells->>8),'')::jsonb;
r."syncedAt" := nullif((cells->>9),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_sales_receipt_syncs(r stock_operational.sales_receipt_syncs) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."salesDate",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."receiptCount"::text,'')),
 to_jsonb(coalesce(r."itemCount"::text,'')),
 to_jsonb(coalesce(r."paymentCount"::text,'')),
 to_jsonb(coalesce(r."syncedAt",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_sales_receipt_syncs(cells jsonb) RETURNS stock_operational.sales_receipt_syncs
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
r."itemCount" := nullif((cells->>6),'')::bigint;
r."paymentCount" := nullif((cells->>7),'')::bigint;
r."syncedAt" := nullif((cells->>8),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_sales_profit_cost_overrides(r stock_operational.sales_profit_cost_overrides) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."averageItemCost"::text,'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_sales_profit_cost_overrides(cells jsonb) RETURNS stock_operational.sales_profit_cost_overrides
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_profit_cost_overrides; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."month" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."averageItemCost" := nullif((cells->>3),'')::numeric;
r."note" := nullif((cells->>4),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."createdBy" := nullif((cells->>7),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_stock_counts(r stock_operational.stock_counts) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."month",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."physicalCount"::text,'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(r."countedAt",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."updatedBy",'')));
$$;
CREATE FUNCTION stock_operational.typed_input_stock_counts(cells jsonb) RETURNS stock_operational.stock_counts
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.stock_counts; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."month" := nullif((cells->>1),'')::text;
r."accountId" := nullif((cells->>2),'')::text;
r."shopName" := nullif((cells->>3),'')::text;
r."physicalCount" := nullif((cells->>4),'')::numeric;
r."note" := nullif((cells->>5),'')::text;
r."countedAt" := nullif((cells->>6),'')::text;
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."updatedBy" := nullif((cells->>8),'')::text;

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_stock_adjustments(r stock_operational.stock_adjustments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."accountId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."date",'')),
 to_jsonb(coalesce(r."direction",'')),
 to_jsonb(coalesce(r."reason",'')),
 to_jsonb(coalesce(r."employeeId",'')),
 to_jsonb(coalesce(r."employeeName",'')),
 to_jsonb(coalesce(r."quantity"::text,'')),
 to_jsonb(coalesce(r."itemDescription",'')),
 to_jsonb(coalesce(r."photoUrl",'')),
 to_jsonb(coalesce(r."note",'')),
 to_jsonb(coalesce(r."reversesId",'')),
 to_jsonb(coalesce(r."replacesId",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(r."createdBy",'')),
 coalesce(to_jsonb(r."notInLoyverse"),'""'::jsonb));
$$;
CREATE FUNCTION stock_operational.typed_input_stock_adjustments(cells jsonb) RETURNS stock_operational.stock_adjustments
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
r."itemDescription" := nullif((cells->>9),'')::text;
r."photoUrl" := nullif((cells->>10),'')::text;
r."note" := nullif((cells->>11),'')::text;
r."reversesId" := nullif((cells->>12),'')::text;
r."replacesId" := nullif((cells->>13),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>14);
r."createdBy" := nullif((cells->>15),'')::text;
IF cells->>16 IS NULL OR cells->>16='' THEN r."notInLoyverse" := NULL;
ELSIF jsonb_typeof(cells->16)='boolean' OR (lower(cells->>16)) IN ('true','false') THEN r."notInLoyverse" := (lower(cells->>16))::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_movements(r stock_operational.movements) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."userId",'')),
 to_jsonb(coalesce(r."packingDate",'')),
 to_jsonb(coalesce(r."deliverDateTime",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(r."totalQuantity"::text,'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')));
$$;
CREATE FUNCTION stock_operational.typed_input_movements(cells jsonb) RETURNS stock_operational.movements
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
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);

RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_movement_details(r stock_operational.movement_details) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."movementMasterId",'')),
 to_jsonb(coalesce(r."shopName",'')),
 to_jsonb(coalesce(r."quantity"::text,'')),
 to_jsonb(coalesce(r."remark",'')),
 to_jsonb(coalesce(r."fromLocation",'')),
 to_jsonb(coalesce(r."toLocation",'')),
 to_jsonb(coalesce(r."productImageUrl",'')),
 to_jsonb(coalesce(r."purchaseDetailId",'')),
 to_jsonb(coalesce(r."status",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 coalesce(to_jsonb(r."stockCounted"),'""'::jsonb),
 coalesce(to_jsonb(r."isNewArrival"),'""'::jsonb));
$$;
CREATE FUNCTION stock_operational.typed_input_movement_details(cells jsonb) RETURNS stock_operational.movement_details
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.movement_details; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM 'array' OR jsonb_array_length(cells)>14 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;
r."id" := nullif((cells->>0),'')::text;
r."movementMasterId" := nullif((cells->>1),'')::text;
r."shopName" := nullif((cells->>2),'')::text;
r."quantity" := nullif((cells->>3),'')::numeric;
r."remark" := nullif((cells->>4),'')::text;
r."fromLocation" := nullif((cells->>5),'')::text;
r."toLocation" := nullif((cells->>6),'')::text;
r."productImageUrl" := nullif((cells->>7),'')::text;
r."purchaseDetailId" := nullif((cells->>8),'')::text;
r."status" := nullif((cells->>9),'')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>10);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>11);
IF cells->>12 IS NULL OR cells->>12='' THEN r."stockCounted" := NULL;
ELSIF jsonb_typeof(cells->12)='boolean' OR (lower(cells->>12)) IN ('true','false') THEN r."stockCounted" := (lower(cells->>12))::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;
IF cells->>13 IS NULL OR cells->>13='' THEN r."isNewArrival" := NULL;
ELSIF jsonb_typeof(cells->13)='boolean' OR (lower(cells->>13)) IN ('true','false') THEN r."isNewArrival" := (lower(cells->>13))::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.typed_project_user_state(r stock_operational.user_state) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'')),
 to_jsonb(coalesce(r."userId",'')),
 to_jsonb(coalesce(r."flowname",'')),
 to_jsonb(coalesce(r."referenceId",'')),
 to_jsonb(coalesce(r."state",'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."createdAt"),'')),
 to_jsonb(coalesce(stock_operational.native_timestamp_text(r."updatedAt"),'')),
 to_jsonb(coalesce(r."context"::text,'')));
$$;
CREATE FUNCTION stock_operational.typed_input_user_state(cells jsonb) RETURNS stock_operational.user_state
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
r."context" := nullif((cells->>7),'')::jsonb;
IF jsonb_typeof(cells->0) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;
IF jsonb_typeof(cells->1) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;
IF jsonb_typeof(cells->2) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;
IF jsonb_typeof(cells->3) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;
IF jsonb_typeof(cells->4) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.lexeme_mapping_contract_v1() RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE valid integer; lexemes integer; total integer;
BEGIN
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND NOT a.attisdropped AND a.attname IN ('business_cells','row_order','cell_kinds','created_at_instant');
 IF total<>0 THEN RAISE EXCEPTION 'Unsupported predecessor schema'; END IF;
 SELECT (SELECT count(*) FROM (VALUES ('orders','id','text'),('orders','status','text'),('orders','seller','text'),('orders','totalPrice','numeric'),('orders','remark','text'),('orders','createdAt','timestamp with time zone'),('orders','updatedAt','timestamp with time zone'),('orders','deletedAt','timestamp with time zone'),('orders','createdBy','text'),('orders','revision','bigint'),('orders','archived_at','timestamp with time zone'),('order_items','id','text'),('order_items','orderId','text'),('order_items','imageUrl','text'),('order_items','quoteQuantity','numeric'),('order_items','deliveredQuantity','numeric'),('order_items','productCode','text'),('order_items','createdAt','timestamp with time zone'),('order_items','updatedAt','timestamp with time zone'),('order_items','deletedAt','timestamp with time zone'),('order_items','createdBy','text'),('order_items','revision','bigint'),('order_items','archived_at','timestamp with time zone'),('order_bills','id','text'),('order_bills','orderId','text'),('order_bills','imageUrl','text'),('order_bills','createdAt','timestamp with time zone'),('order_bills','updatedAt','timestamp with time zone'),('order_bills','deletedAt','timestamp with time zone'),('order_bills','createdBy','text'),('order_bills','revision','bigint'),('order_bills','archived_at','timestamp with time zone'),('shipments','id','text'),('shipments','status','text'),('shipments','carrier','text'),('shipments','poNumber','text'),('shipments','shippingFee','numeric'),('shipments','remark','text'),('shipments','shippedAt','text'),('shipments','deliveredAt','text'),('shipments','createdAt','timestamp with time zone'),('shipments','updatedAt','timestamp with time zone'),('shipments','deletedAt','timestamp with time zone'),('shipments','createdBy','text'),('shipments','shippingBillUrl','text'),('shipments','revision','bigint'),('shipments','archived_at','timestamp with time zone'),('shipment_orders','id','text'),('shipment_orders','shipmentId','text'),('shipment_orders','orderId','text'),('shipment_orders','createdAt','timestamp with time zone'),('shipment_orders','updatedAt','timestamp with time zone'),('shipment_orders','deletedAt','timestamp with time zone'),('shipment_orders','createdBy','text'),('shipment_orders','revision','bigint'),('shipment_orders','archived_at','timestamp with time zone'),('employees','id','text'),('employees','name','text'),('employees','phone','text'),('employees','status','text'),('employees','hiredDate','text'),('employees','terminatedDate','text'),('employees','createdAt','timestamp with time zone'),('employees','updatedAt','timestamp with time zone'),('employees','createdBy','text'),('employees','revision','bigint'),('employees','archived_at','timestamp with time zone'),('employee_compensations','employeeId','text'),('employee_compensations','baseSalary','numeric'),('employee_compensations','commission','numeric'),('employee_compensations','createdAt','timestamp with time zone'),('employee_compensations','updatedAt','timestamp with time zone'),('employee_compensations','updatedBy','text'),('employee_compensations','effectiveFrom','text'),('employee_compensations','compensationType','text'),('employee_compensations','commissionType','text'),('employee_compensations','commissionBucketSales','numeric'),('employee_compensations','commissionBucketAmount','numeric'),('employee_compensations','commissionRoundupThreshold','numeric'),('employee_compensations','revision','bigint'),('employee_compensations','archived_at','timestamp with time zone'),('employee_compensations','migration_id','text'),('employee_timesheets','id','text'),('employee_timesheets','employeeId','text'),('employee_timesheets','shopId','text'),('employee_timesheets','status','text'),('employee_timesheets','createdAt','timestamp with time zone'),('employee_timesheets','updatedAt','timestamp with time zone'),('employee_timesheets','workdayType','text'),('employee_timesheets','revision','bigint'),('employee_timesheets','archived_at','timestamp with time zone'),('employee_advances','id','text'),('employee_advances','employeeId','text'),('employee_advances','shopId','text'),('employee_advances','requestedDate','text'),('employee_advances','payrollMonth','text'),('employee_advances','requestedAmount','numeric'),('employee_advances','paidAmount','numeric'),('employee_advances','status','text'),('employee_advances','paidDate','text'),('employee_advances','reference','text'),('employee_advances','note','text'),('employee_advances','createdAt','timestamp with time zone'),('employee_advances','updatedAt','timestamp with time zone'),('employee_advances','revision','bigint'),('employee_advances','archived_at','timestamp with time zone'),('payroll_settlements','id','text'),('payroll_settlements','employeeId','text'),('payroll_settlements','month','text'),('payroll_settlements','paidDate','text'),('payroll_settlements','reference','text'),('payroll_settlements','createdAt','timestamp with time zone'),('payroll_settlements','snapshot','jsonb'),('payroll_settlements','revision','bigint'),('payroll_settlements','archived_at','timestamp with time zone'),('expenses','id','text'),('expenses','month','text'),('expenses','expenseDate','text'),('expenses','shopId','text'),('expenses','scope','text'),('expenses','categoryId','text'),('expenses','name','text'),('expenses','amount','numeric'),('expenses','note','text'),('expenses','createdAt','timestamp with time zone'),('expenses','updatedAt','timestamp with time zone'),('expenses','createdBy','text'),('expenses','deletedAt','timestamp with time zone'),('expenses','revision','bigint'),('expenses','archived_at','timestamp with time zone'),('expense_categories','id','text'),('expense_categories','name','text'),('expense_categories','active','boolean'),('expense_categories','createdAt','timestamp with time zone'),('expense_categories','updatedAt','timestamp with time zone'),('expense_categories','revision','bigint'),('expense_categories','archived_at','timestamp with time zone'),('shops','id','text'),('shops','name','text'),('shops','active','boolean'),('shops','loyverseAccountId','text'),('shops','createdAt','timestamp with time zone'),('shops','updatedAt','timestamp with time zone'),('shops','revision','bigint'),('shops','archived_at','timestamp with time zone'),('sales_receipts','id','text'),('sales_receipts','salesDate','text'),('sales_receipts','accountId','text'),('sales_receipts','shopName','text'),('sales_receipts','receiptNumber','text'),('sales_receipts','receiptType','text'),('sales_receipts','refundFor','text'),('sales_receipts','order','text'),('sales_receipts','receiptDate','text'),('sales_receipts','createdAt','timestamp with time zone'),('sales_receipts','updatedAt','timestamp with time zone'),('sales_receipts','cancelledAt','text'),('sales_receipts','source','text'),('sales_receipts','storeId','text'),('sales_receipts','employeeId','text'),('sales_receipts','customerId','text'),('sales_receipts','posDeviceId','text'),('sales_receipts','diningOption','text'),('sales_receipts','totalMoney','numeric'),('sales_receipts','totalTax','numeric'),('sales_receipts','totalDiscount','numeric'),('sales_receipts','tip','numeric'),('sales_receipts','surcharge','numeric'),('sales_receipts','pointsEarned','numeric'),('sales_receipts','pointsDeducted','numeric'),('sales_receipts','syncedAt','text'),('sales_receipts','revision','bigint'),('sales_receipts','archived_at','timestamp with time zone'),('sales_receipt_items','id','text'),('sales_receipt_items','receiptId','text'),('sales_receipt_items','lineItemId','text'),('sales_receipt_items','itemId','text'),('sales_receipt_items','variantId','text'),('sales_receipt_items','itemName','text'),('sales_receipt_items','variantName','text'),('sales_receipt_items','sku','text'),('sales_receipt_items','quantity','numeric'),('sales_receipt_items','price','numeric'),('sales_receipt_items','grossTotalMoney','numeric'),('sales_receipt_items','totalDiscount','numeric'),('sales_receipt_items','totalMoney','numeric'),('sales_receipt_items','cost','numeric'),('sales_receipt_items','costTotal','numeric'),('sales_receipt_items','taxes','numeric'),('sales_receipt_items','lineNote','text'),('sales_receipt_items','lineDiscountsJson','jsonb'),('sales_receipt_items','lineTaxesJson','jsonb'),('sales_receipt_items','lineModifiersJson','jsonb'),('sales_receipt_items','syncedAt','text'),('sales_receipt_items','createdAt','timestamp with time zone'),('sales_receipt_items','revision','bigint'),('sales_receipt_items','archived_at','timestamp with time zone'),('sales_receipt_payments','id','text'),('sales_receipt_payments','receiptId','text'),('sales_receipt_payments','paymentIndex','bigint'),('sales_receipt_payments','paymentTypeId','text'),('sales_receipt_payments','paymentName','text'),('sales_receipt_payments','paymentType','text'),('sales_receipt_payments','moneyAmount','numeric'),('sales_receipt_payments','paidAt','text'),('sales_receipt_payments','paymentDetailsJson','jsonb'),('sales_receipt_payments','syncedAt','text'),('sales_receipt_payments','createdAt','timestamp with time zone'),('sales_receipt_payments','revision','bigint'),('sales_receipt_payments','archived_at','timestamp with time zone'),('sales_receipt_syncs','id','text'),('sales_receipt_syncs','salesDate','text'),('sales_receipt_syncs','accountId','text'),('sales_receipt_syncs','shopName','text'),('sales_receipt_syncs','status','text'),('sales_receipt_syncs','receiptCount','bigint'),('sales_receipt_syncs','itemCount','bigint'),('sales_receipt_syncs','paymentCount','bigint'),('sales_receipt_syncs','syncedAt','text'),('sales_receipt_syncs','createdAt','timestamp with time zone'),('sales_receipt_syncs','revision','bigint'),('sales_receipt_syncs','archived_at','timestamp with time zone'),('sales_profit_cost_overrides','id','text'),('sales_profit_cost_overrides','month','text'),('sales_profit_cost_overrides','accountId','text'),('sales_profit_cost_overrides','averageItemCost','numeric'),('sales_profit_cost_overrides','note','text'),('sales_profit_cost_overrides','createdAt','timestamp with time zone'),('sales_profit_cost_overrides','updatedAt','timestamp with time zone'),('sales_profit_cost_overrides','createdBy','text'),('sales_profit_cost_overrides','revision','bigint'),('sales_profit_cost_overrides','archived_at','timestamp with time zone'),('stock_counts','id','text'),('stock_counts','month','text'),('stock_counts','accountId','text'),('stock_counts','shopName','text'),('stock_counts','physicalCount','numeric'),('stock_counts','note','text'),('stock_counts','countedAt','text'),('stock_counts','updatedAt','timestamp with time zone'),('stock_counts','updatedBy','text'),('stock_counts','createdAt','timestamp with time zone'),('stock_counts','revision','bigint'),('stock_counts','archived_at','timestamp with time zone'),('stock_adjustments','id','text'),('stock_adjustments','accountId','text'),('stock_adjustments','shopName','text'),('stock_adjustments','date','text'),('stock_adjustments','direction','text'),('stock_adjustments','reason','text'),('stock_adjustments','employeeId','text'),('stock_adjustments','employeeName','text'),('stock_adjustments','quantity','numeric'),('stock_adjustments','itemDescription','text'),('stock_adjustments','photoUrl','text'),('stock_adjustments','note','text'),('stock_adjustments','reversesId','text'),('stock_adjustments','replacesId','text'),('stock_adjustments','createdAt','timestamp with time zone'),('stock_adjustments','createdBy','text'),('stock_adjustments','notInLoyverse','boolean'),('stock_adjustments','revision','bigint'),('stock_adjustments','archived_at','timestamp with time zone'),('movements','id','text'),('movements','userId','text'),('movements','packingDate','text'),('movements','deliverDateTime','text'),('movements','status','text'),('movements','totalQuantity','numeric'),('movements','createdAt','timestamp with time zone'),('movements','updatedAt','timestamp with time zone'),('movements','revision','bigint'),('movements','archived_at','timestamp with time zone'),('movement_details','id','text'),('movement_details','movementMasterId','text'),('movement_details','shopName','text'),('movement_details','quantity','numeric'),('movement_details','remark','text'),('movement_details','fromLocation','text'),('movement_details','toLocation','text'),('movement_details','productImageUrl','text'),('movement_details','purchaseDetailId','text'),('movement_details','status','text'),('movement_details','createdAt','timestamp with time zone'),('movement_details','updatedAt','timestamp with time zone'),('movement_details','stockCounted','boolean'),('movement_details','isNewArrival','boolean'),('movement_details','revision','bigint'),('movement_details','archived_at','timestamp with time zone'),('user_state','id','text'),('user_state','userId','text'),('user_state','flowname','text'),('user_state','referenceId','text'),('user_state','state','text'),('user_state','createdAt','timestamp with time zone'),('user_state','updatedAt','timestamp with time zone'),('user_state','context','jsonb'),('user_state','revision','bigint'),('user_state','archived_at','timestamp with time zone')) e(name,column_name,datatype) JOIN pg_class c ON c.relname=e.name AND c.relnamespace='stock_operational'::regnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype) INTO valid;
 IF valid<>299 THEN RAISE EXCEPTION 'Unsupported typed-column schema'; END IF;
 SELECT (SELECT count(*) FROM (VALUES ('orders','totalPrice__lexeme','text'),('order_items','quoteQuantity__lexeme','text'),('order_items','deliveredQuantity__lexeme','text'),('shipments','shippingFee__lexeme','text'),('employee_compensations','baseSalary__lexeme','text'),('employee_compensations','commission__lexeme','text'),('employee_compensations','commissionBucketSales__lexeme','text'),('employee_compensations','commissionBucketAmount__lexeme','text'),('employee_compensations','commissionRoundupThreshold__lexeme','text'),('employee_advances','requestedAmount__lexeme','text'),('employee_advances','paidAmount__lexeme','text'),('payroll_settlements','snapshot__lexeme','text'),('expenses','amount__lexeme','text'),('expense_categories','active__lexeme','text'),('shops','active__lexeme','text'),('sales_receipts','totalMoney__lexeme','text'),('sales_receipts','totalTax__lexeme','text'),('sales_receipts','totalDiscount__lexeme','text'),('sales_receipts','tip__lexeme','text'),('sales_receipts','surcharge__lexeme','text'),('sales_receipts','pointsEarned__lexeme','text'),('sales_receipts','pointsDeducted__lexeme','text'),('sales_receipt_items','quantity__lexeme','text'),('sales_receipt_items','price__lexeme','text'),('sales_receipt_items','grossTotalMoney__lexeme','text'),('sales_receipt_items','totalDiscount__lexeme','text'),('sales_receipt_items','totalMoney__lexeme','text'),('sales_receipt_items','cost__lexeme','text'),('sales_receipt_items','costTotal__lexeme','text'),('sales_receipt_items','taxes__lexeme','text'),('sales_receipt_items','lineDiscountsJson__lexeme','text'),('sales_receipt_items','lineTaxesJson__lexeme','text'),('sales_receipt_items','lineModifiersJson__lexeme','text'),('sales_receipt_payments','paymentIndex__lexeme','text'),('sales_receipt_payments','moneyAmount__lexeme','text'),('sales_receipt_payments','paymentDetailsJson__lexeme','text'),('sales_receipt_syncs','receiptCount__lexeme','text'),('sales_receipt_syncs','itemCount__lexeme','text'),('sales_receipt_syncs','paymentCount__lexeme','text'),('sales_profit_cost_overrides','averageItemCost__lexeme','text'),('stock_counts','physicalCount__lexeme','text'),('stock_adjustments','quantity__lexeme','text'),('stock_adjustments','notInLoyverse__lexeme','text'),('movements','totalQuantity__lexeme','text'),('movement_details','quantity__lexeme','text'),('movement_details','stockCounted__lexeme','text'),('movement_details','isNewArrival__lexeme','text'),('user_state','context__lexeme','text')) e(name,column_name,datatype) JOIN pg_class c ON c.relname=e.name AND c.relnamespace='stock_operational'::regnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype) INTO lexemes;
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND NOT a.attisdropped AND right(a.attname,8)='__lexeme';
 IF lexemes=48 AND total=48 THEN RETURN 'retained'; END IF;
 IF lexemes=0 AND total=0 THEN
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='stock_operational'::regnamespace
   AND p.oid<>'stock_operational.lexeme_mapping_contract_v1()'::regprocedure
   AND strpos(p.prosrc,'__lexeme')>0) THEN RAISE EXCEPTION 'Incomplete lexeme function retirement'; END IF;
  RETURN 'typed';
 END IF;
 RAISE EXCEPTION 'Partial lexeme schema';
END $$;
REVOKE ALL ON FUNCTION stock_operational.typed_project_orders(stock_operational.orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_orders(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_order_items(stock_operational.order_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_order_items(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_order_bills(stock_operational.order_bills) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_order_bills(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_shipments(stock_operational.shipments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_shipments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_shipment_orders(stock_operational.shipment_orders) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_shipment_orders(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_employees(stock_operational.employees) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_employees(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_employee_compensations(stock_operational.employee_compensations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_employee_compensations(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_employee_timesheets(stock_operational.employee_timesheets) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_employee_timesheets(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_employee_advances(stock_operational.employee_advances) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_employee_advances(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_payroll_settlements(stock_operational.payroll_settlements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_payroll_settlements(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_expenses(stock_operational.expenses) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_expenses(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_expense_categories(stock_operational.expense_categories) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_expense_categories(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_shops(stock_operational.shops) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_shops(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_sales_receipts(stock_operational.sales_receipts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_sales_receipts(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_sales_receipt_items(stock_operational.sales_receipt_items) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_sales_receipt_items(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_sales_receipt_payments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_sales_receipt_syncs(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_sales_profit_cost_overrides(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_stock_counts(stock_operational.stock_counts) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_stock_counts(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_stock_adjustments(stock_operational.stock_adjustments) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_stock_adjustments(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_movements(stock_operational.movements) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_movements(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_movement_details(stock_operational.movement_details) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_movement_details(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_project_user_state(stock_operational.user_state) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.typed_input_user_state(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION stock_operational.lexeme_mapping_contract_v1() FROM PUBLIC,anon,authenticated;
DO $callers$ DECLARE item record; BEGIN
 FOR item IN SELECT e.new_signature,pg_get_userbyid(a.grantee) AS name FROM (VALUES ('typed_project_orders(stock_operational.orders)','column_project_orders(stock_operational.orders)'),('typed_input_orders(jsonb)','column_input_orders(jsonb)'),('typed_project_order_items(stock_operational.order_items)','column_project_order_items(stock_operational.order_items)'),('typed_input_order_items(jsonb)','column_input_order_items(jsonb)'),('typed_project_order_bills(stock_operational.order_bills)','column_project_order_bills(stock_operational.order_bills)'),('typed_input_order_bills(jsonb)','column_input_order_bills(jsonb)'),('typed_project_shipments(stock_operational.shipments)','column_project_shipments(stock_operational.shipments)'),('typed_input_shipments(jsonb)','column_input_shipments(jsonb)'),('typed_project_shipment_orders(stock_operational.shipment_orders)','column_project_shipment_orders(stock_operational.shipment_orders)'),('typed_input_shipment_orders(jsonb)','column_input_shipment_orders(jsonb)'),('typed_project_employees(stock_operational.employees)','column_project_employees(stock_operational.employees)'),('typed_input_employees(jsonb)','column_input_employees(jsonb)'),('typed_project_employee_compensations(stock_operational.employee_compensations)','column_project_employee_compensations(stock_operational.employee_compensations)'),('typed_input_employee_compensations(jsonb)','column_input_employee_compensations(jsonb)'),('typed_project_employee_timesheets(stock_operational.employee_timesheets)','column_project_employee_timesheets(stock_operational.employee_timesheets)'),('typed_input_employee_timesheets(jsonb)','column_input_employee_timesheets(jsonb)'),('typed_project_employee_advances(stock_operational.employee_advances)','column_project_employee_advances(stock_operational.employee_advances)'),('typed_input_employee_advances(jsonb)','column_input_employee_advances(jsonb)'),('typed_project_payroll_settlements(stock_operational.payroll_settlements)','column_project_payroll_settlements(stock_operational.payroll_settlements)'),('typed_input_payroll_settlements(jsonb)','column_input_payroll_settlements(jsonb)'),('typed_project_expenses(stock_operational.expenses)','column_project_expenses(stock_operational.expenses)'),('typed_input_expenses(jsonb)','column_input_expenses(jsonb)'),('typed_project_expense_categories(stock_operational.expense_categories)','column_project_expense_categories(stock_operational.expense_categories)'),('typed_input_expense_categories(jsonb)','column_input_expense_categories(jsonb)'),('typed_project_shops(stock_operational.shops)','column_project_shops(stock_operational.shops)'),('typed_input_shops(jsonb)','column_input_shops(jsonb)'),('typed_project_sales_receipts(stock_operational.sales_receipts)','column_project_sales_receipts(stock_operational.sales_receipts)'),('typed_input_sales_receipts(jsonb)','column_input_sales_receipts(jsonb)'),('typed_project_sales_receipt_items(stock_operational.sales_receipt_items)','column_project_sales_receipt_items(stock_operational.sales_receipt_items)'),('typed_input_sales_receipt_items(jsonb)','column_input_sales_receipt_items(jsonb)'),('typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)'),('typed_input_sales_receipt_payments(jsonb)','column_input_sales_receipt_payments(jsonb)'),('typed_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'),('typed_input_sales_receipt_syncs(jsonb)','column_input_sales_receipt_syncs(jsonb)'),('typed_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'),('typed_input_sales_profit_cost_overrides(jsonb)','column_input_sales_profit_cost_overrides(jsonb)'),('typed_project_stock_counts(stock_operational.stock_counts)','column_project_stock_counts(stock_operational.stock_counts)'),('typed_input_stock_counts(jsonb)','column_input_stock_counts(jsonb)'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','column_project_stock_adjustments(stock_operational.stock_adjustments)'),('typed_input_stock_adjustments(jsonb)','column_input_stock_adjustments(jsonb)'),('typed_project_movements(stock_operational.movements)','column_project_movements(stock_operational.movements)'),('typed_input_movements(jsonb)','column_input_movements(jsonb)'),('typed_project_movement_details(stock_operational.movement_details)','column_project_movement_details(stock_operational.movement_details)'),('typed_input_movement_details(jsonb)','column_input_movement_details(jsonb)'),('typed_project_user_state(stock_operational.user_state)','column_project_user_state(stock_operational.user_state)'),('typed_input_user_state(jsonb)','column_input_user_state(jsonb)')) e(new_signature,old_signature)
 JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.old_signature)
 CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',item.new_signature,item.name);
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.lexeme_mapping_contract_v1() TO %I',item.name);
 END LOOP;
END $callers$;
SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;
COMMIT;
