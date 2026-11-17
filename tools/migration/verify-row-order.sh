#!/usr/bin/env bash
# Synthetic local schemas only; no production services, snapshots or providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
name="stock-row-order-$$"
artifacts=$(mktemp -d)
trap 'docker rm -fv "$name" >/dev/null; rm -rf "$artifacts"' EXIT
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
print(import_sql(precision_fixture()))
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
# Simulate the old writer's explicit high ordinal with a lagging identity.
pg psql -U postgres -d populated -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id,status,\"createdAt\",row_order) VALUES ('WT_HIGH_ORDINAL','complete','2026-11-01',5000);" > "$artifacts/highwater.log"
prepare populated
pg psql -U stock_test -d populated -v ON_ERROR_STOP=1 -c "BEGIN; SET LOCAL ROLE stock_runtime; INSERT INTO stock_operational.orders(id,status,\"createdAt\") VALUES ('WT_DEFAULT_AFTER_PREPARATION','complete','2026-11-01'); SELECT 1 / ((SELECT row_order>5000 FROM stock_operational.orders WHERE id='WT_DEFAULT_AFTER_PREPARATION'))::int; ROLLBACK;" > "$artifacts/default.log"
python3 - <<'PY' > "$artifacts/values.sql"
import json
from pathlib import Path
tables=json.loads(Path('tools/migration/worksheets.json').read_text())
for table in ['commands','revision','side_effects','environment',*tables]:
 print(f"SELECT '{table}',md5(coalesce(string_agg(v::text,'' ORDER BY v::text),'')) FROM (SELECT to_jsonb(t)-'row_order' v FROM stock_operational.{table} t) s;")
PY
python3 - <<'PY' > "$artifacts/metadata.sql"
import sys
sys.path.insert(0,'tools/migration')
from recovery import fingerprint_sql
print('\n'.join(fingerprint_sql().splitlines()[51:]))
PY
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/values.sql" > "$artifacts/values-before"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-before"
# Every denial must roll back all function/column changes.
if pg psql -U postgres -d populated -v ON_ERROR_STOP=1 < tools/migration/final-removal/*_remove_row_order.sql > "$artifacts/missing-approval.log" 2>&1; then exit 1; fi
if { removal populated | sed "s/SET stock.row_order_reviewed_revision='[0-9]*'/SET stock.row_order_reviewed_revision='-1'/"; } | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/stale-review.log" 2>&1; then exit 1; fi
test "$(columns populated)" = 23
pg psql -U postgres -d populated -c 'CREATE VIEW public.WT_ordinal_dependency AS SELECT row_order FROM stock_operational.orders;'
if removal populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/view-dependency.log" 2>&1; then exit 1; fi
test "$(columns populated)" = 23
pg psql -U postgres -d populated -c 'DROP VIEW public.WT_ordinal_dependency;'
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-denied"
diff -u "$artifacts/metadata-before" "$artifacts/metadata-denied"
removal populated | pg psql -U postgres -d populated -v ON_ERROR_STOP=1 > "$artifacts/removal.log"
test "$(columns populated)" = 0
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/values.sql" > "$artifacts/values-after"
diff -u "$artifacts/values-before" "$artifacts/values-after"
pg psql -U postgres -d populated -XqAt -v ON_ERROR_STOP=1 < "$artifacts/metadata.sql" > "$artifacts/metadata-after"
python3 - "$artifacts" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);read=lambda n:{r['metadata']:r['value'] for r in map(json.loads,(p/n).read_text().splitlines())}
b,a=read('metadata-before'),read('metadata-after')
for key in ['schemas','tables','policies','grants','triggers','defaults','runtimeRole','memberships','runtimeLogins']:assert a[key]==b[key],key
assert a['columns']==[r for r in b['columns'] if not(r['nspname']=='stock_operational' and r['attname']=='row_order')]
assert a['constraints']==[r for r in b['constraints'] if 'row_order' not in r['definition']]
assert a['indexes']==[r for r in b['indexes'] if 'row_order' not in r['indexdef']]
assert a['sequences']==[r for r in b['sequences'] if not(r['schemaname']=='stock_operational' and r['sequencename'].endswith('_row_order_seq'))]
assert a['sequenceGrants']==[r for r in b['sequenceGrants'] if not(r['nspname']=='stock_operational' and r['relname'].endswith('_row_order_seq'))]
expected=[{**r,'definition':r['definition'].replace(' OR NEW.row_order IS DISTINCT FROM OLD.row_order','')} for r in b['functions']]
assert a['functions']==expected
print('PASS: populated physical removal preserves all original values/revisions and exact remaining schema/security metadata')
PY
# Independent fresh copies exercise existing app/API/browser suites in both schemas.
pg createdb -U postgres retained
for file in supabase/migrations/*.sql; do pg psql -U postgres -d retained -v ON_ERROR_STOP=1 < "$file" > "$artifacts/fresh.log"; done
pg createdb -U postgres -T retained final_ids
prepare retained
remove_cells final_ids
prepare final_ids
removal final_ids | pg psql -U postgres -d final_ids -v ON_ERROR_STOP=1 > "$artifacts/final.log"
# Exercise the real read-only exporter and offline review on the empty retained
# target. The unit witnesses separately prove changed-choice and truncation denial.
mkdir "$artifacts/bin"
printf '#!/usr/bin/env bash\nexec docker exec -i %q psql -U postgres -d retained "$@"\n' "$name" > "$artifacts/bin/psql"
chmod 700 "$artifacts/bin/psql"
PGSERVICE=synthetic-row-order-review PATH="$artifacts/bin:$PATH" python3 tools/migration/row-order-review.py --frozen-review-approved --target-id "$(identity retained)" --target-purpose isolated-staging --output "$artifacts/review.jsonl"
echo '{"months":["2026-11"],"accounts":[],"asOf":"2026-11-20T00:00:00+07:00"}' > "$artifacts/review-config.json"
env -i PATH="$PATH" node tools/migration/row-order-review.cjs --snapshot "$artifacts/review.jsonl" --config "$artifacts/review-config.json" --output "$artifacts/review-result.json"
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_app(){ local db=$1 no_order=$2; shift 2; env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/google-chrome}" STOCK_EXPECT_NO_ROW_ORDER="$no_order" STOCK_TARGET_ISOLATION_ID="$(identity "$db")" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$db" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
for schema in retained final_ids; do
 flag=false; [[ "$schema" == final_ids ]] && flag=true
 run_app "$schema" "$flag" tools/migration/operational.test.cjs
 run_app "$schema" "$flag" tools/migration/stable-record-ids.test.cjs
 run_app "$schema" "$flag" tools/migration/row-order.test.cjs
 run_app "$schema" "$flag" tools/migration/browser-acceptance.test.cjs
done
echo 'PASS: guarded ordinal preparation/removal, preserved data/security, ID-based workflows and browser retry acceptance in both schemas'
