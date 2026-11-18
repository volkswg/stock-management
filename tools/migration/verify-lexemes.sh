#!/usr/bin/env bash
# Fresh synthetic local databases only. No credentials, snapshots or providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
lexeme_bootstrap=$(mktemp "${TMPDIR:-/tmp}/stock-lexeme-bootstrap.XXXXXX")
python3 - <<'PY' > "$lexeme_bootstrap"
from pathlib import Path
s=Path('tools/migration/verify-cell-kinds-final.sh').read_text()
print(s.split('for database in cf_base')[0])
PY
source "$lexeme_bootstrap"
rm "$lexeme_bootstrap"
# Build exactly the released kindless predecessor, then the additive candidate.
final_sql ck_base | pg psql -U postgres -d ck_base -v ON_ERROR_STOP=1 > "$artifacts/lexeme-predecessor.log"
for database in lx_retained lx_unprepared lx_bad; do pg createdb -U postgres -T ck_base "$database"; done
lexeme_sql=tools/migration/compatibility/20261118022702_lexeme_compatibility.sql
install_lexemes(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_lexeme_compatibility='reviewed-typed-columns-v1';"; cat "$lexeme_sql"; }
if pg psql -U postgres -d lx_retained -v ON_ERROR_STOP=1 < "$lexeme_sql" > "$artifacts/lexeme-no-approval.log" 2>&1; then exit 1; fi
if { install_lexemes lx_retained | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d lx_retained -v ON_ERROR_STOP=1 > "$artifacts/lexeme-wrong-target.log" 2>&1; then exit 1; fi
pg psql -U postgres -d lx_bad -v ON_ERROR_STOP=1 > "$artifacts/lexeme-drift-fixture.log" <<'SQL'
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('stock_operational.column_input_orders(jsonb)'::regprocedure),'DECLARE r','DECLARE /* drift */ r'); END $$;
SQL
if install_lexemes lx_bad | pg psql -U postgres -d lx_bad -v ON_ERROR_STOP=1 > "$artifacts/lexeme-drift-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d lx_retained -v ON_ERROR_STOP=1 -c "CREATE ROLE lexeme_reader; GRANT USAGE ON SCHEMA stock_operational TO lexeme_reader; GRANT SELECT ON stock_operational.orders TO lexeme_reader; GRANT EXECUTE ON FUNCTION stock_operational.column_project_orders(stock_operational.orders) TO lexeme_reader;" > "$artifacts/lexeme-reader.log"
pg psql -U postgres -d lx_retained -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/lexemes-before.jsonl"
install_lexemes lx_retained | pg psql -U postgres -d lx_retained -v ON_ERROR_STOP=1 > "$artifacts/lexeme-install.log"
pg psql -U postgres -d lx_retained -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/lexemes-after.jsonl"
python3 tools/migration/lexemes-proof.py "$artifacts"
pg psql -U postgres -d lx_retained -v ON_ERROR_STOP=1 -c "SET ROLE lexeme_reader; SELECT stock_operational.lexeme_mapping_contract_v1(); SELECT stock_operational.typed_project_orders(t) FROM stock_operational.orders t LIMIT 1; SELECT 1 / (NOT has_function_privilege('lexeme_reader','stock_operational.typed_input_orders(jsonb)','EXECUTE'))::int;" > "$artifacts/lexeme-reader-after.log"
for database in lx_typed lx_hot lx_partial lx_incomplete lx_operational lx_native lx_browser; do pg createdb -U postgres -T lx_retained "$database"; done
pg psql -U postgres -d lx_partial -v ON_ERROR_STOP=1 -c 'ALTER TABLE stock_operational.revision ADD COLUMN synthetic__lexeme text;' > "$artifacts/lexeme-partial.log"
# Removing columns alone is not a complete candidate migration: retained
# validators still require them. The old v1 mapper would also reject this state.
python3 - <<'PY_INCOMPLETE' > "$artifacts/incomplete-columns.sql"
import runpy
m=runpy.run_path('tools/migration/lexemes.py')
for table,spec in m['POLICY']['tables'].items():
 for f in spec['fields']:
  if f['lexeme']:print(f'ALTER TABLE stock_operational.{table} DROP COLUMN "{f["lexeme"]}" RESTRICT;')
PY_INCOMPLETE
pg psql -U postgres -d lx_incomplete -v ON_ERROR_STOP=1 < "$artifacts/incomplete-columns.sql" > "$artifacts/incomplete-columns.log"
python3 tools/migration/lexemes.py --local-typed-fixture > "$artifacts/local-typed-fixture.sql"
for database in lx_typed lx_operational lx_native lx_browser; do
 { echo "SET stock.local_lexeme_fixture='synthetic-only';"; cat "$artifacts/local-typed-fixture.sql"; } | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/lexeme-local-$database.log"
done
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_lx(){ local database=$1; shift; env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_LX_CASE="$database" STOCK_LX_CONTAINER="$name" STOCK_LX_FIXTURE="$artifacts/local-typed-fixture.sql" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$(identity "$database")" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_lx lx_retained tools/migration/lexemes.test.cjs
run_lx lx_partial tools/migration/lexemes.test.cjs
run_lx lx_incomplete tools/migration/lexemes.test.cjs
run_lx lx_typed tools/migration/lexemes.test.cjs
run_lx lx_hot tools/migration/lexemes.test.cjs
run_lx lx_operational tools/migration/operational.test.cjs
run_lx lx_native tools/migration/native-timestamps.test.cjs
run_lx lx_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: additive lexeme compatibility;48columns retained in release artifact; typed-only synthetic component, pool transition and actual app/LINE/browser acceptance; no hosted access'
