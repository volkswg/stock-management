#!/usr/bin/env bash
# Sourced at the end of verify-typed-postgres.sh. Reuse its fresh synthetic base
# and owned Docker lifecycle; never read credentials, private snapshots or hosts.
test -n "${name:-}" && test -n "${artifacts:-}"
constraint_sql=tools/migration/final-removal/20261118100705_constraint_record_validation.sql
constraints_sql(){ echo "SET stock.expected_isolation_id='$(identity "$1")'; SET stock.expected_purpose='isolated-staging'; SET stock.allow_constraint_validation='reviewed-row-constraints-v1'; SET stock.constraint_reviewed_revision='$(revision "$1")'; SET stock.constraint_reviewed_source='1111111111111111111111111111111111111111'; SET stock.constraint_reviewed_fingerprint='$(printf '%064d' 0)'; SET stock.constraint_restore_verified='51-tables-15-metadata-v1'; SET stock.constraint_semantics_verified='exact-app-line-consumers-v1';"; cat "$constraint_sql"; }
for database in cv_before cv_after cv_guard cv_operational cv_native cv_browser; do pg createdb -U postgres -T tc_base "$database"; done
refuse_constraints(){ local label=$1; if constraints_sql cv_guard | pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 > "$artifacts/constraints-$label.log" 2>&1; then echo "Unexpected constraint release success: $label" >&2; exit 1; fi; pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c "SELECT 1/(to_regprocedure('stock_operational.prepare_record_write()') IS NULL AND to_regprocedure('stock_operational.validate_orders()') IS NOT NULL)::int;" > "$artifacts/constraints-$label-rollback.log"; }
if pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 < "$constraint_sql" > "$artifacts/constraints-unapproved.log" 2>&1; then exit 1; fi
if { constraints_sql cv_guard | sed "s/SET stock.constraint_reviewed_revision='[0-9]*'/SET stock.constraint_reviewed_revision='-1'/"; } | pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 > "$artifacts/constraints-stale.log" 2>&1; then exit 1; fi
if { constraints_sql cv_guard | sed "s/SET stock.expected_isolation_id='[^']*'/SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'/"; } | pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 > "$artifacts/constraints-wrong-target.log" 2>&1; then exit 1; fi
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'CREATE FUNCTION public.cv_consumer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM stock_operational.VALIDATE_ORDERS(); RETURN NEW; END $$;' > "$artifacts/constraints-dependency.log"
refuse_constraints procedural-consumer
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'DROP FUNCTION public.cv_consumer(); CREATE TRIGGER cv_dependency BEFORE INSERT ON stock_operational.orders FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_orders();' > "$artifacts/constraints-trigger-dependency.log"
refuse_constraints trigger-dependency
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'DROP TRIGGER cv_dependency ON stock_operational.orders; GRANT EXECUTE ON FUNCTION stock_operational.validate_orders() TO lexeme_reader;' > "$artifacts/constraints-acl-drift.log"
refuse_constraints mixed-acl
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'REVOKE EXECUTE ON FUNCTION stock_operational.validate_orders() FROM lexeme_reader;' > "$artifacts/constraints-acl-reset.log"
# A late failure must roll back every earlier function/trigger/constraint change.
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'ALTER TABLE stock_operational.user_state ADD CONSTRAINT user_state_lifecycle_range CHECK (true);' > "$artifacts/constraints-late-fixture.log"
refuse_constraints late-ddl-failure
pg psql -U postgres -d cv_guard -v ON_ERROR_STOP=1 -c 'ALTER TABLE stock_operational.user_state DROP CONSTRAINT user_state_lifecycle_range;' > "$artifacts/constraints-late-reset.log"
pg psql -U postgres -d cv_after -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/constraints-before.jsonl"
for database in cv_after cv_operational cv_native cv_browser; do constraints_sql "$database" | pg psql -U postgres -d "$database" -v ON_ERROR_STOP=1 > "$artifacts/constraints-install-$database.log"; done
pg psql -U postgres -d cv_after -XqAt -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/constraints-after.jsonl"
python3 tools/migration/constraint-validation-proof.py "$artifacts"
run_tc cv_after tools/migration/constraint-validation.test.cjs
run_tc cv_operational tools/migration/operational.test.cjs
run_tc cv_native tools/migration/native-timestamps.test.cjs
run_tc cv_browser tools/migration/browser-acceptance.test.cjs
echo 'PASS: row constraints and shared write guard; exact predecessor parity on23tables/47timestamps; actual app/LINE, idempotency and browser retry acceptance'
