-- OPERATOR ONLY. PR76 or newer compatible app must be verified first.
-- No data update, no replacement encoding column, no extra grants or CASCADE.
-- A fresh restored recovery checkpoint and exact app/LINE parity are required.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.cell_kinds_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_final_cell_kinds_removal',true)='reviewed-per-column-retirement-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_semantics_verified',true)='exact-app-line-optional-tails-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
LOCK TABLE stock_operational.environment,stock_operational.revision,stock_operational.orders,stock_operational.order_items,stock_operational.order_bills,stock_operational.shipments,stock_operational.shipment_orders,stock_operational.employees,stock_operational.employee_compensations,stock_operational.employee_timesheets,stock_operational.employee_advances,stock_operational.payroll_settlements,stock_operational.expenses,stock_operational.expense_categories,stock_operational.shops,stock_operational.sales_receipts,stock_operational.sales_receipt_items,stock_operational.sales_receipt_payments,stock_operational.sales_receipt_syncs,stock_operational.sales_profit_cost_overrides,stock_operational.stock_counts,stock_operational.stock_adjustments,stock_operational.movements,stock_operational.movement_details,stock_operational.user_state IN ACCESS EXCLUSIVE MODE;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.cell_kinds_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('input_orders(jsonb)','34cb69f3eb7a4ee84a883a220ec5283a'),('project_orders(stock_operational.orders)','6a7f41b2d41c5a864f8d2cb0552df6a2'),('validate_orders()','6ef1229e7e3e3add3a20a129b4ff8f34'),('input_order_items(jsonb)','1eb764c973bf4702b7f6a50f97003e25'),('project_order_items(stock_operational.order_items)','03ae4676dfc4bc16161a6b58bb11bd14'),('validate_order_items()','91491fa7646b3638cd9f01fe96efab01'),('input_order_bills(jsonb)','e72fd055aac8654d5745c67816ae251b'),('project_order_bills(stock_operational.order_bills)','9932e74af9fb5fe960dc29d1de7f69a7'),('validate_order_bills()','08077e621013916cc5a1320f5554422f'),('input_shipments(jsonb)','e5a2bd88c5109116c3e5e7d9fc1ff37b'),('project_shipments(stock_operational.shipments)','e4fc1121fa5606246c6af79c83f97531'),('validate_shipments()','d04a0df34d5bc10c5a3fdd1b3bd3ad76'),('input_shipment_orders(jsonb)','14c2e20f157fc65f348d961c6deb6e15'),('project_shipment_orders(stock_operational.shipment_orders)','48a655b66a5f7f5baa8b81ee44b5a519'),('validate_shipment_orders()','8ba6208b66026b17be9c1b1bb3695a5a'),('input_employees(jsonb)','c9371069e67edb806961aaea2e051415'),('project_employees(stock_operational.employees)','986fbc18440682e1d646b2d6195e6b24'),('validate_employees()','4a0219a633cfa2f9c93ef0e0f9379ba0'),('input_employee_compensations(jsonb)','95ed4149c28750942e290405f8fecb96'),('project_employee_compensations(stock_operational.employee_compensations)','962ad8435150cc79d979db806820222c'),('validate_employee_compensations()','90def57aa8e02425da3b0f85497683c1'),('input_employee_timesheets(jsonb)','ac17974340a32ec058ddb0b1daceeb3d'),('project_employee_timesheets(stock_operational.employee_timesheets)','1d9197a5cdca11a6c23a5c524794fbc6'),('validate_employee_timesheets()','7f2f1670462c0bb6a9d4110b3991dee2'),('input_employee_advances(jsonb)','c7dce3c7c35b31c83cd38aac6bced94c'),('project_employee_advances(stock_operational.employee_advances)','1081154c177e66a6135db14f132d0392'),('validate_employee_advances()','0a15fdd0f505a0054969e95432eb5215'),('input_payroll_settlements(jsonb)','2b60fa2d1b5b218e5392c356abc313e3'),('project_payroll_settlements(stock_operational.payroll_settlements)','32ba53cbe0ad0bb7b89b128554072576'),('validate_payroll_settlements()','d9ed836fec8a004ed3d263ebda3ff922'),('input_expenses(jsonb)','1babb669ec9dd8cbfcc5fd81256038fe'),('project_expenses(stock_operational.expenses)','c5a4bd8a47775998404ce6d90fb608c7'),('validate_expenses()','70e5d0b399d69030ed4a3012afe73195'),('input_expense_categories(jsonb)','cd2bae2b0838a1226ecf5b47d5d2fd80'),('project_expense_categories(stock_operational.expense_categories)','554f3816a38b634dfc7e3298a3fba799'),('validate_expense_categories()','85c0efb05a2eb752364237b2358eb349'),('input_shops(jsonb)','774244579b1fbafbc1e5f639f0c9b3db'),('project_shops(stock_operational.shops)','359344d0f24788084e1d1c660fd24f8e'),('validate_shops()','4eeca1ffd101d966afb3e18ff7ae7b39'),('input_sales_receipts(jsonb)','2fd985788543024daa2f7db42272ecdc'),('project_sales_receipts(stock_operational.sales_receipts)','150f69bd14c6ef6d95e3415f7833f0f0'),('validate_sales_receipts()','c2cbe6446d7b37699b8bf6c9e300254c'),('input_sales_receipt_items(jsonb)','543194b8dbd7046c82f8dcb6194e7104'),('project_sales_receipt_items(stock_operational.sales_receipt_items)','d95880392b392a81bb9d9738816a51f7'),('validate_sales_receipt_items()','4daa5f9476d56bffa4968af73dc37822'),('input_sales_receipt_payments(jsonb)','d8114668797aaaa4a4e2d047fcbb0656'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)','2a714e26c41b250fe6cc970c9cb40ee7'),('validate_sales_receipt_payments()','d47cafad9303fe28e2821a1d38d4750d'),('input_sales_receipt_syncs(jsonb)','c6ebc3d2f2154c463b99d2d045d9d4c4'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','7b951d44b0738ae4fbc3c7020ec1e3ae'),('validate_sales_receipt_syncs()','1872bd8686848194416a277015ac5a2f'),('input_sales_profit_cost_overrides(jsonb)','5193bb5561253c6ae3d88e392ac974b4'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','44dc7bf1629fe22fa86fede7f18799e3'),('validate_sales_profit_cost_overrides()','b11d1e7290658e3fb5a6a4d08b61fe55'),('input_stock_counts(jsonb)','713a64e36b2beb85e83e53ed925f2ead'),('project_stock_counts(stock_operational.stock_counts)','d0b5cf3fd21672cb189a9db44198c3d2'),('validate_stock_counts()','b8794ccf34da0dd43a7d25e429810700'),('input_stock_adjustments(jsonb)','82c0fa38e2eb7834e0631075b7163880'),('project_stock_adjustments(stock_operational.stock_adjustments)','144abbfc09777e02c19075695233c0b9'),('validate_stock_adjustments()','f8b0d91248d27dc20c3ad1cf008a92f7'),('input_movements(jsonb)','be211ac43589ff5b15b81e81f5ba98fd'),('project_movements(stock_operational.movements)','6fe71670d5edc3ede7078aa035d47d8e'),('validate_movements()','f90b159b1c8aab198dea6fd8babcb14d'),('input_movement_details(jsonb)','bfcc90189bd3d5de4135103f3158a30c'),('project_movement_details(stock_operational.movement_details)','6a359840cb06d0d808738c5870bd0009'),('validate_movement_details()','eb6f28a135ce66de7b82b7823659e2b4'),('input_user_state(jsonb)','92d4b0dbaec1a1e8e5be4c9e24914796'),('project_user_state(stock_operational.user_state)','cf3eb231bdd2059f91fec39b808a0313'),('validate_user_state()','a9f543afe663547bab79f0ec9fa62031'),('column_numeric_v1(numeric,text)','b6c65a84062cd56a9b5d8f438d554851'),('column_bigint_v1(bigint,text)','a8cbab7e0cf32fcfc720a2572963ddbf'),('column_boolean_v1(boolean,text)','5ead1dc7f1e9ca77fd885e79a9852d5d'),('column_jsonb_v1(jsonb,text)','a12994e1234e85cc602ad0e6390fee76'),('column_project_orders(stock_operational.orders)','11f0c525444dcdb05f6e90632d148c66'),('column_input_orders(jsonb)','f8736775584a0af2208e791d32a55d22'),('column_compatible_orders(stock_operational.orders)','ecfc13d6eb3d7e6e2940611c9451d96e'),('column_project_order_items(stock_operational.order_items)','fe9dd62431436a64491ad66fee837eb4'),('column_input_order_items(jsonb)','7e4a822ee53fd9fcca00d2f47e2f4bbc'),('column_compatible_order_items(stock_operational.order_items)','86d984fca8419609d80a1bd21abe2d55'),('column_project_order_bills(stock_operational.order_bills)','8019b047deef8e88eeb60f92d17cd987'),('column_input_order_bills(jsonb)','b12e805c4acdb1daa514e8cdd690ac19'),('column_compatible_order_bills(stock_operational.order_bills)','d20295b4ecdb7560a2614798f2ea14da'),('column_project_shipments(stock_operational.shipments)','95099880736ab6ba6d75c9bc21a048a7'),('column_input_shipments(jsonb)','756653308ccba9e2e02005d49ec10ebf'),('column_compatible_shipments(stock_operational.shipments)','0e2ff8fbea7ad613756dc1dbfba534c2'),('column_project_shipment_orders(stock_operational.shipment_orders)','e8e608f2a1355e9a6fe0c63908fa2d0f'),('column_input_shipment_orders(jsonb)','57b47ca7ecec7ffb819581e7ab41f7e3'),('column_compatible_shipment_orders(stock_operational.shipment_orders)','714f34f76ec09c96de2ca669f0d12475'),('column_project_employees(stock_operational.employees)','f65a472e40a1a63abb3d517ad807cc83'),('column_input_employees(jsonb)','936423861c4b943aa6b0a338d93fecde'),('column_compatible_employees(stock_operational.employees)','4099b1aacd6bbf30bbc4a8aef80fa395'),('column_project_employee_compensations(stock_operational.employee_compensations)','f45432a433d0015140443d011c8f9c6d'),('column_input_employee_compensations(jsonb)','714562b389aa9b8266cc735b92c71e11'),('column_compatible_employee_compensations(stock_operational.employee_compensations)','ef38f2ee0982c3b168a67b042560e35b'),('column_project_employee_timesheets(stock_operational.employee_timesheets)','e53a2faf2dae4dfdb879653dca99cc31'),('column_input_employee_timesheets(jsonb)','1e3055708afe746649c749d3001c47bf'),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','608bd0f3267ec89d81d57e1c41d4b1aa'),('column_project_employee_advances(stock_operational.employee_advances)','345e18cd79750c6203f720ab3478a35e'),('column_input_employee_advances(jsonb)','45284a945a94b0877dcabcafcdb43b86'),('column_compatible_employee_advances(stock_operational.employee_advances)','b0aa2381b6e2339c2e9bc1b1399f66b1'),('column_project_payroll_settlements(stock_operational.payroll_settlements)','97d19bf717c94321700215616a9e1dde'),('column_input_payroll_settlements(jsonb)','057fdc24ee817616c5b49d9dc3146fc1'),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','2ef9e82d132bd99702f8b18a29c01411'),('column_project_expenses(stock_operational.expenses)','be1da2b05c5c3280d17ac21eebd4d7f7'),('column_input_expenses(jsonb)','d6ab83233579bd39e164a0200b62a292'),('column_compatible_expenses(stock_operational.expenses)','109cc311e5ad874d2b17a431a9211956'),('column_project_expense_categories(stock_operational.expense_categories)','2a487f01323a1cf0ae3884b8a0d30b64'),('column_input_expense_categories(jsonb)','d85c4ff2e30fa4e3e7a4288961d45a78'),('column_compatible_expense_categories(stock_operational.expense_categories)','417eb64f4f54225b6426a7c17ba41ff9'),('column_project_shops(stock_operational.shops)','7e5b09b0b4aacac1d29e55d863bec7a2'),('column_input_shops(jsonb)','94b39bfa8a707772a4f9656332495e6d'),('column_compatible_shops(stock_operational.shops)','f1c9b421124eec7f9fef0ce24d8931d8'),('column_project_sales_receipts(stock_operational.sales_receipts)','5f6e10f6a9ec9d9d0e00e15279dcbb99'),('column_input_sales_receipts(jsonb)','8e04c1bb95ff3c7f553d2488557a27f0'),('column_compatible_sales_receipts(stock_operational.sales_receipts)','dfa92e7752e865355fbe149ea544c923'),('column_project_sales_receipt_items(stock_operational.sales_receipt_items)','3c62e77d7a976901707c767147b62dd4'),('column_input_sales_receipt_items(jsonb)','d7fe14488aaa948a6402dae06c9165e9'),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','05456e2e8a56428bf70820ce2f4df029'),('column_project_sales_receipt_payments(stock_operational.sales_receipt_payments)','72ffe0420b16251a08ddd55837d6e63f'),('column_input_sales_receipt_payments(jsonb)','ecc63bd43e039c9e2aca5eca94174c42'),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','7a6ac8ccbdfb976bb2f2b506f026fc33'),('column_project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','a5fae88e6a96f7f5448d2f2608248df2'),('column_input_sales_receipt_syncs(jsonb)','d5ea7015dd4954091455f64c29bc7406'),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','0e3f5547965ecdb29734d9a203e7d700'),('column_project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','bba12c9a7351d04a51af3100319c558c'),('column_input_sales_profit_cost_overrides(jsonb)','b7c367a807a255e6e41d42ee997c86fb'),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','81add0beef8b7949d81dc40fcdae56ee'),('column_project_stock_counts(stock_operational.stock_counts)','c79a797996b5b2be87df0e6b09e60370'),('column_input_stock_counts(jsonb)','34f1ec9fb5e59bb61c629efbce50641a'),('column_compatible_stock_counts(stock_operational.stock_counts)','2742ba4ebb746d25b6613ee72d9d77ca'),('column_project_stock_adjustments(stock_operational.stock_adjustments)','f94cd9aed024578b8ab72b7c399473bd'),('column_input_stock_adjustments(jsonb)','2ff9ebd8948534a65d66f9ca20c0cb47'),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','4b1e2df8886ef60c12e220a3abf4a131'),('column_project_movements(stock_operational.movements)','5e16c86604f30d405eab3c13a7cd89e8'),('column_input_movements(jsonb)','135656db6cba2df65ea739724bf6a833'),('column_compatible_movements(stock_operational.movements)','658f6e148c485f2a1855982031b73cfd'),('column_project_movement_details(stock_operational.movement_details)','1f41da392a375f6ad23a1fc3b1118cee'),('column_input_movement_details(jsonb)','3c8dfc0fa3d508cf22dfb3e31e7b0873'),('column_compatible_movement_details(stock_operational.movement_details)','98b422438acf9061454ae844388c0c3b'),('column_project_user_state(stock_operational.user_state)','b5e74e66f7a93af6eaea61fb235d03be'),('column_input_user_state(jsonb)','55de9ac3098d64c7f168148d3933934a'),('column_compatible_user_state(stock_operational.user_state)','ac5cac5f8a07f9dfd1105f3b1bbeed6c'),('column_mapping_contract_v1()','9196f1a4b00eeee35d3834370a2e87d4'),('native_timestamp_input(text)','5555bc26987e15a622b9b50797caefa6'),('native_timestamp_text(timestamptz)','5ad1f4189fa453fedf54eb9dfe7b5e0e'),('created_at_timestamp(text)','f2841c85ed82d2ba4a51ac0fb5fa4aa7'),('cell_projection(jsonb,text,text,text)','02b242473ff302e3100dbbfe65645f7b')) e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed encoding predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || CASE WHEN t."totalPrice__lexeme" IS NOT NULL OR t."totalPrice" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || CASE WHEN t."totalPrice__lexeme" IS NOT NULL OR t."totalPrice" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's')=repeat('s',9)) THEN NULL::jsonb ELSE stock_operational.project_orders(t) END old,
 stock_operational.column_project_orders(t) candidate FROM stock_operational.orders t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in orders; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || CASE WHEN t."quoteQuantity__lexeme" IS NOT NULL OR t."quoteQuantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."deliveredQuantity__lexeme" IS NOT NULL OR t."deliveredQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || CASE WHEN t."quoteQuantity__lexeme" IS NOT NULL OR t."quoteQuantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."deliveredQuantity__lexeme" IS NOT NULL OR t."deliveredQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's')=repeat('s',10)) THEN NULL::jsonb ELSE stock_operational.project_order_items(t) END old,
 stock_operational.column_project_order_items(t) candidate FROM stock_operational.order_items t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in order_items; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',7)) THEN NULL::jsonb ELSE stock_operational.project_order_bills(t) END old,
 stock_operational.column_project_order_bills(t) candidate FROM stock_operational.order_bills t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in order_bills; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || CASE WHEN t."shippingFee__lexeme" IS NOT NULL OR t."shippingFee" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || CASE WHEN t."shippingFee__lexeme" IS NOT NULL OR t."shippingFee" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',13)) THEN NULL::jsonb ELSE stock_operational.project_shipments(t) END old,
 stock_operational.column_project_shipments(t) candidate FROM stock_operational.shipments t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[12]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in shipments; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',7)) THEN NULL::jsonb ELSE stock_operational.project_shipment_orders(t) END old,
 stock_operational.column_project_shipment_orders(t) candidate FROM stock_operational.shipment_orders t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in shipment_orders; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',9)) THEN NULL::jsonb ELSE stock_operational.project_employees(t) END old,
 stock_operational.column_project_employees(t) candidate FROM stock_operational.employees t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in employees; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || CASE WHEN t."baseSalary__lexeme" IS NOT NULL OR t."baseSalary" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commission__lexeme" IS NOT NULL OR t."commission" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."commissionBucketSales__lexeme" IS NOT NULL OR t."commissionBucketSales" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commissionBucketAmount__lexeme" IS NOT NULL OR t."commissionBucketAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commissionRoundupThreshold__lexeme" IS NOT NULL OR t."commissionRoundupThreshold" IS NULL THEN 's' ELSE 'n' END) OR (t.cell_kinds IS NULL AND ('s' || CASE WHEN t."baseSalary__lexeme" IS NOT NULL OR t."baseSalary" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commission__lexeme" IS NOT NULL OR t."commission" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."commissionBucketSales__lexeme" IS NOT NULL OR t."commissionBucketSales" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commissionBucketAmount__lexeme" IS NOT NULL OR t."commissionBucketAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."commissionRoundupThreshold__lexeme" IS NOT NULL OR t."commissionRoundupThreshold" IS NULL THEN 's' ELSE 'n' END)=repeat('s',12)) THEN NULL::jsonb ELSE stock_operational.project_employee_compensations(t) END old,
 stock_operational.column_project_employee_compensations(t) candidate FROM stock_operational.employee_compensations t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[8,9,10,11]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in employee_compensations; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',7)) THEN NULL::jsonb ELSE stock_operational.project_employee_timesheets(t) END old,
 stock_operational.column_project_employee_timesheets(t) candidate FROM stock_operational.employee_timesheets t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[6]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in employee_timesheets; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || CASE WHEN t."requestedAmount__lexeme" IS NOT NULL OR t."requestedAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."paidAmount__lexeme" IS NOT NULL OR t."paidAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || CASE WHEN t."requestedAmount__lexeme" IS NOT NULL OR t."requestedAmount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."paidAmount__lexeme" IS NOT NULL OR t."paidAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',13)) THEN NULL::jsonb ELSE stock_operational.project_employee_advances(t) END old,
 stock_operational.column_project_employee_advances(t) candidate FROM stock_operational.employee_advances t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in employee_advances; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',7)) THEN NULL::jsonb ELSE stock_operational.project_payroll_settlements(t) END old,
 stock_operational.column_project_payroll_settlements(t) candidate FROM stock_operational.payroll_settlements t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in payroll_settlements; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."amount__lexeme" IS NOT NULL OR t."amount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."amount__lexeme" IS NOT NULL OR t."amount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's')=repeat('s',13)) THEN NULL::jsonb ELSE stock_operational.project_expenses(t) END old,
 stock_operational.column_project_expenses(t) candidate FROM stock_operational.expenses t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[12]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in expenses; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || CASE WHEN t."active__lexeme" IS NOT NULL OR t."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || CASE WHEN t."active__lexeme" IS NOT NULL OR t."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's')=repeat('s',5)) THEN NULL::jsonb ELSE stock_operational.project_expense_categories(t) END old,
 stock_operational.column_project_expense_categories(t) candidate FROM stock_operational.expense_categories t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in expense_categories; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || CASE WHEN t."active__lexeme" IS NOT NULL OR t."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || CASE WHEN t."active__lexeme" IS NOT NULL OR t."active" IS NULL THEN 's' ELSE 'b' END || 's' || 's' || 's')=repeat('s',6)) THEN NULL::jsonb ELSE stock_operational.project_shops(t) END old,
 stock_operational.column_project_shops(t) candidate FROM stock_operational.shops t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in shops; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."totalMoney__lexeme" IS NOT NULL OR t."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalTax__lexeme" IS NOT NULL OR t."totalTax" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalDiscount__lexeme" IS NOT NULL OR t."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."tip__lexeme" IS NOT NULL OR t."tip" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."surcharge__lexeme" IS NOT NULL OR t."surcharge" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."pointsEarned__lexeme" IS NOT NULL OR t."pointsEarned" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."pointsDeducted__lexeme" IS NOT NULL OR t."pointsDeducted" IS NULL THEN 's' ELSE 'n' END || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."totalMoney__lexeme" IS NOT NULL OR t."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalTax__lexeme" IS NOT NULL OR t."totalTax" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalDiscount__lexeme" IS NOT NULL OR t."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."tip__lexeme" IS NOT NULL OR t."tip" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."surcharge__lexeme" IS NOT NULL OR t."surcharge" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."pointsEarned__lexeme" IS NOT NULL OR t."pointsEarned" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."pointsDeducted__lexeme" IS NOT NULL OR t."pointsDeducted" IS NULL THEN 's' ELSE 'n' END || 's')=repeat('s',26)) THEN NULL::jsonb ELSE stock_operational.project_sales_receipts(t) END old,
 stock_operational.column_project_sales_receipts(t) candidate FROM stock_operational.sales_receipts t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in sales_receipts; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."price__lexeme" IS NOT NULL OR t."price" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."grossTotalMoney__lexeme" IS NOT NULL OR t."grossTotalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalDiscount__lexeme" IS NOT NULL OR t."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalMoney__lexeme" IS NOT NULL OR t."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."cost__lexeme" IS NOT NULL OR t."cost" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."costTotal__lexeme" IS NOT NULL OR t."costTotal" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."taxes__lexeme" IS NOT NULL OR t."taxes" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."price__lexeme" IS NOT NULL OR t."price" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."grossTotalMoney__lexeme" IS NOT NULL OR t."grossTotalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalDiscount__lexeme" IS NOT NULL OR t."totalDiscount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."totalMoney__lexeme" IS NOT NULL OR t."totalMoney" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."cost__lexeme" IS NOT NULL OR t."cost" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."costTotal__lexeme" IS NOT NULL OR t."costTotal" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."taxes__lexeme" IS NOT NULL OR t."taxes" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's')=repeat('s',21)) THEN NULL::jsonb ELSE stock_operational.project_sales_receipt_items(t) END old,
 stock_operational.column_project_sales_receipt_items(t) candidate FROM stock_operational.sales_receipt_items t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in sales_receipt_items; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || CASE WHEN t."paymentIndex__lexeme" IS NOT NULL OR t."paymentIndex" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || CASE WHEN t."moneyAmount__lexeme" IS NOT NULL OR t."moneyAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || CASE WHEN t."paymentIndex__lexeme" IS NOT NULL OR t."paymentIndex" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || CASE WHEN t."moneyAmount__lexeme" IS NOT NULL OR t."moneyAmount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's')=repeat('s',10)) THEN NULL::jsonb ELSE stock_operational.project_sales_receipt_payments(t) END old,
 stock_operational.column_project_sales_receipt_payments(t) candidate FROM stock_operational.sales_receipt_payments t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in sales_receipt_payments; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || CASE WHEN t."receiptCount__lexeme" IS NOT NULL OR t."receiptCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."itemCount__lexeme" IS NOT NULL OR t."itemCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."paymentCount__lexeme" IS NOT NULL OR t."paymentCount" IS NULL THEN 's' ELSE 'n' END || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || CASE WHEN t."receiptCount__lexeme" IS NOT NULL OR t."receiptCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."itemCount__lexeme" IS NOT NULL OR t."itemCount" IS NULL THEN 's' ELSE 'n' END || CASE WHEN t."paymentCount__lexeme" IS NOT NULL OR t."paymentCount" IS NULL THEN 's' ELSE 'n' END || 's')=repeat('s',9)) THEN NULL::jsonb ELSE stock_operational.project_sales_receipt_syncs(t) END old,
 stock_operational.column_project_sales_receipt_syncs(t) candidate FROM stock_operational.sales_receipt_syncs t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in sales_receipt_syncs; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || CASE WHEN t."averageItemCost__lexeme" IS NOT NULL OR t."averageItemCost" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || CASE WHEN t."averageItemCost__lexeme" IS NOT NULL OR t."averageItemCost" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's')=repeat('s',8)) THEN NULL::jsonb ELSE stock_operational.project_sales_profit_cost_overrides(t) END old,
 stock_operational.column_project_sales_profit_cost_overrides(t) candidate FROM stock_operational.sales_profit_cost_overrides t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in sales_profit_cost_overrides; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || CASE WHEN t."physicalCount__lexeme" IS NOT NULL OR t."physicalCount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || CASE WHEN t."physicalCount__lexeme" IS NOT NULL OR t."physicalCount" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's')=repeat('s',9)) THEN NULL::jsonb ELSE stock_operational.project_stock_counts(t) END old,
 stock_operational.column_project_stock_counts(t) candidate FROM stock_operational.stock_counts t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in stock_counts; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."notInLoyverse__lexeme" IS NOT NULL OR t."notInLoyverse" IS NULL THEN 's' ELSE 'b' END) OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."notInLoyverse__lexeme" IS NOT NULL OR t."notInLoyverse" IS NULL THEN 's' ELSE 'b' END)=repeat('s',17)) THEN NULL::jsonb ELSE stock_operational.project_stock_adjustments(t) END old,
 stock_operational.column_project_stock_adjustments(t) candidate FROM stock_operational.stock_adjustments t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in stock_adjustments; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || CASE WHEN t."totalQuantity__lexeme" IS NOT NULL OR t."totalQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || CASE WHEN t."totalQuantity__lexeme" IS NOT NULL OR t."totalQuantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's')=repeat('s',8)) THEN NULL::jsonb ELSE stock_operational.project_movements(t) END old,
 stock_operational.column_project_movements(t) candidate FROM stock_operational.movements t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in movements; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."stockCounted__lexeme" IS NOT NULL OR t."stockCounted" IS NULL THEN 's' ELSE 'b' END || CASE WHEN t."isNewArrival__lexeme" IS NOT NULL OR t."isNewArrival" IS NULL THEN 's' ELSE 'b' END) OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || CASE WHEN t."quantity__lexeme" IS NOT NULL OR t."quantity" IS NULL THEN 's' ELSE 'n' END || 's' || 's' || 's' || 's' || 's' || 's' || 's' || 's' || CASE WHEN t."stockCounted__lexeme" IS NOT NULL OR t."stockCounted" IS NULL THEN 's' ELSE 'b' END || CASE WHEN t."isNewArrival__lexeme" IS NOT NULL OR t."isNewArrival" IS NULL THEN 's' ELSE 'b' END)=repeat('s',14)) THEN NULL::jsonb ELSE stock_operational.project_movement_details(t) END old,
 stock_operational.column_project_movement_details(t) candidate FROM stock_operational.movement_details t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[12,13]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in movement_details; inspect privately, never normalize blindly'; END IF; END $data$;
