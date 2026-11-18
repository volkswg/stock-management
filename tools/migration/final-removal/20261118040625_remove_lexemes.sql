-- OPERATOR ONLY. Released PR78-or-newer app, restored recovery and exact
-- application/LINE consumer review required. No data repair or new encoding.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.lexeme_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_final_lexeme_removal',true)='reviewed-typed-retirement-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_reviewed_fingerprint',true) ~ '^[a-f0-9]{64}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_semantics_verified',true)='exact-app-line-consumers-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
LOCK TABLE stock_migration.import_batches,stock_migration.orders,stock_migration.order_items,stock_migration.order_bills,stock_migration.shipments,stock_migration.shipment_orders,stock_migration.employees,stock_migration.employee_compensations,stock_migration.employee_timesheets,stock_migration.employee_advances,stock_migration.payroll_settlements,stock_migration.expenses,stock_migration.expense_categories,stock_migration.shops,stock_migration.sales_receipts,stock_migration.sales_receipt_items,stock_migration.sales_receipt_payments,stock_migration.sales_receipt_syncs,stock_migration.sales_profit_cost_overrides,stock_migration.stock_counts,stock_migration.stock_adjustments,stock_migration.movements,stock_migration.movement_details,stock_migration.user_state,stock_operational.commands,stock_operational.revision,stock_operational.side_effects,stock_operational.environment,stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.lexeme_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','50719cbebc5bae92893a0372c36c8cd7'),('project_orders(stock_operational.orders)','5ad9464213d153c42111098fce21b17b'),('validate_orders()','a0bfeec665bfefc2a0a5d5006152a4d2'),('input_order_items(jsonb)','ab355c7b479eaad42248ea2db01c2747'),('project_order_items(stock_operational.order_items)','d6111869845458c559c91008a5bcf195'),('validate_order_items()','39f9c8f9d89b5a97e133c52d14994129'),('input_order_bills(jsonb)','d3e907f4efdb3b1b67486d81085af026'),('project_order_bills(stock_operational.order_bills)','8fadad71f337cdc9e478296054ef5690'),('validate_order_bills()','72722aee092af047de74b7bd1a6e6644'),('input_shipments(jsonb)','2480203ae95e3f4e5878df7d6afd29f5'),('project_shipments(stock_operational.shipments)','026b30cee1f3c726b0ea3d2a24370561'),('validate_shipments()','3cfb6b5585093d91ba59f47f2b490c4e'),('input_shipment_orders(jsonb)','b5d7ec9deb37bc83ccba4e4a8b7338a1'),('project_shipment_orders(stock_operational.shipment_orders)','3d34b32b70971418f9e026386a6c541e'),('validate_shipment_orders()','06fa77f9bd707fd2e73948213c7c5ff8'),('input_employees(jsonb)','1d75a8883ceaaaad1dde4052a44b43e8'),('project_employees(stock_operational.employees)','ffaad41277d95a2e99d94144c599f493'),('validate_employees()','39bc43cf3c17759220e24e9eaa3c6ff6'),('input_employee_compensations(jsonb)','e8de230f61f41b25c837c6bb27bc2cfd'),('project_employee_compensations(stock_operational.employee_compensations)','41433896eadd94409838239de5fda96e'),('validate_employee_compensations()','4e8f9c97cd93c4e6b482a5ebbc84d6af'),('input_employee_timesheets(jsonb)','d28f292f4a01cfded1b0aea0e8de9f90'),('project_employee_timesheets(stock_operational.employee_timesheets)','39031659ed6a88dc730e9c756781c370'),('validate_employee_timesheets()','35a1c9d84bdb621b8f8753f82f89bc3c'),('input_employee_advances(jsonb)','17a34a0c3cfc2db7f756a18b5175c5e1'),('project_employee_advances(stock_operational.employee_advances)','b334d251529f45d4f53362f5aa2233d4'),('validate_employee_advances()','98f9783f33a963462768041570856344'),('input_payroll_settlements(jsonb)','59715c303cf3fc068ae130011fd8b8ec'),('project_payroll_settlements(stock_operational.payroll_settlements)','d4984927187a49013604c16c994ff25a'),('validate_payroll_settlements()','3608d8ee42d9a1f018803ca238e71300'),('input_expenses(jsonb)','b7084726cf14b0ad37af1dc394a81223'),('project_expenses(stock_operational.expenses)','fde4ea51720f3b56291a679086622a3e'),('validate_expenses()','cf6e98fa27b0876e43f56d948d3db1e0'),('input_expense_categories(jsonb)','d5e928e37c0cc28a3bada7b6b026d0e4'),('project_expense_categories(stock_operational.expense_categories)','fadd388ba96d6c84e407c39fd7635b96'),('validate_expense_categories()','a7fd060d4e0e7995cb97e6a78a3ccf73'),('input_shops(jsonb)','fb71ca3cdb9af383fb9d258f6a3bcfc0'),('project_shops(stock_operational.shops)','bc76781acc3372af27b0febcb4ebbda8'),('validate_shops()','40222020a4068b705a8915a6cb9f0f67'),('input_sales_receipts(jsonb)','9dc15db3026bcd6224caa11c70908f04'),('project_sales_receipts(stock_operational.sales_receipts)','65fe3137f0145a8a9ea71ecb7ae3a5e4'),('validate_sales_receipts()','2fcde387626beec3bd7533f763a4580c'),('input_sales_receipt_items(jsonb)','2293c379be4bc71a1eeb5260f63c32fe'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','4906e30c6d9cbab5662929e187b20976'),('validate_sales_receipt_items()','258f58d54b6d359ad7b98367c64b5d1c'),('input_sales_receipt_payments(jsonb)','99e0cd773a80910fde101bc3dde24984'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','899359ac074bff91e8ab9410f658870b'),('validate_sales_receipt_payments()','0fb29df9e3b326db3562824b19e67cd5'),('input_sales_receipt_syncs(jsonb)','3f5b6154b687fc631d4c76c3178ed34d'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','cc5bceb9b9608cec80ca05c1e37cb1e8'),('validate_sales_receipt_syncs()','534be012ea29293d689178fc0683a345'),('input_sales_profit_cost_overrides(jsonb)','07cf48a230d44893e60413f1f8926220'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','9904af48e1ae15571174828a50607b67'),('validate_sales_profit_cost_overrides()','20241420d89c651a09a9cb5924085ab6'),('input_stock_counts(jsonb)','47ce4e17ccfd43f624422fc4bcd650cb'),('project_stock_counts(stock_operational.stock_counts)','b75143df9c0b4c120c3f5103a65d281c'),('validate_stock_counts()','f024596006db80ff9c384868ea890941'),('input_stock_adjustments(jsonb)','7b257e593935fe1e9f62ca30eb6f27da'),('project_stock_adjustments(stock_operational.stock_adjustments)','ca5ed676c0e6f82346152208b575c5a2'),('validate_stock_adjustments()','13f2dbcae594d18f3dc40735d7a8dd4d'),('input_movements(jsonb)','19f0b805da03a6f23aa63ce46f7e9146'),('project_movements(stock_operational.movements)','8a00237d7397be8d77017f0e006994d2'),('validate_movements()','49152534d41ae2bc1c1f7ca8abf9af99'),('input_movement_details(jsonb)','9da3052c2250ce94757325d856ff4ba6'),('project_movement_details(stock_operational.movement_details)','011607e8fbe655d5a06b65f88ff9fb60'),('validate_movement_details()','6369c0daf49dc2c9303ca211683ca670'),('input_user_state(jsonb)','81f2510e3a6d774f457471afa3b73303'),('project_user_state(stock_operational.user_state)','2257b09f73473c96ec28640886a228a3'),('validate_user_state()','31d73e9b532148408c7ae0a5cb333848'),('column_numeric_v1(numeric,text)','b6c65a84062cd56a9b5d8f438d554851'),('column_bigint_v1(bigint,text)','a8cbab7e0cf32fcfc720a2572963ddbf'),('column_boolean_v1(boolean,text)','5ead1dc7f1e9ca77fd885e79a9852d5d'),('column_jsonb_v1(jsonb,text)','a12994e1234e85cc602ad0e6390fee76'),('column_project_orders(stock_operational.orders)','11f0c525444dcdb05f6e90632d148c66'),('column_input_orders(jsonb)','7335bdee08b3f88b4f1832094fa85f1a'),('column_compatible_orders(stock_operational.orders)','e9cee7bd155c2384b6c883259384a28f'),('column_project_order_items(stock_operational.order_items)','fe9dd62431436a64491ad66fee837eb4'),('column_input_order_items(jsonb)','d5b2fb5331af90fb8e94ff56c70b53bd'),('column_compatible_order_items(stock_operational.order_items)','8de0a8af1ccaf955342069c16ef08b55'),('column_project_order_bills(stock_operational.order_bills)','8019b047deef8e88eeb60f92d17cd987'),('column_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('column_compatible_order_bills(stock_operational.order_bills)','d2ad69ae251a1406b0d4c429c2c29b1e'),('column_project_shipments(stock_operational.shipments)','95099880736ab6ba6d75c9bc21a048a7'),('column_input_shipments(jsonb)','4710c0c2c701361f13fa379d78cf7679'),('column_compatible_shipments(stock_operational.shipments)','0264055758e639bd9deafa1534436773'),('column_project_shipment_orders(stock_operational.shipment_orders)','e8e608f2a1355e9a6fe0c63908fa2d0f'),('column_input_shipment_orders(jsonb)','33e66d5247e6b546a7b345de98363f52'),('column_compatible_shipment_orders(stock_operational.shipment_orders)','b534f0ade3b588b62245a038b73fa687'),('column_project_employees(stock_operational.employees)','f65a472e40a1a63abb3d517ad807cc83'),('column_input_employees(jsonb)','d7b4b7d4a6e29cabe227a60fe004e5f3'),('column_compatible_employees(stock_operational.employees)','4c8fc7ff8e50a4ac4c057a1ad357bb90'),('column_project_employee_compensations(stock_operational.employee_compensations)','f45432a433d0015140443d011c8f9c6d'),('column_input_employee_compensations(jsonb)','848a6e7c20be8017456ef9004bc43964'),('column_compatible_employee_compensations(stock_operational.employee_compensations)','66d8774a3c63c454c8b5824dcd1b7dda'),('column_project_employee_timesheets(stock_operational.employee_timesheets)','e53a2faf2dae4dfdb879653dca99cc31'),('column_input_employee_timesheets(jsonb)','7ca5c001f61187582fb7e6fdd54b953e'),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','0b3803d4338cb548dde098159ca1ec4e'),('column_project_employee_advances(stock_operational.employee_advances)','345e18cd79750c6203f720ab3478a35e'),('column_input_employee_advances(jsonb)','b6ab3b2d12b710da83f59ca7e7a9ffe2'),('column_compatible_employee_advances(stock_operational.employee_advances)','ab8028dac4c8d54d7f70c07c7828b675'),('column_project_payroll_settlements(stock_operational.payroll_settlements)','97d19bf717c94321700215616a9e1dde'),('column_input_payroll_settlements(jsonb)','54df20d4ebc688535fa5e82d103e3efa'),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','dab9dc8f37cb69ddc75d895272d0c67f'),('column_project_expenses(stock_operational.expenses)','be1da2b05c5c3280d17ac21eebd4d7f7'),('column_input_expenses(jsonb)','6defedb02397eacb3d4f9befe58e4642'),('column_compatible_expenses(stock_operational.expenses)','d3e0afbe2536a15bb5ac2a1c7afb64ba'),('column_project_expense_categories(stock_operational.expense_categories)','2a487f01323a1cf0ae3884b8a0d30b64'),('column_input_expense_categories(jsonb)','aec32a171ad93917239ec0b794239734'),('column_compatible_expense_categories(stock_operational.expense_categories)','af7c7363f50dc0c5dcfafe014b5f7664'),('column_project_shops(stock_operational.shops)','7e5b09b0b4aacac1d29e55d863bec7a2'),('column_input_shops(jsonb)','063c947d1127202ed26505d2d643aded'),('column_compatible_shops(stock_operational.shops)','65fe40e5bf62ea817a339d88140c98f0'),('column_project_sales_receipts(stock_operational.sales_receipts)','5f6e10f6a9ec9d9d0e00e15279dcbb99'),('column_input_sales_receipts(jsonb)','5e8fd530b7b6d67eb34ada8e398d8397'),('column_compatible_sales_receipts(stock_operational.sales_receipts)','602a06dcfc554ee9b82734b20e8663c7'),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)','3c62e77d7a976901707c767147b62dd4'),('column_input_sales_receipt_items(jsonb)','94f5445356f0463f7a8ee3500fdfb5c7'),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','7e7f71e313184ec11512a142436a1feb'),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','72ffe0420b16251a08ddd55837d6e63f'),('column_input_sales_receipt_payments(jsonb)','4add5b12604cbc543aadd16889f87890'),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','d9fb8aa2a8909ad85cfa3944cc8a6364'),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','a5fae88e6a96f7f5448d2f2608248df2'),('column_input_sales_receipt_syncs(jsonb)','03ff2bf2e1c6b5dc4a152cb532fea20e'),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7d7b62370f1293d1f8538b453d3c9e19'),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','bba12c9a7351d04a51af3100319c558c'),('column_input_sales_profit_cost_overrides(jsonb)','0e87250f1a18cc7ac3784225993aa482'),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','57cafe6e3972c08da09615953060863e'),('column_project_stock_counts(stock_operational.stock_counts)','c79a797996b5b2be87df0e6b09e60370'),('column_input_stock_counts(jsonb)','6fe86c68c3ead71975ba04e35520e5a2'),('column_compatible_stock_counts(stock_operational.stock_counts)','1965b7ed5af05cdee2ff16d318b02794'),('column_project_stock_adjustments(stock_operational.stock_adjustments)','f94cd9aed024578b8ab72b7c399473bd'),('column_input_stock_adjustments(jsonb)','a40c52ef2277a5c45587b39e08873c56'),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','41b2a7a20c6ebefbc68e79723bd9a3d4'),('column_project_movements(stock_operational.movements)','5e16c86604f30d405eab3c13a7cd89e8'),('column_input_movements(jsonb)','4b71c0f354c79327861307662e77a23a'),('column_compatible_movements(stock_operational.movements)','37ff0bb8cfbd69299b855d7728dcfd5e'),('column_project_movement_details(stock_operational.movement_details)','1f41da392a375f6ad23a1fc3b1118cee'),('column_input_movement_details(jsonb)','8051e8d985727846324ef6da6cee5c1b'),('column_compatible_movement_details(stock_operational.movement_details)','1333f7c7dfb4a56b9e5e9b2d04874a1b'),('column_project_user_state(stock_operational.user_state)','b5e74e66f7a93af6eaea61fb235d03be'),('column_input_user_state(jsonb)','6ac3f912559140a166d01ef0949f3101'),('column_compatible_user_state(stock_operational.user_state)','e1e5f22d86d53443d957a2bef4239e66'),('column_mapping_contract_v1()','9196f1a4b00eeee35d3834370a2e87d4'),('native_timestamp_input(text)','5555bc26987e15a622b9b50797caefa6'),('native_timestamp_text(timestamptz)','5ad1f4189fa453fedf54eb9dfe7b5e0e'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7'),('typed_project_orders(stock_operational.orders)','4d7d39bf375bec85fe3d89c5e25b7466'),('typed_input_orders(jsonb)','39a030815bc16a2b5499a4fc3e43796d'),('typed_project_order_items(stock_operational.order_items)','8f16cb810b98d3b0e7555c368441cbf4'),('typed_input_order_items(jsonb)','3b217a7a7a331c7ea38a22a0cdf13c88'),('typed_project_order_bills(stock_operational.order_bills)','f647325fbd1c443aae4087f730d2bd1c'),('typed_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('typed_project_shipments(stock_operational.shipments)','89b0fe9946e8d002237f5c98e4eee040'),('typed_input_shipments(jsonb)','9e17a62ee77ffd56d35022924a334297'),('typed_project_shipment_orders(stock_operational.shipment_orders)','d4ddafed9c09ef8699bc487a8a93e5b4'),('typed_input_shipment_orders(jsonb)','33e66d5247e6b546a7b345de98363f52'),('typed_project_employees(stock_operational.employees)','8373f6343535c63fcbd5759a5f531630'),('typed_input_employees(jsonb)','d7b4b7d4a6e29cabe227a60fe004e5f3'),('typed_project_employee_compensations(stock_operational.employee_compensations)','719a2384a1bfc06c10f10038bfa621d7'),('typed_input_employee_compensations(jsonb)','f3f940173546b03c471c78f7dc2b1467'),('typed_project_employee_timesheets(stock_operational.employee_timesheets)','990cd70487fb18f3531f35e0538c1260'),('typed_input_employee_timesheets(jsonb)','7ca5c001f61187582fb7e6fdd54b953e'),('typed_project_employee_advances(stock_operational.employee_advances)','a6f59fffc36bd1bfdc03e6a3f3cbb2c3'),('typed_input_employee_advances(jsonb)','bde21069c5e61d7a61a1d1ae18fb2f57'),('typed_project_payroll_settlements(stock_operational.payroll_settlements)','9ba4a0ca68467a5f3dedf0a111ca2a4c'),('typed_input_payroll_settlements(jsonb)','7d330cb6a59763bd21585bc9815a2c41'),('typed_project_expenses(stock_operational.expenses)','0df096fd9b99090b91470dffd6fde5fc'),('typed_input_expenses(jsonb)','9b13a6ba368294d7e292beff45f5f01b'),('typed_project_expense_categories(stock_operational.expense_categories)','22c4f1ef4d55ba04b00db455d8adc5fe'),('typed_input_expense_categories(jsonb)','e2a60db85028ecdc986d551006ebd539'),('typed_project_shops(stock_operational.shops)','50fbe5258b7116caf7b34e988a055fd8'),('typed_input_shops(jsonb)','0718c3826fa6b144a7b9dc732e22abdc'),('typed_project_sales_receipts(stock_operational.sales_receipts)','264cf8eb9166d962b2db740df6f512c9'),('typed_input_sales_receipts(jsonb)','69f65e7d8a908d8870e60c12370c04ca'),('typed_project_sales_receipt_items(stock_operational.sales_receipt_items)','8199760e2d5424c0c8df63a2e0561d68'),('typed_input_sales_receipt_items(jsonb)','19768653457d87881ebb459eaf459405'),('typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','264966de41690ae383afd82d7512bf4b'),('typed_input_sales_receipt_payments(jsonb)','d16be6e9899da9ed001caee206d679f7'),('typed_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','f815fbec31988ff98c8d3d85e890dd6d'),('typed_input_sales_receipt_syncs(jsonb)','120b96763f31ea5f65daaa82f46b5275'),('typed_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','5388c5fcd62b171539c292e4558c1e28'),('typed_input_sales_profit_cost_overrides(jsonb)','56eb838da448bc7a44e780d20230fb92'),('typed_project_stock_counts(stock_operational.stock_counts)','e2c0564ddbb155a68e8470fbb574e7a5'),('typed_input_stock_counts(jsonb)','34da05f442c8bff900f53d9bf41303e4'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','eea0eccacc7e8c9cf338e9ac53ab9479'),('typed_input_stock_adjustments(jsonb)','340fc2660897abe15f86dbb2db289c6b'),('typed_project_movements(stock_operational.movements)','d7d179fa5d82d2339bc87c7c54b019b9'),('typed_input_movements(jsonb)','c412349c1bb33c5448d1337d1627652d'),('typed_project_movement_details(stock_operational.movement_details)','b300286a03444a483a7688a1cc8328f9'),('typed_input_movement_details(jsonb)','54516495048ec2ee2014d6e97b79a862'),('typed_project_user_state(stock_operational.user_state)','8a1e2aabaf3e1b3c5537b46f587016b1'),('typed_input_user_state(jsonb)','1fc79e664300ecdec142f6157e711018'),('lexeme_mapping_contract_v1()','d6bff8c325bc80100e0993f09296a948')) e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed lexeme predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 WHERE c.relnamespace='stock_operational'::regnamespace AND c.relkind IN ('r','p')
 AND NOT a.attisdropped AND right(a.attname,8)='__lexeme' AND coalesce(cardinality(a.attacl),0)>0))::int;
