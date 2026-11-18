#!/usr/bin/env python3
"""Additive lexeme compatibility. No connections, data repair or release removal.

The retained mode uses the unchanged released mappings. Typed candidates have
explicit transport policies; their semantic review is a later removal gate.
"""
import hashlib,json,re,runpy,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
FINAL=runpy.run_path(str(ROOT/'tools/migration/cell-kinds-final.py'))
CK=FINAL['CK'];POLICY=CK['POLICY'];CATALOG=CK['CATALOG'];literal=FINAL['literal']

def predecessors():
    bodies=FINAL['original_bodies']();bodies.update(FINAL['final_bodies']())
    del bodies['cell_projection']
    assert len(bodies)==146
    return bodies

def project(table):
    fields=[]
    for f in POLICY['tables'][table]['fields']:
        if f['position'] is None:continue
        value='r."'+f['name']+'"'
        if f['type'] in ('numeric','bigint'):
            # Decimal/integer text avoids a JSON/JavaScript double round trip.
            fields.append(f"to_jsonb(coalesce({value}::text,''))")
        elif f['type']=='boolean':fields.append(f"coalesce(to_jsonb({value}),'\"\"'::jsonb)")
        elif f['type']=='jsonb':fields.append(f"to_jsonb(coalesce({value}::text,''))")
        else:fields.append(CK['projection'](f))
    return ' SELECT jsonb_build_array(\n '+',\n '.join(fields)+');\n'

def input_body(table):
    text=FINAL['final_input'](table)
    # No field accessor or dynamic sidecar storage is left in this candidate.
    text='\n'.join(line for line in text.split('\n') if '__lexeme' not in line)
    for f in POLICY['tables'][table]['fields']:
        value=f"cells->{f['position']}";scalar=f"cells->>{f['position']}"
        if f['type']=='boolean':
            # Existing application readers do not interpret PostgreSQL aliases
            # such as 1,t,yes as true. Never silently reinterpret them as true.
            expression=f'lower({scalar})'
            if table in ('shops','expense_categories'):expression=f'lower(btrim({scalar}))'
            old=f'r."{f["name"]}" := nullif((cells->>{f["position"]}),\'\')::boolean;'
            new=f'''IF {scalar} IS NULL OR {scalar}='' THEN r."{f['name']}" := NULL;
ELSIF jsonb_typeof({value})='boolean' OR ({expression}) IN ('true','false') THEN r."{f['name']}" := ({expression})::boolean;
ELSE RAISE EXCEPTION 'Ambiguous boolean requires an explicit true/false value'; END IF;'''
            assert text.count(old)==1,(table,f['name']);text=text.replace(old,new)
        elif f['type']=='jsonb':
            old=f'r."{f["name"]}" := nullif(nullif((cells->>{f["position"]}),\'\')::jsonb,\'null\'::jsonb);'
            new=f'r."{f["name"]}" := nullif((cells->>{f["position"]}),\'\')::jsonb;'
            assert text.count(old)==1,(table,f['name']);text=text.replace(old,new)
    assert '__lexeme' not in text and 'cell_kinds' not in text
    return text

def signatures():
    result=[]
    for table in CATALOG:
        result.extend([(f'typed_project_{table}(stock_operational.{table})',f'column_project_{table}(stock_operational.{table})'),
                       (f'typed_input_{table}(jsonb)',f'column_input_{table}(jsonb)')])
    return result

