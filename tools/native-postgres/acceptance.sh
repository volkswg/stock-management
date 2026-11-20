# Sourced after the pinned predecessor has independently proved the final schema.
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
 (cd "$STOCK_NATIVE_ROOT" && env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/google-chrome}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@")
}
native_run np_records tools/native-postgres/records.test.cjs
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
native_run np_items tools/native-postgres/item-identity.test.cjs
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
