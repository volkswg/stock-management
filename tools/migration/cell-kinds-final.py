#!/usr/bin/env python3
"""Generate the guarded final retirement. No connections, records or execution.

Typed values and all existing lexemes stay authoritative. Only explicitly reviewed
missing optional tails may differ at the private array seam; public semantics
require a separate exact application/LINE comparison on a verified restore.
"""
import hashlib,json,re,runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CK=runpy.run_path(str(ROOT/'tools/migration/cell-kinds.py'))
CATALOG=CK['CATALOG']
COMPAT=(ROOT/'tools/migration/compatibility/20261117132332_cell_kinds_compatibility.sql').read_text()
# No generic padding waiver: these specific historical optional fields have
# existing reader defaults. A different prefix/value/type must stop removal.
OPTIONAL_TAILS={
 'shipments':['shippingBillUrl'],
 'employee_compensations':['commissionType','commissionBucketSales','commissionBucketAmount','commissionRoundupThreshold'],
 'employee_timesheets':['workdayType'],
 'expenses':['deletedAt'],
 'movement_details':['stockCounted','isNewArrival'],
 'user_state':['context'],
}

def literal(value):return "'"+value.replace("'","''")+"'"

def original_bodies():
    bodies={}
    for table in CATALOG:
        for prefix in ['input_','project_','validate_']:bodies[prefix+table]=CK['native_body'](prefix+table)
    for match in re.finditer(r'CREATE FUNCTION stock_operational\.(\w+)\(.*? AS \$\$(.*?)\$\$;',COMPAT,re.S):
        bodies[match[1]]=match[2]
    for name in ['native_timestamp_input','native_timestamp_text']:
        bodies[name]=CK['NATIVE']['body'](name,CK['NATIVE_SQL'])
    bodies['created_at_timestamp']=CK['NATIVE']['body']('created_at_timestamp',CK['NATIVE']['STABLE'])
    bodies['cell_projection']=CK['NATIVE']['body']('cell_projection')
    assert len(bodies)==147
    return bodies

def signatures():
    result={}
    for table in CATALOG:
        for prefix in ['input_','column_input_']:result[prefix+table]=prefix+table+'(jsonb)'
        for prefix in ['project_','column_project_','column_compatible_']:result[prefix+table]=prefix+table+'(stock_operational.'+table+')'
        result['validate_'+table]='validate_'+table+'()'
    for name,args in [('native_timestamp_input','text'),('native_timestamp_text','timestamptz'),
                      ('created_at_timestamp','text'),('cell_projection','jsonb,text,text,text'),
                      ('column_mapping_contract_v1','')]:result[name]=name+'('+args+')'
    for typ in ['numeric','bigint','boolean','jsonb']:result['column_'+typ+'_v1']='column_'+typ+'_v1('+typ+',text)'
    assert len(result)==147
    return result

def final_input(table):
    text=CK['input_body'](table)
    beginning=text.index("IF to_jsonb(r) ? 'cell_kinds' THEN")
    text=text[:beginning]+text[text.index('RETURN r;',beginning):]
    # Numeric boolean tokens have different business meaning from true/false.
    # Preserve their actual spelling in the EXISTING per-field lexeme, rather
    # than storing a generic kind vector or silently turning numeric1 into true.
    extras=[]
    for field in CK['POLICY']['tables'][table]['fields']:
        if field['type']=='boolean':
            extras.append(f'''IF jsonb_typeof(cells->{field['position']})='number' THEN r."{field['lexeme']}" := cells->>{field['position']}; END IF;''')
    if table=='user_state':
        # Official LINE writers supply strings. Do not make a formerly ignored
        # numeric identifier visible as a string after retiring its kind token.
        for i in range(5):
            extras.append(f"IF jsonb_typeof(cells->{i}) NOT IN ('string','null') THEN RAISE EXCEPTION 'LINE state identifiers require text'; END IF;")
    return text.replace('RETURN r;','\n'.join(extras)+'\nRETURN r;')

