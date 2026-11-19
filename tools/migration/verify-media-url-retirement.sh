#!/usr/bin/env bash
# Sourced by the current typed/media verifier. Fresh synthetic local databases only.
test -n "${name:-}" && test -n "${artifacts:-}"
pg createdb -U postgres -T mc_base mu_base
media_install mu_base | pg psql -U postgres -d mu_base -v ON_ERROR_STOP=1 > "$artifacts/media-url-base.log"
mu_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_media_url_$2='reviewed-media-ids-v1'; SET stock.media_url_restore_verified='52-tables-15-metadata-v1'; SET stock.media_url_revision='$(revision "$1")'; SET stock.media_url_source='1111111111111111111111111111111111111111'; SET stock.media_url_fingerprint='$(printf '%064d' 0)'; SET stock.media_url_alias_policy='use-media-sourceUrl';"; case "$2" in compatibility) cat tools/migration/operator/20261118180920_media_url_id_compatibility.sql;; retirement) cat tools/migration/operator/20261118180924_retire_media_url_columns.sql;; rollback) cat tools/migration/operator/rollback_media_url_columns.sql;; esac; }
for database in mu_guard mu_compat mu_final mu_operational mu_browser mu_rollback; do pg createdb -U postgres -T mu_base "$database"; done
if pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 < tools/migration/operator/20261118180920_media_url_id_compatibility.sql > "$artifacts/media-url-unapproved.log" 2>&1; then exit 1; fi
if { mu_sql mu_guard compatibility | sed "s/SET stock.media_url_revision='[0-9]*'/SET stock.media_url_revision='-1'/"; } | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-stale.log" 2>&1; then exit 1; fi
if { mu_sql mu_guard compatibility | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-wrong-target.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-limited-reader.log" <<'SQL'
CREATE ROLE mu_limited NOLOGIN;
GRANT SELECT ON stock_operational.order_items TO mu_limited;
SQL
if mu_sql mu_guard compatibility | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-reader-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 -c 'REVOKE SELECT ON stock_operational.order_items FROM mu_limited;' > "$artifacts/media-url-limited-reset.log"
for database in mu_guard mu_compat mu_final mu_operational mu_browser mu_rollback; do mu_sql "$database" compatibility | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/media-url-compat-$database.log"; done
# A failure after all five DDL changes must restore the complete prior schema/data.
python3 -c "import sys;sys.path.insert(0,'tools/migration');import recovery;print(recovery.fingerprint_sql(include_media=True))" > "$artifacts/media-url-complete.sql"
pg psql -U postgres -d mu_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-complete.sql" > "$artifacts/media-url-interrupted-before.jsonl"
if { mu_sql mu_guard retirement | sed 's/^COMMIT;$/SELECT 1\/0; COMMIT;/'; } | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-late-failure.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mu_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-complete.sql" > "$artifacts/media-url-interrupted-after.jsonl"
cmp "$artifacts/media-url-interrupted-before.jsonl" "$artifacts/media-url-interrupted-after.jsonl"
run_tc mu_compat tools/migration/media-url-retirement.test.cjs
run_tc mu_compat tools/migration/media-url-predecessor.test.cjs
# Refuse unknown procedural and ordinary catalog dependencies, never CASCADE.
pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 -c 'CREATE FUNCTION public.mu_external() RETURNS text LANGUAGE plpgsql AS $$BEGIN RETURN (SELECT "imageUrl" FROM stock_operational.order_items LIMIT 1); END$$;' > "$artifacts/media-url-dependency.log"
if mu_sql mu_guard retirement | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-procedure-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 -c 'DROP FUNCTION public.mu_external(); CREATE INDEX mu_custom_url ON stock_operational.order_items("imageUrl");' > "$artifacts/media-url-index.log"
if mu_sql mu_guard retirement | pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 > "$artifacts/media-url-index-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mu_guard -v ON_ERROR_STOP=1 -c 'DROP INDEX stock_operational.mu_custom_url;' > "$artifacts/media-url-index-reset.log"
# Compare every predecessor table, excluding only the five explicitly retired fields.
python3 tools/migration/media-url-proof.py sql > "$artifacts/media-url-fingerprint.sql"
pg psql -U postgres -d mu_final -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-fingerprint.sql" > "$artifacts/media-url-before.jsonl"
for database in mu_final mu_operational mu_browser mu_rollback; do mu_sql "$database" retirement | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/media-url-retire-$database.log"; done
pg psql -U postgres -d mu_final -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-fingerprint.sql" > "$artifacts/media-url-after.jsonl"
python3 tools/migration/media-url-proof.py compare "$artifacts"
run_tc mu_final tools/migration/media-url-retirement.test.cjs
run_tc mu_final --test-name-pattern="actual LINE" tools/migration/media-catalog.test.cjs
run_tc mu_operational tools/migration/operational.test.cjs
run_tc mu_browser tools/migration/browser-acceptance.test.cjs
pg psql -U postgres -d mu_rollback -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-fingerprint.sql" > "$artifacts/media-url-inverse-before.jsonl"
inverse_revision_before=$(revision mu_rollback)
mu_sql mu_rollback rollback | pg psql -U postgres -d mu_rollback -v ON_ERROR_STOP=1 > "$artifacts/media-url-inverse.log"
pg psql -U postgres -d mu_rollback -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-url-fingerprint.sql" > "$artifacts/media-url-inverse-after.jsonl"
test "$(revision mu_rollback)" = "$((inverse_revision_before+5))"
python3 tools/migration/media-url-proof.py inverse "$artifacts"
run_tc mu_rollback tools/migration/media-url-retirement.test.cjs
run_tc mu_rollback tools/migration/media-url-predecessor.test.cjs
echo 'PASS: media-ID reads/writes before/after URL retirement, normalized aliases, unchanged APIs/LINE, uncertainty/replay, scoped permissions and inverse'
source tools/migration/verify-soft-delete.sh
