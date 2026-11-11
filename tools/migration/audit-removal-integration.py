"""Populated synthetic upgrade only; executed inside the disposable CI database."""
from pathlib import Path
from core import CATALOG, import_sql
from test_migration import precision_fixture
root=Path(__file__).resolve().parents[2]
upgrade=next((root/'supabase/migrations').glob('*_remove_operational_audit.sql'))
print("SELECT 1 / (current_database()='audit_removal_test' AND inet_client_addr() IS NULL)::int;")
for path in sorted((root/'supabase/migrations').glob('*.sql')):
    if path.name < upgrade.name: print(path.read_text())
print(import_sql(precision_fixture()))
# The historical promotion still expected an empty audit table.
promotion=(root/'tools/migration/promote.sql').read_text().replace('SELECT 1 / ((SELECT count(*)=1 AND min(value)=0 FROM stock_operational.revision))::int;', 'SELECT 1 / ((SELECT count(*)=0 FROM stock_operational.audit))::int;')
print(promotion)
print('CREATE TEMP TABLE legacy_revision AS SELECT max(sequence) AS value FROM stock_operational.audit;')
queries=[f"SELECT '{schema}.{table}' AS name, to_jsonb(t) AS record FROM {schema}.{table} t" for schema in ['stock_migration','stock_operational'] for table in CATALOG]
queries += [f"SELECT '{schema}.{table}' AS name, to_jsonb(t) AS record FROM {schema}.{table} t" for schema,table in [('stock_migration','import_batches'),('stock_operational','commands'),('stock_operational','side_effects'),('stock_operational','environment')]]
records=' UNION ALL '.join(queries)
print('CREATE TEMP TABLE business_before AS '+records+';')
print(upgrade.read_text())
print(f'''SELECT 1 / (NOT EXISTS (((SELECT * FROM business_before) EXCEPT ALL ({records})) UNION ALL (({records}) EXCEPT ALL (SELECT * FROM business_before))))::int;
SELECT 1 / (to_regclass('stock_operational.audit') IS NULL AND to_regprocedure('stock_operational.audit_change()') IS NULL)::int;
SELECT 1 / ((SELECT value FROM stock_operational.revision)=(SELECT value FROM legacy_revision))::int;
SELECT 1 / ((SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid='stock_operational.advance_revision()'::regprocedure)=23)::int;
SELECT 1 / (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='audit_record' AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='stock_operational'::regnamespace)))::int;
SELECT 1 / (NOT has_table_privilege('anon','stock_operational.revision','SELECT') AND NOT has_table_privilege('authenticated','stock_operational.revision','SELECT'))::int;
CREATE TEMP TABLE revision_before AS SELECT value FROM stock_operational.revision;
BEGIN;
SET LOCAL ROLE stock_runtime;
UPDATE stock_operational.orders SET business_cells=business_cells;
SELECT 1 / ((SELECT count(*)=1 FROM stock_operational.revision))::int;
ROLLBACK;
SELECT 1 / ((SELECT value FROM stock_operational.revision)=(SELECT value FROM revision_before))::int;
BEGIN;
SET LOCAL ROLE stock_runtime;
UPDATE stock_operational.orders SET business_cells=business_cells;
COMMIT;
SELECT 1 / ((SELECT value FROM stock_operational.revision)=(SELECT value+1 FROM revision_before))::int;
-- DELETE is counted too, and rolls back atomically with its revision.
BEGIN;
DELETE FROM stock_operational.user_state;
SELECT 1 / ((SELECT value FROM stock_operational.revision)=(SELECT value+2 FROM revision_before))::int;
ROLLBACK;
SET ROLE stock_runtime;
DO $test$ BEGIN
 BEGIN DELETE FROM stock_operational.revision; RAISE EXCEPTION 'runtime deleted revision'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO stock_operational.revision VALUES(true,0); RAISE EXCEPTION 'runtime inserted revision'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE stock_operational.revision SET singleton=false; RAISE EXCEPTION 'runtime changed singleton'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET ROLE;
BEGIN;
DELETE FROM stock_operational.revision;
DO $test$ BEGIN
 BEGIN
  UPDATE stock_operational.orders SET business_cells=business_cells;
  RAISE EXCEPTION 'missing revision accepted a write';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Missing storage revision' THEN RAISE; END IF;
 END;
END $test$;
ROLLBACK;
''')
