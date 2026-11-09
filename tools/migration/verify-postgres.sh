#!/usr/bin/env bash
# Disposable local Docker ONLY. Does not accept a remote database URL.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGSERVICE=stock_disposable_tests
name="stock-migration-verify-$$"
artifacts=$(mktemp -d)
cleanup() { docker --host=unix:///var/run/docker.sock rm -fv "$name" >/dev/null; rm -rf "$artifacts"; }
trap cleanup EXIT
python3 tools/migration/integration.py > "$artifacts/import.sql"
docker --host=unix:///var/run/docker.sock run -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7 >/dev/null
for attempt in $(seq 1 60); do
  if docker --host=unix:///var/run/docker.sock exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
pg() { docker --host=unix:///var/run/docker.sock exec -i "$name" "$@"; }
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon; CREATE ROLE authenticated;'
pg psql -U postgres -v ON_ERROR_STOP=1 < "$artifacts/import.sql" > "$artifacts/result.log"
# Exercise extraction and reconciliation through the real CLI.
cat > "$artifacts/psql" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host=unix:///var/run/docker.sock exec -i "$STOCK_VERIFY_CONTAINER" psql -U postgres "$@"
WRAPPER
chmod +x "$artifacts/psql"
python3 - <<'PY' > "$artifacts/source.json"
import json,sys
sys.path.insert(0,'tools/migration')
from test_migration import fixture
print(json.dumps(fixture()))
PY
STOCK_VERIFY_CONTAINER="$name" PATH="$artifacts:$PATH" python3 tools/migration/migrate.py database-snapshot --source "$artifacts/source.json" --output "$artifacts/target.json"
python3 tools/migration/migrate.py reconcile "$artifacts/source.json" "$artifacts/target.json"
python3 - <<'PY' > "$artifacts/conflict.sql"
import sys
sys.path.insert(0,'tools/migration')
from test_migration import fixture
from core import import_sql
f=fixture(); f['sheets']['orders']['rows'][0][3]='99.00'
print(import_sql(f))
PY
if pg psql -U postgres -v ON_ERROR_STOP=1 < "$artifacts/conflict.sql" > "$artifacts/conflict.log" 2>&1; then
  echo 'Conflict unexpectedly succeeded' >&2; exit 1
fi
pg psql -U postgres -At -c "SELECT 1 / ((SELECT \"totalPrice\" = 0.10 FROM stock_migration.orders))::int" >/dev/null
pg pg_dump -U postgres -Fc -n stock_migration > "$artifacts/backup.dump"
pg createdb -U postgres restored
pg pg_restore -U postgres -d restored --exit-on-error --single-transaction < "$artifacts/backup.dump"
# Compare full typed records, original cells, snapshots, IDs and audit timestamps after restoration.
python3 - <<'PY' > "$artifacts/fingerprint.sql"
import sys
sys.path.insert(0,'tools/migration')
from core import CATALOG
for t in ['import_batches']+list(CATALOG):
 print(f"SELECT '{t}', md5(coalesce(string_agg(v::text, '' ORDER BY v::text),'')) FROM (SELECT to_jsonb(t) AS v FROM stock_migration.{t} t) s;")
print("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='stock_migration' ORDER BY tablename;")
print("SELECT has_schema_privilege('anon','stock_migration','USAGE'),has_schema_privilege('authenticated','stock_migration','USAGE');")
PY
pg psql -U postgres -At -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/before"
pg psql -U postgres -d restored -At -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/after"
diff -u "$artifacts/before" "$artifacts/after"
echo 'PASS: schema, FK/unique constraints, RLS, repeat import, conflict rollback, backup/restore fingerprints (24 tables)'
