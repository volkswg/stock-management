#!/usr/bin/env bash
# Fresh disposable local cluster only; no hosted configuration or credentials.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."
host=${STOCK_HA_LOCAL_DOCKER_HOST:-unix:///var/run/docker.sock}
artifacts=$(mktemp -d)
containerId=
cleanup(){ if [ -n "$containerId" ]; then docker --host="$host" rm -fv "$containerId" >/dev/null 2>&1 || true; fi; rm -rf "$artifacts"; }
trap cleanup EXIT
mkdir "$artifacts/docker-client"
printf '{"auths":{}}\n' > "$artifacts/docker-client/config.json"
export DOCKER_CONFIG="$artifacts/docker-client"
containerId=$(docker --host="$host" run -d --memory=1g --cpus=1 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7)
pg(){ docker --host="$host" exec -i "$containerId" "$@"; }
for attempt in $(seq 1 60); do if pg pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon; CREATE ROLE authenticated;' > "$artifacts/setup.log"
for file in supabase/migrations/*.sql; do pg psql -U postgres -v ON_ERROR_STOP=1 < "$file" >> "$artifacts/setup.log"; done
pg psql -U postgres -v ON_ERROR_STOP=1 >> "$artifacts/setup.log" <<'FIXTURE'
INSERT INTO stock_operational.orders(business_cells) VALUES ('["WT_BACKUP_READER","draft","WT",12.34,"","2026-01-01","2026-01-01","","WT"]');
CREATE ROLE ha_backup LOGIN CONNECTION LIMIT 2 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA stock_migration,stock_operational TO ha_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA stock_migration,stock_operational TO ha_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA stock_migration,stock_operational TO ha_backup;
DO $$ DECLARE t record; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_migration','stock_operational') LOOP
EXECUTE format('CREATE POLICY backup_full_read ON %I.%I FOR SELECT TO ha_backup USING (true)',t.schemaname,t.tablename);
END LOOP; END $$;
FIXTURE
for tool in psql pg_dump pg_restore; do
 cat > "$artifacts/$tool" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host="$STOCK_READER_TEST_HOST" exec -i "$STOCK_READER_TEST_CONTAINER" "$(basename "$0")" -U ha_backup -d "$STOCK_READER_TEST_DATABASE" "$@"
WRAPPER
 chmod +x "$artifacts/$tool"
done
identity=$(pg psql -U postgres -At -c 'SELECT isolation_id FROM stock_operational.environment')
export STOCK_READER_TEST_HOST="$host" STOCK_READER_TEST_CONTAINER="$containerId" STOCK_READER_TEST_DATABASE=postgres PGSERVICE=synthetic_restricted_backup_only
export PATH="$artifacts:$PATH"
# The owner-style default still refuses an RLS-constrained login.
if python3 tools/migration/recovery.py capture --directory "$artifacts/default" --target-id "$identity" --row-digests > "$artifacts/default.log" 2>&1; then exit 1; fi
test -f "$artifacts/default/database.dump"
python3 tools/migration/recovery.py capture --directory "$artifacts/approved" --target-id "$identity" --row-digests --row-security-reader
pg createdb -U postgres reader_restore
pg pg_restore -U postgres -d reader_restore --single-transaction --exit-on-error < "$artifacts/approved/database.dump"
STOCK_READER_TEST_DATABASE=reader_restore python3 tools/migration/recovery.py verify --directory "$artifacts/approved" --target-id "$identity" --row-digests --output "$artifacts/result.json"
python3 - "$artifacts" <<'PROOF'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);r=json.loads((p/'approved/receipt.json').read_text());f=json.loads((p/'approved/fingerprint.json').read_text())
assert r['fullRowSecurityReaderVerified'] is True
assert len([x for x in f if 'table' in x])==51 and len([x for x in f if 'metadata' in x])==15
assert next(x for x in f if x.get('table')=='stock_operational.orders')['rows']==1
assert json.loads((p/'result.json').read_text())['match'] is True
PROOF
# A restrictive policy or missing table SELECT must fail before creating a dump.
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE POLICY filtered_backup ON stock_operational.orders AS RESTRICTIVE FOR SELECT TO ha_backup USING (false);' >> "$artifacts/setup.log"
if python3 tools/migration/recovery.py capture --directory "$artifacts/filtered" --target-id "$identity" --row-digests --row-security-reader > "$artifacts/filtered.log" 2>&1; then exit 1; fi
test ! -f "$artifacts/filtered/database.dump"
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'DROP POLICY filtered_backup ON stock_operational.orders; REVOKE SELECT ON stock_operational.shops FROM ha_backup;' >> "$artifacts/setup.log"
if python3 tools/migration/recovery.py capture --directory "$artifacts/missing" --target-id "$identity" --row-digests --row-security-reader > "$artifacts/missing.log" 2>&1; then exit 1; fi
test ! -f "$artifacts/missing/database.dump"
echo 'PASS: two-connection nonprivileged backup captures/restores all 51 tables and 15 metadata sections; filtered or missing access fails closed; default unchanged'
