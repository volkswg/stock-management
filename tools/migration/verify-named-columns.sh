#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
name="stock-named-columns-$$"
artifacts=$(mktemp -d)
trap 'docker rm -fv "$name" >/dev/null; rm -rf "$artifacts"' EXIT
docker run -d --name "$name" -p 127.0.0.1::5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7 >/dev/null
for attempt in $(seq 1 60); do
 if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
pg(){ docker exec -i "$name" "$@"; }
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon; CREATE ROLE authenticated;'
for file in supabase/migrations/*.sql; do
 [[ "$file" == *named_column_authority.sql || "$file" == *stable_record_ids_created_at.sql ]] && continue
 pg psql -U postgres -v ON_ERROR_STOP=1 < "$file" > "$artifacts/schema.log"
done
python3 - <<'PY' > "$artifacts/import.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import import_sql
from test_migration import precision_fixture
print(import_sql(precision_fixture()))
PY
pg psql -U postgres -v ON_ERROR_STOP=1 < "$artifacts/import.sql" > "$artifacts/import.log"
pg psql -U postgres -v ON_ERROR_STOP=1 < tools/migration/promote.sql > "$artifacts/promote.log"
pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/*named_column_authority.sql > "$artifacts/transition.log"
pg psql -U postgres -v ON_ERROR_STOP=1 < tools/migration/named-columns.test.sql
# Verify the additive ID/date upgrade on the populated precision fixture, including
# original ordering/archive/revision metadata. Only new derived fields may differ.
python3 - <<'FINGERPRINT' > "$artifacts/id-upgrade-fingerprint.sql"
import json
from pathlib import Path
catalog=json.loads(Path('tools/migration/worksheets.json').read_text())
for table in ['commands','revision','side_effects','environment',*catalog]:
    omitted="-'created_at_instant'"+("-'createdAt'" if table in catalog and 'createdAt' not in catalog[table]['columns'] else '')
    print(f"SELECT '{table}',md5(coalesce(string_agg(v::text,'' ORDER BY v::text),'')) FROM (SELECT to_jsonb(t){omitted} v FROM stock_operational.{table} t) s;")
FINGERPRINT
pg psql -U postgres -XqAt -v ON_ERROR_STOP=1 < "$artifacts/id-upgrade-fingerprint.sql" > "$artifacts/id-upgrade-before"
pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/*stable_record_ids_created_at.sql > "$artifacts/id-upgrade.log"
pg psql -U postgres -XqAt -v ON_ERROR_STOP=1 < "$artifacts/id-upgrade-fingerprint.sql" > "$artifacts/id-upgrade-after"
diff -u "$artifacts/id-upgrade-before" "$artifacts/id-upgrade-after"
pg psql -U postgres -v ON_ERROR_STOP=1 < tools/migration/named-columns-rollback.sql > "$artifacts/rollback.log"
pg psql -U postgres -v ON_ERROR_STOP=1 -c "SELECT 1 / ((SELECT remark='after release' FROM stock_operational.orders WHERE id='NC_TEST'))::int; SELECT 1 / ((SELECT business_cells->>4='after release' FROM stock_operational.orders WHERE id='NC_TEST'))::int;"
# Fresh complete install is separate from populated upgrade.
pg createdb -U postgres application_test
for file in supabase/migrations/*.sql; do pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 < "$file" > "$artifacts/fresh.log"; done
pg psql -U postgres -c "CREATE ROLE stock_test LOGIN PASSWORD 'synthetic-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; GRANT stock_runtime TO stock_test;"
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
target=$(pg psql -U postgres -d application_test -At -c 'SELECT isolation_id FROM stock_operational.environment')
run_app(){ env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/application_test" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
# Independent empty copies prevent fixture reuse from masking either schema path.
pg createdb -U postgres -T application_test id_compat_before
pg createdb -U postgres -T application_test id_compat_after
run_ids(){ local id_target; id_target=$(pg psql -U postgres -d "$1" -At -c 'SELECT isolation_id FROM stock_operational.environment'); env -i PATH="$PATH" STOCK_TARGET_ISOLATION_ID="$id_target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$1" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test tools/migration/stable-record-ids.test.cjs; }
run_ids id_compat_before
run_app tools/migration/operational.test.cjs
run_app tools/migration/browser-acceptance.test.cjs
if pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 < tools/migration/final-removal/*remove_business_cells.sql > "$artifacts/guard-denial.log" 2>&1; then
 echo 'Final removal must fail without explicit operator setting' >&2; exit 1
fi
if pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 -c "SET stock.allow_final_cells_removal='reviewed-named-columns-v1'; SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000';" -f /dev/stdin < tools/migration/final-removal/*remove_business_cells.sql > "$artifacts/wrong-target-denial.log" 2>&1; then
 echo 'Final removal must fail for a different target identity' >&2; exit 1
fi
pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 -c "SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='business_cells'))::int;"
pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 -c "SET stock.allow_final_cells_removal='reviewed-named-columns-v1'; SET stock.expected_isolation_id='$target';" -f /dev/stdin < tools/migration/final-removal/*remove_business_cells.sql > "$artifacts/removal.log"
pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 -c "SELECT 1 / (NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='business_cells'))::int;"
# Run the final schema against a separate fresh database, with the full suite.
run_app tools/migration/named-columns-final.test.cjs
pg createdb -U postgres final_test
for file in supabase/migrations/*.sql; do pg psql -U postgres -d final_test -v ON_ERROR_STOP=1 < "$file" > "$artifacts/final-schema.log"; done
target=$(pg psql -U postgres -d final_test -At -c 'SELECT isolation_id FROM stock_operational.environment')
pg psql -U postgres -d final_test -v ON_ERROR_STOP=1 -c "SET stock.allow_final_cells_removal='reviewed-named-columns-v1'; SET stock.expected_isolation_id='$target';" -f /dev/stdin < tools/migration/final-removal/*remove_business_cells.sql > "$artifacts/final-removal.log"
run_final(){ env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$target" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/final_test" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_final tools/migration/operational.test.cjs
run_final tools/migration/browser-acceptance.test.cjs


id_target=$(pg psql -U postgres -d id_compat_after -At -c 'SELECT isolation_id FROM stock_operational.environment')
pg psql -U postgres -d id_compat_after -v ON_ERROR_STOP=1 -c "SET stock.allow_final_cells_removal='reviewed-named-columns-v1'; SET stock.expected_isolation_id='$id_target';" -f /dev/stdin < tools/migration/final-removal/*remove_business_cells.sql > "$artifacts/id-final-removal.log"
run_ids id_compat_after
echo "PASS: populated upgrade, complete installation, all-column codecs, compatibility rollback, guarded physical removal and operational/browser acceptance in both schemas"
