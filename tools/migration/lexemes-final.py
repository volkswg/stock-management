#!/usr/bin/env python3
"""Generate guarded operator retirement; no connections or record normalization."""
import hashlib,re,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LX=runpy.run_path(str(ROOT/'tools/migration/lexemes.py'))
CATALOG=LX['CATALOG'];POLICY=LX['POLICY'];literal=LX['literal']
COMPAT=(ROOT/'tools/migration/compatibility/20261118022702_lexeme_compatibility.sql').read_text()
RETIRED_HELPERS={f'column_{typ}_v1' for typ in ['numeric','bigint','boolean','jsonb']}

def originals():
    result=LX['predecessors']()
    for match in re.finditer(r'CREATE FUNCTION stock_operational\.(\w+)\(.*? AS \$\$(.*?)\$\$;',COMPAT,re.S):result[match[1]]=match[2]
    assert len(result)==193
    return result

def signatures():
    result=LX['FINAL']['signatures']()
    for table in CATALOG:
        result['typed_input_'+table]=f'typed_input_{table}(jsonb)'
        result['typed_project_'+table]=f'typed_project_{table}(stock_operational.{table})'
    result['lexeme_mapping_contract_v1']='lexeme_mapping_contract_v1()'
    return result

def replacements():
    result={}
    for table,spec in POLICY['tables'].items():
        if not any(f['lexeme'] for f in spec['fields']):continue
        for prefix in ['input_','column_input_']:result[prefix+table]=f'BEGIN RETURN stock_operational.typed_input_{table}(cells); END;'
        for prefix in ['project_','column_project_']:result[prefix+table]=f' SELECT stock_operational.typed_project_{table}(r); '
        body=LX['FINAL']['final_bodies']()['validate_'+table]
        body='\n'.join(line for line in body.split('\n') if '__lexeme' not in line)
        result['validate_'+table]=re.sub(r'IF ([^\n]+) THEN\nEND IF;\n','',body)
    result['column_mapping_contract_v1']="BEGIN PERFORM stock_operational.lexeme_mapping_contract_v1(); RETURN 'final'; END;"
    # The receipt writer emits JSON.stringify(payment_details ?? null). Preserve
    # its JSON-null text when the legacy SQLNULL spelling sidecar is removed.
    old=LX['project']('sales_receipt_payments')
    needle='to_jsonb(coalesce(r."paymentDetailsJson"::text,\'\'))'
    assert old.count(needle)==1
    result['typed_project_sales_receipt_payments']=old.replace(needle,'to_jsonb(coalesce(r."paymentDetailsJson"::text,\'null\'))')
    assert len(result)==97
    assert all('__lexeme' not in body for body in result.values())
    return result

def data_guard(table):
    bad=[]
    for f in POLICY['tables'][table]['fields']:
        if f['position'] is None:continue
        i=f['position'];old=f'old->{i}';new=f'candidate->{i}';ot=f'old->>{i}';nt=f'candidate->>{i}'
        if f['type'] in ('numeric','bigint'):
            # SQL numeric comparison never introduces a JavaScript double.
            bad.append(f"nullif({ot},'')::numeric IS DISTINCT FROM nullif({nt},'')::numeric")
        elif f['type']=='boolean':
            value=f"coalesce({ot},'')"
            if table in ('shops','expense_categories'):value=f'btrim({value})'
            bad.append(f"(lower({value})='true') IS DISTINCT FROM (coalesce({nt},'')='true')")
        elif f['type']=='jsonb':
            left=f"nullif({ot},'')::jsonb";right=f"nullif({nt},'')::jsonb"
            if table=='sales_receipt_payments' and f['name']=='paymentDetailsJson':
                left=f"coalesce({left},'null'::jsonb)";right=f"coalesce({right},'null'::jsonb)"
            bad.append(f'{left} IS DISTINCT FROM {right}')
        else:bad.append(f'{old} IS DISTINCT FROM {new}')
    width=len(CATALOG[table]['headers'])
    return f'''SELECT EXISTS(WITH projections AS MATERIALIZED (
 SELECT stock_operational.column_project_{table}(t) old,stock_operational.typed_project_{table}(t) candidate
 FROM stock_operational.{table} t
) SELECT FROM projections WHERE old IS NULL OR candidate IS NULL
 OR jsonb_array_length(old)<>{width} OR jsonb_array_length(candidate)<>{width}
 OR ('''+') OR ('.join(bad)+'))'

