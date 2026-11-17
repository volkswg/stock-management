#!/usr/bin/env bash
# Synthetic local schemas only; no production services, snapshots or providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
name="stock-native-timestamps-$$"
artifacts=$(mktemp -d "${STOCK_NATIVE_EVIDENCE_DIR:-${TMPDIR:-/tmp}}/native-timestamps.XXXXXX")
trap 'docker rm -fv "$name" >/dev/null; if [[ -z "${STOCK_NATIVE_EVIDENCE_DIR:-}" ]]; then rm -rf "$artifacts"; fi' EXIT
docker run -d --name "$name" --memory=2g --memory-swap=2g --cpus=2 -p 127.0.0.1::5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7 >/dev/null
for attempt in $(seq 1 60); do
 if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
pg(){ docker exec -i "$name" "$@"; }
pg psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE stock_test LOGIN PASSWORD 'synthetic-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;"
pg createdb -U postgres populated
for file in supabase/migrations/*.sql; do
 [[ "$file" == *named_column_authority.sql || "$file" == *stable_record_ids_created_at.sql ]] && continue
 pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$file" > "$artifacts/schema.log"
done
python3 - <<'PY' > "$artifacts/import.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import import_sql
from test_migration import precision_fixture
snapshot=precision_fixture()
# Explicit domain for this new fixture; old precision/history fixtures stay frozen.
for table,spec in __import__('core').CATALOG.items():
 for col in ['createdAt','updatedAt','deletedAt']:
  if col in spec['headers']:snapshot['sheets'][table]['rows'][0][spec['headers'].index(col)]={'createdAt':'2026-11-17T09:00:00.123456+07:00','updatedAt':'2026-11-17 10:00:00','deletedAt':''}[col]
snapshot['sheets']['orders']['rows'][0][7]='2026-11-18T02:00:00Z'
print(import_sql(snapshot))
PY
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$artifacts/import.sql" > "$artifacts/import.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < tools/migration/promote.sql > "$artifacts/promote.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < supabase/migrations/*named_column_authority.sql > "$artifacts/named.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < supabase/migrations/*stable_record_ids_created_at.sql > "$artifacts/creation.log"
pg psql -U postgres -c 'GRANT stock_runtime TO stock_test;'

identity(){ pg psql -U postgres -d "$1" -At -c 'SELECT isolation_id FROM stock_operational.environment'; }
revision(){ pg psql -U postgres -d "$1" -At -c 'SELECT value FROM stock_operational.revision WHERE singleton'; }
prepare(){ { echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_row_order_preparation='reviewed-id-created-order-v1';"; cat tools/migration/final-removal/*prepare_row_order_removal.sql; } | pg psql -U postgres -d "$1" -v ON_ERROR_STOP=1 > "$artifacts/prepare-$1.log"; }
remove_cells(){ { echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.allow_final_cells_removal='reviewed-named-columns-v1';"; cat tools/migration/final-removal/*remove_business_cells.sql; } | pg psql -U postgres -d "$1" -v ON_ERROR_STOP=1 > "$artifacts/cells-$1.log"; }
removal(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_final_row_order_removal='reviewed-id-created-order-v1'; SET stock.row_order_reviewed_revision='$(revision "$1")'; SET stock.row_order_reviewed_source='1111111111111111111111111111111111111111'; SET stock.row_order_restore_verified='51-tables-15-metadata-v1';"; cat tools/migration/final-removal/*_remove_row_order.sql; }
columns(){ pg psql -U postgres -d "$1" -At -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'"; }

remove_cells populated
prepare populated
removal populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/ordinal.log"
native_sql=tools/migration/final-removal/20261117085310_native_lifecycle_timestamps.sql
native_settings(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_native_timestamps='reviewed-lifecycle-timestamptz-v1'; SET stock.timestamp_reviewed_revision='$(revision "$1")'; SET stock.timestamp_reviewed_source='1111111111111111111111111111111111111111'; SET stock.timestamp_restore_verified='51-tables-15-metadata-v1';"; }
native(){ native_settings "$1"; cat "$native_sql"; }
python3 - <<'PY' > "$artifacts/metadata.sql"
import sys
sys.path.insert(0,'tools/migration')
from recovery import fingerprint_sql
print('\n'.join(fingerprint_sql().splitlines()[51:]))
PY
if pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$native_sql" > "$artifacts/missing-approval.log" 2>&1; then exit 1; fi
if { native populated | sed "s/SET stock.timestamp_reviewed_revision='[0-9]*'/SET stock.timestamp_reviewed_revision='-1'/"; } | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/stale-review.log" 2>&1; then exit 1; fi
if { native populated | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/wrong-target.log" 2>&1; then exit 1; fi
# A real writer commits after the first revision check while DDL waits on its
# advisory lock. The post-lock seal must reject, even under a different caller
# default isolation. No migration object may survive that refusal.
mkfifo "$artifacts/writer-input"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/writer-input" > "$artifacts/writer-output" 2> "$artifacts/writer-error" &
writer_pid=$!
exec 3> "$artifacts/writer-input"
printf '%s\n' 'BEGIN;' 'SELECT pg_advisory_xact_lock(835107241);' '\echo NT_WRITER_LOCK_READY' >&3
for attempt in $(seq 1 40); do if [[ $(< "$artifacts/writer-output") == *NT_WRITER_LOCK_READY* ]]; then break; fi; sleep .1; done
[[ $(< "$artifacts/writer-output") == *NT_WRITER_LOCK_READY* ]]
{ echo "SET application_name='NT_TIMESTAMP_LOCK_RACE'; SET default_transaction_isolation='repeatable read';"; native populated; } | pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 > "$artifacts/lock-race-refused.log" 2>&1 &
ddl_pid=$!
blocked=false
for attempt in $(seq 1 12); do
 if [[ $(pg psql -U postgres -d populated -XqAt -c "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE application_name='NT_TIMESTAMP_LOCK_RACE' AND wait_event='advisory')") == t ]]; then blocked=true; break; fi
 sleep .1
done
test "$blocked" = true
printf '%s\n' "UPDATE stock_operational.orders SET remark='synthetic concurrent change' WHERE id='orders-1';" 'COMMIT;' '\q' >&3
exec 3>&-
wait "$writer_pid"
if wait "$ddl_pid"; then echo 'Stale seal survived a real lock-wait writer race' >&2; exit 1; fi
[[ $(< "$artifacts/lock-race-refused.log") == *'division by zero'* ]]
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "SELECT 1 / (to_regprocedure('stock_operational.native_timestamp_input(text)') IS NULL)::int;" > "$artifacts/lock-race-rollback.log"
echo 'PASS: a real writer committing during lock wait invalidates the stale review seal atomically'
# Invalid values must block conversion even on archived rows; no NULL coercion.
for field in createdAt updatedAt deletedAt; do
 pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id,status,\"createdAt\",\"updatedAt\",\"deletedAt\") VALUES ('NT_INVALID','complete','2026-11-01','',''); UPDATE stock_operational.orders SET \"$field\"='not-a-date' WHERE id='NT_INVALID'; UPDATE stock_operational.orders SET archived_at=now() WHERE id='NT_INVALID';" > "$artifacts/invalid-$field-fixture.log"
 if native populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/invalid-$field.log" 2>&1; then exit 1; fi
 pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "SELECT 1 / ((SELECT count(*)=47 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='text'))::int; SELECT 1 / (to_regprocedure('stock_operational.native_timestamp_input(text)') IS NULL)::int; DELETE FROM stock_operational.orders WHERE id='NT_INVALID';" > "$artifacts/invalid-$field-rollback.log"
done
pg psql -U postgres -d populated -XqAt -c "SELECT pg_get_functiondef('stock_operational.validate_orders()'::regprocedure)" > "$artifacts/original-validator.sql"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN EXECUTE replace(pg_get_functiondef('stock_operational.validate_orders()'::regprocedure),'DECLARE supplied_encoding boolean;','DECLARE supplied_encoding boolean; -- synthetic drift'); END \$\$;" > "$artifacts/drift-fixture.log"
if native populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/drift-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$artifacts/original-validator.sql" > "$artifacts/drift-restored.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id,status,\"createdAt\") VALUES ('NT_ARCHIVED','complete','2026-11-01'); UPDATE stock_operational.orders SET archived_at=now() WHERE id='NT_ARCHIVED'; CREATE ROLE native_reader; GRANT USAGE ON SCHEMA stock_operational TO native_reader; GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational TO native_reader;" > "$artifacts/archived-reader-fixture.log"
python3 - <<'PY' > "$artifacts/reader.sql"
import json
from pathlib import Path
for t in json.loads(Path('tools/migration/worksheets.json').read_text()):print(f'GRANT EXECUTE ON FUNCTION stock_operational.project_{t}(stock_operational.{t}) TO native_reader;')
PY
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$artifacts/reader.sql" > "$artifacts/reader.log"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-before"
pg psql -U postgres -d populated -c 'CREATE VIEW public.NT_timestamp_dependency AS SELECT created_at_instant FROM stock_operational.orders;'
if native populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/view-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d populated -c 'DROP VIEW public.NT_timestamp_dependency;'
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-denied"
diff -u "$artifacts/metadata-before" "$artifacts/metadata-denied"
# Compare all 51 full tables. Only requested operational timestamps normalize;
# archive text, unrelated dates, all values/revisions/journals remain exact.
python3 - <<'PY' > "$artifacts/expected-values.sql"
import sys,runpy
sys.path.insert(0,'tools/migration')
from core import CATALOG
fields=runpy.run_path('tools/migration/native-timestamps.py')['fields']()
print("SET timezone='UTC';")
for schema,tables in [('stock_migration',['import_batches',*CATALOG]),('stock_operational',['commands','revision','side_effects','environment',*CATALOG])]:
 for t in tables:
  expression='to_jsonb(t)'
  if schema=='stock_operational' and t in CATALOG:
   expression+="-'created_at_instant'"
   for name_table,col,_ in fields:
    if name_table==t:expression+=f" || jsonb_build_object('{col}',to_jsonb(stock_operational.created_at_timestamp(\"{col}\")))"
  print(f"SELECT '{schema}.{t}',md5(coalesce(string_agg(v::text,'' ORDER BY v::text),'')) FROM (SELECT {expression} v FROM {schema}.{t} t) s;")
PY
python3 - <<'PY' > "$artifacts/actual-values.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import CATALOG
print("SET timezone='UTC';")
for schema,tables in [('stock_migration',['import_batches',*CATALOG]),('stock_operational',['commands','revision','side_effects','environment',*CATALOG])]:
 for t in tables:print(f"SELECT '{schema}.{t}',md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM {schema}.{t} t;")
PY
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/expected-values.sql" > "$artifacts/values-before"
native populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/native-populated.log"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/actual-values.sql" > "$artifacts/values-after"
diff -u "$artifacts/values-before" "$artifacts/values-after"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-after"
python3 tools/migration/native-timestamps-proof.py "$artifacts"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "SET ROLE native_reader; SELECT stock_operational.project_orders(t) FROM stock_operational.orders t LIMIT 1; SELECT 1 / (NOT has_function_privilege('native_reader','stock_operational.native_timestamp_input(text)','EXECUTE'))::int;" > "$artifacts/reader-after.log"
# Fresh final schema, independent of populated upgrade fixtures.
pg createdb -U postgres application_test
for file in supabase/migrations/*.sql; do pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 < "$file" > "$artifacts/fresh.log"; done
remove_cells application_test
prepare application_test
removal application_test | pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 > "$artifacts/ordinal-final.log"
native application_test | pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 > "$artifacts/native-final.log"
pg psql -U postgres -c 'GRANT stock_runtime TO stock_test;'
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
for database in native_cases operational_cases browser_cases; do pg createdb -U postgres -T application_test "$database"; done
run_app(){ local database=$1; shift; local target; target=$(identity "$database"); env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_app native_cases tools/migration/native-timestamps.test.cjs
run_app operational_cases tools/migration/operational.test.cjs
run_app browser_cases tools/migration/browser-acceptance.test.cjs
echo 'PASS: guarded native lifecycle timestamps; 51-table value preservation, exact remaining metadata, native application/browser/LINE behavior'
