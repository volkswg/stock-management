# Sourced after the pinned predecessor has independently proved the final schema.
# Older table-layout campaigns keep their original source and assertions.
receipt_history=$(mktemp -d "$PWD/pr98-payment-source.XXXXXX")
python3 "$STOCK_NATIVE_ROOT/tools/native-postgres/receipt-payment-history-copy.py" "$receipt_history"
install_receipt_jsonb(){
 local database=$1
 {
  printf "SELECT set_config('stock.allow_receipt_payment_rebuild','reviewed-receipt-payments-jsonb-v1',false);\n"
  printf "SELECT set_config('stock.payment_restore_verified','business-and-config-v1',false);\n"
  printf "SELECT set_config('stock.payment_source',repeat('1',40),false);\n"
  printf "SELECT set_config('stock.expected_isolation_id',isolation_id::text,false),set_config('stock.expected_purpose',purpose,false) FROM stock_operational.environment;\n"
  printf "SELECT set_config('stock.payment_revision',value::text,false) FROM stock_operational.revision;\n"
  printf "SELECT set_config('stock.payment_fingerprint', ("
  sed '$s/;[[:space:]]*$//' "$STOCK_NATIVE_ROOT/tools/migration/single-receipt-payment-fingerprint.sql"
  printf "),false);\n"
  cat "$STOCK_NATIVE_ROOT/tools/migration/operator/20261121063257_receipt_payments_jsonb.sql"
 } | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/native-jsonb-$database.log"
}
for database in np_application np_records np_media np_browser; do
  pg createdb -U postgres -T sd_base "$database"
  sd_sql "$database" retirement | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/native-install-$database.log"
  # Prove the actual application does not depend on array input/project helpers.
  pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/native-revoke-$database.log" <<'SQL'
DO $$DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='stock_operational'::regnamespace AND (proname LIKE 'typed_input_%' OR proname LIKE 'typed_project_%') LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM stock_runtime',f.sig); END LOOP; END$$;
SQL
done
native_run(){
 local database=$1; shift
 local target; target=$(identity "$database")
 (cd "${STOCK_NATIVE_SOURCE_OVERRIDE:-$STOCK_NATIVE_ROOT}" && env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/google-chrome}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@")
}
native_run np_records tools/native-postgres/records.test.cjs
install_receipt_jsonb np_application
native_run np_application tools/native-postgres/application.test.cjs
native_run np_media tools/native-postgres/media-line.test.cjs
native_run np_browser tools/native-postgres/browser.test.cjs
pg createdb -U postgres -T sd_base np_bill
sd_sql np_bill retirement | pg psql -U postgres -d np_bill -v ON_ERROR_STOP=1 > "$artifacts/native-install-np_bill.log"
native_run np_bill tools/native-postgres/bill-identity.test.cjs
native_run np_bill --test-name-pattern="actual LINE order-image" tools/native-postgres/media-line.test.cjs
# Identity sequence high-water state (including rolled-back gaps) is recovery
# data. Exercise pg_dump/restore, not just a MAX(id) reconstruction.
pg psql -U postgres -d np_bill -v ON_ERROR_STOP=1 -c "SELECT nextval('stock_operational.order_bills_id_seq');" > "$artifacts/bill-identity-unused-reservation.log"
pg pg_dump -U postgres -d np_bill --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/bill-identity-recovery.sql"
pg createdb -U postgres np_bill_restore
pg psql -U postgres -d np_bill_restore -v ON_ERROR_STOP=1 < "$artifacts/bill-identity-recovery.sql" > "$artifacts/bill-identity-restore.log"
for database in np_bill np_bill_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/bill-identity-$database.txt" <<'SQL'
SELECT id::text,revision::text,to_jsonb(t)::text FROM stock_operational.order_bills t ORDER BY id;
SELECT last_value,is_called FROM stock_operational.order_bills_id_seq;
SELECT pg_get_serial_sequence('stock_operational.order_bills','id'),stock_operational.lexeme_mapping_contract_v1();
SELECT relacl::text FROM pg_class WHERE oid='stock_operational.order_bills_id_seq'::regclass;
SELECT to_jsonb(t)::text FROM stock_configuration.loyverse_accounts t ORDER BY id;
SQL
done
cmp "$artifacts/bill-identity-np_bill.txt" "$artifacts/bill-identity-np_bill_restore.txt"
echo 'PASS: order-bill identity app, guarded conversion/inverse and sequence recovery'
echo 'PASS: CURRENT PostgreSQL-only owners on fresh final-schema clones, legacy mapper execution revoked'

