#!/usr/bin/env bash
# Fresh synthetic local databases only; no saved credentials or hosted services.
set -euo pipefail
cd "$(dirname "$0")/../.."
# Reuse the reviewed native+retained bootstrap, without the candidate-only DROP
# fixture or rerunning the earlier app suites. Earlier acceptance stays intact.
bootstrap=$(mktemp "${TMPDIR:-/tmp}/stock-final-bootstrap.XXXXXX")
python3 - <<'PY' > "$bootstrap"
from pathlib import Path
s=Path('tools/migration/verify-cell-kinds.sh').read_text()
assert s.count('for database in ck_retained')==1
print(s.split('for database in ck_retained')[0])
PY
source "$bootstrap"
rm "$bootstrap"
final_script=tools/migration/final-removal/20261117174324_remove_cell_kinds.sql
final_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_final_cell_kinds_removal='reviewed-per-column-retirement-v1'; SET stock.cell_kinds_reviewed_revision='$(revision "$1")'; SET stock.cell_kinds_reviewed_source='1111111111111111111111111111111111111111'; SET stock.cell_kinds_restore_verified='51-tables-15-metadata-v1'; SET stock.cell_kinds_semantics_verified='exact-app-line-optional-tails-v1';"; cat "$final_script"; }
for database in cf_base cf_bad cf_race; do pg createdb -U postgres -T ck_base "$database"; done
if pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 < "$final_script" > "$artifacts/final-no-approval.log" 2>&1; then exit 1; fi
if { final_sql cf_base | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 > "$artifacts/final-wrong-target.log" 2>&1; then exit 1; fi
if { final_sql cf_base | sed "s/SET stock.cell_kinds_reviewed_revision='[0-9]*'/SET stock.cell_kinds_reviewed_revision='-1'/"; } | pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 > "$artifacts/final-stale.log" 2>&1; then exit 1; fi
pg psql -U postgres -d cf_bad -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id,status,seller,cell_kinds) VALUES('CF_AMBIGUOUS','waiting_for_total_price','42','ssnssssss'); UPDATE stock_operational.orders SET archived_at=now() WHERE id='CF_AMBIGUOUS';" > "$artifacts/final-ambiguous-fixture.log"
if final_sql cf_bad | pg psql -U postgres -d cf_bad -v ON_ERROR_STOP=1 > "$artifacts/final-ambiguous-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d cf_bad -At -c "SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;" > "$artifacts/final-ambiguous-rollback.log"
pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 -c 'CREATE VIEW public.cf_encoding_dependency AS SELECT cell_kinds FROM stock_operational.orders;' > "$artifacts/final-view-fixture.log"
if final_sql cf_base | pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 > "$artifacts/final-view-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 -c 'DROP VIEW public.cf_encoding_dependency;' > "$artifacts/final-view-cleanup.log"
# A genuine writer commits during the advisory-lock wait. The post-lock seal
# must reject atomically even with a repeatable-read caller default.
mkfifo "$artifacts/final-writer-input"
pg psql -U postgres -d cf_race -XqAt -v ON_ERROR_STOP=1 < "$artifacts/final-writer-input" > "$artifacts/final-writer-output" 2> "$artifacts/final-writer-error" & writer_pid=$!
exec 3> "$artifacts/final-writer-input"
printf '%s\n' 'BEGIN;' 'SELECT pg_advisory_xact_lock(835107241);' '\echo CF_WRITER_READY' >&3
for attempt in $(seq 1 40); do if [[ $(< "$artifacts/final-writer-output") == *CF_WRITER_READY* ]]; then break; fi; sleep .1; done
[[ $(< "$artifacts/final-writer-output") == *CF_WRITER_READY* ]]
{ echo "SET application_name='CF_LOCK_RACE'; SET default_transaction_isolation='repeatable read';"; final_sql cf_race; } | pg psql -U postgres -d cf_race -XqAt -v ON_ERROR_STOP=1 > "$artifacts/final-lock-race-refused.log" 2>&1 & ddl_pid=$!
blocked=false
for attempt in $(seq 1 12); do
 if [[ $(pg psql -U postgres -d cf_race -XqAt -c "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE application_name='CF_LOCK_RACE' AND wait_event='advisory')") == t ]]; then blocked=true; break; fi
 sleep .1
