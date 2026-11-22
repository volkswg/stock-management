#!/usr/bin/env bash
# Owns one fresh localhost-only container. No app env files, live records or providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${DOCKER_HOST:-unix:///var/run/docker.sock}" in unix:///*) ;; *) echo 'Local Docker socket required' >&2; exit 1;; esac
name="stock-pooling-$RANDOM-$$"
cleanup(){ docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build -q -t stock-pooling-test:pg17 - < tools/native-postgres/pooling.Dockerfile >/dev/null
docker run -d --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1::5432 -p 127.0.0.1::6543 stock-pooling-test:pg17 >/dev/null
for attempt in $(seq 1 45); do if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec -i "$name" psql -Xq -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE stock_runtime NOLOGIN;
CREATE ROLE stock_test LOGIN NOINHERIT CONNECTION LIMIT 6 PASSWORD 'synthetic-only';
GRANT stock_runtime TO stock_test;
CREATE SCHEMA stock_operational;
CREATE TABLE stock_operational.environment(singleton boolean PRIMARY KEY,isolation_id uuid,purpose text);
INSERT INTO stock_operational.environment VALUES(true,'11111111-2222-4333-8444-555555555555','isolated-staging');
CREATE TABLE stock_operational.commands(actor text,kind text,key text,intent text,state text,response jsonb,completed_at timestamptz,PRIMARY KEY(actor,kind,key));
CREATE TABLE stock_operational.pooling_probe(id text PRIMARY KEY,value integer NOT NULL);
INSERT INTO stock_operational.pooling_probe VALUES('quantity',0);
GRANT USAGE ON SCHEMA stock_operational TO stock_runtime;
GRANT SELECT ON stock_operational.environment TO stock_runtime;
GRANT SELECT,INSERT,UPDATE ON stock_operational.commands,stock_operational.pooling_probe TO stock_runtime;
SQL
docker exec -i "$name" sh -c 'cat > /tmp/transaction.ini' <<'INI'
[databases]
postgres = host=127.0.0.1 port=5432 dbname=postgres
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6543
auth_type = plain
auth_file = /tmp/pooling-users.txt
pool_mode = transaction
default_pool_size = 4
reserve_pool_size = 0
max_db_connections = 4
max_user_connections = 4
max_client_conn = 100
query_wait_timeout = 10
log_connections = 0
log_disconnections = 0
logfile = /tmp/transaction.log
pidfile = /tmp/transaction.pid
INI
docker exec -i "$name" sh -c 'cat > /tmp/pooling-users.txt' <<'USERS'
"stock_test" "synthetic-only"
USERS
docker exec "$name" chown postgres:postgres /tmp/transaction.ini /tmp/pooling-users.txt
docker exec -u postgres "$name" pgbouncer -d /tmp/transaction.ini
for attempt in $(seq 1 15); do if docker exec "$name" pg_isready -h 127.0.0.1 -p 6543 -U stock_test >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec "$name" pg_isready -h 127.0.0.1 -p 6543 -U stock_test >/dev/null
direct=$(docker port "$name" 5432/tcp | cut -d: -f2)
pooled=$(docker port "$name" 6543/tcp | cut -d: -f2)
docker exec "$name" pgbouncer --version
env -i PATH="$PATH" STOCK_POOL_TEST_DIRECT_PORT="$direct" STOCK_POOL_TEST_TRANSACTION_PORT="$pooled" node --test tools/native-postgres/connection-pooling.test.cjs