# Separate fresh clone: released order-bill identity plus proposed user-state identity.
pg createdb -U postgres -T sd_base np_sessions
sd_sql np_sessions retirement | pg psql -U postgres -d np_sessions -v ON_ERROR_STOP=1 > "$artifacts/native-install-np_sessions.log"
native_run np_sessions tools/native-postgres/user-state-identity.test.cjs
native_run np_sessions tools/native-postgres/media-line.test.cjs
# Preserve sequence gaps and narrow grants in an actual logical restore.
pg psql -U postgres -d np_sessions -v ON_ERROR_STOP=1 -c "SELECT nextval('stock_operational.user_state_id_seq');" > "$artifacts/session-identity-unused-reservation.log"
pg pg_dump -U postgres -d np_sessions --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/session-identity-recovery.sql"
pg createdb -U postgres np_sessions_restore
pg psql -U postgres -d np_sessions_restore -v ON_ERROR_STOP=1 < "$artifacts/session-identity-recovery.sql" > "$artifacts/session-identity-restore.log"
for database in np_sessions np_sessions_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/session-identity-$database.txt" <<'SQL'
SELECT to_jsonb(t)::text FROM stock_operational.user_state t ORDER BY id;
SELECT last_value,is_called FROM stock_operational.user_state_id_seq;
SELECT pg_get_serial_sequence('stock_operational.user_state','id'),stock_operational.lexeme_mapping_contract_v1();
SELECT relacl::text FROM pg_class WHERE oid='stock_operational.user_state_id_seq'::regclass;
SELECT last_value,is_called FROM stock_operational.order_bills_id_seq;
SELECT to_jsonb(t)::text FROM stock_configuration.loyverse_accounts t ORDER BY id;
SQL
done
cmp "$artifacts/session-identity-np_sessions.txt" "$artifacts/session-identity-np_sessions_restore.txt"
echo 'PASS: user-state identity, actual LINE order/movement image redelivery and sequence recovery'

# Coupled item/reference conversion, after both earlier identity releases.
pg createdb -U postgres -T sd_base np_items
sd_sql np_items retirement | pg psql -U postgres -d np_items -v ON_ERROR_STOP=1 > "$artifacts/native-install-np_items.log"
# Preserve PR93's unchanged relationship tests on its hash-pinned source only.
pr93_source=$(mktemp -d "$PWD/pr93-identity-source.XXXXXX")
python3 "$STOCK_NATIVE_ROOT/tools/native-postgres/reference-history-copy.py" "$pr93_source"
STOCK_NATIVE_SOURCE_OVERRIDE="$pr93_source" native_run np_items tools/native-postgres/item-identity.test.cjs
rm -rf "$pr93_source"
native_run np_items tools/native-postgres/media-line.test.cjs
pg psql -U postgres -d np_items -v ON_ERROR_STOP=1 -c "SELECT nextval('stock_operational.order_items_id_seq');" > "$artifacts/item-identity-unused-reservation.log"
pg pg_dump -U postgres -d np_items --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/item-identity-recovery.sql"
pg createdb -U postgres np_items_restore
pg psql -U postgres -d np_items_restore -v ON_ERROR_STOP=1 < "$artifacts/item-identity-recovery.sql" > "$artifacts/item-identity-restore.log"
for database in np_items np_items_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/item-identity-$database.txt" <<'SQL'
SELECT to_jsonb(t)::text FROM stock_operational.order_items t ORDER BY id;
SELECT to_jsonb(t)::text FROM stock_operational.movement_details t ORDER BY id;
SELECT last_value,is_called FROM stock_operational.order_items_id_seq;
SELECT last_value,is_called FROM stock_operational.order_bills_id_seq;
SELECT last_value,is_called FROM stock_operational.user_state_id_seq;
SELECT pg_get_constraintdef(oid),convalidated,condeferrable,condeferred FROM pg_constraint WHERE conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey';
SELECT relacl::text FROM pg_class WHERE oid='stock_operational.order_items_id_seq'::regclass;
SELECT stock_operational.lexeme_mapping_contract_v1();
SQL
done
cmp "$artifacts/item-identity-np_items.txt" "$artifacts/item-identity-np_items_restore.txt"
echo 'PASS: coupled item/reference identity, unchanged app/LINE flows, FK and all three sequence states restored'

