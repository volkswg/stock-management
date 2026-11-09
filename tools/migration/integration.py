"""Generate synthetic SQL for execution by psql -v ON_ERROR_STOP=1 in an empty DB."""
from pathlib import Path
from core import CATALOG, import_sql
from test_migration import fixture

root=Path(__file__).resolve().parents[2]
schema='\n'.join(path.read_text() for path in sorted((root/'supabase/migrations').glob('*.sql')))
f=fixture()
# Use separate transactions so deferred FK checks actually execute on both passes.
script=schema+'\n'+import_sql(f)+import_sql(f)
script+='\nDO $test$ BEGIN\n'
for table in CATALOG:
    script+=f"IF (SELECT count(*) FROM stock_migration.{table}) <> 1 THEN RAISE EXCEPTION 'idempotency {table}'; END IF;\n"
script+="""IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='stock_migration' AND NOT rowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
IF has_schema_privilege('anon','stock_migration','USAGE') OR has_schema_privilege('authenticated','stock_migration','USAGE') THEN RAISE EXCEPTION 'schema exposure'; END IF;
BEGIN
 INSERT INTO stock_migration.order_items (id,"orderId",source_workbook,source_row,source_cells) VALUES ('orphan','missing','test',500,'[]');
 SET CONSTRAINTS ALL IMMEDIATE;
 RAISE EXCEPTION 'FK missing';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END;
BEGIN
 INSERT INTO stock_migration.orders (id,source_workbook,source_row,source_cells) VALUES ('orders-1','test',500,'[]');
 RAISE EXCEPTION 'uniqueness missing';
EXCEPTION WHEN unique_violation THEN NULL;
END;
END $test$;
"""
print(script)
