#!/usr/bin/env bash
# Synthetic local schemas only; no production services, snapshots or providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
name="stock-cell-kinds-$$"
artifacts=$(mktemp -d "${STOCK_CK_EVIDENCE_DIR:-${TMPDIR:-/tmp}}/cell-kinds.XXXXXX")
trap 'docker rm -fv "$name" >/dev/null; if [[ -z "${STOCK_CK_EVIDENCE_DIR:-}" ]]; then rm -rf "$artifacts"; fi' EXIT
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
native populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/native-populated.log"
compat_sql=tools/migration/compatibility/20261117132332_cell_kinds_compatibility.sql
install_columns(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_cell_kinds_compatibility='reviewed-per-column-compatibility-v1';"; cat "$compat_sql"; }
python3 - <<'PYCODE' > "$artifacts/fingerprint.sql"
import sys
sys.path.insert(0,'tools/migration')
from recovery import fingerprint_sql
print(fingerprint_sql())
PYCODE
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/before.jsonl"
if pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$compat_sql" > "$artifacts/missing-approval.log" 2>&1; then exit 1; fi
if { install_columns populated | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/wrong-target.log" 2>&1; then exit 1; fi
pg psql -U postgres -d populated -XqAt -c "SELECT pg_get_functiondef('stock_operational.validate_orders()'::regprocedure)" > "$artifacts/validator.sql"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN EXECUTE replace(pg_get_functiondef('stock_operational.validate_orders()'::regprocedure),'DECLARE supplied_encoding boolean;','DECLARE supplied_encoding boolean; -- synthetic drift'); END \$\$;" > "$artifacts/drift.log"
if install_columns populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/drift-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < "$artifacts/validator.sql" > "$artifacts/validator-restored.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c 'CREATE ROLE column_reader; GRANT USAGE ON SCHEMA stock_operational TO column_reader; GRANT SELECT ON stock_operational.orders TO column_reader; GRANT EXECUTE ON FUNCTION stock_operational.project_orders(stock_operational.orders) TO column_reader;' > "$artifacts/reader.log"
# Record metadata after the explicitly scoped synthetic reader fixture.
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/before.jsonl"
install_columns populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/install-populated.log"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/after.jsonl"
python3 tools/migration/cell-kinds-proof.py "$artifacts"
python3 tools/migration/cell-kinds-matrix.py | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/codec-matrix.log"
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "SET ROLE column_reader; SELECT stock_operational.column_mapping_contract_v1(); SELECT stock_operational.column_compatible_orders(t) FROM stock_operational.orders t LIMIT 1; SELECT 1 / (NOT has_function_privilege('column_reader','stock_operational.column_input_orders(jsonb)','EXECUTE'))::int;" > "$artifacts/reader-after.log"
# Independent empty native schema, without the populated precision fixtures.
pg createdb -U postgres ck_base
for file in supabase/migrations/*.sql; do pg psql -U postgres -d ck_base -v ON_ERROR_STOP=1 < "$file" > "$artifacts/fresh.log"; done
remove_cells ck_base
prepare ck_base
removal ck_base | pg psql -U postgres -d ck_base -v ON_ERROR_STOP=1 > "$artifacts/fresh-ordinal.log"
native ck_base | pg psql -U postgres -d ck_base -v ON_ERROR_STOP=1 > "$artifacts/fresh-native.log"
install_columns ck_base | pg psql -U postgres -d ck_base -v ON_ERROR_STOP=1 > "$artifacts/install-fresh.log"
for database in ck_retained ck_operational ck_native ck_browser ck_final ck_partial ck_perf; do pg createdb -U postgres -T ck_base "$database"; done
pg psql -U postgres -d ck_partial -v ON_ERROR_STOP=1 -c 'ALTER TABLE stock_operational.orders RENAME COLUMN cell_kinds TO synthetic_missing_kinds; ALTER TABLE stock_operational.revision ADD COLUMN cell_kinds text;' > "$artifacts/partial.log"
python3 tools/migration/cell-kinds.py --local-final-fixture > "$artifacts/local-final-fixture.sql"
{ echo "SET stock.local_cell_kind_fixture='synthetic-only';"; cat "$artifacts/local-final-fixture.sql"; } | pg psql -U postgres -d ck_final -v ON_ERROR_STOP=1 > "$artifacts/local-final.log"
# Bounded read-cost evidence for the new projection, not a capacity campaign.
pg psql -U postgres -d ck_perf -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id,status,seller,\"totalPrice\",remark,\"createdAt\",\"updatedAt\",\"deletedAt\",\"createdBy\",cell_kinds,\"totalPrice__lexeme\") SELECT i.id,i.status,i.seller,i.\"totalPrice\",i.remark,i.\"createdAt\",i.\"updatedAt\",i.\"deletedAt\",i.\"createdBy\",i.cell_kinds,i.\"totalPrice__lexeme\" FROM generate_series(1,1000) n CROSS JOIN LATERAL stock_operational.column_input_orders(jsonb_build_array('CK_PERF_'||n,'waiting_for_total_price','synthetic',12.5,'','2026-11-17T02:00:00.000Z','','','synthetic')) i;" > "$artifacts/performance-fixture.log"
for prefix in project_ column_compatible_; do
 pg psql -U postgres -d ck_perf -XqAt -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SET LOCAL ROLE stock_runtime; SET LOCAL statement_timeout='30s'; EXPLAIN (ANALYZE,FORMAT JSON) SELECT sum(octet_length(stock_operational.${prefix}orders(t)::text)) FROM stock_operational.orders t; COMMIT;" > "$artifacts/performance-${prefix}.json"
done
python3 - "$artifacts" <<'PYCODE'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);old=json.loads((p/'performance-project_.json').read_text())[0]['Execution Time'];new=json.loads((p/'performance-column_compatible_.json').read_text())[0]['Execution Time']
assert old>0 and new>0
(p/'performance-summary.json').write_text(json.dumps({'syntheticOrderRows':1000,'legacyMilliseconds':old,'compatibleMilliseconds':new,'ratio':round(new/old,3),'capacityProof':False})+'\n')
print('PASS: bounded1000-row legacy/compatibility read plans completed under the existing30-second statement bound')
PYCODE
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_app(){ local database=$1; shift; local target; target=$(identity "$database"); env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CK_CASE="$database" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_app ck_partial tools/migration/cell-kinds.test.cjs
run_app ck_retained tools/migration/cell-kinds.test.cjs
run_app ck_final tools/migration/cell-kinds.test.cjs
run_app ck_operational tools/migration/operational.test.cjs
run_app ck_native tools/migration/native-timestamps.test.cjs
run_app ck_browser tools/migration/browser-acceptance.test.cjs
# Audit only the new local retained fixture, never any saved service or hosted data.
wrappers="$artifacts/bin"; mkdir "$wrappers"
printf '#!/bin/sh\nexec docker exec -i %s psql -U postgres -d ck_retained "$@"\n' "$name" > "$wrappers/psql"; chmod 700 "$wrappers/psql"
env -i PATH="$wrappers:$PATH" PGSERVICE=ck_local_wrapper_only python3 tools/migration/cell-kinds-audit.py --target-id "$(identity ck_retained)" --target-purpose isolated-staging --frozen-or-local-review-approved --output "$artifacts/audit.private.json"
python3 - "$artifacts/audit.private.json" <<'PYCODE'
import json,sys
r=json.load(open(sys.argv[1]));assert len(r['tables'])==23 and r['nonidenticalRows']>0
assert r['physicalRemovalAuthorized'] is False and r['writesPerformed'] is False
assert any(t['archivedRows'] for t in r['tables'])
assert sum(len(t['fields']) for t in r['tables'])==248
movement=next(t for t in r['tables'] if t['table']=='movement_details')
assert next(f for f in movement['fields'] if f['name']=='stockCounted')['archivedMismatches']==1
PYCODE
echo 'PASS: additive per-column compatibility; all23 kind columns retained; exact51-table/remaining-metadata preservation; old/new encodings and real app/browser/LINE acceptance; guarded final-candidate component smoke only'
