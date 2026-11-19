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
echo 'PASS: CURRENT PostgreSQL-only owners on fresh final-schema clones, legacy mapper execution revoked'