-- PostgreSQL can automatically remove column-owned indexes/constraints even
-- with RESTRICT. Refuse ALL unreviewed attribute dependencies before any DROP.
SELECT 1 / (NOT EXISTS(SELECT FROM pg_depend d JOIN pg_attribute a
 ON d.refclassid='pg_class'::regclass AND d.refobjid=a.attrelid AND d.refobjsubid=a.attnum
 JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace
 AND NOT a.attisdropped AND right(a.attname,8)='__lexeme'))::int;
DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)',' SELECT jsonb_build_array(
 to_jsonb(coalesce(r."id",'''')),
 to_jsonb(coalesce(r."receiptId",'''')),
 to_jsonb(coalesce(r."paymentIndex"::text,'''')),
 to_jsonb(coalesce(r."paymentTypeId",'''')),
 to_jsonb(coalesce(r."paymentName",'''')),
 to_jsonb(coalesce(r."paymentType",'''')),
 to_jsonb(coalesce(r."moneyAmount"::text,'''')),
 to_jsonb(coalesce(r."paidAt",'''')),
 to_jsonb(coalesce(r."paymentDetailsJson"::text,''null'')),
 to_jsonb(coalesce(r."syncedAt",'''')));
')) e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_orders(t) old,stock_operational.typed_project_orders(t) candidate
 FROM stock_operational.orders t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>9 OR jsonb_array_length(candidate)<>9
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (nullif(old->>3,'')::numeric IS DISTINCT FROM nullif(candidate->>3,'')::numeric) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8))) THEN RAISE EXCEPTION 'Unreviewed typed representation in orders; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_order_items(t) old,stock_operational.typed_project_order_items(t) candidate
 FROM stock_operational.order_items t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>10 OR jsonb_array_length(candidate)<>10
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (nullif(old->>3,'')::numeric IS DISTINCT FROM nullif(candidate->>3,'')::numeric) OR (nullif(old->>4,'')::numeric IS DISTINCT FROM nullif(candidate->>4,'')::numeric) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9))) THEN RAISE EXCEPTION 'Unreviewed typed representation in order_items; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_order_bills(t) old,stock_operational.typed_project_order_bills(t) candidate
 FROM stock_operational.order_bills t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>7 OR jsonb_array_length(candidate)<>7
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6))) THEN RAISE EXCEPTION 'Unreviewed typed representation in order_bills; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_shipments(t) old,stock_operational.typed_project_shipments(t) candidate
 FROM stock_operational.shipments t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>13 OR jsonb_array_length(candidate)<>13
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (nullif(old->>4,'')::numeric IS DISTINCT FROM nullif(candidate->>4,'')::numeric) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR (old->12 IS DISTINCT FROM candidate->12))) THEN RAISE EXCEPTION 'Unreviewed typed representation in shipments; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_shipment_orders(t) old,stock_operational.typed_project_shipment_orders(t) candidate
 FROM stock_operational.shipment_orders t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>7 OR jsonb_array_length(candidate)<>7
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6))) THEN RAISE EXCEPTION 'Unreviewed typed representation in shipment_orders; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_employees(t) old,stock_operational.typed_project_employees(t) candidate
 FROM stock_operational.employees t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>9 OR jsonb_array_length(candidate)<>9
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8))) THEN RAISE EXCEPTION 'Unreviewed typed representation in employees; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_employee_compensations(t) old,stock_operational.typed_project_employee_compensations(t) candidate
 FROM stock_operational.employee_compensations t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>12 OR jsonb_array_length(candidate)<>12
 OR (old->0 IS DISTINCT FROM candidate->0) OR (nullif(old->>1,'')::numeric IS DISTINCT FROM nullif(candidate->>1,'')::numeric) OR (nullif(old->>2,'')::numeric IS DISTINCT FROM nullif(candidate->>2,'')::numeric) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (nullif(old->>9,'')::numeric IS DISTINCT FROM nullif(candidate->>9,'')::numeric) OR (nullif(old->>10,'')::numeric IS DISTINCT FROM nullif(candidate->>10,'')::numeric) OR (nullif(old->>11,'')::numeric IS DISTINCT FROM nullif(candidate->>11,'')::numeric))) THEN RAISE EXCEPTION 'Unreviewed typed representation in employee_compensations; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_employee_timesheets(t) old,stock_operational.typed_project_employee_timesheets(t) candidate
 FROM stock_operational.employee_timesheets t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>7 OR jsonb_array_length(candidate)<>7
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6))) THEN RAISE EXCEPTION 'Unreviewed typed representation in employee_timesheets; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_employee_advances(t) old,stock_operational.typed_project_employee_advances(t) candidate
 FROM stock_operational.employee_advances t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>13 OR jsonb_array_length(candidate)<>13
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (nullif(old->>5,'')::numeric IS DISTINCT FROM nullif(candidate->>5,'')::numeric) OR (nullif(old->>6,'')::numeric IS DISTINCT FROM nullif(candidate->>6,'')::numeric) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR (old->12 IS DISTINCT FROM candidate->12))) THEN RAISE EXCEPTION 'Unreviewed typed representation in employee_advances; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_payroll_settlements(t) old,stock_operational.typed_project_payroll_settlements(t) candidate
 FROM stock_operational.payroll_settlements t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>7 OR jsonb_array_length(candidate)<>7
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (nullif(old->>6,'')::jsonb IS DISTINCT FROM nullif(candidate->>6,'')::jsonb))) THEN RAISE EXCEPTION 'Unreviewed typed representation in payroll_settlements; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_expenses(t) old,stock_operational.typed_project_expenses(t) candidate
 FROM stock_operational.expenses t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>13 OR jsonb_array_length(candidate)<>13
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (nullif(old->>7,'')::numeric IS DISTINCT FROM nullif(candidate->>7,'')::numeric) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR (old->12 IS DISTINCT FROM candidate->12))) THEN RAISE EXCEPTION 'Unreviewed typed representation in expenses; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_expense_categories(t) old,stock_operational.typed_project_expense_categories(t) candidate
 FROM stock_operational.expense_categories t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>5 OR jsonb_array_length(candidate)<>5
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR ((lower(btrim(coalesce(old->>2,'')))='true') IS DISTINCT FROM (coalesce(candidate->>2,'')='true')) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4))) THEN RAISE EXCEPTION 'Unreviewed typed representation in expense_categories; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_shops(t) old,stock_operational.typed_project_shops(t) candidate
 FROM stock_operational.shops t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>6 OR jsonb_array_length(candidate)<>6
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR ((lower(btrim(coalesce(old->>2,'')))='true') IS DISTINCT FROM (coalesce(candidate->>2,'')='true')) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5))) THEN RAISE EXCEPTION 'Unreviewed typed representation in shops; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_sales_receipts(t) old,stock_operational.typed_project_sales_receipts(t) candidate
 FROM stock_operational.sales_receipts t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>26 OR jsonb_array_length(candidate)<>26
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR (old->12 IS DISTINCT FROM candidate->12) OR (old->13 IS DISTINCT FROM candidate->13) OR (old->14 IS DISTINCT FROM candidate->14) OR (old->15 IS DISTINCT FROM candidate->15) OR (old->16 IS DISTINCT FROM candidate->16) OR (old->17 IS DISTINCT FROM candidate->17) OR (nullif(old->>18,'')::numeric IS DISTINCT FROM nullif(candidate->>18,'')::numeric) OR (nullif(old->>19,'')::numeric IS DISTINCT FROM nullif(candidate->>19,'')::numeric) OR (nullif(old->>20,'')::numeric IS DISTINCT FROM nullif(candidate->>20,'')::numeric) OR (nullif(old->>21,'')::numeric IS DISTINCT FROM nullif(candidate->>21,'')::numeric) OR (nullif(old->>22,'')::numeric IS DISTINCT FROM nullif(candidate->>22,'')::numeric) OR (nullif(old->>23,'')::numeric IS DISTINCT FROM nullif(candidate->>23,'')::numeric) OR (nullif(old->>24,'')::numeric IS DISTINCT FROM nullif(candidate->>24,'')::numeric) OR (old->25 IS DISTINCT FROM candidate->25))) THEN RAISE EXCEPTION 'Unreviewed typed representation in sales_receipts; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_sales_receipt_items(t) old,stock_operational.typed_project_sales_receipt_items(t) candidate
 FROM stock_operational.sales_receipt_items t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>21 OR jsonb_array_length(candidate)<>21
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (nullif(old->>8,'')::numeric IS DISTINCT FROM nullif(candidate->>8,'')::numeric) OR (nullif(old->>9,'')::numeric IS DISTINCT FROM nullif(candidate->>9,'')::numeric) OR (nullif(old->>10,'')::numeric IS DISTINCT FROM nullif(candidate->>10,'')::numeric) OR (nullif(old->>11,'')::numeric IS DISTINCT FROM nullif(candidate->>11,'')::numeric) OR (nullif(old->>12,'')::numeric IS DISTINCT FROM nullif(candidate->>12,'')::numeric) OR (nullif(old->>13,'')::numeric IS DISTINCT FROM nullif(candidate->>13,'')::numeric) OR (nullif(old->>14,'')::numeric IS DISTINCT FROM nullif(candidate->>14,'')::numeric) OR (nullif(old->>15,'')::numeric IS DISTINCT FROM nullif(candidate->>15,'')::numeric) OR (old->16 IS DISTINCT FROM candidate->16) OR (nullif(old->>17,'')::jsonb IS DISTINCT FROM nullif(candidate->>17,'')::jsonb) OR (nullif(old->>18,'')::jsonb IS DISTINCT FROM nullif(candidate->>18,'')::jsonb) OR (nullif(old->>19,'')::jsonb IS DISTINCT FROM nullif(candidate->>19,'')::jsonb) OR (old->20 IS DISTINCT FROM candidate->20))) THEN RAISE EXCEPTION 'Unreviewed typed representation in sales_receipt_items; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_sales_receipt_payments(t) old,stock_operational.typed_project_sales_receipt_payments(t) candidate
 FROM stock_operational.sales_receipt_payments t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>10 OR jsonb_array_length(candidate)<>10
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (nullif(old->>2,'')::numeric IS DISTINCT FROM nullif(candidate->>2,'')::numeric) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (nullif(old->>6,'')::numeric IS DISTINCT FROM nullif(candidate->>6,'')::numeric) OR (old->7 IS DISTINCT FROM candidate->7) OR (coalesce(nullif(old->>8,'')::jsonb,'null'::jsonb) IS DISTINCT FROM coalesce(nullif(candidate->>8,'')::jsonb,'null'::jsonb)) OR (old->9 IS DISTINCT FROM candidate->9))) THEN RAISE EXCEPTION 'Unreviewed typed representation in sales_receipt_payments; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_sales_receipt_syncs(t) old,stock_operational.typed_project_sales_receipt_syncs(t) candidate
 FROM stock_operational.sales_receipt_syncs t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>9 OR jsonb_array_length(candidate)<>9
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (nullif(old->>5,'')::numeric IS DISTINCT FROM nullif(candidate->>5,'')::numeric) OR (nullif(old->>6,'')::numeric IS DISTINCT FROM nullif(candidate->>6,'')::numeric) OR (nullif(old->>7,'')::numeric IS DISTINCT FROM nullif(candidate->>7,'')::numeric) OR (old->8 IS DISTINCT FROM candidate->8))) THEN RAISE EXCEPTION 'Unreviewed typed representation in sales_receipt_syncs; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_sales_profit_cost_overrides(t) old,stock_operational.typed_project_sales_profit_cost_overrides(t) candidate
 FROM stock_operational.sales_profit_cost_overrides t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>8 OR jsonb_array_length(candidate)<>8
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (nullif(old->>3,'')::numeric IS DISTINCT FROM nullif(candidate->>3,'')::numeric) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7))) THEN RAISE EXCEPTION 'Unreviewed typed representation in sales_profit_cost_overrides; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_stock_counts(t) old,stock_operational.typed_project_stock_counts(t) candidate
 FROM stock_operational.stock_counts t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>9 OR jsonb_array_length(candidate)<>9
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (nullif(old->>4,'')::numeric IS DISTINCT FROM nullif(candidate->>4,'')::numeric) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8))) THEN RAISE EXCEPTION 'Unreviewed typed representation in stock_counts; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_stock_adjustments(t) old,stock_operational.typed_project_stock_adjustments(t) candidate
 FROM stock_operational.stock_adjustments t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>17 OR jsonb_array_length(candidate)<>17
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (nullif(old->>8,'')::numeric IS DISTINCT FROM nullif(candidate->>8,'')::numeric) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR (old->12 IS DISTINCT FROM candidate->12) OR (old->13 IS DISTINCT FROM candidate->13) OR (old->14 IS DISTINCT FROM candidate->14) OR (old->15 IS DISTINCT FROM candidate->15) OR ((lower(coalesce(old->>16,''))='true') IS DISTINCT FROM (coalesce(candidate->>16,'')='true')))) THEN RAISE EXCEPTION 'Unreviewed typed representation in stock_adjustments; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_movements(t) old,stock_operational.typed_project_movements(t) candidate
 FROM stock_operational.movements t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>8 OR jsonb_array_length(candidate)<>8
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (nullif(old->>5,'')::numeric IS DISTINCT FROM nullif(candidate->>5,'')::numeric) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7))) THEN RAISE EXCEPTION 'Unreviewed typed representation in movements; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_movement_details(t) old,stock_operational.typed_project_movement_details(t) candidate
 FROM stock_operational.movement_details t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>14 OR jsonb_array_length(candidate)<>14
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (nullif(old->>3,'')::numeric IS DISTINCT FROM nullif(candidate->>3,'')::numeric) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (old->7 IS DISTINCT FROM candidate->7) OR (old->8 IS DISTINCT FROM candidate->8) OR (old->9 IS DISTINCT FROM candidate->9) OR (old->10 IS DISTINCT FROM candidate->10) OR (old->11 IS DISTINCT FROM candidate->11) OR ((lower(coalesce(old->>12,''))='true') IS DISTINCT FROM (coalesce(candidate->>12,'')='true')) OR ((lower(coalesce(old->>13,''))='true') IS DISTINCT FROM (coalesce(candidate->>13,'')='true')))) THEN RAISE EXCEPTION 'Unreviewed typed representation in movement_details; inspect privately, never repair automatically'; END IF; END $values$;
DO $values$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_user_state(t) old,stock_operational.typed_project_user_state(t) candidate
 FROM stock_operational.user_state t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>8 OR jsonb_array_length(candidate)<>8
 OR (old->0 IS DISTINCT FROM candidate->0) OR (old->1 IS DISTINCT FROM candidate->1) OR (old->2 IS DISTINCT FROM candidate->2) OR (old->3 IS DISTINCT FROM candidate->3) OR (old->4 IS DISTINCT FROM candidate->4) OR (old->5 IS DISTINCT FROM candidate->5) OR (old->6 IS DISTINCT FROM candidate->6) OR (nullif(old->>7,'')::jsonb IS DISTINCT FROM nullif(candidate->>7,'')::jsonb))) THEN RAISE EXCEPTION 'Unreviewed typed representation in user_state; inspect privately, never repair automatically'; END IF; END $values$;
DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','BEGIN RETURN stock_operational.typed_input_orders(cells); END;'),('column_input_orders(jsonb)','BEGIN RETURN stock_operational.typed_input_orders(cells); END;'),('project_orders(stock_operational.orders)',' SELECT stock_operational.typed_project_orders(r); '),('column_project_orders(stock_operational.orders)',' SELECT stock_operational.typed_project_orders(r); '),('validate_orders()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."status" := nullif(NEW."status",'''');
NEW."seller" := nullif(NEW."seller",'''');
NEW."remark" := nullif(NEW."remark",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_orders(NEW);
RETURN NEW; END '),('input_order_items(jsonb)','BEGIN RETURN stock_operational.typed_input_order_items(cells); END;'),('column_input_order_items(jsonb)','BEGIN RETURN stock_operational.typed_input_order_items(cells); END;'),('project_order_items(stock_operational.order_items)',' SELECT stock_operational.typed_project_order_items(r); '),('column_project_order_items(stock_operational.order_items)',' SELECT stock_operational.typed_project_order_items(r); '),('validate_order_items()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."orderId" := nullif(NEW."orderId",'''');
NEW."imageUrl" := nullif(NEW."imageUrl",'''');
NEW."productCode" := nullif(NEW."productCode",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_order_items(NEW);
RETURN NEW; END '),('input_shipments(jsonb)','BEGIN RETURN stock_operational.typed_input_shipments(cells); END;'),('column_input_shipments(jsonb)','BEGIN RETURN stock_operational.typed_input_shipments(cells); END;'),('project_shipments(stock_operational.shipments)',' SELECT stock_operational.typed_project_shipments(r); '),('column_project_shipments(stock_operational.shipments)',' SELECT stock_operational.typed_project_shipments(r); '),('validate_shipments()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."status" := nullif(NEW."status",'''');
NEW."carrier" := nullif(NEW."carrier",'''');
NEW."poNumber" := nullif(NEW."poNumber",'''');
NEW."remark" := nullif(NEW."remark",'''');
NEW."shippedAt" := nullif(NEW."shippedAt",'''');
NEW."deliveredAt" := nullif(NEW."deliveredAt",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
NEW."shippingBillUrl" := nullif(NEW."shippingBillUrl",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_shipments(NEW);
RETURN NEW; END '),('input_employee_compensations(jsonb)','BEGIN RETURN stock_operational.typed_input_employee_compensations(cells); END;'),('column_input_employee_compensations(jsonb)','BEGIN RETURN stock_operational.typed_input_employee_compensations(cells); END;'),('project_employee_compensations(stock_operational.employee_compensations)',' SELECT stock_operational.typed_project_employee_compensations(r); '),('column_project_employee_compensations(stock_operational.employee_compensations)',' SELECT stock_operational.typed_project_employee_compensations(r); '),('validate_employee_compensations()','
BEGIN
NEW."employeeId" := nullif(NEW."employeeId",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."updatedBy" := nullif(NEW."updatedBy",'''');
NEW."effectiveFrom" := nullif(NEW."effectiveFrom",'''');
NEW."compensationType" := nullif(NEW."compensationType",'''');
NEW."commissionType" := nullif(NEW."commissionType",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."migration_id" IS DISTINCT FROM OLD."migration_id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_employee_compensations(NEW);
RETURN NEW; END '),('input_employee_advances(jsonb)','BEGIN RETURN stock_operational.typed_input_employee_advances(cells); END;'),('column_input_employee_advances(jsonb)','BEGIN RETURN stock_operational.typed_input_employee_advances(cells); END;'),('project_employee_advances(stock_operational.employee_advances)',' SELECT stock_operational.typed_project_employee_advances(r); '),('column_project_employee_advances(stock_operational.employee_advances)',' SELECT stock_operational.typed_project_employee_advances(r); '),('validate_employee_advances()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."employeeId" := nullif(NEW."employeeId",'''');
NEW."shopId" := nullif(NEW."shopId",'''');
NEW."requestedDate" := nullif(NEW."requestedDate",'''');
NEW."payrollMonth" := nullif(NEW."payrollMonth",'''');
NEW."status" := nullif(NEW."status",'''');
NEW."paidDate" := nullif(NEW."paidDate",'''');
NEW."reference" := nullif(NEW."reference",'''');
NEW."note" := nullif(NEW."note",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_employee_advances(NEW);
RETURN NEW; END '),('input_payroll_settlements(jsonb)','BEGIN RETURN stock_operational.typed_input_payroll_settlements(cells); END;'),('column_input_payroll_settlements(jsonb)','BEGIN RETURN stock_operational.typed_input_payroll_settlements(cells); END;'),('project_payroll_settlements(stock_operational.payroll_settlements)',' SELECT stock_operational.typed_project_payroll_settlements(r); '),('column_project_payroll_settlements(stock_operational.payroll_settlements)',' SELECT stock_operational.typed_project_payroll_settlements(r); '),('validate_payroll_settlements()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."employeeId" := nullif(NEW."employeeId",'''');
NEW."month" := nullif(NEW."month",'''');
NEW."paidDate" := nullif(NEW."paidDate",'''');
NEW."reference" := nullif(NEW."reference",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_payroll_settlements(NEW);
RETURN NEW; END '),('input_expenses(jsonb)','BEGIN RETURN stock_operational.typed_input_expenses(cells); END;'),('column_input_expenses(jsonb)','BEGIN RETURN stock_operational.typed_input_expenses(cells); END;'),('project_expenses(stock_operational.expenses)',' SELECT stock_operational.typed_project_expenses(r); '),('column_project_expenses(stock_operational.expenses)',' SELECT stock_operational.typed_project_expenses(r); '),('validate_expenses()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."month" := nullif(NEW."month",'''');
NEW."expenseDate" := nullif(NEW."expenseDate",'''');
NEW."shopId" := nullif(NEW."shopId",'''');
NEW."scope" := nullif(NEW."scope",'''');
NEW."categoryId" := nullif(NEW."categoryId",'''');
NEW."name" := nullif(NEW."name",'''');
NEW."note" := nullif(NEW."note",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_expenses(NEW);
RETURN NEW; END '),('input_expense_categories(jsonb)','BEGIN RETURN stock_operational.typed_input_expense_categories(cells); END;'),('column_input_expense_categories(jsonb)','BEGIN RETURN stock_operational.typed_input_expense_categories(cells); END;'),('project_expense_categories(stock_operational.expense_categories)',' SELECT stock_operational.typed_project_expense_categories(r); '),('column_project_expense_categories(stock_operational.expense_categories)',' SELECT stock_operational.typed_project_expense_categories(r); '),('validate_expense_categories()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_expense_categories(NEW);
RETURN NEW; END '),('input_shops(jsonb)','BEGIN RETURN stock_operational.typed_input_shops(cells); END;'),('column_input_shops(jsonb)','BEGIN RETURN stock_operational.typed_input_shops(cells); END;'),('project_shops(stock_operational.shops)',' SELECT stock_operational.typed_project_shops(r); '),('column_project_shops(stock_operational.shops)',' SELECT stock_operational.typed_project_shops(r); '),('validate_shops()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
NEW."loyverseAccountId" := nullif(NEW."loyverseAccountId",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_shops(NEW);
RETURN NEW; END '),('input_sales_receipts(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipts(cells); END;'),('column_input_sales_receipts(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipts(cells); END;'),('project_sales_receipts(stock_operational.sales_receipts)',' SELECT stock_operational.typed_project_sales_receipts(r); '),('column_project_sales_receipts(stock_operational.sales_receipts)',' SELECT stock_operational.typed_project_sales_receipts(r); '),('validate_sales_receipts()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."salesDate" := nullif(NEW."salesDate",'''');
NEW."accountId" := nullif(NEW."accountId",'''');
NEW."shopName" := nullif(NEW."shopName",'''');
NEW."receiptNumber" := nullif(NEW."receiptNumber",'''');
NEW."receiptType" := nullif(NEW."receiptType",'''');
NEW."refundFor" := nullif(NEW."refundFor",'''');
NEW."order" := nullif(NEW."order",'''');
NEW."receiptDate" := nullif(NEW."receiptDate",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."cancelledAt" := nullif(NEW."cancelledAt",'''');
NEW."source" := nullif(NEW."source",'''');
NEW."storeId" := nullif(NEW."storeId",'''');
NEW."employeeId" := nullif(NEW."employeeId",'''');
NEW."customerId" := nullif(NEW."customerId",'''');
NEW."posDeviceId" := nullif(NEW."posDeviceId",'''');
NEW."diningOption" := nullif(NEW."diningOption",'''');
NEW."syncedAt" := nullif(NEW."syncedAt",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_sales_receipts(NEW);
RETURN NEW; END '),('input_sales_receipt_items(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_items(cells); END;'),('column_input_sales_receipt_items(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_items(cells); END;'),('project_sales_receipt_items(stock_operational.sales_receipt_items)',' SELECT stock_operational.typed_project_sales_receipt_items(r); '),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)',' SELECT stock_operational.typed_project_sales_receipt_items(r); '),('validate_sales_receipt_items()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."receiptId" := nullif(NEW."receiptId",'''');
NEW."lineItemId" := nullif(NEW."lineItemId",'''');
NEW."itemId" := nullif(NEW."itemId",'''');
NEW."variantId" := nullif(NEW."variantId",'''');
NEW."itemName" := nullif(NEW."itemName",'''');
NEW."variantName" := nullif(NEW."variantName",'''');
NEW."sku" := nullif(NEW."sku",'''');
NEW."lineNote" := nullif(NEW."lineNote",'''');
NEW."syncedAt" := nullif(NEW."syncedAt",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_items(NEW);
RETURN NEW; END '),('input_sales_receipt_payments(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_payments(cells); END;'),('column_input_sales_receipt_payments(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_payments(cells); END;'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)',' SELECT stock_operational.typed_project_sales_receipt_payments(r); '),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)',' SELECT stock_operational.typed_project_sales_receipt_payments(r); '),('validate_sales_receipt_payments()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."receiptId" := nullif(NEW."receiptId",'''');
NEW."paymentTypeId" := nullif(NEW."paymentTypeId",'''');
NEW."paymentName" := nullif(NEW."paymentName",'''');
NEW."paymentType" := nullif(NEW."paymentType",'''');
NEW."paidAt" := nullif(NEW."paidAt",'''');
NEW."syncedAt" := nullif(NEW."syncedAt",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_payments(NEW);
RETURN NEW; END '),('input_sales_receipt_syncs(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_syncs(cells); END;'),('column_input_sales_receipt_syncs(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_receipt_syncs(cells); END;'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)',' SELECT stock_operational.typed_project_sales_receipt_syncs(r); '),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)',' SELECT stock_operational.typed_project_sales_receipt_syncs(r); '),('validate_sales_receipt_syncs()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."salesDate" := nullif(NEW."salesDate",'''');
NEW."accountId" := nullif(NEW."accountId",'''');
NEW."shopName" := nullif(NEW."shopName",'''');
NEW."status" := nullif(NEW."status",'''');
NEW."syncedAt" := nullif(NEW."syncedAt",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_syncs(NEW);
RETURN NEW; END '),('input_sales_profit_cost_overrides(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_profit_cost_overrides(cells); END;'),('column_input_sales_profit_cost_overrides(jsonb)','BEGIN RETURN stock_operational.typed_input_sales_profit_cost_overrides(cells); END;'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)',' SELECT stock_operational.typed_project_sales_profit_cost_overrides(r); '),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)',' SELECT stock_operational.typed_project_sales_profit_cost_overrides(r); '),('validate_sales_profit_cost_overrides()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."month" := nullif(NEW."month",'''');
NEW."accountId" := nullif(NEW."accountId",'''');
NEW."note" := nullif(NEW."note",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_sales_profit_cost_overrides(NEW);
RETURN NEW; END '),('input_stock_counts(jsonb)','BEGIN RETURN stock_operational.typed_input_stock_counts(cells); END;'),('column_input_stock_counts(jsonb)','BEGIN RETURN stock_operational.typed_input_stock_counts(cells); END;'),('project_stock_counts(stock_operational.stock_counts)',' SELECT stock_operational.typed_project_stock_counts(r); '),('column_project_stock_counts(stock_operational.stock_counts)',' SELECT stock_operational.typed_project_stock_counts(r); '),('validate_stock_counts()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."month" := nullif(NEW."month",'''');
NEW."accountId" := nullif(NEW."accountId",'''');
NEW."shopName" := nullif(NEW."shopName",'''');
NEW."note" := nullif(NEW."note",'''');
NEW."countedAt" := nullif(NEW."countedAt",'''');
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."updatedBy" := nullif(NEW."updatedBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_stock_counts(NEW);
RETURN NEW; END '),('input_stock_adjustments(jsonb)','BEGIN RETURN stock_operational.typed_input_stock_adjustments(cells); END;'),('column_input_stock_adjustments(jsonb)','BEGIN RETURN stock_operational.typed_input_stock_adjustments(cells); END;'),('project_stock_adjustments(stock_operational.stock_adjustments)',' SELECT stock_operational.typed_project_stock_adjustments(r); '),('column_project_stock_adjustments(stock_operational.stock_adjustments)',' SELECT stock_operational.typed_project_stock_adjustments(r); '),('validate_stock_adjustments()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."accountId" := nullif(NEW."accountId",'''');
NEW."shopName" := nullif(NEW."shopName",'''');
NEW."date" := nullif(NEW."date",'''');
NEW."direction" := nullif(NEW."direction",'''');
NEW."reason" := nullif(NEW."reason",'''');
NEW."employeeId" := nullif(NEW."employeeId",'''');
NEW."employeeName" := nullif(NEW."employeeName",'''');
NEW."itemDescription" := nullif(NEW."itemDescription",'''');
NEW."photoUrl" := nullif(NEW."photoUrl",'''');
NEW."note" := nullif(NEW."note",'''');
NEW."reversesId" := nullif(NEW."reversesId",'''');
NEW."replacesId" := nullif(NEW."replacesId",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_stock_adjustments(NEW);
RETURN NEW; END '),('input_movements(jsonb)','BEGIN RETURN stock_operational.typed_input_movements(cells); END;'),('column_input_movements(jsonb)','BEGIN RETURN stock_operational.typed_input_movements(cells); END;'),('project_movements(stock_operational.movements)',' SELECT stock_operational.typed_project_movements(r); '),('column_project_movements(stock_operational.movements)',' SELECT stock_operational.typed_project_movements(r); '),('validate_movements()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."userId" := nullif(NEW."userId",'''');
NEW."packingDate" := nullif(NEW."packingDate",'''');
NEW."deliverDateTime" := nullif(NEW."deliverDateTime",'''');
NEW."status" := nullif(NEW."status",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_movements(NEW);
RETURN NEW; END '),('input_movement_details(jsonb)','BEGIN RETURN stock_operational.typed_input_movement_details(cells); END;'),('column_input_movement_details(jsonb)','BEGIN RETURN stock_operational.typed_input_movement_details(cells); END;'),('project_movement_details(stock_operational.movement_details)',' SELECT stock_operational.typed_project_movement_details(r); '),('column_project_movement_details(stock_operational.movement_details)',' SELECT stock_operational.typed_project_movement_details(r); '),('validate_movement_details()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."movementMasterId" := nullif(NEW."movementMasterId",'''');
NEW."shopName" := nullif(NEW."shopName",'''');
NEW."remark" := nullif(NEW."remark",'''');
NEW."fromLocation" := nullif(NEW."fromLocation",'''');
NEW."toLocation" := nullif(NEW."toLocation",'''');
NEW."productImageUrl" := nullif(NEW."productImageUrl",'''');
NEW."purchaseDetailId" := nullif(NEW."purchaseDetailId",'''');
NEW."status" := nullif(NEW."status",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_movement_details(NEW);
RETURN NEW; END '),('input_user_state(jsonb)','BEGIN RETURN stock_operational.typed_input_user_state(cells); END;'),('column_input_user_state(jsonb)','BEGIN RETURN stock_operational.typed_input_user_state(cells); END;'),('project_user_state(stock_operational.user_state)',' SELECT stock_operational.typed_project_user_state(r); '),('column_project_user_state(stock_operational.user_state)',' SELECT stock_operational.typed_project_user_state(r); '),('validate_user_state()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."userId" := nullif(NEW."userId",'''');
NEW."flowname" := nullif(NEW."flowname",'''');
NEW."referenceId" := nullif(NEW."referenceId",'''');
NEW."state" := nullif(NEW."state",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.project_user_state(NEW);
RETURN NEW; END '),('column_mapping_contract_v1()','BEGIN PERFORM stock_operational.lexeme_mapping_contract_v1(); RETURN ''final''; END;')) e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('stock_operational.lexeme_mapping_contract_v1()'::regprocedure,'stock_operational.column_bigint_v1(bigint,text)'::regprocedure,'stock_operational.column_boolean_v1(boolean,text)'::regprocedure,'stock_operational.column_jsonb_v1(jsonb,text)'::regprocedure,'stock_operational.column_numeric_v1(numeric,text)'::regprocedure) AND (strpos(p.prosrc,'__lexeme')>0 OR strpos(p.prosrc,'column_bigint_v1')>0 OR strpos(p.prosrc,'column_boolean_v1')>0 OR strpos(p.prosrc,'column_jsonb_v1')>0 OR strpos(p.prosrc,'column_numeric_v1')>0)))::int;
ALTER TABLE stock_operational.orders DROP COLUMN "totalPrice__lexeme" RESTRICT;
ALTER TABLE stock_operational.order_items DROP COLUMN "quoteQuantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.order_items DROP COLUMN "deliveredQuantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.shipments DROP COLUMN "shippingFee__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN "baseSalary__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN "commission__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN "commissionBucketSales__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN "commissionBucketAmount__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN "commissionRoundupThreshold__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_advances DROP COLUMN "requestedAmount__lexeme" RESTRICT;
ALTER TABLE stock_operational.employee_advances DROP COLUMN "paidAmount__lexeme" RESTRICT;
ALTER TABLE stock_operational.payroll_settlements DROP COLUMN "snapshot__lexeme" RESTRICT;
ALTER TABLE stock_operational.expenses DROP COLUMN "amount__lexeme" RESTRICT;
ALTER TABLE stock_operational.expense_categories DROP COLUMN "active__lexeme" RESTRICT;
ALTER TABLE stock_operational.shops DROP COLUMN "active__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "totalMoney__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "totalTax__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "totalDiscount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "tip__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "surcharge__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "pointsEarned__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN "pointsDeducted__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "quantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "price__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "grossTotalMoney__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "totalDiscount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "totalMoney__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "cost__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "costTotal__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "taxes__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "lineDiscountsJson__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "lineTaxesJson__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN "lineModifiersJson__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN "paymentIndex__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN "moneyAmount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN "paymentDetailsJson__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN "receiptCount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN "itemCount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN "paymentCount__lexeme" RESTRICT;
ALTER TABLE stock_operational.sales_profit_cost_overrides DROP COLUMN "averageItemCost__lexeme" RESTRICT;
ALTER TABLE stock_operational.stock_counts DROP COLUMN "physicalCount__lexeme" RESTRICT;
ALTER TABLE stock_operational.stock_adjustments DROP COLUMN "quantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.stock_adjustments DROP COLUMN "notInLoyverse__lexeme" RESTRICT;
ALTER TABLE stock_operational.movements DROP COLUMN "totalQuantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN "quantity__lexeme" RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN "stockCounted__lexeme" RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN "isNewArrival__lexeme" RESTRICT;
ALTER TABLE stock_operational.user_state DROP COLUMN "context__lexeme" RESTRICT;
DROP FUNCTION stock_operational.column_bigint_v1(bigint,text) RESTRICT;
DROP FUNCTION stock_operational.column_boolean_v1(boolean,text) RESTRICT;
DROP FUNCTION stock_operational.column_jsonb_v1(jsonb,text) RESTRICT;
DROP FUNCTION stock_operational.column_numeric_v1(numeric,text) RESTRICT;
SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='typed')::int;
COMMIT;
