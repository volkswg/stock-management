#!/usr/bin/env bash
# Fresh synthetic localhost database ONLY. Uses no application env/credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${DOCKER_HOST:-unix:///var/run/docker.sock}" in unix:///*) ;; *) echo 'Local Docker socket required' >&2; exit 1;; esac
name="stock-accounts-$RANDOM-$$"; artifacts=$(mktemp -d)
cleanup(){ docker rm -fv "$name" >/dev/null 2>&1 || true; rm -rf "$artifacts"; }
trap cleanup EXIT
docker run -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1::5432 postgres:17.7 >/dev/null
for attempt in $(seq 1 45); do if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1;then break;fi;sleep 1;done
pg(){ docker exec -i "$name" psql -X -q -U postgres -v ON_ERROR_STOP=1 "$@"; }
pg <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE stock_runtime;
CREATE ROLE stock_test LOGIN NOINHERIT PASSWORD 'synthetic-only'; GRANT stock_runtime TO stock_test;
CREATE ROLE stock_prod_reader LOGIN NOINHERIT PASSWORD 'synthetic-only';
CREATE ROLE stock_prod_backup LOGIN NOINHERIT PASSWORD 'synthetic-only';
CREATE SCHEMA stock_operational;
CREATE TABLE stock_operational.environment (singleton boolean PRIMARY KEY, isolation_id uuid, purpose text);
INSERT INTO stock_operational.environment VALUES(true,'11111111-1111-4111-8111-111111111111','isolated-staging');
CREATE TABLE stock_operational.revision (singleton boolean PRIMARY KEY,value bigint);INSERT INTO stock_operational.revision VALUES(true,0);
GRANT USAGE ON SCHEMA stock_operational TO stock_runtime,stock_prod_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational TO stock_runtime,stock_prod_reader;
SQL
pg < supabase/migrations/20261119082351_private_loyverse_accounts.sql
# Real operator CLI, restricted private input, private PGSERVICE and local psql wrapper.
python3 - "$artifacts" <<'PY'
from pathlib import Path
import json,sys,os
p=Path(sys.argv[1]);os.umask(0o077)
(p/'input.json').write_text(json.dumps({'headers':['id','shopName','storeId','accessToken','active','sortOrder'],'rows':[['second','Second','','synthetic-second',True,20],['off','Old','','',False,30],['first','First','store-1','synthetic-first',True,10]]}))
(p/'service.conf').write_text('[synthetic]\nhost=127.0.0.1\nport=5432\ndbname=postgres\nuser=postgres\nsslmode=disable\n')
PY
cat > "$artifacts/psql" <<WRAPPER
#!/usr/bin/env bash
exec docker --host="${DOCKER_HOST:-unix:///var/run/docker.sock}" exec -i "$name" psql -U postgres "\$@"
WRAPPER
chmod +x "$artifacts/psql"
import_account(){ env -i PATH="$artifacts:$PATH" PGSERVICEFILE="$artifacts/service.conf" PGSERVICE=synthetic python3 tools/migration/loyverse-accounts.py --input "$artifacts/input.json" --apply-empty --approved --project-ref aaaaaaaaaaaaaaaaaaaa --isolation-id "$1" --purpose isolated-staging --allow-local; }
if import_account 22222222-2222-4222-8222-222222222222 > "$artifacts/wrong-target.log" 2>&1;then echo 'Wrong target accepted' >&2;exit 1;fi
pg -Atc 'SELECT 1/(count(*)=0)::int FROM stock_configuration.loyverse_accounts;' >/dev/null
import_account 11111111-1111-4111-8111-111111111111
if import_account 11111111-1111-4111-8111-111111111111 > "$artifacts/repeat.log" 2>&1;then echo 'Populated import accepted' >&2;exit 1;fi
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
env -i PATH="$PATH" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_TARGET_ISOLATION_ID=11111111-1111-4111-8111-111111111111 STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/postgres" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters LOYVERSE_ACCOUNT_SOURCE=postgres node --test tools/native-postgres/accounts.test.cjs
docker exec "$name" pg_dump -U postgres -Fc -n stock_configuration > "$artifacts/configuration.dump"
docker exec "$name" createdb -U postgres restored
docker exec -i "$name" pg_restore -U postgres -d restored --exit-on-error --single-transaction < "$artifacts/configuration.dump"
fingerprint='SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,$$[]$$)) FROM stock_configuration.loyverse_accounts t; SELECT rowsecurity FROM pg_tables WHERE schemaname=$$stock_configuration$$; SELECT attname,has_column_privilege($$stock_prod_reader$$,attrelid,attname,$$SELECT$$) FROM pg_attribute WHERE attrelid=$$stock_configuration.loyverse_accounts$$::regclass AND attnum>0 ORDER BY attnum;'
pg -Atc "$fingerprint" > "$artifacts/source-fingerprint"
pg -d restored -Atc "$fingerprint" > "$artifacts/restored-fingerprint"
diff -u "$artifacts/source-fingerprint" "$artifacts/restored-fingerprint"
echo 'PASS: private account schema, real importer, reader, role permissions, constraints, metadata APIs and provider stubs'
echo 'PASS: configuration-only dump/restore preserves records, timestamps, RLS and reader column permissions'