def final_bodies():
    bodies={}
    for table in CATALOG:
        bodies['column_input_'+table]=final_input(table)
        bodies['input_'+table]=f'BEGIN RETURN stock_operational.column_input_{table}(cells); END;'
        bodies['project_'+table]=f' SELECT stock_operational.column_project_{table}(r); '
        bodies['column_compatible_'+table]=f'BEGIN RETURN stock_operational.column_project_{table}(r); END;'
        validator=CK['native_body']('validate_'+table)
        validator='\n'.join(line for line in validator.split('\n') if 'cell_kinds' not in line and 'supplied_encoding' not in line)
        validator=re.sub(r'IF ([^\n]+) THEN\nEND IF;\n','',validator)
        assert 'cell_kinds' not in validator
        bodies['validate_'+table]=validator
    assert len(bodies)==115
    assert all('cell_kinds' not in body and 'cell_projection' not in body for body in bodies.values())
    return bodies

def difference_query(table):
    spec=CATALOG[table]
    exposed=[f for f in CK['POLICY']['tables'][table]['fields'] if f['position'] is not None]
    expected=' || '.join(CK['canonical_kind'](f).replace('r.','t.') for f in exposed)
    canonical=f"t.cell_kinds=({expected}) OR (t.cell_kinds IS NULL AND ({expected})=repeat('s',{len(exposed)}))"
    optional=[spec['headers'].index(name) for name in OPTIONAL_TAILS.get(table,[])]
    allowed='ARRAY['+','.join(map(str,optional))+']::int[]'
    # Every candidate row is validated. Known encodings reuse PR76's exact
    # projection proof; exceptional arrays are decoded/materialized only once.
    return f'''SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT CASE WHEN {canonical} THEN NULL::jsonb ELSE stock_operational.project_{table}(t) END old,
 stock_operational.column_project_{table}(t) candidate FROM stock_operational.{table} t
) SELECT FROM projections WHERE candidate IS NULL OR (old IS NOT NULL AND (
 jsonb_array_length(old)>jsonb_array_length(candidate)
 OR EXISTS(SELECT FROM generate_series(0,jsonb_array_length(candidate)-1) i
  WHERE CASE WHEN i<jsonb_array_length(old) THEN old->i IS DISTINCT FROM candidate->i
   ELSE NOT (i=ANY({allowed})) OR candidate->i IS DISTINCT FROM '\"\"'::jsonb END))))'''

def generate():
    CK['validate_policy']()
    originals=original_bodies();sigs=signatures();replacements=final_bodies()
    def seal():return """SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.cell_kinds_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
"""
    sql="""-- OPERATOR ONLY. PR76 or newer compatible app must be verified first.
-- No data update, no replacement encoding column, no extra grants or CASCADE.
-- A fresh restored recovery checkpoint and exact app/LINE parity are required.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
"""+seal()+"""SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_final_cell_kinds_removal',true)='reviewed-per-column-retirement-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.cell_kinds_semantics_verified',true)='exact-app-line-optional-tails-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
"""
    sql+='LOCK TABLE '+','.join('stock_operational.'+t for t in ['environment','revision',*CATALOG])+' IN ACCESS EXCLUSIVE MODE;\n'
    sql+=seal()+"SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;\n"
    values=','.join('('+literal(sigs[name])+','+literal(hashlib.md5(body.encode()).hexdigest())+')' for name,body in originals.items())
    sql+='''DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+values+''') e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed encoding predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
'''
    for table in CATALOG:
        sql+=f"DO $data$ BEGIN IF ({difference_query(table)}) THEN RAISE EXCEPTION 'Unreviewed encoding representation in {table}; inspect privately, never normalize blindly'; END IF; END $data$;\n"
    changes=','.join('('+literal(sigs[name])+','+literal(body)+')' for name,body in replacements.items())
    sql+='''DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+changes+''') e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
-- Refuse unknown procedural consumers too, beyond PostgreSQL's RESTRICT graph.
SELECT 1 / (NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('stock_operational.cell_projection(jsonb,text,text,text)'::regprocedure,'stock_operational.column_mapping_contract_v1()'::regprocedure)
 AND (p.prosrc LIKE '%cell_kinds%' OR p.prosrc LIKE '%cell_projection%')))::int;
'''
    for table in CATALOG:sql+=f'ALTER TABLE stock_operational.{table} DROP COLUMN cell_kinds RESTRICT;\n'
    sql+='''DROP FUNCTION stock_operational.cell_projection(jsonb,text,text,text) RESTRICT;
SELECT 1 / (stock_operational.column_mapping_contract_v1()='final')::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attname='cell_kinds' AND NOT a.attisdropped))::int;
COMMIT;
'''
    return sql

if __name__=='__main__':print(generate(),end='')