done
test "$blocked" = true
printf '%s\n' 'UPDATE stock_operational.revision SET value=value+1 WHERE singleton;' 'COMMIT;' '\q' >&3
exec 3>&-
wait "$writer_pid"
if wait "$ddl_pid"; then echo 'Stale review survived writer race' >&2; exit 1; fi
pg psql -U postgres -d cf_race -At -c "SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;" > "$artifacts/final-race-rollback.log"
echo 'PASS: approval/target/stale/archived ambiguity/RESTRICT dependency/real writer-race guards refuse atomically'
# Small retained fixtures independently cover each approved optional tail.
pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.shipments(id,cell_kinds) VALUES('CF_SHORT_SHIPMENT','s');" > "$artifacts/final-unreviewed-tail.log"
if final_sql cf_base | pg psql -U postgres -d cf_base -v ON_ERROR_STOP=1 > "$artifacts/final-unreviewed-tail-refused.log" 2>&1; then exit 1; fi
# This deliberately too-short row lives in a disposable guard database only.
pg createdb -U postgres -T ck_base cf_values
pg createdb -U postgres -T ck_base cf_final
python3 - <<'PY' > "$artifacts/final-seed.sql"
import json,runpy
m=runpy.run_path('tools/migration/cell-kinds-final.py');p=m['CK']['POLICY']['tables'];now='2026-11-17T02:00:00.123Z'
rows={
'employees':['CF_BASE_EMP','Synthetic','','active','','',now,'','synthetic'],
'expense_categories':['CF_BASE_CATEGORY','Synthetic',True,now,''],
'shops':['CF_BASE_SHOP','Synthetic',True,'synthetic',now,''],
'movements':['CF_BASE_MASTER','synthetic','2026-11-17','','created','1',now,''],
'orders':['CF_BASE_ORDER','waiting_for_total_price','Synthetic','12.3400','retained',now,'','','synthetic'],
'shipments':['CF_BASE_SHIPMENT','draft','Synthetic','PO-CF',0,'','','',now,'','','synthetic'],
'employee_compensations':['CF_BASE_EMP',100,2,now,'','synthetic','2026-11-01','monthly'],
'employee_timesheets':['CF_BASE_SHIFT','CF_BASE_EMP','CF_BASE_SHOP','work',now,now],
'expenses':['CF_BASE_EXP','2026-11','2026-11-17','','SHARED','CF_BASE_CATEGORY','Synthetic',12.34,'',now,'','synthetic'],
'movement_details':['CF_BASE_ITEM','CF_BASE_MASTER','Synthetic','1','','Home','Synthetic','','','created',now,''],
'user_state':['99001','CF_BASE_USER','OrderCreate','CF_BASE_ORDER','waiting_for_bill_image',now,'']}
for table,cells in rows.items():
 spec=p[table];fields=[f['name'] for f in spec['fields'] if f['position'] is not None]+[f['lexeme'] for f in spec['fields'] if f['lexeme']]+['cell_kinds'];cols=','.join('"'+f+'"' for f in fields);values=','.join('i."'+f+'"' for f in fields)
 if spec['key']=='migration_id':cols='migration_id,'+cols;values="'CF_BASE_COMP',"+values
 literal=m['literal'](json.dumps(cells))
 print(f'INSERT INTO stock_operational.{table}({cols}) SELECT {values} FROM stock_operational.column_input_{table}({literal}::jsonb) i;')
print("UPDATE stock_operational.orders SET archived_at=now() WHERE id='CF_BASE_ORDER';")
PY
pg psql -U postgres -d cf_values -v ON_ERROR_STOP=1 < "$artifacts/final-seed.sql" > "$artifacts/final-seed.log"
python3 - <<'PY' > "$artifacts/final-values-before.sql"
import sys
sys.path.insert(0,'tools/migration')
from recovery import fingerprint_sql
s=fingerprint_sql()
# Native fingerprint statements use aliases; replace only the operational row
# expression, not the immutable source/import tables or metadata definitions.
lines=s.splitlines()
for i,line in enumerate(lines[:51]):
 if 'FROM stock_operational.' in line:lines[i]=line.replace('to_jsonb(t)',"(to_jsonb(t)-'cell_kinds')")
print('\n'.join(lines))
PY
pg psql -U postgres -d cf_values -XqAt -v ON_ERROR_STOP=1 < "$artifacts/final-values-before.sql" > "$artifacts/final-before.jsonl"
final_sql cf_values | pg psql -U postgres -d cf_values -v ON_ERROR_STOP=1 > "$artifacts/final-install-values.log"
pg psql -U postgres -d cf_values -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/final-after.jsonl"
python3 tools/migration/cell-kinds-final-proof.py "$artifacts"
final_sql cf_final | pg psql -U postgres -d cf_final -v ON_ERROR_STOP=1 > "$artifacts/final-install.log"
for database in cf_operational cf_native cf_browser cf_focused; do pg createdb -U postgres -T cf_final "$database"; done
port=$(docker port "$name" 5432/tcp | cut -d: -f2)
run_final(){ local database=$1; shift; env -i PATH="$PATH" NODE_PATH="${NODE_PATH:-}" STOCK_CHROMIUM_EXECUTABLE="${STOCK_CHROMIUM_EXECUTABLE:-/usr/bin/chromium}" STOCK_TARGET_ISOLATION_ID="$(identity "$database")" STOCK_STORAGE=supabase STOCK_STAGING_ENABLED=true STOCK_ALLOW_LOCAL_TEST_DATABASE=true STOCK_DATABASE_URL="postgres://stock_test:synthetic-only@127.0.0.1:$port/$database" STOCK_STAGING_AUTH_TOKEN=synthetic-authorization-token-32-characters node --test "$@"; }
pg createdb -U postgres -T ck_base cf_hot
run_final cf_hot tools/migration/cell-kinds-hot-upgrade.test.cjs
run_final cf_focused tools/migration/cell-kinds-final.test.cjs
run_final cf_operational tools/migration/operational.test.cjs
run_final cf_native tools/migration/native-timestamps.test.cjs
run_final cf_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: actual guarded retirement,0 kind columns,48 lexemes,47 native timestamps; final PostgreSQL app/LINE/browser acceptance; no production access'