# Actual current source on a separate fresh copy; no historical source overlay.
pg createdb -U postgres -T sd_base np_reference
sd_sql np_reference retirement | pg psql -U postgres -d np_reference -v ON_ERROR_STOP=1 > "$artifacts/native-install-np_reference.log"
native_run np_reference tools/native-postgres/movement-reference-retirement.test.cjs
native_run np_reference tools/native-postgres/media-line.test.cjs
native_run np_reference tools/native-postgres/order-image-uploads.test.cjs
native_run np_reference tools/native-postgres/row-edits.test.cjs
pg psql -U postgres -d np_reference -v ON_ERROR_STOP=1 -c "SELECT nextval('stock_operational.order_items_id_seq');" > "$artifacts/retired-reference-unused-reservation.log"
pg pg_dump -U postgres -d np_reference --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/retired-reference-recovery.sql"
pg createdb -U postgres np_reference_restore
pg psql -U postgres -d np_reference_restore -v ON_ERROR_STOP=1 < "$artifacts/retired-reference-recovery.sql" > "$artifacts/retired-reference-restore.log"
for database in np_reference np_reference_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/retired-reference-$database.txt" <<'SQL'
SELECT to_jsonb(t)::text FROM stock_operational.movement_details t ORDER BY id;
SELECT last_value,is_called FROM stock_operational.order_items_id_seq;
SELECT last_value,is_called FROM stock_operational.order_bills_id_seq;
SELECT last_value,is_called FROM stock_operational.user_state_id_seq;
SELECT relname,relacl::text FROM pg_class WHERE relnamespace='stock_operational'::regnamespace AND relkind='S' ORDER BY relname;
SELECT stock_operational.lexeme_mapping_contract_v1();
SELECT count(*) FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped;
SQL
done
cmp "$artifacts/retired-reference-np_reference.txt" "$artifacts/retired-reference-np_reference_restore.txt"
echo 'PASS: unused reference removed, unchanged actual app/LINE owners, logical inverse and all three sequence states restored'

# Lean-sync acceptance owns a fresh empty final-schema copy. Never assume the
# earlier shared reference/LINE campaigns or their historical seeds were empty.
pg createdb -U postgres -T np_reference np_lean_sales
pg psql -U postgres -d np_lean_sales -v ON_ERROR_STOP=1 > "$artifacts/lean-sales-empty-copy.log" <<'SQL'
DO $$DECLARE names text;BEGIN
 SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names
 FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');
 EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';
END$$;
SQL
STOCK_NATIVE_SOURCE_OVERRIDE="$receipt_history" native_run np_lean_sales tools/native-postgres/lean-sales.test.cjs
echo 'PASS: lean Loyverse fields, exact reports, late rollback and retained historical details on an empty synthetic copy'

# Separate fresh copy for the proposed JSONB payment rebuild and inverse.
# Existing production data is never a test fixture.
pg createdb -U postgres -T np_reference np_single_payment
pg psql -U postgres -d np_single_payment -v ON_ERROR_STOP=1 > "$artifacts/single-payment-empty-copy.log" <<'SQL'
DO $$DECLARE names text;BEGIN
 SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names
 FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');
 EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';
