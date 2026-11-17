#!/usr/bin/env python3
"""Generate additive per-column compatibility, or a guarded LOCAL test fixture.

No connections, credentials, source data or production DDL execution. Original
migrations and functions are immutable witnesses. The ordinary output never drops
columns or replaces an existing function, trigger, role, policy or grant.
"""
import hashlib,json,re,runpy,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
POLICY=json.loads((ROOT/'tools/migration/cell-kinds-policy.json').read_text())
NATIVE=runpy.run_path(str(ROOT/'tools/migration/native-timestamps.py'))
CATALOG=NATIVE['CATALOG']
NATIVE_SQL=(ROOT/'tools/migration/final-removal/20261117085310_native_lifecycle_timestamps.sql').read_text()
POLICIES={'text':'text-empty-v1','numeric':'decimal-lexeme-v1','bigint':'integer-lexeme-v1',
          'boolean':'boolean-lexeme-v1','jsonb':'json-text-v1','timestamptz':'instant-text-v1'}

def validate_policy():
    assert POLICY['version']==1 and POLICY['normalizationApproved'] is False
    assert list(POLICY['tables'])==list(CATALOG)
    native={(t,n) for t,n,_ in NATIVE['fields']()}
    count=0
    for table,spec in CATALOG.items():
        entry=POLICY['tables'][table];assert entry['key']==spec['key']
        fields=entry['fields'];exposed=[f for f in fields if f['position'] is not None]
        assert [f['name'] for f in exposed]==spec['headers']
        for i,f in enumerate(exposed):
            expected='timestamptz' if (table,f['name']) in native else spec['columns'][f['name']]
            assert f['position']==i and f['type']==expected and f['read']==POLICIES[expected]
            assert f['lexeme']==(f['name']+'__lexeme' if expected in ('numeric','bigint','boolean','jsonb') else None)
        internal=[f for f in fields if f['position'] is None]
        assert internal==([] if 'createdAt' in spec['headers'] else [{'name':'createdAt','position':None,'type':'timestamptz','read':'internal-first-observed-v1','lexeme':None}])
        count+=len(fields)
    assert count==252

def native_body(name):
    """Reproduce PR75's replacements of immutable predecessor function bodies."""
    text=NATIVE['body'](name).replace(' OR NEW.row_order IS DISTINCT FROM OLD.row_order','')
    table=next((name[len(p):] for p in ('input_','project_','validate_') if name.startswith(p)),None)
    for t,col,index in NATIVE['fields']():
        if t!=table or index is None:continue
        if name.startswith('input_'):
            old=f'r."{col}" := nullif((cells->>{index}),\'\')::text;'
            new=f'r."{col}" := stock_operational.native_timestamp_input(cells->>{index});'
        elif name.startswith('project_'):
            old=f'to_jsonb(r."{col}")';new=f'to_jsonb(stock_operational.native_timestamp_text(r."{col}"))'
        else:
            old=f'NEW."{col}" := nullif(NEW."{col}",\'\');'
            new=f'PERFORM stock_operational.native_timestamp_text(NEW."{col}");'
        assert text.count(old)==1,(name,col);text=text.replace(old,new)
    if name.startswith('validate_') and any(t==table and i is None for t,_,i in NATIVE['fields']()):
        text=text.replace(f'PERFORM stock_operational.project_{table}(NEW);',f'PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_{table}(NEW);')
    return text

def signature(table,prefix):
    return prefix+table+('()' if prefix=='validate_' else '(jsonb)' if prefix=='input_' else '(stock_operational.'+table+')')

def projection(field):
    name=field['name'];value=f'r."{name}"';policy=field['read']
    if policy=='text-empty-v1':return f"to_jsonb(coalesce({value},''))"
    if policy=='instant-text-v1':return f"to_jsonb(coalesce(stock_operational.native_timestamp_text({value}),''))"
    helper={'decimal-lexeme-v1':'numeric','integer-lexeme-v1':'bigint','boolean-lexeme-v1':'boolean','json-text-v1':'jsonb'}[policy]
    return f'stock_operational.column_{helper}_v1({value},r."{field["lexeme"]}")'

def canonical_kind(field):
    # This discriminator is temporary retained-schema compatibility, not stored
    # metadata or a final-schema dependency. It follows the explicit field policy.
    if field['type'] in ('text','timestamptz','jsonb'):return "'s'"
    kind='b' if field['type']=='boolean' else 'n'
    return f'''CASE WHEN r."{field['lexeme']}" IS NOT NULL OR r."{field['name']}" IS NULL THEN 's' ELSE '{kind}' END'''

