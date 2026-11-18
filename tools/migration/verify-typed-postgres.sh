#!/usr/bin/env bash
# Current source only, actual released final schema and reviewed cleanup SQL.
set -euo pipefail
cd "$(dirname "$0")/../.."
typed_bootstrap=$(mktemp "${TMPDIR:-/tmp}/stock-typed-bootstrap.XXXXXX")
python3 - <<'PY' > "$typed_bootstrap"
from pathlib import Path
print(Path('tools/migration/verify-lexemes-final.sh').read_text().split('for database in lf_guard')[0])
PY
source "$typed_bootstrap"
rm "$typed_bootstrap"
pg createdb -U postgres -T lx_retained tc_retained
pg createdb -U postgres -T lx_retained tc_base
lexeme_final_sql tc_base | pg psql -U postgres -d tc_base -v ON_ERROR_STOP=1 > "$artifacts/typed-final-schema.log"
cleanup_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_legacy_mapper_cleanup='reviewed-typed-only-v1'; SET stock.mapper_reviewed_revision='$(revision "$1")'; SET stock.mapper_reviewed_source='1111111111111111111111111111111111111111'; SET stock.mapper_reviewed_fingerprint='$(printf '%064d' 0)'; SET stock.mapper_restore_verified='51-tables-15-metadata-v1'; SET stock.mapper_semantics_verified='exact-app-line-consumers-v1';"; cat tools/migration/final-removal/20261118082624_retire_legacy_mappers.sql; }
for database in tc_guard tc_operational tc_native tc_browser tc_focused; do pg createdb -U postgres -T tc_base "$database"; done
if pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 < tools/migration/final-removal/20261118082624_retire_legacy_mappers.sql > "$artifacts/typed-unapproved.log" 2>&1; then exit 1; fi
if { cleanup_sql tc_guard | sed "s/SET stock.mapper_reviewed_revision='[0-9]*'/SET stock.mapper_reviewed_revision='-1'/"; } | pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 > "$artifacts/typed-stale.log" 2>&1; then exit 1; fi
pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 > "$artifacts/typed-dependency-fixture.log" <<'SQL'
CREATE FUNCTION public.tc_consumer() RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN RETURN stock_operational.COLUMN_INPUT_ORDERS('[]'::jsonb)::jsonb; END$$;
SQL
if cleanup_sql tc_guard | pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 > "$artifacts/typed-procedure-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 -c 'DROP FUNCTION public.tc_consumer();' > "$artifacts/typed-dependency-cleanup.log"
pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 -c 'CREATE VIEW public.tc_view AS SELECT stock_operational.project_orders(t) FROM stock_operational.orders t;' > "$artifacts/typed-view-fixture.log"
if cleanup_sql tc_guard | pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 > "$artifacts/typed-view-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d tc_guard -v ON_ERROR_STOP=1 -c "SELECT 1/(to_regclass('public.tc_view') IS NOT NULL AND position('stock_operational.project_orders(' in (SELECT prosrc FROM pg_proc WHERE oid='stock_operational.validate_orders()'::regprocedure))>0)::int; DROP VIEW public.tc_view;" > "$artifacts/typed-view-rollback.log"

pg psql -U postgres -d tc_base -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/typed-before.jsonl"
cleanup_sql tc_base | pg psql -U postgres -d tc_base -v ON_ERROR_STOP=1 > "$artifacts/typed-cleanup.log"
pg psql -U postgres -d tc_base -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/typed-after.jsonl"
python3 tools/migration/typed-cleanup-proof.py "$artifacts"
pg psql -U postgres -d tc_base -v ON_ERROR_STOP=1 -c "SET ROLE lexeme_reader; SELECT stock_operational.lexeme_mapping_contract_v1(); SELECT stock_operational.typed_project_orders(t) FROM stock_operational.orders t LIMIT 1; SELECT 1/(NOT has_function_privilege('lexeme_reader','stock_operational.typed_input_orders(jsonb)','EXECUTE'))::int;" > "$artifacts/typed-reader-scope.log"

for database in tc_operational tc_native tc_browser tc_focused; do cleanup_sql "$database" | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/typed-cleanup-$database.log"; done
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_tc(){ local database=$1; shift; env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/google-chrome}" STOCK_TARGET_ISOLATION_ID="$(identity "$database")" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_tc tc_retained tools/migration/typed-postgres.test.cjs
run_tc tc_focused tools/migration/typed-postgres.test.cjs
run_tc tc_operational tools/migration/operational.test.cjs
run_tc tc_native tools/migration/native-timestamps.test.cjs
run_tc tc_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: current typed-only adapter;116 legacy functions retired;51tables/15metadata exact;operational,timestamp and actual browser acceptance'
