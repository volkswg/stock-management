#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGSERVICE=stock_disposable_tests
name="stock-operational-verify-$$"
artifacts=$(mktemp -d)
cleanup(){ docker --host=unix:///var/run/docker.sock rm -fv "$name" >/dev/null; rm -rf "$artifacts"; }
trap cleanup EXIT
docker --host=unix:///var/run/docker.sock run -d --name "$name" -p 127.0.0.1::5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7 >/dev/null
for attempt in $(seq 1 60); do
 if docker --host=unix:///var/run/docker.sock exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
pg(){ docker --host=unix:///var/run/docker.sock exec -i "$name" "$@"; }
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon; CREATE ROLE authenticated;'
for file in supabase/migrations/*.sql; do pg psql -U postgres -v ON_ERROR_STOP=1 < "$file" > "$artifacts/migration.log"; done
pg psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE stock_test LOGIN PASSWORD 'synthetic-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; GRANT stock_runtime TO stock_test;"
# Phase 1 importer and exact-value operational promotion, using synthetic data only.
python3 - <<'PY' > "$artifacts/import.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import import_sql
from test_migration import precision_fixture
print(import_sql(precision_fixture()))
PY
pg psql -U postgres -v ON_ERROR_STOP=1 < "$artifacts/import.sql" > "$artifacts/import.log"
pg psql -U postgres -v ON_ERROR_STOP=1 < "$artifacts/import.sql" > "$artifacts/reimport.log"
pg psql -U postgres -v ON_ERROR_STOP=1 < tools/migration/promote.sql > "$artifacts/promote.log"
pg psql -U postgres -v ON_ERROR_STOP=1 -c "SELECT 1 / ((SELECT snapshot->>'totalPay'='9007199254740993.01' AND jsonb_typeof(snapshot->'totalPay')='number' FROM stock_migration.payroll_settlements))::int; SELECT 1 / ((SELECT snapshot->>'totalPay'='9007199254740993.01' AND jsonb_typeof(snapshot->'totalPay')='number' FROM stock_operational.payroll_settlements))::int;" > "$artifacts/json-precision.log"
# Extract the actual promoted operational tables through the read-only CLI.
cat > "$artifacts/psql" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host=unix:///var/run/docker.sock exec -i "$STOCK_VERIFY_CONTAINER" psql -U postgres "$@"
WRAPPER
chmod +x "$artifacts/psql"
python3 - <<'PY' > "$artifacts/source.json"
import sys,json
sys.path.insert(0,'tools/migration')
from test_migration import precision_fixture
print(json.dumps(precision_fixture()))
PY
promotion_id=$(pg psql -U postgres -At -c 'SELECT isolation_id FROM stock_operational.environment')
STOCK_VERIFY_CONTAINER="$name" STOCK_TARGET_ISOLATION_ID="$promotion_id" PATH="$artifacts:$PATH" python3 tools/migration/phase3.py operational-snapshot --source "$artifacts/source.json" --output "$artifacts/operational.json"
python3 tools/migration/migrate.py reconcile "$artifacts/source.json" "$artifacts/operational.json"
STOCK_VERIFY_CONTAINER="$name" PATH="$artifacts:$PATH" python3 tools/migration/migrate.py database-snapshot --source "$artifacts/source.json" --output "$artifacts/archive.json"
# The fixture's historical date text is intentionally unprofiled: report exact
# record parity while keeping overall acceptance blocked, never fabricating a pass.
python3 - "$artifacts" <<'PY'
import json,sys
from pathlib import Path
sys.path.insert(0,'tools/migration')
from acceptance import acceptance
from migrate import write_private
p=Path(sys.argv[1]);r=acceptance(*(json.loads((p/n).read_text()) for n in ['source.json','archive.json','operational.json']))
assert r['match'] and r['tableCount']==23 and not r['recordValidationPassed'] and not r['cutoverReady']
write_private(p/'acceptance.json',json.dumps(r))
print('PASS: 23-table acceptance report preserves record parity and does not approve unprofiled business data')
PY
if STOCK_VERIFY_CONTAINER="$name" STOCK_TARGET_ISOLATION_ID=00000000-0000-0000-0000-000000000000 PATH="$artifacts:$PATH" python3 tools/migration/phase3.py operational-snapshot --source "$artifacts/source.json" --output "$artifacts/forbidden.json" > "$artifacts/wrong-target.log" 2>&1; then
 echo 'Wrong target extraction must fail' >&2; exit 1
fi
test ! -e "$artifacts/forbidden.json"
python3 - "$artifacts" <<'PY'
import sys,json
from pathlib import Path
p=Path(sys.argv[1]);source=json.loads((p/'source.json').read_text());source['sheets']['orders']['formulaRows']=[['changed-formula-only']]
(p/'changed-batch.json').write_text(json.dumps(source))
PY
if STOCK_VERIFY_CONTAINER="$name" PATH="$artifacts:$PATH" python3 tools/migration/migrate.py database-snapshot --source "$artifacts/changed-batch.json" --output "$artifacts/changed-batch-extracted.json" > "$artifacts/changed-batch.log" 2>&1; then
 echo 'Changed formula archive provenance must fail' >&2; exit 1
fi
test ! -e "$artifacts/changed-batch-extracted.json"
if pg psql -U postgres -v ON_ERROR_STOP=1 < tools/migration/promote.sql > "$artifacts/repeat-promotion.log" 2>&1; then
 echo 'Promotion must reject a nonempty operational target' >&2; exit 1
fi
if pg psql -U postgres -v ON_ERROR_STOP=1 -c "UPDATE stock_migration.orders SET id='forbidden'" > "$artifacts/immutable.log" 2>&1; then
 echo 'Frozen archive unexpectedly accepted an update' >&2; exit 1
fi
# Upgrade existing synthetic archive rows, then promote nullable JSON cases.
pg createdb -U postgres json_null_test
python3 tools/migration/nullable-json-integration.py > "$artifacts/json-null.sql"
if ! pg psql -U postgres -d json_null_test -v ON_ERROR_STOP=1 < "$artifacts/json-null.sql" > "$artifacts/json-null.log"; then
 python3 - "$artifacts/json-null.log" <<'PYLOG'
import sys
from pathlib import Path
for line in Path(sys.argv[1]).read_text().splitlines():
 if line.startswith('nullable-json:'): print(line)
PYLOG
 exit 1
fi
echo 'PASS: nullable JSON upgrade/promotion, exact cells/types/precision, malformed JSON rejection and unchanged data/function security/trigger bindings'
# Keep promotion fixtures separate from domain-valid application fixtures.
pg createdb -U postgres application_test
for file in supabase/migrations/*.sql; do pg psql -U postgres -d application_test -v ON_ERROR_STOP=1 < "$file" > "$artifacts/application-schema.log"; done
port=$(docker --host=unix:///var/run/docker.sock port "$name" 5432/tcp | sed 's/.*://')
target_id=$(pg psql -U postgres -d application_test -At -c "SELECT isolation_id FROM stock_operational.environment")
env -i PATH="$PATH" STOCK_TARGET_ISOLATION_ID="$target_id" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/application_test" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test tools/migration/operational.test.cjs
env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-}" STOCK_TARGET_ISOLATION_ID="$target_id" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/application_test" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test tools/migration/browser-acceptance.test.cjs
pg pg_dump -U postgres -Fc -n stock_operational -n stock_migration > "$artifacts/backup.dump"
pg pg_dump -U postgres -d application_test -Fc -n stock_operational -n stock_migration > "$artifacts/application.dump"
pg createdb -U postgres restored
pg createdb -U postgres restored_application
pg pg_restore -U postgres -d restored_application --single-transaction --exit-on-error < "$artifacts/application.dump"
pg pg_restore -U postgres -d restored --single-transaction --exit-on-error < "$artifacts/backup.dump"
# Reusable consistent-snapshot backup tooling, independently restored and verified.
cat > "$artifacts/psql" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host=unix:///var/run/docker.sock exec -i "$STOCK_VERIFY_CONTAINER" psql -U postgres -d "${STOCK_VERIFY_DATABASE:-postgres}" "$@"
WRAPPER
cat > "$artifacts/pg_dump" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host=unix:///var/run/docker.sock exec -i "$STOCK_VERIFY_CONTAINER" pg_dump -U postgres -d "${STOCK_VERIFY_DATABASE:-postgres}" "$@"
WRAPPER
cat > "$artifacts/pg_restore" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host=unix:///var/run/docker.sock exec -i "$STOCK_VERIFY_CONTAINER" pg_restore "$@"
WRAPPER
chmod +x "$artifacts/psql" "$artifacts/pg_dump" "$artifacts/pg_restore"
for database in postgres application_test; do
 identity=$(pg psql -U postgres -d "$database" -At -c 'SELECT isolation_id FROM stock_operational.environment')
 STOCK_VERIFY_CONTAINER="$name" STOCK_VERIFY_DATABASE="$database" PATH="$artifacts:$PATH" python3 tools/migration/recovery.py capture --directory "$artifacts/recovery-$database" --target-id "$identity"
 pg createdb -U postgres "recovery_$database"
 pg pg_restore -U postgres -d "recovery_$database" --single-transaction --exit-on-error < "$artifacts/recovery-$database/database.dump"
 STOCK_VERIFY_CONTAINER="$name" STOCK_VERIFY_DATABASE="recovery_$database" PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/recovery-$database" --target-id "$identity" --output "$artifacts/restored-$database.json"
done
# Detect altered permissions and records on expendable restored databases.
pg psql -U postgres -d recovery_postgres -v ON_ERROR_STOP=1 -c 'GRANT SELECT ON stock_operational.orders TO anon;' > "$artifacts/grant-probe.log"
identity=$(pg psql -U postgres -At -c 'SELECT isolation_id FROM stock_operational.environment')
if STOCK_VERIFY_CONTAINER="$name" STOCK_VERIFY_DATABASE=recovery_postgres PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/recovery-postgres" --target-id "$identity" --output "$artifacts/altered-grant.json"; then
 echo 'Recovery must detect changed grants' >&2; exit 1
fi
pg psql -U postgres -d recovery_application_test -v ON_ERROR_STOP=1 -c "UPDATE stock_operational.orders SET business_cells=jsonb_set(business_cells,'{3}','999.11'::jsonb) WHERE id='order-valid';" > "$artifacts/record-probe.log"
identity=$(pg psql -U postgres -d application_test -At -c 'SELECT isolation_id FROM stock_operational.environment')
if STOCK_VERIFY_CONTAINER="$name" STOCK_VERIFY_DATABASE=recovery_application_test PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/recovery-application_test" --target-id "$identity" --output "$artifacts/altered-record.json"; then
 echo 'Recovery must detect changed records' >&2; exit 1
fi
python3 - <<'PY' > "$artifacts/fingerprint.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import CATALOG
for schema,tables in [('stock_migration',['import_batches']+list(CATALOG)),('stock_operational',['commands','audit','side_effects','environment']+list(CATALOG))]:
 for table in tables:
  print(f"SELECT '{schema}.{table}',md5(coalesce(string_agg(v::text,'' ORDER BY v::text),'')) FROM (SELECT to_jsonb(t) v FROM {schema}.{table} t) s;")
print("SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('stock_operational','stock_migration') ORDER BY 1,2,3;")
print("SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE table_schema IN ('stock_operational','stock_migration') ORDER BY 1,2,3,4;")
print("SELECT conrelid::regclass::text,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN ('stock_operational'::regnamespace,'stock_migration'::regnamespace) ORDER BY 1,2;")
print("SELECT schemaname,tablename,rowsecurity FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration') ORDER BY 1,2;")
print("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('stock_operational','stock_migration') ORDER BY 1,2,3;")
print("SELECT t.tgrelid::regclass::text,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('stock_operational','stock_migration') ORDER BY 1,2;")
print("SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('stock_operational','stock_migration') ORDER BY 1,2;")
print("SELECT schemaname,sequencename,sequenceowner,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname IN ('stock_operational','stock_migration') ORDER BY 1,2;")
PY
pg psql -U postgres -At -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/before"
pg psql -U postgres -At -v ON_ERROR_STOP=1 -d restored < "$artifacts/fingerprint.sql" > "$artifacts/after"
diff -u "$artifacts/before" "$artifacts/after"
pg psql -U postgres -At -d application_test -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/application-before"
pg psql -U postgres -At -d restored_application -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/application-after"
diff -u "$artifacts/application-before" "$artifacts/application-after"
pg psql -U postgres -At -c "SELECT pg_database_size(current_database()),sum(pg_total_relation_size(c.oid)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('stock_migration','stock_operational') AND c.relkind IN ('r','p');"
echo 'PASS: archive import, exact operational promotion, application/transaction tests, complete archive+operational backup and restore'