def input_body(table):
    text=native_body('input_'+table)
    text='\n'.join(line for line in text.split('\n') if 'cell_kinds' not in line)
    # Formerly unsupported object/array cells must not become valid writes after
    # the compatibility encoder is retired. JSON payload columns keep JSON TEXT.
    marker='r."'+CATALOG[table]['headers'][0]+'"'
    index=text.index(marker)
    text=text[:index]+"IF EXISTS(SELECT FROM jsonb_array_elements(cells) v WHERE jsonb_typeof(v) NOT IN ('string','number','boolean','null')) THEN RAISE EXCEPTION 'Invalid cell scalar'; END IF;\n"+text[index:]
    text=text.replace("jsonb_typeof(cells)<>'array'","jsonb_typeof(cells) IS DISTINCT FROM 'array'")
    # Only retained schemas receive a valid rollback encoding, derived from the
    # transient input, never from persisted metadata. Unknown JSON keys cannot
    # create a physical column. The guard avoids encoding work on final schemas.
    encoding="""IF to_jsonb(r) ? 'cell_kinds' THEN
 r := jsonb_populate_record(r,jsonb_build_object('cell_kinds',(
  SELECT string_agg(CASE jsonb_typeof(v) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' END,'' ORDER BY n)
  FROM jsonb_array_elements(cells) WITH ORDINALITY a(v,n))));
END IF;
"""
    assert text.count('RETURN r;')==1
    return text.replace('RETURN r;',encoding+'RETURN r;')

def scalar_helpers():
    output=''
    for datatype in ['numeric','bigint','boolean','jsonb']:
        parsed="nullif(lexeme::jsonb,'null'::jsonb)" if datatype=='jsonb' else 'lexeme::'+datatype
        actual="nullif(to_jsonb(value),'null'::jsonb)"
        canonical="to_jsonb(coalesce(nullif(value,'null'::jsonb)::text,''))" if datatype=='jsonb' else "coalesce(to_jsonb(value),'\"\"'::jsonb)"
        output+=f'''CREATE FUNCTION stock_operational.column_{datatype}_v1(value {datatype},lexeme text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF lexeme IS NOT NULL THEN
  IF to_jsonb({parsed}) IS DISTINCT FROM {actual} THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
  RETURN to_jsonb(lexeme);
 END IF;
 RETURN {canonical};
END $$;
'''
    return output

