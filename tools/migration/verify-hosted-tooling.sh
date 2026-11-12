#!/usr/bin/env bash
# New disposable local PostgreSQL only. Never uses existing databases or cloud credentials.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."
root=$PWD
host=${STOCK_HA_LOCAL_DOCKER_HOST:-unix:///var/run/docker.sock}
name="stock-ha-tooling-$$"
containerId=
if [ -n "${STOCK_HA_PRIVATE_EVIDENCE_DIR:-}" ]; then test ! -e "$STOCK_HA_PRIVATE_EVIDENCE_DIR"; fi
artifacts=$(python3 -c 'import os,tempfile; print(os.path.realpath(tempfile.mkdtemp()))')
mkdir "$artifacts/docker-client"
printf '{"auths":{}}\n' > "$artifacts/docker-client/config.json"
export DOCKER_CONFIG="$artifacts/docker-client"
cleanup(){ if [ -n "$containerId" ]; then docker --host="$host" rm -fv "$containerId" >/dev/null 2>&1 || true; fi; if [ -n "${STOCK_HA_PRIVATE_EVIDENCE_DIR:-}" ]; then mkdir -p "$STOCK_HA_PRIVATE_EVIDENCE_DIR"; cp -R "$artifacts/." "$STOCK_HA_PRIVATE_EVIDENCE_DIR/"; fi; rm -rf "$artifacts"; }
trap cleanup EXIT
containerId=$(docker --host="$host" run -d --name "$name" --memory=1g --cpus=1 -p 127.0.0.1::5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.7)
pg(){ docker --host="$host" exec -i "$containerId" "$@"; }
for attempt in $(seq 1 60); do if pg pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -keyout "$artifacts/key" -out "$artifacts/cert" -subj /CN=localhost -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:db.abcdefghijklmnopqrst.supabase.co' > "$artifacts/tls.log" 2>&1
docker --host="$host" cp "$artifacts/cert" "$containerId:/tmp/ha-cert" >/dev/null
docker --host="$host" cp "$artifacts/key" "$containerId:/tmp/ha-key" >/dev/null
pg chown postgres:postgres /tmp/ha-key /tmp/ha-cert
pg chmod 600 /tmp/ha-key
pg psql -U postgres -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET ssl_cert_file='/tmp/ha-cert'" > "$artifacts/setup.log"
pg psql -U postgres -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET ssl_key_file='/tmp/ha-key'" >> "$artifacts/setup.log"
pg psql -U postgres -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET ssl=on" >> "$artifacts/setup.log"
pg psql -U postgres -v ON_ERROR_STOP=1 -c 'SELECT pg_reload_conf();' >> "$artifacts/setup.log"
test "$(pg psql -U postgres -At -c 'SHOW ssl')" = on
pg createdb -U postgres ha_synthetic_app
pg psql -U postgres -d ha_synthetic_app -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon; CREATE ROLE authenticated;' >> "$artifacts/setup.log"
for file in supabase/migrations/*.sql; do pg psql -U postgres -d ha_synthetic_app -v ON_ERROR_STOP=1 < "$file" >> "$artifacts/setup.log"; done
pg psql -U postgres -d ha_synthetic_app -v ON_ERROR_STOP=1 -c "CREATE ROLE ha_runtime LOGIN PASSWORD 'WT_synthetic_only' CONNECTION LIMIT 6 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; GRANT stock_runtime TO ha_runtime;" >> "$artifacts/setup.log"
pg psql -U postgres -d ha_synthetic_app -v ON_ERROR_STOP=1 >> "$artifacts/setup.log" <<'READONLY_FIXTURE'
CREATE ROLE ha_readonly LOGIN PASSWORD 'WT_readonly_only' CONNECTION LIMIT 6 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA stock_operational TO ha_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational TO ha_readonly;
DO $$ DECLARE item record; BEGIN
FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock_operational' AND c.relrowsecurity LOOP
EXECUTE format('CREATE POLICY ha_synthetic_readonly ON stock_operational.%I FOR SELECT TO ha_readonly USING (true)',item.relname);
END LOOP; END $$;
READONLY_FIXTURE
port=$(docker --host="$host" port "$containerId" 5432/tcp | sed 's/.*://')
build="$artifacts/app"
node tools/migration/hosted-write/build-app.cjs "$root" "$build" > "$artifacts/build-attestation.json"
env -i PATH="$PATH" HOME="$HOME" NODE_PATH="${NODE_PATH:-}" STOCK_PLAYWRIGHT_MODULE="${STOCK_PLAYWRIGHT_MODULE:-playwright}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/google-chrome}" STOCK_HA_SMOKE_DIRECTORY="$artifacts" STOCK_HA_TEST_BUILD="$build" STOCK_HA_SYNTHETIC_DATABASE_URL="postgresql://ha_runtime:WT_synthetic_only@127.0.0.1:$port/ha_synthetic_app" node tools/migration/hosted-write/application-smoke.cjs
# Generated-state checkpoint, restored to a new local database, complete existing recovery oracle.
pg pg_dump -U postgres -d ha_synthetic_app -Fc -n stock_migration -n stock_operational > "$artifacts/application.dump"
pg createdb -U postgres ha_synthetic_restore
pg pg_restore -U postgres -d ha_synthetic_restore --single-transaction --exit-on-error < "$artifacts/application.dump"
for tool in psql pg_dump pg_restore; do
 cat > "$artifacts/$tool" <<'WRAPPER'
#!/usr/bin/env bash
exec docker --host="$STOCK_HA_WRAPPER_HOST" exec -i "$STOCK_HA_WRAPPER_CONTAINER" "$(basename "$0")" -U postgres -d "$STOCK_HA_WRAPPER_DATABASE" "$@"
WRAPPER
 chmod +x "$artifacts/$tool"
done
identity=$(pg psql -U postgres -d ha_synthetic_app -At -c 'SELECT isolation_id FROM stock_operational.environment')
export STOCK_HA_WRAPPER_HOST="$host" STOCK_HA_WRAPPER_CONTAINER="$containerId" PGSERVICE=stock_ha_synthetic_only
STOCK_HA_WRAPPER_DATABASE=ha_synthetic_app PATH="$artifacts:$PATH" python3 tools/migration/recovery.py capture --directory "$artifacts/recovery" --target-id "$identity" --workers 2 --row-digests
# Restore the capture itself, rather than substituting the earlier convenience dump.
pg createdb -U postgres ha_synthetic_checkpoint
pg pg_restore -U postgres -d ha_synthetic_checkpoint --single-transaction --exit-on-error < "$artifacts/recovery/database.dump"
STOCK_HA_WRAPPER_DATABASE=ha_synthetic_checkpoint PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/recovery" --target-id "$identity" --workers 2 --row-digests --output "$artifacts/recovery-verified.json"
env -i PATH="$PATH" HOME="$HOME" STOCK_HA_SMOKE_DIRECTORY="$artifacts" STOCK_HA_TEST_BUILD="$build" STOCK_HA_SYNTHETIC_DATABASE_URL="postgresql://ha_readonly:WT_readonly_only@127.0.0.1:$port/ha_synthetic_checkpoint" node tools/migration/hosted-write/recovery-smoke.cjs
STOCK_HA_WRAPPER_DATABASE=ha_synthetic_checkpoint PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/recovery" --target-id "$identity" --workers 2 --row-digests --output "$artifacts/recovery-after-app.json"
# The new production profile is exercised only against this new container's empty default database.
pg pg_restore -U postgres -d postgres --single-transaction --exit-on-error < "$artifacts/recovery/database.dump"
pg psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE stock_prod_runtime LOGIN PASSWORD 'WT_production_fixture_only' CONNECTION LIMIT 6 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; GRANT stock_runtime TO stock_prod_runtime; UPDATE stock_operational.environment SET purpose='production';" >> "$artifacts/setup.log"
pg psql -U postgres -d postgres -v ON_ERROR_STOP=1 >> "$artifacts/setup.log" <<'PRODUCTION_READER_FIXTURE'
CREATE ROLE stock_prod_reader LOGIN PASSWORD 'WT_reader_fixture_only' CONNECTION LIMIT 6 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA stock_operational TO stock_prod_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational TO stock_prod_reader;
DO $$ DECLARE item record; BEGIN
FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock_operational' AND c.relrowsecurity LOOP
EXECUTE format('CREATE POLICY production_fixture_reader ON stock_operational.%I FOR SELECT TO stock_prod_reader USING (true)',item.relname);
END LOOP; END $$;
PRODUCTION_READER_FIXTURE
env -i PATH="$PATH" STOCK_PRODUCTION_FIXTURE_PORT="$port" STOCK_PRODUCTION_FIXTURE_CA_FILE="$artifacts/cert" node --test tools/migration/production-release-postgres.test.cjs
# The same capture/restore tools now require explicit production purpose and retain it in the receipt.
STOCK_HA_WRAPPER_DATABASE=postgres PATH="$artifacts:$PATH" python3 tools/migration/recovery.py capture --directory "$artifacts/production-recovery" --target-id "$identity" --target-purpose production --workers 2 --row-digests
pg createdb -U postgres ha_synthetic_production_restore
pg pg_restore -U postgres -d ha_synthetic_production_restore --single-transaction --exit-on-error < "$artifacts/production-recovery/database.dump"
STOCK_HA_WRAPPER_DATABASE=ha_synthetic_production_restore PATH="$artifacts:$PATH" python3 tools/migration/recovery.py verify --directory "$artifacts/production-recovery" --target-id "$identity" --target-purpose production --workers 2 --row-digests --output "$artifacts/production-recovery-result.json"
if [ -n "${STOCK_HA_EVIDENCE_DIR:-}" ]; then cp "$artifacts/production-recovery-result.json" "$STOCK_HA_EVIDENCE_DIR/production-profile-recovery.json"; cp "$artifacts/smoke-result.json" "$STOCK_HA_EVIDENCE_DIR/hosted-private-app-smoke.json"; cp "$artifacts/build-attestation.json" "$STOCK_HA_EVIDENCE_DIR/hosted-private-build.json"; cp "$artifacts/recovery-app-result.json" "$STOCK_HA_EVIDENCE_DIR/hosted-recovery-app.json"; fi
echo 'PASS: hosted tooling private app, browser, durable fake outcomes, TLS, SQL faults, process crash and generated-checkpoint recovery; hosted execution NOT RUN'
