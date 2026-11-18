#!/usr/bin/env bash
# Actual operator SQL, only on fresh synthetic local databases. No providers.
set -euo pipefail
cd "$(dirname "$0")/../.."
lexeme_final_bootstrap=$(mktemp "${TMPDIR:-/tmp}/stock-lexeme-final.XXXXXX")
python3 - <<'PY' > "$lexeme_final_bootstrap"
from pathlib import Path
print(Path('tools/migration/verify-lexemes.sh').read_text().split('for database in lx_typed')[0])
PY
source "$lexeme_final_bootstrap"
rm "$lexeme_final_bootstrap"
final_lexeme_script=tools/migration/final-removal/20261118040625_remove_lexemes.sql
lexeme_final_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_final_lexeme_removal='reviewed-typed-retirement-v1'; SET stock.lexeme_reviewed_revision='$(revision "$1")'; SET stock.lexeme_reviewed_source='1111111111111111111111111111111111111111'; SET stock.lexeme_reviewed_fingerprint='$(printf '%064d' 0)'; SET stock.lexeme_restore_verified='51-tables-15-metadata-v1'; SET stock.lexeme_semantics_verified='exact-app-line-consumers-v1';"; cat "$final_lexeme_script"; }
refuse(){ local database=$1 label=$2; if lexeme_final_sql "$database" | pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-$label.log" 2>&1; then echo "Unexpected retirement success: $label" >&2; exit 1; fi; pg psql -U postgres -d "$database" -XqAt -v ON_ERROR_STOP=1 -c "SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;" > "$artifacts/lexeme-final-$label-rollback.log"; }
for database in lf_guard lf_bool lf_context lf_race lf_values lf_hot; do pg createdb -U postgres -T lx_retained "$database"; done
if pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 < "$final_lexeme_script" > "$artifacts/lexeme-final-no-approval.log" 2>&1; then exit 1; fi
if { lexeme_final_sql lf_guard | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-wrong-target.log" 2>&1; then exit 1; fi
if { lexeme_final_sql lf_guard | sed "s/SET stock.lexeme_reviewed_revision='[0-9]*'/SET stock.lexeme_reviewed_revision='-1'/"; } | pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-stale.log" 2>&1; then exit 1; fi
pg psql -U postgres -d lf_guard -XqAt -v ON_ERROR_STOP=1 -c "SELECT pg_get_functiondef('stock_operational.column_input_orders(jsonb)'::regprocedure)" > "$artifacts/lexeme-final-original-function.sql"
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-drift-fixture.log" <<'SQL'
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('stock_operational.column_input_orders(jsonb)'::regprocedure),'DECLARE r','DECLARE /* unreviewed drift */ r'); END $$;
SQL
refuse lf_guard predecessor-drift
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 < "$artifacts/lexeme-final-original-function.sql" > "$artifacts/lexeme-final-function-restored.log"
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 -c 'GRANT SELECT ("totalPrice__lexeme") ON stock_operational.orders TO lexeme_reader;' > "$artifacts/lexeme-final-column-grant.log"
refuse lf_guard column-grant
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 -c 'REVOKE SELECT ("totalPrice__lexeme") ON stock_operational.orders FROM lexeme_reader;' > "$artifacts/lexeme-final-column-revoked.log"
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 -c 'CREATE INDEX lf_dependency ON stock_operational.orders((length("totalPrice__lexeme")));' > "$artifacts/lexeme-final-index-fixture.log"
refuse lf_guard index-dependency
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 -c "SELECT 1/(to_regclass('stock_operational.lf_dependency') IS NOT NULL)::int; DROP INDEX stock_operational.lf_dependency; CREATE VIEW public.lf_view AS SELECT \"totalPrice__lexeme\" FROM stock_operational.orders;" > "$artifacts/lexeme-final-index-preserved.log"
refuse lf_guard view-dependency
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-procedure-fixture.log" <<'SQL'
DROP VIEW public.lf_view;
CREATE FUNCTION public.lf_consumer() RETURNS text LANGUAGE plpgsql AS $$ BEGIN RETURN (SELECT "totalPrice__lexeme" FROM stock_operational.orders LIMIT 1); END $$;
SQL
refuse lf_guard public-procedure
pg psql -U postgres -d lf_guard -v ON_ERROR_STOP=1 -c 'DROP FUNCTION public.lf_consumer();' > "$artifacts/lexeme-final-procedure-cleanup.log"
pg psql -U postgres -d lf_bool -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-bool-fixture.log" <<'SQL'
INSERT INTO stock_operational.movements(id) VALUES('LF_AMBIGUOUS_MASTER');
INSERT INTO stock_operational.movement_details(id,"movementMasterId","stockCounted","stockCounted__lexeme") VALUES('LF_AMBIGUOUS','LF_AMBIGUOUS_MASTER',true,'1');
UPDATE stock_operational.movement_details SET archived_at=now() WHERE id='LF_AMBIGUOUS';
SQL
refuse lf_bool archived-boolean-meaning
pg psql -U postgres -d lf_context -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-context-fixture.log" <<'SQL'
INSERT INTO stock_operational.user_state(id,"userId",flowname,state,context,"context__lexeme") VALUES('99001','synthetic','MovementCreate','complete',NULL,'null');
UPDATE stock_operational.user_state SET archived_at=now() WHERE id='99001';
SQL
refuse lf_context archived-context-null
# A writer commits while DDL waits; the seal must be reread under READ COMMITTED.
mkfifo "$artifacts/lexeme-final-writer-input"
pg psql -U postgres -d lf_race -XqAt -v ON_ERROR_STOP=1 < "$artifacts/lexeme-final-writer-input" > "$artifacts/lexeme-final-writer-output" 2> "$artifacts/lexeme-final-writer-error" & writer_pid=$!
exec 3> "$artifacts/lexeme-final-writer-input"
printf '%s\n' 'BEGIN;' 'SELECT pg_advisory_xact_lock(835107241);' '\echo LF_WRITER_READY' >&3
for attempt in $(seq 1 40); do if [[ $(< "$artifacts/lexeme-final-writer-output") == *LF_WRITER_READY* ]]; then break; fi; sleep .1; done
[[ $(< "$artifacts/lexeme-final-writer-output") == *LF_WRITER_READY* ]]
{ echo "SET application_name='LF_LOCK_RACE'; SET default_transaction_isolation='repeatable read';"; lexeme_final_sql lf_race; } | pg psql -U postgres -d lf_race -XqAt -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-race-refused.log" 2>&1 & ddl_pid=$!
blocked=false
for attempt in $(seq 1 12); do if [[ $(pg psql -U postgres -d lf_race -XqAt -c "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE application_name='LF_LOCK_RACE' AND wait_event='advisory')") == t ]]; then blocked=true; break; fi; sleep .1; done
test "$blocked" = true
printf '%s\n' 'UPDATE stock_operational.revision SET value=value+1 WHERE singleton;' 'COMMIT;' '\q' >&3
exec 3>&-
wait "$writer_pid"
if wait "$ddl_pid"; then echo 'Stale review survived writer race' >&2; exit 1; fi
pg psql -U postgres -d lf_race -At -c "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='retained')::int;" > "$artifacts/lexeme-final-race-rollback.log"
echo 'PASS: missing/wrong/stale review, predecessor drift, column grants, index/view/procedural dependencies, archived boolean/context ambiguity and real writer-race refuse atomically'
python3 - <<'PY' > "$artifacts/lexeme-final-seed.sql"
import json,runpy
m=runpy.run_path('tools/migration/lexemes-final.py');now='2026-11-18T00:00:00.123456Z'
seeds={
 'orders':{'id':'LF_ORDER','status':'waiting_for_total_price','seller':'Synthetic','totalPrice':'9007199254740993.0100','remark':'retained','createdAt':now,'createdBy':'synthetic'},
 'movements':{'id':'LF_MASTER','userId':'synthetic','packingDate':'2026-11-18','status':'created','totalQuantity':'1','createdAt':now},
 'movement_details':{'id':'LF_ITEM','movementMasterId':'LF_MASTER','shopName':'Synthetic','quantity':'1','status':'created','createdAt':now,'stockCounted':True,'isNewArrival':False},
 'user_state':{'id':'99001','userId':'synthetic','flowname':'OrderCreate','referenceId':'LF_ORDER','state':'waiting_for_bill_image','createdAt':now,'context':' { "last" : "synthetic", "array" : [1,true] } '},
 'sales_receipts':{'id':'LF_RECEIPT','salesDate':'2026-11-18','accountId':'synthetic','receiptType':'SALE','syncedAt':now},
 'sales_receipt_payments':{'id':'LF_PAYMENT','receiptId':'LF_RECEIPT','paymentIndex':'0','moneyAmount':'12.3400','paymentDetailsJson':'null','syncedAt':now},
}
for table,values in seeds.items():
 spec=m['POLICY']['tables'][table];cells=[values.get(h,'') for h in m['CATALOG'][table]['headers']]
 fields=[f['name'] for f in spec['fields'] if f['position'] is not None]+[f['lexeme'] for f in spec['fields'] if f['lexeme']]
 cols=','.join('"'+f+'"' for f in fields);project=','.join('i."'+f+'"' for f in fields)
 print(f'INSERT INTO stock_operational.{table}({cols}) SELECT {project} FROM stock_operational.column_input_{table}('+m['literal'](json.dumps(cells))+'::jsonb) i;')
print("UPDATE stock_operational.orders SET archived_at=now() WHERE id='LF_ORDER';")
PY
pg psql -U postgres -d lf_values -v ON_ERROR_STOP=1 < "$artifacts/lexeme-final-seed.sql" > "$artifacts/lexeme-final-seed.log"
python3 - <<'PY' > "$artifacts/lexeme-final-fingerprint.sql"
import sys,runpy
sys.path.insert(0,'tools/migration');from recovery import fingerprint_sql
m=runpy.run_path('tools/migration/lexemes-final.py');lines=fingerprint_sql().splitlines()
for i,line in enumerate(lines[:51]):
 for table,spec in m['POLICY']['tables'].items():
  if 'FROM stock_operational.'+table+' t' not in line:continue
  fields=[m['literal'](f['lexeme']) for f in spec['fields'] if f['lexeme']]
  if fields:lines[i]=line.replace('to_jsonb(t)',"(to_jsonb(t)-ARRAY["+','.join(fields)+']::text[])')
print('\n'.join(lines))
PY
pg psql -U postgres -d lf_values -XqAt -v ON_ERROR_STOP=1 < "$artifacts/lexeme-final-fingerprint.sql" > "$artifacts/lexeme-final-before.jsonl"
lexeme_final_sql lf_values | pg psql -U postgres -d lf_values -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-install.log"
pg psql -U postgres -d lf_values -XqAt -v ON_ERROR_STOP=1 < "$artifacts/lexeme-final-fingerprint.sql" > "$artifacts/lexeme-final-after.jsonl"
python3 tools/migration/lexemes-final-proof.py "$artifacts"
for database in lf_operational lf_native lf_browser; do pg createdb -U postgres -T lx_retained "$database"; lexeme_final_sql "$database" | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/lexeme-final-install-$database.log"; done
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_lf(){ local database=$1; shift; env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$(identity "$database")" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
run_lf lf_hot tools/migration/lexemes-final.test.cjs
run_lf lf_operational tools/migration/operational.test.cjs
run_lf lf_native tools/migration/native-timestamps.test.cjs
run_lf lf_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: actual guarded48column retirement;all51stored tables preserved except spellings;47native timestamps and existing permissions retained;actual app/LINE/browser acceptance;no production access'