def generate():
    validate_policy()
    sql="""-- OPERATOR ONLY: additive compatibility; every cell_kinds column remains.
-- Deployable code also supports the unprepared schema. No normalization approved.
-- Private data review and final removal require separate authorization.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_cell_kinds_compatibility',true)='reviewed-per-column-compatibility-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / ((SELECT count(*)=23 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND a.atttypid='text'::regtype))::int;
SELECT 1 / (to_regprocedure('stock_operational.column_mapping_contract_v1()') IS NULL)::int;
"""
    witnesses=[]
    for table in CATALOG:
        for prefix in ['input_','project_','validate_']:
            witnesses.append("('"+signature(table,prefix)+"','"+hashlib.md5(native_body(prefix+table).encode()).hexdigest()+"')")
    for name,args in [('native_timestamp_input','text'),('native_timestamp_text','timestamptz')]:
        witnesses.append("('"+name+'('+args+")','"+hashlib.md5(NATIVE['body'](name,NATIVE_SQL).encode()).hexdigest()+"')")
    witnesses.append("('created_at_timestamp(text)','"+hashlib.md5(NATIVE['body']('created_at_timestamp',NATIVE['STABLE']).encode()).hexdigest()+"')")
    witnesses.append("('cell_projection(jsonb,text,text,text)','"+hashlib.md5(NATIVE['body']('cell_projection').encode()).hexdigest()+"')")
    sql+="""DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES """+','.join(witnesses)+""") e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed mapping predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
"""
    sql+=scalar_helpers()
    required=[]
    grants=[]
    for table,entry in POLICY['tables'].items():
        for f in entry['fields']:
            typ='timestamp with time zone' if f['type']=='timestamptz' else f['type']
            required.append("('"+table+"','"+f['name']+"','"+typ+"')")
            if f['lexeme']:required.append("('"+table+"','"+f['lexeme']+"','text')")
        for name,typ in [('revision','bigint'),('archived_at','timestamp with time zone')]:
            required.append("('"+table+"','"+name+"','"+typ+"')")
        if entry['key'] not in CATALOG[table]['headers']:
            required.append("('"+table+"','"+entry['key']+"','text')")
        exposed=[f for f in entry['fields'] if f['position'] is not None]
        sql+=f'''CREATE FUNCTION stock_operational.column_project_{table}(r stock_operational.{table}) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_array(
 '''+',\n '.join(projection(f) for f in exposed)+');\n$$;\n'
        sql+=f'''CREATE FUNCTION stock_operational.column_input_{table}(cells jsonb) RETURNS stock_operational.{table}
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$'''+input_body(table)+'$$;\n'
        sql+=f'''CREATE FUNCTION stock_operational.column_compatible_{table}(r stock_operational.{table}) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE shape jsonb; encoding text; expected text;
BEGIN
 shape := to_jsonb(r);
 IF NOT (shape ? 'cell_kinds') THEN RETURN stock_operational.column_project_{table}(r); END IF;
 encoding := shape->>'cell_kinds';
 expected := '''+' || '.join(canonical_kind(f) for f in exposed)+f''';
 -- Canonical kind/width proof avoids decoding both projections for every row.
 -- Other encodings remain exact through the explicit retained legacy path;
 -- the audit independently compares values and exposes all differences.
 IF encoding=expected OR (encoding IS NULL AND expected=repeat('s',{len(exposed)})) THEN
  RETURN stock_operational.column_project_{table}(r);
 END IF;
 RETURN stock_operational.project_{table}(r);
END $$;
'''
        grants.extend([(f'column_project_{table}(stock_operational.{table})',signature(table,'project_')),
                       (f'column_compatible_{table}(stock_operational.{table})',signature(table,'project_')),
                       (f'column_input_{table}(jsonb)',signature(table,'input_'))])
    # Per-request capability validation uses catalogs (not permission-filtered
    # information_schema), so an existing table-scoped reader is not widened.
    sql+="""CREATE FUNCTION stock_operational.column_mapping_contract_v1() RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE kinds integer; all_kinds integer; valid integer;
BEGIN
 SELECT count(*) INTO valid FROM (VALUES """+','.join(required)+""") e(name,column_name,datatype)
 JOIN pg_class c ON c.relname=e.name AND c.relnamespace='stock_operational'::regnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype;
 IF valid<>"""+str(len(required))+""" THEN RAISE EXCEPTION 'Unsupported per-column schema'; END IF;
 SELECT count(*) INTO kinds FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND a.atttypid='text'::regtype;
 SELECT count(*) INTO all_kinds FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped;
 IF kinds=23 AND all_kinds=23 AND NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped AND c.relname NOT IN ("""+','.join("'"+t+"'" for t in CATALOG)+""")) THEN RETURN 'retained'; END IF;
 IF kinds=0 AND all_kinds=0 THEN RETURN 'final'; END IF;
 RAISE EXCEPTION 'Partial encoding-column schema';
END $$;
"""
    allnew=[g[0] for g in grants]+['column_mapping_contract_v1()']+[f'column_{t}_v1({t},text)' for t in ['numeric','bigint','boolean','jsonb']]
    for sig in allnew:sql+=f'REVOKE ALL ON FUNCTION stock_operational.{sig} FROM PUBLIC,anon,authenticated;\n'
    # Preserve only existing mapper callers. New scalar helpers/capability carry
    # no table privileges or memberships; original function owners/ACLs remain.
    pairs=','.join("('"+new+"','"+old+"')" for new,old in grants)
    helpers="ARRAY["+','.join("'"+s+"'" for s in allnew if s.startswith('column_mapping_') or re.match(r'column_(numeric|bigint|boolean|jsonb)_v1',s))+"]"
    sql+="""DO $callers$ DECLARE item record; helper text; BEGIN
 FOR item IN SELECT e.new_signature,pg_get_userbyid(a.grantee) AS name FROM (VALUES """+pairs+""") e(new_signature,old_signature)
 JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.old_signature)
 CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',item.new_signature,item.name);
  FOREACH helper IN ARRAY """+helpers+""" LOOP
   EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',helper,item.name);
  END LOOP;
 END LOOP;
END $callers$;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;
COMMIT;
"""
    return sql

def local_final_fixture():
    """No release DDL: only an isolated Unix-socket synthetic test database."""
    validate_policy()
    sql="""-- TEST ONLY. Not a production-removal artifact or authorization.
BEGIN;
SELECT 1 / (inet_server_addr() IS NULL AND current_database() LIKE 'ck_%' AND current_user='postgres' AND current_setting('stock.local_cell_kind_fixture',true)='synthetic-only')::int;
SELECT 1 / ((SELECT purpose='isolated-staging' FROM stock_operational.environment WHERE singleton))::int;
"""
    for table in CATALOG:
        text=native_body('validate_'+table)
        text='\n'.join(line for line in text.split('\n') if 'cell_kinds' not in line and 'supplied_encoding' not in line)
        text=text.replace(f'PERFORM stock_operational.project_{table}(NEW);',f'PERFORM stock_operational.column_project_{table}(NEW);')
        text=re.sub(r'IF ([^\n]+) THEN\nEND IF;\n','',text)
        sql+=f'CREATE OR REPLACE FUNCTION stock_operational.validate_{table}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=\'\' AS $$'+text+'$$;\n'
    for table in CATALOG:sql+=f'ALTER TABLE stock_operational.{table} DROP COLUMN cell_kinds RESTRICT;\n'
    sql+="SELECT 1 / (stock_operational.column_mapping_contract_v1()='final')::int;\nCOMMIT;\n"
    return sql

if __name__=='__main__':
    if sys.argv[1:]==['--local-final-fixture']:print(local_final_fixture(),end='')
    elif not sys.argv[1:]:print(generate(),end='')
    else:raise SystemExit('Use no arguments for additive SQL or --local-final-fixture for guarded synthetic test SQL')
