-- OPERATOR ONLY. Final typed schema and reviewed recovery required.
-- No table/record/role changes. Never execute through automatic discovery.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.mapper_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1/coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1/coalesce(current_setting('stock.allow_legacy_mapper_cleanup',true)='reviewed-typed-only-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_reviewed_fingerprint',true) ~ '^[a-f0-9]{64}$',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_semantics_verified',true)='exact-app-line-consumers-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
LOCK TABLE stock_migration.import_batches,stock_migration.orders,stock_migration.order_items,stock_migration.order_bills,stock_migration.shipments,stock_migration.shipment_orders,stock_migration.employees,stock_migration.employee_compensations,stock_migration.employee_timesheets,stock_migration.employee_advances,stock_migration.payroll_settlements,stock_migration.expenses,stock_migration.expense_categories,stock_migration.shops,stock_migration.sales_receipts,stock_migration.sales_receipt_items,stock_migration.sales_receipt_payments,stock_migration.sales_receipt_syncs,stock_migration.sales_profit_cost_overrides,stock_migration.stock_counts,stock_migration.stock_adjustments,stock_migration.movements,stock_migration.movement_details,stock_migration.user_state,stock_operational.commands,stock_operational.revision,stock_operational.side_effects,stock_operational.environment,stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.mapper_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','925b5d9fc5c2c91edd3b57ff3765a949'),('project_orders(stock_operational.orders)','a059ea4a1b627f046906eb672296e399'),('validate_orders()','b7ecb644189f64b929c0da4dad983dba'),('input_order_items(jsonb)','9557ec7c74204f2596bf720df3ff3444'),('project_order_items(stock_operational.order_items)','f7cd4b96006f7af4abbc074e26130522'),('validate_order_items()','5e0bbb33a590e53cf65d8b655d824f8e'),('input_order_bills(jsonb)','d3e907f4efdb3b1b67486d81085af026'),('project_order_bills(stock_operational.order_bills)','8fadad71f337cdc9e478296054ef5690'),('validate_order_bills()','72722aee092af047de74b7bd1a6e6644'),('input_shipments(jsonb)','dc6e51dbda5906719b88f248df5f862a'),('project_shipments(stock_operational.shipments)','53b4afe275c75d0c5ff71f02940d6617'),('validate_shipments()','4fb0c61fcc519fcf792e1f9be6423213'),('input_shipment_orders(jsonb)','b5d7ec9deb37bc83ccba4e4a8b7338a1'),('project_shipment_orders(stock_operational.shipment_orders)','3d34b32b70971418f9e026386a6c541e'),('validate_shipment_orders()','06fa77f9bd707fd2e73948213c7c5ff8'),('input_employees(jsonb)','1d75a8883ceaaaad1dde4052a44b43e8'),('project_employees(stock_operational.employees)','ffaad41277d95a2e99d94144c599f493'),('validate_employees()','39bc43cf3c17759220e24e9eaa3c6ff6'),('input_employee_compensations(jsonb)','b4c9db4328f14672a7867749ea8ef5a7'),('project_employee_compensations(stock_operational.employee_compensations)','09fd684c97faa0cad9bb4d66f1db8bcc'),('validate_employee_compensations()','c0ddc8ea6cc9408fe00ce41fc853326c'),('input_employee_timesheets(jsonb)','d28f292f4a01cfded1b0aea0e8de9f90'),('project_employee_timesheets(stock_operational.employee_timesheets)','39031659ed6a88dc730e9c756781c370'),('validate_employee_timesheets()','35a1c9d84bdb621b8f8753f82f89bc3c'),('input_employee_advances(jsonb)','f98ca5fd615da8c637b356281be7048e'),('project_employee_advances(stock_operational.employee_advances)','20f82dcca05a5e319b26f0cc068b2c0f'),('validate_employee_advances()','efaa60c95d5979512fafc580137de94e'),('input_payroll_settlements(jsonb)','fbfe5e4d32b784a2c6738207c61da900'),('project_payroll_settlements(stock_operational.payroll_settlements)','da8827a010837c972f247322fd1ae9f4'),('validate_payroll_settlements()','435c2e48a5d2e7f78962ba9ea2a46158'),('input_expenses(jsonb)','93df12cd6a5d0b75e3c15c7ee9bce844'),('project_expenses(stock_operational.expenses)','d24edcf8a22c024ca4918188a8aa8639'),('validate_expenses()','a3afccba82bdffdd00e58a287b7fa2ae'),('input_expense_categories(jsonb)','949f2d4ac4acd3e886fc1b523a8b7d1b'),('project_expense_categories(stock_operational.expense_categories)','692088bab02254354aa9bb77709afa99'),('validate_expense_categories()','de6193fe34b32bc04fd569517878d704'),('input_shops(jsonb)','322eb368af97380a5506954c726ccdcd'),('project_shops(stock_operational.shops)','72b6048ed546968cbbc6f8c64473a20b'),('validate_shops()','0f2f15a4b654a9bd204f7ef391f5e710'),('input_sales_receipts(jsonb)','d6a7e71e6bc29011c09921994c9e1d12'),('project_sales_receipts(stock_operational.sales_receipts)','fd1f4153ec8bc0db2cafc2586cd38362'),('validate_sales_receipts()','ecc399a9024f71fd8b1466074611dddc'),('input_sales_receipt_items(jsonb)','f877d07c5ccf4e1ef536876a6535870b'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','49b2f4294cadc091566fd7b6eb30af80'),('validate_sales_receipt_items()','ff4f6ff7a4f9519affc9d9e62a88f681'),('input_sales_receipt_payments(jsonb)','1f3a1c1892e75c1f777a2282a98ef829'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','214b8f8373b6c8e62fca328ee30e33b1'),('validate_sales_receipt_payments()','3ce7c2ab56e9736a40e84ebc7642ece5'),('input_sales_receipt_syncs(jsonb)','bcdc8e12684865f752067abeb4aa5d7e'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','f5bfeb525395e55f5b1c2b4a2cf9d0f4'),('validate_sales_receipt_syncs()','ac1f9d85a6d254325c81dad6b9b40106'),('input_sales_profit_cost_overrides(jsonb)','d1d6c40d5c0be6fcc676b8852c86b0ac'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','8663c72e83327c0202dd458c131bc145'),('validate_sales_profit_cost_overrides()','304fbaba2b30d252ed78cb222221e30c'),('input_stock_counts(jsonb)','3a35a2cb6c7112d196b2aa258bf35295'),('project_stock_counts(stock_operational.stock_counts)','96ea4176edb466a667849f009bbe6ac4'),('validate_stock_counts()','91e3c064721603cff1d791decf0b7362'),('input_stock_adjustments(jsonb)','aa0464015979891be3520831daeff8fa'),('project_stock_adjustments(stock_operational.stock_adjustments)','2894923bfd427cd7f7b36d1df29c9d45'),('validate_stock_adjustments()','a4c6f66d4a43b0c98eb0a32a7e3ff8cc'),('input_movements(jsonb)','34a58352c897bba7864a0212aedc752a'),('project_movements(stock_operational.movements)','71ae02def138a3859eb4dd331a2a7b18'),('validate_movements()','8d6f115ca3b098dccbd1ede4227302c3'),('input_movement_details(jsonb)','97d136f6760b3cc59a0531ce69036f29'),('project_movement_details(stock_operational.movement_details)','bf25b6b0030a0b340344c19f031ea285'),('validate_movement_details()','beff42e0431f68bf2236670eb040797a'),('input_user_state(jsonb)','aa93436b85953ccc0909aa812bccf763'),('project_user_state(stock_operational.user_state)','8c47b1bc9c4aacd24506401f45ff3ee4'),('validate_user_state()','b8ca8af21a4e8e7319d5f24c896364f0'),('column_project_orders(stock_operational.orders)','a059ea4a1b627f046906eb672296e399'),('column_input_orders(jsonb)','925b5d9fc5c2c91edd3b57ff3765a949'),('column_compatible_orders(stock_operational.orders)','e9cee7bd155c2384b6c883259384a28f'),('column_project_order_items(stock_operational.order_items)','f7cd4b96006f7af4abbc074e26130522'),('column_input_order_items(jsonb)','9557ec7c74204f2596bf720df3ff3444'),('column_compatible_order_items(stock_operational.order_items)','8de0a8af1ccaf955342069c16ef08b55'),('column_project_order_bills(stock_operational.order_bills)','8019b047deef8e88eeb60f92d17cd987'),('column_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('column_compatible_order_bills(stock_operational.order_bills)','d2ad69ae251a1406b0d4c429c2c29b1e'),('column_project_shipments(stock_operational.shipments)','53b4afe275c75d0c5ff71f02940d6617'),('column_input_shipments(jsonb)','dc6e51dbda5906719b88f248df5f862a'),('column_compatible_shipments(stock_operational.shipments)','0264055758e639bd9deafa1534436773'),('column_project_shipment_orders(stock_operational.shipment_orders)','e8e608f2a1355e9a6fe0c63908fa2d0f'),('column_input_shipment_orders(jsonb)','33e66d5247e6b546a7b345de98363f52'),('column_compatible_shipment_orders(stock_operational.shipment_orders)','b534f0ade3b588b62245a038b73fa687'),('column_project_employees(stock_operational.employees)','f65a472e40a1a63abb3d517ad807cc83'),('column_input_employees(jsonb)','d7b4b7d4a6e29cabe227a60fe004e5f3'),('column_compatible_employees(stock_operational.employees)','4c8fc7ff8e50a4ac4c057a1ad357bb90'),('column_project_employee_compensations(stock_operational.employee_compensations)','09fd684c97faa0cad9bb4d66f1db8bcc'),('column_input_employee_compensations(jsonb)','b4c9db4328f14672a7867749ea8ef5a7'),('column_compatible_employee_compensations(stock_operational.employee_compensations)','66d8774a3c63c454c8b5824dcd1b7dda'),('column_project_employee_timesheets(stock_operational.employee_timesheets)','e53a2faf2dae4dfdb879653dca99cc31'),('column_input_employee_timesheets(jsonb)','7ca5c001f61187582fb7e6fdd54b953e'),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','0b3803d4338cb548dde098159ca1ec4e'),('column_project_employee_advances(stock_operational.employee_advances)','20f82dcca05a5e319b26f0cc068b2c0f'),('column_input_employee_advances(jsonb)','f98ca5fd615da8c637b356281be7048e'),('column_compatible_employee_advances(stock_operational.employee_advances)','ab8028dac4c8d54d7f70c07c7828b675'),('column_project_payroll_settlements(stock_operational.payroll_settlements)','da8827a010837c972f247322fd1ae9f4'),('column_input_payroll_settlements(jsonb)','fbfe5e4d32b784a2c6738207c61da900'),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','dab9dc8f37cb69ddc75d895272d0c67f'),('column_project_expenses(stock_operational.expenses)','d24edcf8a22c024ca4918188a8aa8639'),('column_input_expenses(jsonb)','93df12cd6a5d0b75e3c15c7ee9bce844'),('column_compatible_expenses(stock_operational.expenses)','d3e0afbe2536a15bb5ac2a1c7afb64ba'),('column_project_expense_categories(stock_operational.expense_categories)','692088bab02254354aa9bb77709afa99'),('column_input_expense_categories(jsonb)','949f2d4ac4acd3e886fc1b523a8b7d1b'),('column_compatible_expense_categories(stock_operational.expense_categories)','af7c7363f50dc0c5dcfafe014b5f7664'),('column_project_shops(stock_operational.shops)','72b6048ed546968cbbc6f8c64473a20b'),('column_input_shops(jsonb)','322eb368af97380a5506954c726ccdcd'),('column_compatible_shops(stock_operational.shops)','65fe40e5bf62ea817a339d88140c98f0'),('column_project_sales_receipts(stock_operational.sales_receipts)','fd1f4153ec8bc0db2cafc2586cd38362'),('column_input_sales_receipts(jsonb)','d6a7e71e6bc29011c09921994c9e1d12'),('column_compatible_sales_receipts(stock_operational.sales_receipts)','602a06dcfc554ee9b82734b20e8663c7'),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)','49b2f4294cadc091566fd7b6eb30af80'),('column_input_sales_receipt_items(jsonb)','f877d07c5ccf4e1ef536876a6535870b'),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','7e7f71e313184ec11512a142436a1feb'),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','214b8f8373b6c8e62fca328ee30e33b1'),('column_input_sales_receipt_payments(jsonb)','1f3a1c1892e75c1f777a2282a98ef829'),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','d9fb8aa2a8909ad85cfa3944cc8a6364'),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','f5bfeb525395e55f5b1c2b4a2cf9d0f4'),('column_input_sales_receipt_syncs(jsonb)','bcdc8e12684865f752067abeb4aa5d7e'),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7d7b62370f1293d1f8538b453d3c9e19'),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','8663c72e83327c0202dd458c131bc145'),('column_input_sales_profit_cost_overrides(jsonb)','d1d6c40d5c0be6fcc676b8852c86b0ac'),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','57cafe6e3972c08da09615953060863e'),('column_project_stock_counts(stock_operational.stock_counts)','96ea4176edb466a667849f009bbe6ac4'),('column_input_stock_counts(jsonb)','3a35a2cb6c7112d196b2aa258bf35295'),('column_compatible_stock_counts(stock_operational.stock_counts)','1965b7ed5af05cdee2ff16d318b02794'),('column_project_stock_adjustments(stock_operational.stock_adjustments)','2894923bfd427cd7f7b36d1df29c9d45'),('column_input_stock_adjustments(jsonb)','aa0464015979891be3520831daeff8fa'),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','41b2a7a20c6ebefbc68e79723bd9a3d4'),('column_project_movements(stock_operational.movements)','71ae02def138a3859eb4dd331a2a7b18'),('column_input_movements(jsonb)','34a58352c897bba7864a0212aedc752a'),('column_compatible_movements(stock_operational.movements)','37ff0bb8cfbd69299b855d7728dcfd5e'),('column_project_movement_details(stock_operational.movement_details)','bf25b6b0030a0b340344c19f031ea285'),('column_input_movement_details(jsonb)','97d136f6760b3cc59a0531ce69036f29'),('column_compatible_movement_details(stock_operational.movement_details)','1333f7c7dfb4a56b9e5e9b2d04874a1b'),('column_project_user_state(stock_operational.user_state)','8c47b1bc9c4aacd24506401f45ff3ee4'),('column_input_user_state(jsonb)','aa93436b85953ccc0909aa812bccf763'),('column_compatible_user_state(stock_operational.user_state)','e1e5f22d86d53443d957a2bef4239e66'),('column_mapping_contract_v1()','793034e8985682642b94dbc8b4fa457c'),('native_timestamp_input(text)','5555bc26987e15a622b9b50797caefa6'),('native_timestamp_text(timestamptz)','5ad1f4189fa453fedf54eb9dfe7b5e0e'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7'),('typed_project_orders(stock_operational.orders)','4d7d39bf375bec85fe3d89c5e25b7466'),('typed_input_orders(jsonb)','39a030815bc16a2b5499a4fc3e43796d'),('typed_project_order_items(stock_operational.order_items)','8f16cb810b98d3b0e7555c368441cbf4'),('typed_input_order_items(jsonb)','3b217a7a7a331c7ea38a22a0cdf13c88'),('typed_project_order_bills(stock_operational.order_bills)','f647325fbd1c443aae4087f730d2bd1c'),('typed_input_order_bills(jsonb)','7850c3000d922be702015f923fcdab2e'),('typed_project_shipments(stock_operational.shipments)','89b0fe9946e8d002237f5c98e4eee040'),('typed_input_shipments(jsonb)','9e17a62ee77ffd56d35022924a334297'),('typed_project_shipment_orders(stock_operational.shipment_orders)','d4ddafed9c09ef8699bc487a8a93e5b4'),('typed_input_shipment_orders(jsonb)','33e66d5247e6b546a7b345de98363f52'),('typed_project_employees(stock_operational.employees)','8373f6343535c63fcbd5759a5f531630'),('typed_input_employees(jsonb)','d7b4b7d4a6e29cabe227a60fe004e5f3'),('typed_project_employee_compensations(stock_operational.employee_compensations)','719a2384a1bfc06c10f10038bfa621d7'),('typed_input_employee_compensations(jsonb)','f3f940173546b03c471c78f7dc2b1467'),('typed_project_employee_timesheets(stock_operational.employee_timesheets)','990cd70487fb18f3531f35e0538c1260'),('typed_input_employee_timesheets(jsonb)','7ca5c001f61187582fb7e6fdd54b953e'),('typed_project_employee_advances(stock_operational.employee_advances)','a6f59fffc36bd1bfdc03e6a3f3cbb2c3'),('typed_input_employee_advances(jsonb)','bde21069c5e61d7a61a1d1ae18fb2f57'),('typed_project_payroll_settlements(stock_operational.payroll_settlements)','9ba4a0ca68467a5f3dedf0a111ca2a4c'),('typed_input_payroll_settlements(jsonb)','7d330cb6a59763bd21585bc9815a2c41'),('typed_project_expenses(stock_operational.expenses)','0df096fd9b99090b91470dffd6fde5fc'),('typed_input_expenses(jsonb)','9b13a6ba368294d7e292beff45f5f01b'),('typed_project_expense_categories(stock_operational.expense_categories)','22c4f1ef4d55ba04b00db455d8adc5fe'),('typed_input_expense_categories(jsonb)','e2a60db85028ecdc986d551006ebd539'),('typed_project_shops(stock_operational.shops)','50fbe5258b7116caf7b34e988a055fd8'),('typed_input_shops(jsonb)','0718c3826fa6b144a7b9dc732e22abdc'),('typed_project_sales_receipts(stock_operational.sales_receipts)','264cf8eb9166d962b2db740df6f512c9'),('typed_input_sales_receipts(jsonb)','69f65e7d8a908d8870e60c12370c04ca'),('typed_project_sales_receipt_items(stock_operational.sales_receipt_items)','8199760e2d5424c0c8df63a2e0561d68'),('typed_input_sales_receipt_items(jsonb)','19768653457d87881ebb459eaf459405'),('typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','f6671ffa5dbbb528b85ea28e05076a98'),('typed_input_sales_receipt_payments(jsonb)','d16be6e9899da9ed001caee206d679f7'),('typed_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','f815fbec31988ff98c8d3d85e890dd6d'),('typed_input_sales_receipt_syncs(jsonb)','120b96763f31ea5f65daaa82f46b5275'),('typed_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','5388c5fcd62b171539c292e4558c1e28'),('typed_input_sales_profit_cost_overrides(jsonb)','56eb838da448bc7a44e780d20230fb92'),('typed_project_stock_counts(stock_operational.stock_counts)','e2c0564ddbb155a68e8470fbb574e7a5'),('typed_input_stock_counts(jsonb)','34da05f442c8bff900f53d9bf41303e4'),('typed_project_stock_adjustments(stock_operational.stock_adjustments)','eea0eccacc7e8c9cf338e9ac53ab9479'),('typed_input_stock_adjustments(jsonb)','340fc2660897abe15f86dbb2db289c6b'),('typed_project_movements(stock_operational.movements)','d7d179fa5d82d2339bc87c7c54b019b9'),('typed_input_movements(jsonb)','c412349c1bb33c5448d1337d1627652d'),('typed_project_movement_details(stock_operational.movement_details)','b300286a03444a483a7688a1cc8328f9'),('typed_input_movement_details(jsonb)','54516495048ec2ee2014d6e97b79a862'),('typed_project_user_state(stock_operational.user_state)','8a1e2aabaf3e1b3c5537b46f587016b1'),('typed_input_user_state(jsonb)','1fc79e664300ecdec142f6157e711018'),('lexeme_mapping_contract_v1()','d6bff8c325bc80100e0993f09296a948'),('advance_revision()','5eb221fdefa47fef5b3400436fe5a6ac')) e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed mapper predecessor: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('validate_orders()','
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
PERFORM stock_operational.typed_project_orders(NEW);
RETURN NEW; END '),('validate_order_items()','
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
PERFORM stock_operational.typed_project_order_items(NEW);
RETURN NEW; END '),('validate_order_bills()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."orderId" := nullif(NEW."orderId",'''');
NEW."imageUrl" := nullif(NEW."imageUrl",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_order_bills(NEW);
RETURN NEW; END '),('validate_shipments()','
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
PERFORM stock_operational.typed_project_shipments(NEW);
RETURN NEW; END '),('validate_shipment_orders()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."shipmentId" := nullif(NEW."shipmentId",'''');
NEW."orderId" := nullif(NEW."orderId",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
PERFORM stock_operational.native_timestamp_text(NEW."deletedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_shipment_orders(NEW);
RETURN NEW; END '),('validate_employees()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
NEW."phone" := nullif(NEW."phone",'''');
NEW."status" := nullif(NEW."status",'''');
NEW."hiredDate" := nullif(NEW."hiredDate",'''');
NEW."terminatedDate" := nullif(NEW."terminatedDate",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."createdBy" := nullif(NEW."createdBy",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_employees(NEW);
RETURN NEW; END '),('validate_employee_compensations()','
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
PERFORM stock_operational.typed_project_employee_compensations(NEW);
RETURN NEW; END '),('validate_employee_timesheets()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."employeeId" := nullif(NEW."employeeId",'''');
NEW."shopId" := nullif(NEW."shopId",'''');
NEW."status" := nullif(NEW."status",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
NEW."workdayType" := nullif(NEW."workdayType",'''');
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_employee_timesheets(NEW);
RETURN NEW; END '),('validate_employee_advances()','
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
PERFORM stock_operational.typed_project_employee_advances(NEW);
RETURN NEW; END '),('validate_payroll_settlements()','
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
PERFORM stock_operational.typed_project_payroll_settlements(NEW);
RETURN NEW; END '),('validate_expenses()','
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
PERFORM stock_operational.typed_project_expenses(NEW);
RETURN NEW; END '),('validate_expense_categories()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_expense_categories(NEW);
RETURN NEW; END '),('validate_shops()','
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
PERFORM stock_operational.typed_project_shops(NEW);
RETURN NEW; END '),('validate_sales_receipts()','
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
PERFORM stock_operational.typed_project_sales_receipts(NEW);
RETURN NEW; END '),('validate_sales_receipt_items()','
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
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.typed_project_sales_receipt_items(NEW);
RETURN NEW; END '),('validate_sales_receipt_payments()','
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
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.typed_project_sales_receipt_payments(NEW);
RETURN NEW; END '),('validate_sales_receipt_syncs()','
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
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.typed_project_sales_receipt_syncs(NEW);
RETURN NEW; END '),('validate_sales_profit_cost_overrides()','
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
PERFORM stock_operational.typed_project_sales_profit_cost_overrides(NEW);
RETURN NEW; END '),('validate_stock_counts()','
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
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.typed_project_stock_counts(NEW);
RETURN NEW; END '),('validate_stock_adjustments()','
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
PERFORM stock_operational.typed_project_stock_adjustments(NEW);
RETURN NEW; END '),('validate_movements()','
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
PERFORM stock_operational.typed_project_movements(NEW);
RETURN NEW; END '),('validate_movement_details()','
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
PERFORM stock_operational.typed_project_movement_details(NEW);
RETURN NEW; END '),('validate_user_state()','
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
PERFORM stock_operational.typed_project_user_state(NEW);
RETURN NEW; END ')) e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
-- Include external procedural consumers: PostgreSQL does not track every
-- PL/pgSQL body reference as a catalog dependency. Refuse, never cascade.
SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('stock_operational.column_compatible_orders(stock_operational.orders)'::regprocedure,'stock_operational.column_compatible_order_items(stock_operational.order_items)'::regprocedure,'stock_operational.column_compatible_order_bills(stock_operational.order_bills)'::regprocedure,'stock_operational.column_compatible_shipments(stock_operational.shipments)'::regprocedure,'stock_operational.column_compatible_shipment_orders(stock_operational.shipment_orders)'::regprocedure,'stock_operational.column_compatible_employees(stock_operational.employees)'::regprocedure,'stock_operational.column_compatible_employee_compensations(stock_operational.employee_compensations)'::regprocedure,'stock_operational.column_compatible_employee_timesheets(stock_operational.employee_timesheets)'::regprocedure,'stock_operational.column_compatible_employee_advances(stock_operational.employee_advances)'::regprocedure,'stock_operational.column_compatible_payroll_settlements(stock_operational.payroll_settlements)'::regprocedure,'stock_operational.column_compatible_expenses(stock_operational.expenses)'::regprocedure,'stock_operational.column_compatible_expense_categories(stock_operational.expense_categories)'::regprocedure,'stock_operational.column_compatible_shops(stock_operational.shops)'::regprocedure,'stock_operational.column_compatible_sales_receipts(stock_operational.sales_receipts)'::regprocedure,'stock_operational.column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)'::regprocedure,'stock_operational.column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)'::regprocedure,'stock_operational.column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'::regprocedure,'stock_operational.column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'::regprocedure,'stock_operational.column_compatible_stock_counts(stock_operational.stock_counts)'::regprocedure,'stock_operational.column_compatible_stock_adjustments(stock_operational.stock_adjustments)'::regprocedure,'stock_operational.column_compatible_movements(stock_operational.movements)'::regprocedure,'stock_operational.column_compatible_movement_details(stock_operational.movement_details)'::regprocedure,'stock_operational.column_compatible_user_state(stock_operational.user_state)'::regprocedure,'stock_operational.column_project_orders(stock_operational.orders)'::regprocedure,'stock_operational.column_project_order_items(stock_operational.order_items)'::regprocedure,'stock_operational.column_project_order_bills(stock_operational.order_bills)'::regprocedure,'stock_operational.column_project_shipments(stock_operational.shipments)'::regprocedure,'stock_operational.column_project_shipment_orders(stock_operational.shipment_orders)'::regprocedure,'stock_operational.column_project_employees(stock_operational.employees)'::regprocedure,'stock_operational.column_project_employee_compensations(stock_operational.employee_compensations)'::regprocedure,'stock_operational.column_project_employee_timesheets(stock_operational.employee_timesheets)'::regprocedure,'stock_operational.column_project_employee_advances(stock_operational.employee_advances)'::regprocedure,'stock_operational.column_project_payroll_settlements(stock_operational.payroll_settlements)'::regprocedure,'stock_operational.column_project_expenses(stock_operational.expenses)'::regprocedure,'stock_operational.column_project_expense_categories(stock_operational.expense_categories)'::regprocedure,'stock_operational.column_project_shops(stock_operational.shops)'::regprocedure,'stock_operational.column_project_sales_receipts(stock_operational.sales_receipts)'::regprocedure,'stock_operational.column_project_sales_receipt_items(stock_operational.sales_receipt_items)'::regprocedure,'stock_operational.column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)'::regprocedure,'stock_operational.column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'::regprocedure,'stock_operational.column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'::regprocedure,'stock_operational.column_project_stock_counts(stock_operational.stock_counts)'::regprocedure,'stock_operational.column_project_stock_adjustments(stock_operational.stock_adjustments)'::regprocedure,'stock_operational.column_project_movements(stock_operational.movements)'::regprocedure,'stock_operational.column_project_movement_details(stock_operational.movement_details)'::regprocedure,'stock_operational.column_project_user_state(stock_operational.user_state)'::regprocedure,'stock_operational.project_orders(stock_operational.orders)'::regprocedure,'stock_operational.project_order_items(stock_operational.order_items)'::regprocedure,'stock_operational.project_order_bills(stock_operational.order_bills)'::regprocedure,'stock_operational.project_shipments(stock_operational.shipments)'::regprocedure,'stock_operational.project_shipment_orders(stock_operational.shipment_orders)'::regprocedure,'stock_operational.project_employees(stock_operational.employees)'::regprocedure,'stock_operational.project_employee_compensations(stock_operational.employee_compensations)'::regprocedure,'stock_operational.project_employee_timesheets(stock_operational.employee_timesheets)'::regprocedure,'stock_operational.project_employee_advances(stock_operational.employee_advances)'::regprocedure,'stock_operational.project_payroll_settlements(stock_operational.payroll_settlements)'::regprocedure,'stock_operational.project_expenses(stock_operational.expenses)'::regprocedure,'stock_operational.project_expense_categories(stock_operational.expense_categories)'::regprocedure,'stock_operational.project_shops(stock_operational.shops)'::regprocedure,'stock_operational.project_sales_receipts(stock_operational.sales_receipts)'::regprocedure,'stock_operational.project_sales_receipt_items(stock_operational.sales_receipt_items)'::regprocedure,'stock_operational.project_sales_receipt_payments(stock_operational.sales_receipt_payments)'::regprocedure,'stock_operational.project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)'::regprocedure,'stock_operational.project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)'::regprocedure,'stock_operational.project_stock_counts(stock_operational.stock_counts)'::regprocedure,'stock_operational.project_stock_adjustments(stock_operational.stock_adjustments)'::regprocedure,'stock_operational.project_movements(stock_operational.movements)'::regprocedure,'stock_operational.project_movement_details(stock_operational.movement_details)'::regprocedure,'stock_operational.project_user_state(stock_operational.user_state)'::regprocedure,'stock_operational.column_input_orders(jsonb)'::regprocedure,'stock_operational.column_input_order_items(jsonb)'::regprocedure,'stock_operational.column_input_order_bills(jsonb)'::regprocedure,'stock_operational.column_input_shipments(jsonb)'::regprocedure,'stock_operational.column_input_shipment_orders(jsonb)'::regprocedure,'stock_operational.column_input_employees(jsonb)'::regprocedure,'stock_operational.column_input_employee_compensations(jsonb)'::regprocedure,'stock_operational.column_input_employee_timesheets(jsonb)'::regprocedure,'stock_operational.column_input_employee_advances(jsonb)'::regprocedure,'stock_operational.column_input_payroll_settlements(jsonb)'::regprocedure,'stock_operational.column_input_expenses(jsonb)'::regprocedure,'stock_operational.column_input_expense_categories(jsonb)'::regprocedure,'stock_operational.column_input_shops(jsonb)'::regprocedure,'stock_operational.column_input_sales_receipts(jsonb)'::regprocedure,'stock_operational.column_input_sales_receipt_items(jsonb)'::regprocedure,'stock_operational.column_input_sales_receipt_payments(jsonb)'::regprocedure,'stock_operational.column_input_sales_receipt_syncs(jsonb)'::regprocedure,'stock_operational.column_input_sales_profit_cost_overrides(jsonb)'::regprocedure,'stock_operational.column_input_stock_counts(jsonb)'::regprocedure,'stock_operational.column_input_stock_adjustments(jsonb)'::regprocedure,'stock_operational.column_input_movements(jsonb)'::regprocedure,'stock_operational.column_input_movement_details(jsonb)'::regprocedure,'stock_operational.column_input_user_state(jsonb)'::regprocedure,'stock_operational.input_orders(jsonb)'::regprocedure,'stock_operational.input_order_items(jsonb)'::regprocedure,'stock_operational.input_order_bills(jsonb)'::regprocedure,'stock_operational.input_shipments(jsonb)'::regprocedure,'stock_operational.input_shipment_orders(jsonb)'::regprocedure,'stock_operational.input_employees(jsonb)'::regprocedure,'stock_operational.input_employee_compensations(jsonb)'::regprocedure,'stock_operational.input_employee_timesheets(jsonb)'::regprocedure,'stock_operational.input_employee_advances(jsonb)'::regprocedure,'stock_operational.input_payroll_settlements(jsonb)'::regprocedure,'stock_operational.input_expenses(jsonb)'::regprocedure,'stock_operational.input_expense_categories(jsonb)'::regprocedure,'stock_operational.input_shops(jsonb)'::regprocedure,'stock_operational.input_sales_receipts(jsonb)'::regprocedure,'stock_operational.input_sales_receipt_items(jsonb)'::regprocedure,'stock_operational.input_sales_receipt_payments(jsonb)'::regprocedure,'stock_operational.input_sales_receipt_syncs(jsonb)'::regprocedure,'stock_operational.input_sales_profit_cost_overrides(jsonb)'::regprocedure,'stock_operational.input_stock_counts(jsonb)'::regprocedure,'stock_operational.input_stock_adjustments(jsonb)'::regprocedure,'stock_operational.input_movements(jsonb)'::regprocedure,'stock_operational.input_movement_details(jsonb)'::regprocedure,'stock_operational.input_user_state(jsonb)'::regprocedure,'stock_operational.column_mapping_contract_v1()'::regprocedure) AND lower(p.prosrc) ~ '(^|[^a-z0-9_])(column_compatible_orders|column_compatible_order_items|column_compatible_order_bills|column_compatible_shipments|column_compatible_shipment_orders|column_compatible_employees|column_compatible_employee_compensations|column_compatible_employee_timesheets|column_compatible_employee_advances|column_compatible_payroll_settlements|column_compatible_expenses|column_compatible_expense_categories|column_compatible_shops|column_compatible_sales_receipts|column_compatible_sales_receipt_items|column_compatible_sales_receipt_payments|column_compatible_sales_receipt_syncs|column_compatible_sales_profit_cost_overrides|column_compatible_stock_counts|column_compatible_stock_adjustments|column_compatible_movements|column_compatible_movement_details|column_compatible_user_state|column_project_orders|column_project_order_items|column_project_order_bills|column_project_shipments|column_project_shipment_orders|column_project_employees|column_project_employee_compensations|column_project_employee_timesheets|column_project_employee_advances|column_project_payroll_settlements|column_project_expenses|column_project_expense_categories|column_project_shops|column_project_sales_receipts|column_project_sales_receipt_items|column_project_sales_receipt_payments|column_project_sales_receipt_syncs|column_project_sales_profit_cost_overrides|column_project_stock_counts|column_project_stock_adjustments|column_project_movements|column_project_movement_details|column_project_user_state|project_orders|project_order_items|project_order_bills|project_shipments|project_shipment_orders|project_employees|project_employee_compensations|project_employee_timesheets|project_employee_advances|project_payroll_settlements|project_expenses|project_expense_categories|project_shops|project_sales_receipts|project_sales_receipt_items|project_sales_receipt_payments|project_sales_receipt_syncs|project_sales_profit_cost_overrides|project_stock_counts|project_stock_adjustments|project_movements|project_movement_details|project_user_state|column_input_orders|column_input_order_items|column_input_order_bills|column_input_shipments|column_input_shipment_orders|column_input_employees|column_input_employee_compensations|column_input_employee_timesheets|column_input_employee_advances|column_input_payroll_settlements|column_input_expenses|column_input_expense_categories|column_input_shops|column_input_sales_receipts|column_input_sales_receipt_items|column_input_sales_receipt_payments|column_input_sales_receipt_syncs|column_input_sales_profit_cost_overrides|column_input_stock_counts|column_input_stock_adjustments|column_input_movements|column_input_movement_details|column_input_user_state|input_orders|input_order_items|input_order_bills|input_shipments|input_shipment_orders|input_employees|input_employee_compensations|input_employee_timesheets|input_employee_advances|input_payroll_settlements|input_expenses|input_expense_categories|input_shops|input_sales_receipts|input_sales_receipt_items|input_sales_receipt_payments|input_sales_receipt_syncs|input_sales_profit_cost_overrides|input_stock_counts|input_stock_adjustments|input_movements|input_movement_details|input_user_state|column_mapping_contract_v1)([^a-z0-9_]|$)'))::int;
DROP FUNCTION stock_operational.column_compatible_orders(stock_operational.orders) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_order_items(stock_operational.order_items) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_order_bills(stock_operational.order_bills) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_shipments(stock_operational.shipments) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_shipment_orders(stock_operational.shipment_orders) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_employees(stock_operational.employees) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_employee_compensations(stock_operational.employee_compensations) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_employee_timesheets(stock_operational.employee_timesheets) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_employee_advances(stock_operational.employee_advances) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_payroll_settlements(stock_operational.payroll_settlements) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_expenses(stock_operational.expenses) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_expense_categories(stock_operational.expense_categories) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_shops(stock_operational.shops) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_sales_receipts(stock_operational.sales_receipts) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_sales_receipt_items(stock_operational.sales_receipt_items) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_stock_counts(stock_operational.stock_counts) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_stock_adjustments(stock_operational.stock_adjustments) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_movements(stock_operational.movements) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_movement_details(stock_operational.movement_details) RESTRICT;
DROP FUNCTION stock_operational.column_compatible_user_state(stock_operational.user_state) RESTRICT;
DROP FUNCTION stock_operational.column_project_orders(stock_operational.orders) RESTRICT;
DROP FUNCTION stock_operational.column_project_order_items(stock_operational.order_items) RESTRICT;
DROP FUNCTION stock_operational.column_project_order_bills(stock_operational.order_bills) RESTRICT;
DROP FUNCTION stock_operational.column_project_shipments(stock_operational.shipments) RESTRICT;
DROP FUNCTION stock_operational.column_project_shipment_orders(stock_operational.shipment_orders) RESTRICT;
DROP FUNCTION stock_operational.column_project_employees(stock_operational.employees) RESTRICT;
DROP FUNCTION stock_operational.column_project_employee_compensations(stock_operational.employee_compensations) RESTRICT;
DROP FUNCTION stock_operational.column_project_employee_timesheets(stock_operational.employee_timesheets) RESTRICT;
DROP FUNCTION stock_operational.column_project_employee_advances(stock_operational.employee_advances) RESTRICT;
DROP FUNCTION stock_operational.column_project_payroll_settlements(stock_operational.payroll_settlements) RESTRICT;
DROP FUNCTION stock_operational.column_project_expenses(stock_operational.expenses) RESTRICT;
DROP FUNCTION stock_operational.column_project_expense_categories(stock_operational.expense_categories) RESTRICT;
DROP FUNCTION stock_operational.column_project_shops(stock_operational.shops) RESTRICT;
DROP FUNCTION stock_operational.column_project_sales_receipts(stock_operational.sales_receipts) RESTRICT;
DROP FUNCTION stock_operational.column_project_sales_receipt_items(stock_operational.sales_receipt_items) RESTRICT;
DROP FUNCTION stock_operational.column_project_sales_receipt_payments(stock_operational.sales_receipt_payments) RESTRICT;
DROP FUNCTION stock_operational.column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) RESTRICT;
DROP FUNCTION stock_operational.column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) RESTRICT;
DROP FUNCTION stock_operational.column_project_stock_counts(stock_operational.stock_counts) RESTRICT;
DROP FUNCTION stock_operational.column_project_stock_adjustments(stock_operational.stock_adjustments) RESTRICT;
DROP FUNCTION stock_operational.column_project_movements(stock_operational.movements) RESTRICT;
DROP FUNCTION stock_operational.column_project_movement_details(stock_operational.movement_details) RESTRICT;
DROP FUNCTION stock_operational.column_project_user_state(stock_operational.user_state) RESTRICT;
DROP FUNCTION stock_operational.project_orders(stock_operational.orders) RESTRICT;
DROP FUNCTION stock_operational.project_order_items(stock_operational.order_items) RESTRICT;
DROP FUNCTION stock_operational.project_order_bills(stock_operational.order_bills) RESTRICT;
DROP FUNCTION stock_operational.project_shipments(stock_operational.shipments) RESTRICT;
DROP FUNCTION stock_operational.project_shipment_orders(stock_operational.shipment_orders) RESTRICT;
DROP FUNCTION stock_operational.project_employees(stock_operational.employees) RESTRICT;
DROP FUNCTION stock_operational.project_employee_compensations(stock_operational.employee_compensations) RESTRICT;
DROP FUNCTION stock_operational.project_employee_timesheets(stock_operational.employee_timesheets) RESTRICT;
DROP FUNCTION stock_operational.project_employee_advances(stock_operational.employee_advances) RESTRICT;
DROP FUNCTION stock_operational.project_payroll_settlements(stock_operational.payroll_settlements) RESTRICT;
DROP FUNCTION stock_operational.project_expenses(stock_operational.expenses) RESTRICT;
DROP FUNCTION stock_operational.project_expense_categories(stock_operational.expense_categories) RESTRICT;
DROP FUNCTION stock_operational.project_shops(stock_operational.shops) RESTRICT;
DROP FUNCTION stock_operational.project_sales_receipts(stock_operational.sales_receipts) RESTRICT;
DROP FUNCTION stock_operational.project_sales_receipt_items(stock_operational.sales_receipt_items) RESTRICT;
DROP FUNCTION stock_operational.project_sales_receipt_payments(stock_operational.sales_receipt_payments) RESTRICT;
DROP FUNCTION stock_operational.project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) RESTRICT;
DROP FUNCTION stock_operational.project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) RESTRICT;
DROP FUNCTION stock_operational.project_stock_counts(stock_operational.stock_counts) RESTRICT;
DROP FUNCTION stock_operational.project_stock_adjustments(stock_operational.stock_adjustments) RESTRICT;
DROP FUNCTION stock_operational.project_movements(stock_operational.movements) RESTRICT;
DROP FUNCTION stock_operational.project_movement_details(stock_operational.movement_details) RESTRICT;
DROP FUNCTION stock_operational.project_user_state(stock_operational.user_state) RESTRICT;
DROP FUNCTION stock_operational.column_input_orders(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_order_items(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_order_bills(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_shipments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_shipment_orders(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_employees(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_employee_compensations(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_employee_timesheets(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_employee_advances(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_payroll_settlements(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_expenses(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_expense_categories(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_shops(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_sales_receipts(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_sales_receipt_items(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_sales_receipt_payments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_sales_receipt_syncs(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_sales_profit_cost_overrides(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_stock_counts(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_stock_adjustments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_movements(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_movement_details(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_input_user_state(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_orders(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_order_items(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_order_bills(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_shipments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_shipment_orders(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_employees(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_employee_compensations(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_employee_timesheets(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_employee_advances(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_payroll_settlements(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_expenses(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_expense_categories(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_shops(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_sales_receipts(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_sales_receipt_items(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_sales_receipt_payments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_sales_receipt_syncs(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_sales_profit_cost_overrides(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_stock_counts(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_stock_adjustments(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_movements(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_movement_details(jsonb) RESTRICT;
DROP FUNCTION stock_operational.input_user_state(jsonb) RESTRICT;
DROP FUNCTION stock_operational.column_mapping_contract_v1() RESTRICT;
SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;
COMMIT;
