"""Generate synthetic-only upgrade/promotion checks for the CI Unix-socket database."""
from pathlib import Path
from core import CATALOG, import_sql, literal, normalize, quote
from test_nullable_json import nullable_json_fixture

root = Path(__file__).resolve().parents[2]
fix = next((root / 'supabase/migrations').glob('*_normalize_nullable_json_projections.sql'))
migrations = sorted((root / 'supabase/migrations').glob('*.sql'))
source = nullable_json_fixture()
script = ["SELECT 1 / (current_database()='json_null_test' AND inet_client_addr() IS NULL)::int;"]
script.extend(path.read_text() for path in migrations if path.name < fix.name)
script.append(import_sql(source))
# Establish the old failure without inserting or promoting any operational record.
script.append("SELECT 1 / (EXISTS(SELECT 1 FROM stock_migration.sales_receipt_payments WHERE \"paymentDetailsJson\" IS DISTINCT FROM NULLIF(source_cells->>8,'')::jsonb))::int;")
functions = [quote('map_' + table) for table, spec in CATALOG.items()
             if any(kind == 'jsonb' for kind in spec['columns'].values())]
attrs = "p.oid,p.proname,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prorettype,p.provolatile,p.proparallel,p.proisstrict,p.prolang,p.proargtypes,p.procost"
function_query = f"SELECT to_jsonb(attributes) AS attributes FROM (SELECT {attrs} FROM pg_proc p WHERE p.pronamespace='stock_operational'::regnamespace AND p.proname IN ({','.join(functions)})) attributes"
script.append('CREATE TEMP TABLE json_functions_before AS ' + function_query + ';')
script.append("CREATE TEMP TABLE json_triggers_before AS SELECT oid,tgfoid,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='stock_operational'::regnamespace);")
row_queries = []
for schema, tables in [('stock_migration', ['import_batches'] + list(CATALOG)),
                       ('stock_operational', ['commands', 'audit', 'side_effects', 'environment'] + list(CATALOG))]:
    for table in tables:
        row_queries.append(f"SELECT '{schema}.{table}' AS relation,count(*) AS rows,md5(coalesce(string_agg(v::text,'' ORDER BY v::text COLLATE \"C\"),'')) AS fingerprint FROM (SELECT to_jsonb(t) AS v FROM {schema}.{table} t) records")
row_query = ' UNION ALL '.join(row_queries)
script.append('CREATE TEMP TABLE json_rows_before AS ' + row_query + ';')
script.append(fix.read_text())
for before, after in [('SELECT * FROM json_functions_before', function_query),
                      ('SELECT * FROM json_triggers_before', "SELECT oid,tgfoid,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='stock_operational'::regnamespace)"),
                      ('SELECT * FROM json_rows_before', row_query)]:
    script.append(f'SELECT 1 / (NOT EXISTS (({before} EXCEPT ALL {after}) UNION ALL ({after} EXCEPT ALL {before})))::int;')
script.extend(path.read_text() for path in migrations if path.name > fix.name)
script.append((root / 'tools/migration/promote.sql').read_text())
# Exact typed values and original cells must agree for all six JSON projections.
for table, rows in normalize(source).items():
    spec = CATALOG[table]
    columns = [column for column, kind in spec['columns'].items() if kind == 'jsonb']
    if not columns:
        continue
    for row in rows:
        conditions = [f'"{column}" IS NOT DISTINCT FROM {literal(row[column], "jsonb")}' for column in columns]
        conditions.append('business_cells = ' + literal(row['source_cells'], 'jsonb'))
        script.append(f'SELECT 1 / (EXISTS(SELECT 1 FROM stock_operational.{table} WHERE id={quote(row["id"])} AND ' + ' AND '.join(conditions) + '))::int;')
script.append(r"""DO $test$
BEGIN
  BEGIN
    INSERT INTO stock_operational.sales_receipt_payments(business_cells)
    SELECT jsonb_set(jsonb_set(business_cells,'{0}',to_jsonb('invalid-json-synthetic'::text)),
                     '{8}',to_jsonb('not-json'::text))
    FROM stock_operational.sales_receipt_payments WHERE id='sales_receipt_payments-1';
    RAISE EXCEPTION 'Malformed JSON was accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
END;
$test$;
""")
print('\n'.join(script))