def replace_group(items):
    sigs=signatures();values=','.join('('+literal(sigs[name])+','+literal(body)+')' for name,body in items.items())
    return '''DO $replace$ DECLARE item record; definition text; old_body text; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+values+''') e(signature,body) LOOP
  SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
  EXECUTE replace(definition,old_body,item.body);
 END LOOP;
END $replace$;
'''

def generate():
    old=originals();sigs=signatures();changed=replacements()
    def seal():return """SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.lexeme_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
"""
    sql="""-- OPERATOR ONLY. Released PR78-or-newer app, restored recovery and exact
-- application/LINE consumer review required. No data repair or new encoding.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
"""+seal()+"""SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_final_lexeme_removal',true)='reviewed-typed-retirement-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_reviewed_fingerprint',true) ~ '^[a-f0-9]{64}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1 / coalesce(current_setting('stock.lexeme_semantics_verified',true)='exact-app-line-consumers-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
"""
    locks=['stock_migration.'+t for t in ['import_batches',*CATALOG]]+['stock_operational.'+t for t in ['commands','revision','side_effects','environment',*CATALOG]]
    assert len(locks)==51
    sql+='LOCK TABLE '+','.join(locks)+' IN ACCESS EXCLUSIVE MODE;\n'+seal()
    sql+="SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='retained')::int;\n"
    values=','.join('('+literal(sigs[n])+','+literal(hashlib.md5(body.encode()).hexdigest())+')' for n,body in old.items())
    sql+='''DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+values+''') e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed lexeme predecessor drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 WHERE c.relnamespace='stock_operational'::regnamespace AND c.relkind IN ('r','p')
 AND NOT a.attisdropped AND right(a.attname,8)='__lexeme' AND coalesce(cardinality(a.attacl),0)>0))::int;
-- PostgreSQL can automatically remove column-owned indexes/constraints even
-- with RESTRICT. Refuse ALL unreviewed attribute dependencies before any DROP.
SELECT 1 / (NOT EXISTS(SELECT FROM pg_depend d JOIN pg_attribute a
 ON d.refclassid='pg_class'::regclass AND d.refobjid=a.attrelid AND d.refobjsubid=a.attnum
 JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace
 AND NOT a.attisdropped AND right(a.attname,8)='__lexeme'))::int;
'''
    payment='typed_project_sales_receipt_payments'
    sql+=replace_group({payment:changed[payment]})
    for table in CATALOG:sql+=f"DO $values$ BEGIN IF ({data_guard(table)}) THEN RAISE EXCEPTION 'Unreviewed typed representation in {table}; inspect privately, never repair automatically'; END IF; END $values$;\n"
    sql+=replace_group({name:body for name,body in changed.items() if name!=payment})
    excluded=["'stock_operational.lexeme_mapping_contract_v1()'::regprocedure"]+[literal('stock_operational.'+sigs[n])+'::regprocedure' for n in sorted(RETIRED_HELPERS)]
    patterns="strpos(p.prosrc,'__lexeme')>0 OR "+' OR '.join('strpos(p.prosrc,'+literal(n)+')>0' for n in sorted(RETIRED_HELPERS))
    sql+='''SELECT 1 / (NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('''+','.join(excluded)+') AND ('+patterns+')))::int;\n'
    for table,spec in POLICY['tables'].items():
        for f in spec['fields']:
            if f['lexeme']:sql+=f'ALTER TABLE stock_operational.{table} DROP COLUMN "{f["lexeme"]}" RESTRICT;\n'
    for name in sorted(RETIRED_HELPERS):sql+=f'DROP FUNCTION stock_operational.{sigs[name]} RESTRICT;\n'
    sql+="SELECT 1 / (stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"
    return sql

if __name__=='__main__':print(generate(),end='')
