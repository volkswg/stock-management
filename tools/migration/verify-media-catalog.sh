#!/usr/bin/env bash
# Sourced after current typed/shared-guard acceptance. Synthetic local DBs only.
test -n "${name:-}" && test -n "${artifacts:-}"
media_sql=tools/migration/operator/20261118135558_media_catalog_compatibility.sql
pg createdb -U postgres -T tc_base mc_base
constraints_sql mc_base | pg psql -U postgres -d mc_base -v ON_ERROR_STOP=1 > "$artifacts/media-base.log"
pg psql -U postgres -d mc_base -v ON_ERROR_STOP=1 > "$artifacts/media-archive-fixture.log" <<'SQL'
INSERT INTO stock_operational.orders(id,status) VALUES('MC_ARCHIVED_PARENT','complete');
INSERT INTO stock_operational.order_items(id,"orderId","imageUrl") VALUES('MC_ARCHIVED_FIXTURE','MC_ARCHIVED_PARENT','https://drive.google.com/file/d/MC_ARCHIVED_FILE/view');
UPDATE stock_operational.order_items SET archived_at=now() WHERE id='MC_ARCHIVED_FIXTURE';
SQL
pg psql -U postgres -d mc_base -v ON_ERROR_STOP=1 > "$artifacts/media-reader-fixture.log" <<'SQL'
CREATE ROLE media_test_reader NOLOGIN;
GRANT USAGE ON SCHEMA stock_operational TO media_test_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational TO media_test_reader;
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['orders','order_items','order_bills','movement_details','shipments','stock_adjustments'] LOOP
  EXECUTE format('CREATE POLICY media_fixture_reader ON stock_operational.%I FOR SELECT TO media_test_reader USING(true)',t);
 END LOOP;
END $$;
SQL
for database in mc_guard mc_app mc_operational mc_browser mc_rollback; do pg createdb -U postgres -T mc_base "$database"; done
media_settings(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_media_catalog='reviewed-media-v1'; SET stock.media_reviewed_revision='$(revision "$1")'; SET stock.media_reviewed_source='1111111111111111111111111111111111111111'; SET stock.media_restore_verified='complete-private-checkpoint-v1';"; }
media_install(){ media_settings "$1"; cat "$media_sql"; }
if pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 < "$media_sql" > "$artifacts/media-unapproved.log" 2>&1; then exit 1; fi
if { media_install mc_guard | sed "s/SET stock.media_reviewed_revision='[0-9]*'/SET stock.media_reviewed_revision='-1'/"; } | pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 > "$artifacts/media-stale.log" 2>&1; then exit 1; fi
if { media_install mc_guard | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 > "$artifacts/media-wrong-target.log" 2>&1; then exit 1; fi
# A deliberately late conflicting index proves atomic DDL/guard/backfill rollback.
pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 -c 'CREATE INDEX stock_adjustments_media_ref ON stock_operational.stock_adjustments(id);' > "$artifacts/media-late-fixture.log"
if media_install mc_guard | pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 > "$artifacts/media-late-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 -c "SELECT 1/(to_regclass('stock_operational.media') IS NULL AND (SELECT count(*)=5 FROM pg_trigger WHERE tgname='a_validate' AND tgenabled='O' AND tgrelid IN ('stock_operational.order_items'::regclass,'stock_operational.order_bills'::regclass,'stock_operational.movement_details'::regclass,'stock_operational.shipments'::regclass,'stock_operational.stock_adjustments'::regclass)))::int;" > "$artifacts/media-late-rollback.log"
# Fail during the actual backfill, after its row guard has been suspended.
pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 > "$artifacts/media-backfill-failure-fixture.log" <<'SQL'
DROP INDEX stock_operational.stock_adjustments_media_ref;
CREATE FUNCTION public.mc_backfill_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic backfill interruption'; END$$;
CREATE TRIGGER zz_media_failure BEFORE UPDATE ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION public.mc_backfill_failure();
SQL
python3 tools/migration/media-catalog-proof.py sql > "$artifacts/media-proof.sql"
pg psql -U postgres -d mc_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-proof.sql" > "$artifacts/media-interrupted-before.jsonl"
if media_install mc_guard | pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 > "$artifacts/media-backfill-refused.log" 2>&1; then exit 1; fi
pg psql -U postgres -d mc_guard -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-proof.sql" > "$artifacts/media-interrupted-after.jsonl"
cmp "$artifacts/media-interrupted-before.jsonl" "$artifacts/media-interrupted-after.jsonl"
pg psql -U postgres -d mc_guard -v ON_ERROR_STOP=1 -c 'DROP TRIGGER zz_media_failure ON stock_operational.order_items; DROP FUNCTION public.mc_backfill_failure();' > "$artifacts/media-backfill-fixture-cleanup.log"
python3 tools/migration/media-catalog-proof.py sql > "$artifacts/media-proof.sql"
pg psql -U postgres -d mc_app -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-proof.sql" > "$artifacts/media-before.jsonl"
for database in mc_app mc_operational mc_browser mc_rollback; do media_install "$database" | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/media-install-$database.log"; done
pg psql -U postgres -d mc_app -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-proof.sql" > "$artifacts/media-after.jsonl"
python3 tools/migration/media-catalog-proof.py compare "$artifacts"
run_tc mc_app tools/migration/media-catalog.test.cjs
run_tc mc_operational tools/migration/operational.test.cjs
run_tc mc_browser tools/migration/browser-acceptance.test.cjs
{ media_settings mc_rollback; echo "SET stock.allow_media_catalog_rollback='reviewed-media-v1';"; cat tools/migration/operator/rollback_media_catalog.sql; } | pg psql -U postgres -d mc_rollback -v ON_ERROR_STOP=1 > "$artifacts/media-rollback.log"
pg psql -U postgres -d mc_rollback -XqAt -v ON_ERROR_STOP=1 < "$artifacts/media-proof.sql" > "$artifacts/media-rollback.jsonl"
python3 tools/migration/media-catalog-proof.py rollback "$artifacts"
run_tc mc_rollback tools/migration/media-rollback.test.cjs
echo 'PASS: private media catalog, 5 ID/URL reference paths, confirmed browser/LINE uploads, preserved 51-table values/guards, guarded install and schema-only rollback'