def generate():
    CK['validate_policy']()
    sigs=FINAL['signatures']()
    witnesses=','.join('('+literal(sigs[n])+','+literal(hashlib.md5(body.encode()).hexdigest())+')' for n,body in predecessors().items())
    seal="SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;\n"
    sql="""-- OPERATOR ONLY: additive compatibility, all48 lexeme columns retained.
-- No existing function replacement, table DDL, record rewrite or normalization.
-- Outside automatic migration discovery; hosted execution needs separate approval.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
"""+seal+"""SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_lexeme_compatibility',true)='reviewed-typed-columns-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
"""+seal+"""SELECT 1 / (stock_operational.column_mapping_contract_v1()='final')::int;
SELECT 1 / (to_regprocedure('stock_operational.lexeme_mapping_contract_v1()') IS NULL)::int;
DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES """+witnesses+""") e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed lexeme predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
"""
    for table in CATALOG:
        sql+=f'''CREATE FUNCTION stock_operational.typed_project_{table}(r stock_operational.{table}) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$'''+project(table)+'$$;\n'
        sql+=f'''CREATE FUNCTION stock_operational.typed_input_{table}(cells jsonb) RETURNS stock_operational.{table}
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$'''+input_body(table)+'$$;\n'
    required=[];lexemes=[]
    for table,spec in POLICY['tables'].items():
        for f in spec['fields']:
            typ='timestamp with time zone' if f['type']=='timestamptz' else f['type']
            required.append((table,f['name'],typ))
            if f['lexeme']:lexemes.append((table,f['lexeme'],'text'))
        required.extend([(table,'revision','bigint'),(table,'archived_at','timestamp with time zone')])
        if spec['key'] not in CATALOG[table]['headers']:required.append((table,spec['key'],'text'))
    values=lambda rows:','.join('('+','.join(literal(v) for v in row)+')' for row in rows)
    def count(rows):return "SELECT count(*) FROM (VALUES "+values(rows)+") e(name,column_name,datatype) JOIN pg_class c ON c.relname=e.name AND c.relnamespace='stock_operational'::regnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=e.datatype"
    sql+='''CREATE FUNCTION stock_operational.lexeme_mapping_contract_v1() RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE valid integer; lexemes integer; total integer;
BEGIN
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND NOT a.attisdropped AND a.attname IN ('business_cells','row_order','cell_kinds','created_at_instant');
 IF total<>0 THEN RAISE EXCEPTION 'Unsupported predecessor schema'; END IF;
 SELECT ('''+count(required)+''') INTO valid;
 IF valid<>'''+str(len(required))+''' THEN RAISE EXCEPTION 'Unsupported typed-column schema'; END IF;
 SELECT ('''+count(lexemes)+''') INTO lexemes;
 SELECT count(*) INTO total FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND NOT a.attisdropped AND right(a.attname,8)='__lexeme';
 IF lexemes=48 AND total=48 THEN RETURN 'retained'; END IF;
 IF lexemes=0 AND total=0 THEN
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='stock_operational'::regnamespace
   AND p.oid<>'stock_operational.lexeme_mapping_contract_v1()'::regprocedure
   AND strpos(p.prosrc,'__lexeme')>0) THEN RAISE EXCEPTION 'Incomplete lexeme function retirement'; END IF;
  RETURN 'typed';
 END IF;
 RAISE EXCEPTION 'Partial lexeme schema';
END $$;
'''
    pairs=signatures()
    for sig,_ in pairs:sql+=f'REVOKE ALL ON FUNCTION stock_operational.{sig} FROM PUBLIC,anon,authenticated;\n'
    sql+='REVOKE ALL ON FUNCTION stock_operational.lexeme_mapping_contract_v1() FROM PUBLIC,anon,authenticated;\n'
    # Copy exact existing function callers; no new business/table capabilities.
    sql+='''DO $callers$ DECLARE item record; BEGIN
 FOR item IN SELECT e.new_signature,pg_get_userbyid(a.grantee) AS name FROM (VALUES '''+values(pairs)+''') e(new_signature,old_signature)
 JOIN pg_proc p ON p.oid=to_regprocedure('stock_operational.'||e.old_signature)
 CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.%s TO %I',item.new_signature,item.name);
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.lexeme_mapping_contract_v1() TO %I',item.name);
 END LOOP;
END $callers$;
SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;
COMMIT;
'''
    return sql

def local_fixture():
    """Synthetic component fixture, never a production-removal implementation."""
    sql="""-- TEST ONLY. No release DDL or production approval.
BEGIN;
SELECT 1 / (inet_server_addr() IS NULL AND current_database() LIKE 'lx_%' AND current_user='postgres' AND current_setting('stock.local_lexeme_fixture',true)='synthetic-only')::int;
SELECT 1 / ((SELECT purpose='isolated-staging' FROM stock_operational.environment WHERE singleton))::int;
SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;
"""
    # Redirect the old trigger/projector family without bypassing validation.
    for table in CATALOG:
        for name,body in [('input_'+table,f'BEGIN RETURN stock_operational.typed_input_{table}(cells); END;'),
                          ('column_input_'+table,f'BEGIN RETURN stock_operational.typed_input_{table}(cells); END;'),
                          ('project_'+table,f' SELECT stock_operational.typed_project_{table}(r); '),
                          ('column_project_'+table,f' SELECT stock_operational.typed_project_{table}(r); ')]:
            sig=FINAL['signatures']()[name]
            sql+=replace_body(sig,body)
        body=FINAL['final_bodies']()['validate_'+table]
        body='\n'.join(line for line in body.split('\n') if '__lexeme' not in line)
        body=re.sub(r'IF ([^\n]+) THEN\nEND IF;\n','',body)
        sql+=replace_body('validate_'+table+'()',body)
    sql+=replace_body('column_mapping_contract_v1()',"BEGIN RETURN 'final'; END;")
    for table,spec in POLICY['tables'].items():
        for f in spec['fields']:
            if f['lexeme']:sql+=f'ALTER TABLE stock_operational.{table} DROP COLUMN "{f["lexeme"]}" RESTRICT;\n'
    return sql+"SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"

def replace_body(signature,body):
    return '''DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('''+literal('stock_operational.'+signature)+''');
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous fixture body'; END IF;
 EXECUTE replace(definition,old_body,'''+literal(body)+''');
END $replace$;
'''

if __name__=='__main__':print(local_fixture() if sys.argv[1:]==['--local-typed-fixture'] else generate(),end='')
