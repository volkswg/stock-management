"""Generated row assertions: index lookup, null equality and conflict rejection. CI only."""
import copy,json,os
from core import CATALOG,import_sql,quote
from test_migration import fixture
from jsonb_stream import read_session

TABLE='pg_temp.import_assertion_fixture'

def commands(source):
    lines=import_sql(source).splitlines()
    insert=next(s for s in lines if s.startswith('INSERT INTO stock_migration.orders '))
    check=next(s for s in lines if s.startswith('SELECT 1 / (EXISTS (SELECT 1 FROM stock_migration.orders WHERE '))
    return [s.replace('stock_migration.orders',TABLE) for s in (insert,check)]

def indexed(value):
    if isinstance(value,dict):
        if value.get('Node Type') in ('Index Scan','Index Only Scan') and 'Index Cond' in value:return True
        return any(indexed(v) for v in value.values())
    return isinstance(value,list) and any(indexed(v) for v in value)

def main():
    if os.environ.get('PGSERVICE')!='stock_disposable_tests':raise ValueError('disposable CI service required')
    source=fixture();source['sheets']['orders']['rows'][0][CATALOG['orders']['headers'].index('remark')]=None
    insert,check=commands(source)
    guard="BEGIN;SET LOCAL statement_timeout='120s';SET LOCAL standard_conforming_strings=on;SELECT 1/(current_database()='postgres' AND session_user='postgres' AND inet_client_addr() IS NULL AND (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AND (SELECT count(*)=1 AND bool_and(workbook='synthetic-only') FROM stock_migration.import_batches))::int;"
    with read_session(guard) as session:
        session.rows('CREATE TEMP TABLE import_assertion_fixture (LIKE stock_migration.orders INCLUDING ALL) ON COMMIT DROP;')
        session.rows(insert);session.rows(check);session.rows(insert);session.rows(check)
        fields=list(CATALOG['orders']['columns'])+['source_workbook','source_row','source_cells']
        expressions=[]
        for field in fields:
            value='t."'+field+'"'
            if field=='id':value+="||'-synthetic-'||g"
            elif field=='source_row':value+=' + g'
            elif field=='source_cells':value="jsonb_set(t.source_cells,'{0}',to_jsonb(t.id||'-synthetic-'||g))"
            expressions.append(value)
        session.rows('INSERT INTO '+TABLE+' ('+','.join('"'+c+'"' for c in fields)+') SELECT '+','.join(expressions)+' FROM '+TABLE+' t CROSS JOIN generate_series(1,30000) g;')
        plan=json.loads(b''.join(session.rows('EXPLAIN (FORMAT JSON, COSTS OFF) '+check)))
        if not indexed(plan):raise ValueError('generated row assertion has no primary-key index condition')
        # Execute the real generated check after growing the fixture. Its null
        # fields and original cells must still compare exactly.
        session.rows(check)
        for column,value in [('totalPrice','99.00'),('remark',"changed O'Brien ; ไทย")]:
            changed=copy.deepcopy(source);sheet=changed['sheets']['orders'];sheet['rows'][0][sheet['headers'].index(column)]=value
            bad_insert,bad_check=commands(changed)
            block="DO $assertion$DECLARE rejected boolean:=false;BEGIN BEGIN EXECUTE "+quote(bad_insert)+'; EXECUTE '+quote(bad_check)+";EXCEPTION WHEN division_by_zero THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'changed identity was accepted';END IF;END $assertion$;"
            session.rows(block)
        session.rows("SELECT 1/((SELECT count(*)=30001 FROM "+TABLE+"))::int;")
        session.rows(check)
    print('PASS: generated indexed row assertion, identical replay, NULL equality and changed-identity rejection')

if __name__=='__main__':main()
