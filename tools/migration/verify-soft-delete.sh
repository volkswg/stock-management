#!/usr/bin/env bash
# Sourced from current synthetic PostgreSQL acceptance. Never a hosted target.
test -n "${name:-}" && test -n "${artifacts:-}"
pg createdb -U postgres -T mu_base sd_base
mu_sql sd_base compatibility | pg psql -U postgres -d sd_base -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-media-compatibility.log"
mu_sql sd_base retirement | pg psql -U postgres -d sd_base -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-media-predecessor.log"
# Six overlapping columns: preserve both legacy deletion paths and their exact instants.
pg psql -U postgres -d sd_base -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-fixtures.log" <<'SQL'
INSERT INTO stock_operational.orders(id,"createdAt",remark) VALUES('SD_LEGACY_ARCHIVE','2026-11-19T00:00:00Z','retained archive'),('SD_LEGACY_DELETE','2026-11-19T00:00:00Z','retained delete'),('SD_SAME','2026-11-19T00:00:00Z','both same');
UPDATE stock_operational.orders SET archived_at='2026-11-19T01:02:03.123456Z' WHERE id='SD_LEGACY_ARCHIVE';
UPDATE stock_operational.orders SET "deletedAt"='2026-11-19T01:02:03.654321Z' WHERE id='SD_LEGACY_DELETE';
UPDATE stock_operational.orders SET archived_at='2026-11-19T01:02:03.789123Z',"deletedAt"='2026-11-19T01:02:03.789123Z' WHERE id='SD_SAME';
SQL
for database in sd_guard sd_final sd_app sd_media sd_line sd_browser sd_inverse; do pg createdb -U postgres -T sd_base "$database"; done
sd_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_soft_delete_$2='reviewed-deleted-at-v1'; SET stock.soft_delete_restore_verified='52-tables-15-metadata-v1'; SET stock.soft_delete_revision='$(revision "$1")'; SET stock.soft_delete_source='1111111111111111111111111111111111111111'; SET stock.soft_delete_fingerprint='$(printf '%064d' 0)';"; if [[ $2 == retirement ]]; then cat tools/migration/operator/20261119013852_retire_archived_at.sql; else cat "$artifacts/soft-delete-inverse.sql"; fi; }
python3 tools/migration/soft-delete-proof.py sql > "$artifacts/soft-delete-fingerprint.sql"
python3 -c "import sys;sys.path.insert(0,'tools/migration');import recovery;print(recovery.fingerprint_sql(include_media=True))" > "$artifacts/soft-delete-complete.sql"
pg psql -U postgres -d sd_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/soft-delete-complete.sql" > "$artifacts/soft-delete-guard-before.jsonl"
if pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 < tools/migration/operator/20261119013852_retire_archived_at.sql > "$artifacts/soft-delete-unapproved.log" 2>&1; then exit 1; fi
if sd_sql sd_guard retirement | sed "s/stock.soft_delete_revision='[0-9]*'/stock.soft_delete_revision='-1'/" | pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-stale.log" 2>&1; then exit 1; fi
if sd_sql sd_guard retirement | sed "s/stock.expected_isolation_id='[^']*'/stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/" | pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-wrong-target.log" 2>&1; then exit 1; fi
# A failure after the last DDL/function change must leave every value/metadata exact.
if sd_sql sd_guard retirement | sed 's/^COMMIT;$/SELECT 1\/0; COMMIT;/' | pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-late-failure.log" 2>&1; then exit 1; fi
pg psql -U postgres -d sd_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/soft-delete-complete.sql" > "$artifacts/soft-delete-guard-after.jsonl"
cmp "$artifacts/soft-delete-guard-before.jsonl" "$artifacts/soft-delete-guard-after.jsonl"
pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 -c 'CREATE VIEW public.sd_dependency AS SELECT archived_at FROM stock_operational.orders;' > "$artifacts/soft-delete-dependency.log"
if sd_sql sd_guard retirement | pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-dependency-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 -c 'DROP VIEW public.sd_dependency; INSERT INTO stock_operational.orders(id,archived_at,"deletedAt") VALUES('\''SD_CONFLICT'\'','\''2026-11-19T00:00:00Z'\'','\''2026-11-19T00:00:01Z'\'');' > "$artifacts/soft-delete-conflict.log"
if sd_sql sd_guard retirement | pg psql -U postgres -d sd_guard -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-conflict-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d sd_final -XqAt -v ON_ERROR_STOP=1 < "$artifacts/soft-delete-fingerprint.sql" > "$artifacts/soft-delete-before.jsonl"
{ echo "SET stock.expected_isolation_id='$(identity sd_inverse)'; SET stock.expected_purpose='isolated-staging';"; python3 tools/migration/soft-delete.py checkpoint-sql; } | pg psql -U postgres -d sd_inverse -XqAt -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-state.private.jsonl"
python3 tools/migration/soft-delete.py rollback "$artifacts/soft-delete-state.private.jsonl" > "$artifacts/soft-delete-inverse.sql"
for database in sd_final sd_app sd_media sd_line sd_browser sd_inverse; do sd_sql "$database" retirement | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-install-$database.log"; done
pg psql -U postgres -d sd_final -XqAt -v ON_ERROR_STOP=1 < "$artifacts/soft-delete-fingerprint.sql" > "$artifacts/soft-delete-after.jsonl"
sd_sql sd_inverse rollback | pg psql -U postgres -d sd_inverse -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-inverse.log"
pg psql -U postgres -d sd_inverse -XqAt -v ON_ERROR_STOP=1 < "$artifacts/soft-delete-fingerprint.sql" > "$artifacts/soft-delete-inverse.jsonl"
python3 tools/migration/soft-delete-proof.py "$artifacts"
# Inverse after ANY later write must refuse; it never guesses old archive history.
pg psql -U postgres -d sd_final -v ON_ERROR_STOP=1 -c "INSERT INTO stock_operational.orders(id) VALUES('SD_LATER_WRITE');" > "$artifacts/soft-delete-later-write.log"
if sd_sql sd_final rollback | pg psql -U postgres -d sd_final -v ON_ERROR_STOP=1 > "$artifacts/soft-delete-stale-inverse.log" 2>&1; then exit 1; fi
run_tc sd_app tools/migration/soft-delete.test.cjs
run_tc sd_media tools/migration/media-url-retirement.test.cjs
run_tc sd_line --test-name-pattern="actual LINE" tools/migration/media-catalog.test.cjs
run_tc sd_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: all23 deletedAt columns, all52 tables/revisions/security preserved, exact guarded inverse, actual app/LINE/media/browser acceptance'