END$$;
SQL
STOCK_NATIVE_SOURCE_OVERRIDE="$receipt_history" native_run np_single_payment tools/native-postgres/receipt-payments-jsonb.test.cjs
pg pg_dump -U postgres -d np_single_payment --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/single-payment-recovery.sql"
pg createdb -U postgres np_single_payment_restore
pg psql -U postgres -d np_single_payment_restore -v ON_ERROR_STOP=1 < "$artifacts/single-payment-recovery.sql" > "$artifacts/single-payment-restore.log"
for database in np_single_payment np_single_payment_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/single-payment-$database.txt" <<'SQL'
SELECT to_jsonb(t)::text FROM stock_operational.sales_receipts t ORDER BY id COLLATE "C";
SELECT to_jsonb(t)::text FROM stock_operational.sales_receipt_items t ORDER BY id COLLATE "C";
SELECT to_jsonb(t)::text FROM stock_operational.sales_receipt_payments t ORDER BY id COLLATE "C";
SELECT to_jsonb(t)::text FROM stock_operational.sales_receipt_syncs t ORDER BY id COLLATE "C";
SELECT last_value,is_called FROM stock_operational.order_bills_id_seq;
SELECT last_value,is_called FROM stock_operational.order_items_id_seq;
SELECT last_value,is_called FROM stock_operational.user_state_id_seq;
SELECT stock_operational.receipt_payment_storage_v1(),has_any_column_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT');
SELECT has_function_privilege('anon','stock_operational.receipt_payment_storage_v1()','EXECUTE'),has_function_privilege('authenticated','stock_operational.receipt_payment_storage_v1()','EXECUTE');
SQL
done
cmp "$artifacts/single-payment-np_single_payment.txt" "$artifacts/single-payment-np_single_payment_restore.txt"
echo 'PASS: receipt JSONB payment rebuild/inverse, exact reports, legacy write fence, split preservation and independent logical restore'

# Actual current owners, not the historical copy: table present then physically absent.
pg createdb -U postgres -T np_single_payment np_payments_retired
native_run np_payments_retired tools/native-postgres/receipt-payment-retirement.test.cjs
# Every retained archive/business row and all 15 security/schema metadata sections
# are compared after a real logical dump/restore of the table-absent layout.
python3 "$STOCK_NATIVE_ROOT/tools/native-postgres/receipt-payment-recovery-sql.py" > "$artifacts/payment-retired-fingerprint.sql"
pg pg_dump -U postgres -d np_payments_retired --schema=stock_operational --schema=stock_migration --schema=stock_configuration > "$artifacts/payment-retired-recovery.sql"
pg createdb -U postgres np_payments_retired_restore
pg psql -U postgres -d np_payments_retired_restore -v ON_ERROR_STOP=1 < "$artifacts/payment-retired-recovery.sql" > "$artifacts/payment-retired-restore.log"
for database in np_payments_retired np_payments_retired_restore; do
 pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 < "$artifacts/payment-retired-fingerprint.sql" > "$artifacts/payment-retired-$database.txt"
done
cmp "$artifacts/payment-retired-np_payments_retired.txt" "$artifacts/payment-retired-np_payments_retired_restore.txt"
native_run np_payments_retired_restore tools/native-postgres/receipt-payment-retirement-restored.test.cjs
rm -rf "$receipt_history"
echo 'PASS: current sync/reports/replay/rollback without operational payments; archive and complete recovery preserved'

# Product UAT runs only on a new disposable final-schema copy; never the archive.
pg createdb -U postgres -T np_payments_retired np_product_uat
pg psql -U postgres -d np_product_uat -v ON_ERROR_STOP=1 > "$artifacts/product-uat-empty.log" <<'SQL'
DO $$DECLARE names text;BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';END$$;
SQL
{
 printf "SELECT set_config('stock.product_master_uat','reviewed-product-master-uat-v1',false);\n"
 printf "SELECT set_config('stock.expected_isolation_id',isolation_id::text,false) FROM stock_operational.environment;\n"
 cat "$STOCK_NATIVE_ROOT/supabase/migrations/20261122050700_product_master_order_item_uat.sql"
} | pg psql -U postgres -d np_product_uat -v ON_ERROR_STOP=1 > "$artifacts/product-uat-install.log"
native_run np_product_uat tools/product-uat/postgres.test.cjs

# Production-specific SQL is exercised on another owned synthetic localhost copy.
# The real production identity exists only inside that disposable clone.
pg createdb -U postgres -T np_payments_retired np_product_release
native_run np_product_release tools/product-uat/production-release.test.cjs