DO $data$ BEGIN IF (SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN t.cell_kinds=('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's') OR (t.cell_kinds IS NULL AND ('s' || 's' || 's' || 's' || 's' || 's' || 's' || 's')=repeat('s',8)) THEN NULL::jsonb ELSE stock_operational.project_user_state(t) END old,
 stock_operational.column_project_user_state(t) candidate FROM stock_operational.user_state t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY(ARRAY[7]::int[])) OR candidate->i IS DISTINCT FROM '""'::jsonb END))))) THEN RAISE EXCEPTION 'Unreviewed encoding representation in user_state; inspect privately, never normalize blindly'; END IF; END $data$;
DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES ('column_input_orders(jsonb)','
DECLARE r stock_operational.orders; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."status" := nullif((cells->>1),'''')::text;
r."seller" := nullif((cells->>2),'''')::text;
r."totalPrice" := nullif((cells->>3),'''')::numeric;
IF jsonb_typeof((cells->3))=''string'' AND (cells->>3)<>'''' THEN r."totalPrice__lexeme" := (cells->>3); END IF;
r."remark" := nullif((cells->>4),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>7);
r."createdBy" := nullif((cells->>8),'''')::text;

RETURN r; END '),('input_orders(jsonb)','BEGIN RETURN stock_operational.column_input_orders(cells); END;'),('project_orders(stock_operational.orders)',' SELECT stock_operational.column_project_orders(r); '),('column_compatible_orders(stock_operational.orders)','BEGIN RETURN stock_operational.column_project_orders(r); END;'),('validate_orders()','
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
IF NEW."totalPrice" IS DISTINCT FROM OLD."totalPrice" THEN
IF NEW."totalPrice__lexeme" IS NOT DISTINCT FROM OLD."totalPrice__lexeme" THEN NEW."totalPrice__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_orders(NEW);
RETURN NEW; END '),('column_input_order_items(jsonb)','
DECLARE r stock_operational.order_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."orderId" := nullif((cells->>1),'''')::text;
r."imageUrl" := nullif((cells->>2),'''')::text;
r."quoteQuantity" := nullif((cells->>3),'''')::numeric;
IF jsonb_typeof((cells->3))=''string'' AND (cells->>3)<>'''' THEN r."quoteQuantity__lexeme" := (cells->>3); END IF;
r."deliveredQuantity" := nullif((cells->>4),'''')::numeric;
IF jsonb_typeof((cells->4))=''string'' AND (cells->>4)<>'''' THEN r."deliveredQuantity__lexeme" := (cells->>4); END IF;
r."productCode" := nullif((cells->>5),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>8);
r."createdBy" := nullif((cells->>9),'''')::text;

RETURN r; END '),('input_order_items(jsonb)','BEGIN RETURN stock_operational.column_input_order_items(cells); END;'),('project_order_items(stock_operational.order_items)',' SELECT stock_operational.column_project_order_items(r); '),('column_compatible_order_items(stock_operational.order_items)','BEGIN RETURN stock_operational.column_project_order_items(r); END;'),('validate_order_items()','
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
IF NEW."quoteQuantity" IS DISTINCT FROM OLD."quoteQuantity" THEN
IF NEW."quoteQuantity__lexeme" IS NOT DISTINCT FROM OLD."quoteQuantity__lexeme" THEN NEW."quoteQuantity__lexeme" := NULL; END IF;
END IF;
IF NEW."deliveredQuantity" IS DISTINCT FROM OLD."deliveredQuantity" THEN
IF NEW."deliveredQuantity__lexeme" IS NOT DISTINCT FROM OLD."deliveredQuantity__lexeme" THEN NEW."deliveredQuantity__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_order_items(NEW);
RETURN NEW; END '),('column_input_order_bills(jsonb)','
DECLARE r stock_operational.order_bills; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."orderId" := nullif((cells->>1),'''')::text;
r."imageUrl" := nullif((cells->>2),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>5);
r."createdBy" := nullif((cells->>6),'''')::text;

RETURN r; END '),('input_order_bills(jsonb)','BEGIN RETURN stock_operational.column_input_order_bills(cells); END;'),('project_order_bills(stock_operational.order_bills)',' SELECT stock_operational.column_project_order_bills(r); '),('column_compatible_order_bills(stock_operational.order_bills)','BEGIN RETURN stock_operational.column_project_order_bills(r); END;'),('validate_order_bills()','
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
PERFORM stock_operational.project_order_bills(NEW);
RETURN NEW; END '),('column_input_shipments(jsonb)','
DECLARE r stock_operational.shipments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."status" := nullif((cells->>1),'''')::text;
r."carrier" := nullif((cells->>2),'''')::text;
r."poNumber" := nullif((cells->>3),'''')::text;
r."shippingFee" := nullif((cells->>4),'''')::numeric;
IF jsonb_typeof((cells->4))=''string'' AND (cells->>4)<>'''' THEN r."shippingFee__lexeme" := (cells->>4); END IF;
r."remark" := nullif((cells->>5),'''')::text;
r."shippedAt" := nullif((cells->>6),'''')::text;
r."deliveredAt" := nullif((cells->>7),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>8);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>9);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'''')::text;
r."shippingBillUrl" := nullif((cells->>12),'''')::text;

RETURN r; END '),('input_shipments(jsonb)','BEGIN RETURN stock_operational.column_input_shipments(cells); END;'),('project_shipments(stock_operational.shipments)',' SELECT stock_operational.column_project_shipments(r); '),('column_compatible_shipments(stock_operational.shipments)','BEGIN RETURN stock_operational.column_project_shipments(r); END;'),('validate_shipments()','
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
IF NEW."shippingFee" IS DISTINCT FROM OLD."shippingFee" THEN
IF NEW."shippingFee__lexeme" IS NOT DISTINCT FROM OLD."shippingFee__lexeme" THEN NEW."shippingFee__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_shipments(NEW);
RETURN NEW; END '),('column_input_shipment_orders(jsonb)','
DECLARE r stock_operational.shipment_orders; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."shipmentId" := nullif((cells->>1),'''')::text;
r."orderId" := nullif((cells->>2),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."deletedAt" := stock_operational.native_timestamp_input(cells->>5);
r."createdBy" := nullif((cells->>6),'''')::text;

RETURN r; END '),('input_shipment_orders(jsonb)','BEGIN RETURN stock_operational.column_input_shipment_orders(cells); END;'),('project_shipment_orders(stock_operational.shipment_orders)',' SELECT stock_operational.column_project_shipment_orders(r); '),('column_compatible_shipment_orders(stock_operational.shipment_orders)','BEGIN RETURN stock_operational.column_project_shipment_orders(r); END;'),('validate_shipment_orders()','
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
PERFORM stock_operational.project_shipment_orders(NEW);
RETURN NEW; END '),('column_input_employees(jsonb)','
DECLARE r stock_operational.employees; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."name" := nullif((cells->>1),'''')::text;
r."phone" := nullif((cells->>2),'''')::text;
r."status" := nullif((cells->>3),'''')::text;
r."hiredDate" := nullif((cells->>4),'''')::text;
r."terminatedDate" := nullif((cells->>5),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."createdBy" := nullif((cells->>8),'''')::text;

RETURN r; END '),('input_employees(jsonb)','BEGIN RETURN stock_operational.column_input_employees(cells); END;'),('project_employees(stock_operational.employees)',' SELECT stock_operational.column_project_employees(r); '),('column_compatible_employees(stock_operational.employees)','BEGIN RETURN stock_operational.column_project_employees(r); END;'),('validate_employees()','
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
PERFORM stock_operational.project_employees(NEW);
RETURN NEW; END '),('column_input_employee_compensations(jsonb)','
DECLARE r stock_operational.employee_compensations; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>12 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."employeeId" := nullif((cells->>0),'''')::text;
r."baseSalary" := nullif((cells->>1),'''')::numeric;
IF jsonb_typeof((cells->1))=''string'' AND (cells->>1)<>'''' THEN r."baseSalary__lexeme" := (cells->>1); END IF;
r."commission" := nullif((cells->>2),'''')::numeric;
IF jsonb_typeof((cells->2))=''string'' AND (cells->>2)<>'''' THEN r."commission__lexeme" := (cells->>2); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedBy" := nullif((cells->>5),'''')::text;
r."effectiveFrom" := nullif((cells->>6),'''')::text;
r."compensationType" := nullif((cells->>7),'''')::text;
r."commissionType" := nullif((cells->>8),'''')::text;
r."commissionBucketSales" := nullif((cells->>9),'''')::numeric;
IF jsonb_typeof((cells->9))=''string'' AND (cells->>9)<>'''' THEN r."commissionBucketSales__lexeme" := (cells->>9); END IF;
r."commissionBucketAmount" := nullif((cells->>10),'''')::numeric;
IF jsonb_typeof((cells->10))=''string'' AND (cells->>10)<>'''' THEN r."commissionBucketAmount__lexeme" := (cells->>10); END IF;
r."commissionRoundupThreshold" := nullif((cells->>11),'''')::numeric;
IF jsonb_typeof((cells->11))=''string'' AND (cells->>11)<>'''' THEN r."commissionRoundupThreshold__lexeme" := (cells->>11); END IF;

RETURN r; END '),('input_employee_compensations(jsonb)','BEGIN RETURN stock_operational.column_input_employee_compensations(cells); END;'),('project_employee_compensations(stock_operational.employee_compensations)',' SELECT stock_operational.column_project_employee_compensations(r); '),('column_compatible_employee_compensations(stock_operational.employee_compensations)','BEGIN RETURN stock_operational.column_project_employee_compensations(r); END;'),('validate_employee_compensations()','
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
IF NEW."baseSalary" IS DISTINCT FROM OLD."baseSalary" THEN
IF NEW."baseSalary__lexeme" IS NOT DISTINCT FROM OLD."baseSalary__lexeme" THEN NEW."baseSalary__lexeme" := NULL; END IF;
END IF;
IF NEW."commission" IS DISTINCT FROM OLD."commission" THEN
IF NEW."commission__lexeme" IS NOT DISTINCT FROM OLD."commission__lexeme" THEN NEW."commission__lexeme" := NULL; END IF;
END IF;
IF NEW."commissionBucketSales" IS DISTINCT FROM OLD."commissionBucketSales" THEN
IF NEW."commissionBucketSales__lexeme" IS NOT DISTINCT FROM OLD."commissionBucketSales__lexeme" THEN NEW."commissionBucketSales__lexeme" := NULL; END IF;
END IF;
IF NEW."commissionBucketAmount" IS DISTINCT FROM OLD."commissionBucketAmount" THEN
IF NEW."commissionBucketAmount__lexeme" IS NOT DISTINCT FROM OLD."commissionBucketAmount__lexeme" THEN NEW."commissionBucketAmount__lexeme" := NULL; END IF;
END IF;
IF NEW."commissionRoundupThreshold" IS DISTINCT FROM OLD."commissionRoundupThreshold" THEN
IF NEW."commissionRoundupThreshold__lexeme" IS NOT DISTINCT FROM OLD."commissionRoundupThreshold__lexeme" THEN NEW."commissionRoundupThreshold__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_employee_compensations(NEW);
RETURN NEW; END '),('column_input_employee_timesheets(jsonb)','
DECLARE r stock_operational.employee_timesheets; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."employeeId" := nullif((cells->>1),'''')::text;
r."shopId" := nullif((cells->>2),'''')::text;
r."status" := nullif((cells->>3),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>5);
r."workdayType" := nullif((cells->>6),'''')::text;

RETURN r; END '),('input_employee_timesheets(jsonb)','BEGIN RETURN stock_operational.column_input_employee_timesheets(cells); END;'),('project_employee_timesheets(stock_operational.employee_timesheets)',' SELECT stock_operational.column_project_employee_timesheets(r); '),('column_compatible_employee_timesheets(stock_operational.employee_timesheets)','BEGIN RETURN stock_operational.column_project_employee_timesheets(r); END;'),('validate_employee_timesheets()','
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
PERFORM stock_operational.project_employee_timesheets(NEW);
RETURN NEW; END '),('column_input_employee_advances(jsonb)','
DECLARE r stock_operational.employee_advances; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."employeeId" := nullif((cells->>1),'''')::text;
r."shopId" := nullif((cells->>2),'''')::text;
r."requestedDate" := nullif((cells->>3),'''')::text;
r."payrollMonth" := nullif((cells->>4),'''')::text;
r."requestedAmount" := nullif((cells->>5),'''')::numeric;
IF jsonb_typeof((cells->5))=''string'' AND (cells->>5)<>'''' THEN r."requestedAmount__lexeme" := (cells->>5); END IF;
r."paidAmount" := nullif((cells->>6),'''')::numeric;
IF jsonb_typeof((cells->6))=''string'' AND (cells->>6)<>'''' THEN r."paidAmount__lexeme" := (cells->>6); END IF;
r."status" := nullif((cells->>7),'''')::text;
r."paidDate" := nullif((cells->>8),'''')::text;
r."reference" := nullif((cells->>9),'''')::text;
r."note" := nullif((cells->>10),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>11);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>12);

RETURN r; END '),('input_employee_advances(jsonb)','BEGIN RETURN stock_operational.column_input_employee_advances(cells); END;'),('project_employee_advances(stock_operational.employee_advances)',' SELECT stock_operational.column_project_employee_advances(r); '),('column_compatible_employee_advances(stock_operational.employee_advances)','BEGIN RETURN stock_operational.column_project_employee_advances(r); END;'),('validate_employee_advances()','
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
IF NEW."requestedAmount" IS DISTINCT FROM OLD."requestedAmount" THEN
IF NEW."requestedAmount__lexeme" IS NOT DISTINCT FROM OLD."requestedAmount__lexeme" THEN NEW."requestedAmount__lexeme" := NULL; END IF;
END IF;
IF NEW."paidAmount" IS DISTINCT FROM OLD."paidAmount" THEN
IF NEW."paidAmount__lexeme" IS NOT DISTINCT FROM OLD."paidAmount__lexeme" THEN NEW."paidAmount__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_employee_advances(NEW);
RETURN NEW; END '),('column_input_payroll_settlements(jsonb)','
DECLARE r stock_operational.payroll_settlements; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."employeeId" := nullif((cells->>1),'''')::text;
r."month" := nullif((cells->>2),'''')::text;
r."paidDate" := nullif((cells->>3),'''')::text;
r."reference" := nullif((cells->>4),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."snapshot" := nullif(nullif((cells->>6),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->6))=''string'' AND (cells->>6)<>'''' THEN r."snapshot__lexeme" := (cells->>6); END IF;

RETURN r; END '),('input_payroll_settlements(jsonb)','BEGIN RETURN stock_operational.column_input_payroll_settlements(cells); END;'),('project_payroll_settlements(stock_operational.payroll_settlements)',' SELECT stock_operational.column_project_payroll_settlements(r); '),('column_compatible_payroll_settlements(stock_operational.payroll_settlements)','BEGIN RETURN stock_operational.column_project_payroll_settlements(r); END;'),('validate_payroll_settlements()','
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
IF NEW."snapshot" IS DISTINCT FROM OLD."snapshot" THEN
IF NEW."snapshot__lexeme" IS NOT DISTINCT FROM OLD."snapshot__lexeme" THEN NEW."snapshot__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_payroll_settlements(NEW);
RETURN NEW; END '),('column_input_expenses(jsonb)','
DECLARE r stock_operational.expenses; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."month" := nullif((cells->>1),'''')::text;
r."expenseDate" := nullif((cells->>2),'''')::text;
r."shopId" := nullif((cells->>3),'''')::text;
r."scope" := nullif((cells->>4),'''')::text;
r."categoryId" := nullif((cells->>5),'''')::text;
r."name" := nullif((cells->>6),'''')::text;
r."amount" := nullif((cells->>7),'''')::numeric;
IF jsonb_typeof((cells->7))=''string'' AND (cells->>7)<>'''' THEN r."amount__lexeme" := (cells->>7); END IF;
r."note" := nullif((cells->>8),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>9);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>10);
r."createdBy" := nullif((cells->>11),'''')::text;
r."deletedAt" := stock_operational.native_timestamp_input(cells->>12);

RETURN r; END '),('input_expenses(jsonb)','BEGIN RETURN stock_operational.column_input_expenses(cells); END;'),('project_expenses(stock_operational.expenses)',' SELECT stock_operational.column_project_expenses(r); '),('column_compatible_expenses(stock_operational.expenses)','BEGIN RETURN stock_operational.column_project_expenses(r); END;'),('validate_expenses()','
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
IF NEW."amount" IS DISTINCT FROM OLD."amount" THEN
IF NEW."amount__lexeme" IS NOT DISTINCT FROM OLD."amount__lexeme" THEN NEW."amount__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_expenses(NEW);
RETURN NEW; END '),('column_input_expense_categories(jsonb)','
DECLARE r stock_operational.expense_categories; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>5 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."name" := nullif((cells->>1),'''')::text;
r."active" := nullif((cells->>2),'''')::boolean;
IF jsonb_typeof((cells->2))=''string'' AND (cells->>2)<>'''' THEN r."active__lexeme" := (cells->>2); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>3);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>4);
IF jsonb_typeof(cells->2)=''number'' THEN r."active__lexeme" := cells->>2; END IF;
RETURN r; END '),('input_expense_categories(jsonb)','BEGIN RETURN stock_operational.column_input_expense_categories(cells); END;'),('project_expense_categories(stock_operational.expense_categories)',' SELECT stock_operational.column_project_expense_categories(r); '),('column_compatible_expense_categories(stock_operational.expense_categories)','BEGIN RETURN stock_operational.column_project_expense_categories(r); END;'),('validate_expense_categories()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
IF NEW."active" IS DISTINCT FROM OLD."active" THEN
IF NEW."active__lexeme" IS NOT DISTINCT FROM OLD."active__lexeme" THEN NEW."active__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_expense_categories(NEW);
RETURN NEW; END '),('column_input_shops(jsonb)','
DECLARE r stock_operational.shops; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>6 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."name" := nullif((cells->>1),'''')::text;
r."active" := nullif((cells->>2),'''')::boolean;
IF jsonb_typeof((cells->2))=''string'' AND (cells->>2)<>'''' THEN r."active__lexeme" := (cells->>2); END IF;
r."loyverseAccountId" := nullif((cells->>3),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>4);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>5);
IF jsonb_typeof(cells->2)=''number'' THEN r."active__lexeme" := cells->>2; END IF;
RETURN r; END '),('input_shops(jsonb)','BEGIN RETURN stock_operational.column_input_shops(cells); END;'),('project_shops(stock_operational.shops)',' SELECT stock_operational.column_project_shops(r); '),('column_compatible_shops(stock_operational.shops)','BEGIN RETURN stock_operational.column_project_shops(r); END;'),('validate_shops()','
BEGIN
NEW."id" := nullif(NEW."id",'''');
NEW."name" := nullif(NEW."name",'''');
NEW."loyverseAccountId" := nullif(NEW."loyverseAccountId",'''');
PERFORM stock_operational.native_timestamp_text(NEW."createdAt");
PERFORM stock_operational.native_timestamp_text(NEW."updatedAt");
IF TG_OP=''UPDATE'' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION ''Immutable identity, order or archived record''; END IF;
NEW.revision := OLD.revision+1;
IF NEW."active" IS DISTINCT FROM OLD."active" THEN
IF NEW."active__lexeme" IS NOT DISTINCT FROM OLD."active__lexeme" THEN NEW."active__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_shops(NEW);
RETURN NEW; END '),('column_input_sales_receipts(jsonb)','
DECLARE r stock_operational.sales_receipts; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>26 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."salesDate" := nullif((cells->>1),'''')::text;
r."accountId" := nullif((cells->>2),'''')::text;
r."shopName" := nullif((cells->>3),'''')::text;
r."receiptNumber" := nullif((cells->>4),'''')::text;
r."receiptType" := nullif((cells->>5),'''')::text;
r."refundFor" := nullif((cells->>6),'''')::text;
r."order" := nullif((cells->>7),'''')::text;
r."receiptDate" := nullif((cells->>8),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>9);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>10);
r."cancelledAt" := nullif((cells->>11),'''')::text;
r."source" := nullif((cells->>12),'''')::text;
r."storeId" := nullif((cells->>13),'''')::text;
r."employeeId" := nullif((cells->>14),'''')::text;
r."customerId" := nullif((cells->>15),'''')::text;
r."posDeviceId" := nullif((cells->>16),'''')::text;
r."diningOption" := nullif((cells->>17),'''')::text;
r."totalMoney" := nullif((cells->>18),'''')::numeric;
IF jsonb_typeof((cells->18))=''string'' AND (cells->>18)<>'''' THEN r."totalMoney__lexeme" := (cells->>18); END IF;
r."totalTax" := nullif((cells->>19),'''')::numeric;
IF jsonb_typeof((cells->19))=''string'' AND (cells->>19)<>'''' THEN r."totalTax__lexeme" := (cells->>19); END IF;
r."totalDiscount" := nullif((cells->>20),'''')::numeric;
IF jsonb_typeof((cells->20))=''string'' AND (cells->>20)<>'''' THEN r."totalDiscount__lexeme" := (cells->>20); END IF;
r."tip" := nullif((cells->>21),'''')::numeric;
IF jsonb_typeof((cells->21))=''string'' AND (cells->>21)<>'''' THEN r."tip__lexeme" := (cells->>21); END IF;
r."surcharge" := nullif((cells->>22),'''')::numeric;
IF jsonb_typeof((cells->22))=''string'' AND (cells->>22)<>'''' THEN r."surcharge__lexeme" := (cells->>22); END IF;
r."pointsEarned" := nullif((cells->>23),'''')::numeric;
IF jsonb_typeof((cells->23))=''string'' AND (cells->>23)<>'''' THEN r."pointsEarned__lexeme" := (cells->>23); END IF;
r."pointsDeducted" := nullif((cells->>24),'''')::numeric;
IF jsonb_typeof((cells->24))=''string'' AND (cells->>24)<>'''' THEN r."pointsDeducted__lexeme" := (cells->>24); END IF;
r."syncedAt" := nullif((cells->>25),'''')::text;

RETURN r; END '),('input_sales_receipts(jsonb)','BEGIN RETURN stock_operational.column_input_sales_receipts(cells); END;'),('project_sales_receipts(stock_operational.sales_receipts)',' SELECT stock_operational.column_project_sales_receipts(r); '),('column_compatible_sales_receipts(stock_operational.sales_receipts)','BEGIN RETURN stock_operational.column_project_sales_receipts(r); END;'),('validate_sales_receipts()','
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
IF NEW."totalMoney" IS DISTINCT FROM OLD."totalMoney" THEN
IF NEW."totalMoney__lexeme" IS NOT DISTINCT FROM OLD."totalMoney__lexeme" THEN NEW."totalMoney__lexeme" := NULL; END IF;
END IF;
IF NEW."totalTax" IS DISTINCT FROM OLD."totalTax" THEN
IF NEW."totalTax__lexeme" IS NOT DISTINCT FROM OLD."totalTax__lexeme" THEN NEW."totalTax__lexeme" := NULL; END IF;
END IF;
IF NEW."totalDiscount" IS DISTINCT FROM OLD."totalDiscount" THEN
IF NEW."totalDiscount__lexeme" IS NOT DISTINCT FROM OLD."totalDiscount__lexeme" THEN NEW."totalDiscount__lexeme" := NULL; END IF;
END IF;
IF NEW."tip" IS DISTINCT FROM OLD."tip" THEN
IF NEW."tip__lexeme" IS NOT DISTINCT FROM OLD."tip__lexeme" THEN NEW."tip__lexeme" := NULL; END IF;
END IF;
IF NEW."surcharge" IS DISTINCT FROM OLD."surcharge" THEN
IF NEW."surcharge__lexeme" IS NOT DISTINCT FROM OLD."surcharge__lexeme" THEN NEW."surcharge__lexeme" := NULL; END IF;
END IF;
IF NEW."pointsEarned" IS DISTINCT FROM OLD."pointsEarned" THEN
IF NEW."pointsEarned__lexeme" IS NOT DISTINCT FROM OLD."pointsEarned__lexeme" THEN NEW."pointsEarned__lexeme" := NULL; END IF;
END IF;
IF NEW."pointsDeducted" IS DISTINCT FROM OLD."pointsDeducted" THEN
IF NEW."pointsDeducted__lexeme" IS NOT DISTINCT FROM OLD."pointsDeducted__lexeme" THEN NEW."pointsDeducted__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_sales_receipts(NEW);
RETURN NEW; END '),('column_input_sales_receipt_items(jsonb)','
DECLARE r stock_operational.sales_receipt_items; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>21 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."receiptId" := nullif((cells->>1),'''')::text;
r."lineItemId" := nullif((cells->>2),'''')::text;
r."itemId" := nullif((cells->>3),'''')::text;
r."variantId" := nullif((cells->>4),'''')::text;
r."itemName" := nullif((cells->>5),'''')::text;
r."variantName" := nullif((cells->>6),'''')::text;
r."sku" := nullif((cells->>7),'''')::text;
r."quantity" := nullif((cells->>8),'''')::numeric;
IF jsonb_typeof((cells->8))=''string'' AND (cells->>8)<>'''' THEN r."quantity__lexeme" := (cells->>8); END IF;
r."price" := nullif((cells->>9),'''')::numeric;
IF jsonb_typeof((cells->9))=''string'' AND (cells->>9)<>'''' THEN r."price__lexeme" := (cells->>9); END IF;
r."grossTotalMoney" := nullif((cells->>10),'''')::numeric;
IF jsonb_typeof((cells->10))=''string'' AND (cells->>10)<>'''' THEN r."grossTotalMoney__lexeme" := (cells->>10); END IF;
r."totalDiscount" := nullif((cells->>11),'''')::numeric;
IF jsonb_typeof((cells->11))=''string'' AND (cells->>11)<>'''' THEN r."totalDiscount__lexeme" := (cells->>11); END IF;
r."totalMoney" := nullif((cells->>12),'''')::numeric;
IF jsonb_typeof((cells->12))=''string'' AND (cells->>12)<>'''' THEN r."totalMoney__lexeme" := (cells->>12); END IF;
r."cost" := nullif((cells->>13),'''')::numeric;
IF jsonb_typeof((cells->13))=''string'' AND (cells->>13)<>'''' THEN r."cost__lexeme" := (cells->>13); END IF;
r."costTotal" := nullif((cells->>14),'''')::numeric;
IF jsonb_typeof((cells->14))=''string'' AND (cells->>14)<>'''' THEN r."costTotal__lexeme" := (cells->>14); END IF;
r."taxes" := nullif((cells->>15),'''')::numeric;
IF jsonb_typeof((cells->15))=''string'' AND (cells->>15)<>'''' THEN r."taxes__lexeme" := (cells->>15); END IF;
r."lineNote" := nullif((cells->>16),'''')::text;
r."lineDiscountsJson" := nullif(nullif((cells->>17),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->17))=''string'' AND (cells->>17)<>'''' THEN r."lineDiscountsJson__lexeme" := (cells->>17); END IF;
r."lineTaxesJson" := nullif(nullif((cells->>18),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->18))=''string'' AND (cells->>18)<>'''' THEN r."lineTaxesJson__lexeme" := (cells->>18); END IF;
r."lineModifiersJson" := nullif(nullif((cells->>19),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->19))=''string'' AND (cells->>19)<>'''' THEN r."lineModifiersJson__lexeme" := (cells->>19); END IF;
r."syncedAt" := nullif((cells->>20),'''')::text;

RETURN r; END '),('input_sales_receipt_items(jsonb)','BEGIN RETURN stock_operational.column_input_sales_receipt_items(cells); END;'),('project_sales_receipt_items(stock_operational.sales_receipt_items)',' SELECT stock_operational.column_project_sales_receipt_items(r); '),('column_compatible_sales_receipt_items(stock_operational.sales_receipt_items)','BEGIN RETURN stock_operational.column_project_sales_receipt_items(r); END;'),('validate_sales_receipt_items()','
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
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
END IF;
IF NEW."price" IS DISTINCT FROM OLD."price" THEN
IF NEW."price__lexeme" IS NOT DISTINCT FROM OLD."price__lexeme" THEN NEW."price__lexeme" := NULL; END IF;
END IF;
IF NEW."grossTotalMoney" IS DISTINCT FROM OLD."grossTotalMoney" THEN
IF NEW."grossTotalMoney__lexeme" IS NOT DISTINCT FROM OLD."grossTotalMoney__lexeme" THEN NEW."grossTotalMoney__lexeme" := NULL; END IF;
END IF;
IF NEW."totalDiscount" IS DISTINCT FROM OLD."totalDiscount" THEN
IF NEW."totalDiscount__lexeme" IS NOT DISTINCT FROM OLD."totalDiscount__lexeme" THEN NEW."totalDiscount__lexeme" := NULL; END IF;
END IF;
IF NEW."totalMoney" IS DISTINCT FROM OLD."totalMoney" THEN
IF NEW."totalMoney__lexeme" IS NOT DISTINCT FROM OLD."totalMoney__lexeme" THEN NEW."totalMoney__lexeme" := NULL; END IF;
END IF;
IF NEW."cost" IS DISTINCT FROM OLD."cost" THEN
IF NEW."cost__lexeme" IS NOT DISTINCT FROM OLD."cost__lexeme" THEN NEW."cost__lexeme" := NULL; END IF;
END IF;
IF NEW."costTotal" IS DISTINCT FROM OLD."costTotal" THEN
IF NEW."costTotal__lexeme" IS NOT DISTINCT FROM OLD."costTotal__lexeme" THEN NEW."costTotal__lexeme" := NULL; END IF;
END IF;
IF NEW."taxes" IS DISTINCT FROM OLD."taxes" THEN
IF NEW."taxes__lexeme" IS NOT DISTINCT FROM OLD."taxes__lexeme" THEN NEW."taxes__lexeme" := NULL; END IF;
END IF;
IF NEW."lineDiscountsJson" IS DISTINCT FROM OLD."lineDiscountsJson" THEN
IF NEW."lineDiscountsJson__lexeme" IS NOT DISTINCT FROM OLD."lineDiscountsJson__lexeme" THEN NEW."lineDiscountsJson__lexeme" := NULL; END IF;
END IF;
IF NEW."lineTaxesJson" IS DISTINCT FROM OLD."lineTaxesJson" THEN
IF NEW."lineTaxesJson__lexeme" IS NOT DISTINCT FROM OLD."lineTaxesJson__lexeme" THEN NEW."lineTaxesJson__lexeme" := NULL; END IF;
END IF;
IF NEW."lineModifiersJson" IS DISTINCT FROM OLD."lineModifiersJson" THEN
IF NEW."lineModifiersJson__lexeme" IS NOT DISTINCT FROM OLD."lineModifiersJson__lexeme" THEN NEW."lineModifiersJson__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_items(NEW);
RETURN NEW; END '),('column_input_sales_receipt_payments(jsonb)','
DECLARE r stock_operational.sales_receipt_payments; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."receiptId" := nullif((cells->>1),'''')::text;
r."paymentIndex" := nullif((cells->>2),'''')::bigint;
IF jsonb_typeof((cells->2))=''string'' AND (cells->>2)<>'''' THEN r."paymentIndex__lexeme" := (cells->>2); END IF;
r."paymentTypeId" := nullif((cells->>3),'''')::text;
r."paymentName" := nullif((cells->>4),'''')::text;
r."paymentType" := nullif((cells->>5),'''')::text;
r."moneyAmount" := nullif((cells->>6),'''')::numeric;
IF jsonb_typeof((cells->6))=''string'' AND (cells->>6)<>'''' THEN r."moneyAmount__lexeme" := (cells->>6); END IF;
r."paidAt" := nullif((cells->>7),'''')::text;
r."paymentDetailsJson" := nullif(nullif((cells->>8),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->8))=''string'' AND (cells->>8)<>'''' THEN r."paymentDetailsJson__lexeme" := (cells->>8); END IF;
r."syncedAt" := nullif((cells->>9),'''')::text;

RETURN r; END '),('input_sales_receipt_payments(jsonb)','BEGIN RETURN stock_operational.column_input_sales_receipt_payments(cells); END;'),('project_sales_receipt_payments(stock_operational.sales_receipt_payments)',' SELECT stock_operational.column_project_sales_receipt_payments(r); '),('column_compatible_sales_receipt_payments(stock_operational.sales_receipt_payments)','BEGIN RETURN stock_operational.column_project_sales_receipt_payments(r); END;'),('validate_sales_receipt_payments()','
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
IF NEW."paymentIndex" IS DISTINCT FROM OLD."paymentIndex" THEN
IF NEW."paymentIndex__lexeme" IS NOT DISTINCT FROM OLD."paymentIndex__lexeme" THEN NEW."paymentIndex__lexeme" := NULL; END IF;
END IF;
IF NEW."moneyAmount" IS DISTINCT FROM OLD."moneyAmount" THEN
IF NEW."moneyAmount__lexeme" IS NOT DISTINCT FROM OLD."moneyAmount__lexeme" THEN NEW."moneyAmount__lexeme" := NULL; END IF;
END IF;
IF NEW."paymentDetailsJson" IS DISTINCT FROM OLD."paymentDetailsJson" THEN
IF NEW."paymentDetailsJson__lexeme" IS NOT DISTINCT FROM OLD."paymentDetailsJson__lexeme" THEN NEW."paymentDetailsJson__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_payments(NEW);
RETURN NEW; END '),('column_input_sales_receipt_syncs(jsonb)','
DECLARE r stock_operational.sales_receipt_syncs; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."salesDate" := nullif((cells->>1),'''')::text;
r."accountId" := nullif((cells->>2),'''')::text;
r."shopName" := nullif((cells->>3),'''')::text;
r."status" := nullif((cells->>4),'''')::text;
r."receiptCount" := nullif((cells->>5),'''')::bigint;
IF jsonb_typeof((cells->5))=''string'' AND (cells->>5)<>'''' THEN r."receiptCount__lexeme" := (cells->>5); END IF;
r."itemCount" := nullif((cells->>6),'''')::bigint;
IF jsonb_typeof((cells->6))=''string'' AND (cells->>6)<>'''' THEN r."itemCount__lexeme" := (cells->>6); END IF;
r."paymentCount" := nullif((cells->>7),'''')::bigint;
IF jsonb_typeof((cells->7))=''string'' AND (cells->>7)<>'''' THEN r."paymentCount__lexeme" := (cells->>7); END IF;
r."syncedAt" := nullif((cells->>8),'''')::text;

RETURN r; END '),('input_sales_receipt_syncs(jsonb)','BEGIN RETURN stock_operational.column_input_sales_receipt_syncs(cells); END;'),('project_sales_receipt_syncs(stock_operational.sales_receipt_syncs)',' SELECT stock_operational.column_project_sales_receipt_syncs(r); '),('column_compatible_sales_receipt_syncs(stock_operational.sales_receipt_syncs)','BEGIN RETURN stock_operational.column_project_sales_receipt_syncs(r); END;'),('validate_sales_receipt_syncs()','
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
IF NEW."receiptCount" IS DISTINCT FROM OLD."receiptCount" THEN
IF NEW."receiptCount__lexeme" IS NOT DISTINCT FROM OLD."receiptCount__lexeme" THEN NEW."receiptCount__lexeme" := NULL; END IF;
END IF;
IF NEW."itemCount" IS DISTINCT FROM OLD."itemCount" THEN
IF NEW."itemCount__lexeme" IS NOT DISTINCT FROM OLD."itemCount__lexeme" THEN NEW."itemCount__lexeme" := NULL; END IF;
END IF;
IF NEW."paymentCount" IS DISTINCT FROM OLD."paymentCount" THEN
IF NEW."paymentCount__lexeme" IS NOT DISTINCT FROM OLD."paymentCount__lexeme" THEN NEW."paymentCount__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_sales_receipt_syncs(NEW);
RETURN NEW; END '),('column_input_sales_profit_cost_overrides(jsonb)','
DECLARE r stock_operational.sales_profit_cost_overrides; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."month" := nullif((cells->>1),'''')::text;
r."accountId" := nullif((cells->>2),'''')::text;
r."averageItemCost" := nullif((cells->>3),'''')::numeric;
IF jsonb_typeof((cells->3))=''string'' AND (cells->>3)<>'''' THEN r."averageItemCost__lexeme" := (cells->>3); END IF;
r."note" := nullif((cells->>4),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."createdBy" := nullif((cells->>7),'''')::text;

RETURN r; END '),('input_sales_profit_cost_overrides(jsonb)','BEGIN RETURN stock_operational.column_input_sales_profit_cost_overrides(cells); END;'),('project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)',' SELECT stock_operational.column_project_sales_profit_cost_overrides(r); '),('column_compatible_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides)','BEGIN RETURN stock_operational.column_project_sales_profit_cost_overrides(r); END;'),('validate_sales_profit_cost_overrides()','
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
IF NEW."averageItemCost" IS DISTINCT FROM OLD."averageItemCost" THEN
IF NEW."averageItemCost__lexeme" IS NOT DISTINCT FROM OLD."averageItemCost__lexeme" THEN NEW."averageItemCost__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_sales_profit_cost_overrides(NEW);
RETURN NEW; END '),('column_input_stock_counts(jsonb)','
DECLARE r stock_operational.stock_counts; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."month" := nullif((cells->>1),'''')::text;
r."accountId" := nullif((cells->>2),'''')::text;
r."shopName" := nullif((cells->>3),'''')::text;
r."physicalCount" := nullif((cells->>4),'''')::numeric;
IF jsonb_typeof((cells->4))=''string'' AND (cells->>4)<>'''' THEN r."physicalCount__lexeme" := (cells->>4); END IF;
r."note" := nullif((cells->>5),'''')::text;
r."countedAt" := nullif((cells->>6),'''')::text;
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);
r."updatedBy" := nullif((cells->>8),'''')::text;

RETURN r; END '),('input_stock_counts(jsonb)','BEGIN RETURN stock_operational.column_input_stock_counts(cells); END;'),('project_stock_counts(stock_operational.stock_counts)',' SELECT stock_operational.column_project_stock_counts(r); '),('column_compatible_stock_counts(stock_operational.stock_counts)','BEGIN RETURN stock_operational.column_project_stock_counts(r); END;'),('validate_stock_counts()','
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
IF NEW."physicalCount" IS DISTINCT FROM OLD."physicalCount" THEN
IF NEW."physicalCount__lexeme" IS NOT DISTINCT FROM OLD."physicalCount__lexeme" THEN NEW."physicalCount__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_stock_counts(NEW);
RETURN NEW; END '),('column_input_stock_adjustments(jsonb)','
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
IF jsonb_typeof((cells->8))=''string'' AND (cells->>8)<>'''' THEN r."quantity__lexeme" := (cells->>8); END IF;
r."itemDescription" := nullif((cells->>9),'''')::text;
r."photoUrl" := nullif((cells->>10),'''')::text;
r."note" := nullif((cells->>11),'''')::text;
r."reversesId" := nullif((cells->>12),'''')::text;
r."replacesId" := nullif((cells->>13),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>14);
r."createdBy" := nullif((cells->>15),'''')::text;
r."notInLoyverse" := nullif((cells->>16),'''')::boolean;
IF jsonb_typeof((cells->16))=''string'' AND (cells->>16)<>'''' THEN r."notInLoyverse__lexeme" := (cells->>16); END IF;
IF jsonb_typeof(cells->16)=''number'' THEN r."notInLoyverse__lexeme" := cells->>16; END IF;
RETURN r; END '),('input_stock_adjustments(jsonb)','BEGIN RETURN stock_operational.column_input_stock_adjustments(cells); END;'),('project_stock_adjustments(stock_operational.stock_adjustments)',' SELECT stock_operational.column_project_stock_adjustments(r); '),('column_compatible_stock_adjustments(stock_operational.stock_adjustments)','BEGIN RETURN stock_operational.column_project_stock_adjustments(r); END;'),('validate_stock_adjustments()','
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
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
END IF;
IF NEW."notInLoyverse" IS DISTINCT FROM OLD."notInLoyverse" THEN
IF NEW."notInLoyverse__lexeme" IS NOT DISTINCT FROM OLD."notInLoyverse__lexeme" THEN NEW."notInLoyverse__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_stock_adjustments(NEW);
RETURN NEW; END '),('column_input_movements(jsonb)','
DECLARE r stock_operational.movements; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."userId" := nullif((cells->>1),'''')::text;
r."packingDate" := nullif((cells->>2),'''')::text;
r."deliverDateTime" := nullif((cells->>3),'''')::text;
r."status" := nullif((cells->>4),'''')::text;
r."totalQuantity" := nullif((cells->>5),'''')::numeric;
IF jsonb_typeof((cells->5))=''string'' AND (cells->>5)<>'''' THEN r."totalQuantity__lexeme" := (cells->>5); END IF;
r."createdAt" := stock_operational.native_timestamp_input(cells->>6);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>7);

RETURN r; END '),('input_movements(jsonb)','BEGIN RETURN stock_operational.column_input_movements(cells); END;'),('project_movements(stock_operational.movements)',' SELECT stock_operational.column_project_movements(r); '),('column_compatible_movements(stock_operational.movements)','BEGIN RETURN stock_operational.column_project_movements(r); END;'),('validate_movements()','
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
IF NEW."totalQuantity" IS DISTINCT FROM OLD."totalQuantity" THEN
IF NEW."totalQuantity__lexeme" IS NOT DISTINCT FROM OLD."totalQuantity__lexeme" THEN NEW."totalQuantity__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_movements(NEW);
RETURN NEW; END '),('column_input_movement_details(jsonb)','
DECLARE r stock_operational.movement_details; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>14 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."movementMasterId" := nullif((cells->>1),'''')::text;
r."shopName" := nullif((cells->>2),'''')::text;
r."quantity" := nullif((cells->>3),'''')::numeric;
IF jsonb_typeof((cells->3))=''string'' AND (cells->>3)<>'''' THEN r."quantity__lexeme" := (cells->>3); END IF;
r."remark" := nullif((cells->>4),'''')::text;
r."fromLocation" := nullif((cells->>5),'''')::text;
r."toLocation" := nullif((cells->>6),'''')::text;
r."productImageUrl" := nullif((cells->>7),'''')::text;
r."purchaseDetailId" := nullif((cells->>8),'''')::text;
r."status" := nullif((cells->>9),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>10);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>11);
r."stockCounted" := nullif((cells->>12),'''')::boolean;
IF jsonb_typeof((cells->12))=''string'' AND (cells->>12)<>'''' THEN r."stockCounted__lexeme" := (cells->>12); END IF;
r."isNewArrival" := nullif((cells->>13),'''')::boolean;
IF jsonb_typeof((cells->13))=''string'' AND (cells->>13)<>'''' THEN r."isNewArrival__lexeme" := (cells->>13); END IF;
IF jsonb_typeof(cells->12)=''number'' THEN r."stockCounted__lexeme" := cells->>12; END IF;
IF jsonb_typeof(cells->13)=''number'' THEN r."isNewArrival__lexeme" := cells->>13; END IF;
RETURN r; END '),('input_movement_details(jsonb)','BEGIN RETURN stock_operational.column_input_movement_details(cells); END;'),('project_movement_details(stock_operational.movement_details)',' SELECT stock_operational.column_project_movement_details(r); '),('column_compatible_movement_details(stock_operational.movement_details)','BEGIN RETURN stock_operational.column_project_movement_details(r); END;'),('validate_movement_details()','
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
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
END IF;
IF NEW."stockCounted" IS DISTINCT FROM OLD."stockCounted" THEN
IF NEW."stockCounted__lexeme" IS NOT DISTINCT FROM OLD."stockCounted__lexeme" THEN NEW."stockCounted__lexeme" := NULL; END IF;
END IF;
IF NEW."isNewArrival" IS DISTINCT FROM OLD."isNewArrival" THEN
IF NEW."isNewArrival__lexeme" IS NOT DISTINCT FROM OLD."isNewArrival__lexeme" THEN NEW."isNewArrival__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_movement_details(NEW);
RETURN NEW; END '),('column_input_user_state(jsonb)','
DECLARE r stock_operational.user_state; BEGIN
IF jsonb_typeof(cells) IS DISTINCT FROM ''array'' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION ''Invalid row width''; END IF;
IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN (''string'',''number'',''boolean'',''null'')) THEN RAISE EXCEPTION ''Invalid cell scalar''; END IF;
r."id" := nullif((cells->>0),'''')::text;
r."userId" := nullif((cells->>1),'''')::text;
r."flowname" := nullif((cells->>2),'''')::text;
r."referenceId" := nullif((cells->>3),'''')::text;
r."state" := nullif((cells->>4),'''')::text;
r."createdAt" := stock_operational.native_timestamp_input(cells->>5);
r."updatedAt" := stock_operational.native_timestamp_input(cells->>6);
r."context" := nullif(nullif((cells->>7),'''')::jsonb,''null''::jsonb);
IF jsonb_typeof((cells->7))=''string'' AND (cells->>7)<>'''' THEN r."context__lexeme" := (cells->>7); END IF;
IF jsonb_typeof(cells->0) NOT IN (''string'',''null'') THEN RAISE EXCEPTION ''LINE state identifiers require text''; END IF;
IF jsonb_typeof(cells->1) NOT IN (''string'',''null'') THEN RAISE EXCEPTION ''LINE state identifiers require text''; END IF;
IF jsonb_typeof(cells->2) NOT IN (''string'',''null'') THEN RAISE EXCEPTION ''LINE state identifiers require text''; END IF;
IF jsonb_typeof(cells->3) NOT IN (''string'',''null'') THEN RAISE EXCEPTION ''LINE state identifiers require text''; END IF;
IF jsonb_typeof(cells->4) NOT IN (''string'',''null'') THEN RAISE EXCEPTION ''LINE state identifiers require text''; END IF;
RETURN r; END '),('input_user_state(jsonb)','BEGIN RETURN stock_operational.column_input_user_state(cells); END;'),('project_user_state(stock_operational.user_state)',' SELECT stock_operational.column_project_user_state(r); '),('column_compatible_user_state(stock_operational.user_state)','BEGIN RETURN stock_operational.column_project_user_state(r); END;'),('validate_user_state()','
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
IF NEW."context" IS DISTINCT FROM OLD."context" THEN
IF NEW."context__lexeme" IS NOT DISTINCT FROM OLD."context__lexeme" THEN NEW."context__lexeme" := NULL; END IF;
END IF;
END IF;
PERFORM stock_operational.project_user_state(NEW);
RETURN NEW; END ')) e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
-- Refuse unknown procedural consumers too, beyond PostgreSQL's RESTRICT graph.
SELECT 1 / (NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('stock_operational.cell_projection(jsonb,text,text,text)'::regprocedure,'stock_operational.column_mapping_contract_v1()'::regprocedure)
 AND (p.prosrc LIKE '%cell_kinds%' OR p.prosrc LIKE '%cell_projection%')))::int;
ALTER TABLE stock_operational.orders DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.order_items DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.order_bills DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.shipments DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.shipment_orders DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.employees DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.employee_compensations DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.employee_timesheets DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.employee_advances DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.payroll_settlements DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.expenses DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.expense_categories DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.shops DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.sales_receipts DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.sales_receipt_items DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.sales_receipt_payments DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.sales_receipt_syncs DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.sales_profit_cost_overrides DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.stock_counts DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.stock_adjustments DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.movements DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.movement_details DROP COLUMN cell_kinds RESTRICT;
ALTER TABLE stock_operational.user_state DROP COLUMN cell_kinds RESTRICT;
DROP FUNCTION stock_operational.cell_projection(jsonb,text,text,text) RESTRICT;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='final')::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped))::int;
COMMIT;
