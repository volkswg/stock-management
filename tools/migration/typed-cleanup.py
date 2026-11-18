"""Reproducible, operator-only retirement of obsolete mapper entrypoints."""
import hashlib,re,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LF=runpy.run_path(str(ROOT/'tools/migration/lexemes-final.py'))
CATALOG=LF['CATALOG'];literal=LF['literal']
BODIES=LF['originals']();BODIES.update(LF['replacements']())
for name in LF['RETIRED_HELPERS']:del BODIES[name]
SIGS=LF['signatures']()
sql=(ROOT/'supabase/migrations/20261111034402_remove_operational_audit.sql').read_text()
BODIES['advance_revision']=re.search(r'CREATE FUNCTION stock_operational.advance_revision\(\).*?AS \$\$(.*?)\$\$;',sql,re.S)[1]
SIGS['advance_revision']='advance_revision()'
PREFIXES=['column_compatible_','column_project_','project_','column_input_','input_']
RETIRED=[prefix+table for prefix in PREFIXES for table in CATALOG]+['column_mapping_contract_v1']
assert len(BODIES)==190 and len(RETIRED)==116
REPLACEMENTS={}
for table in CATALOG:
 name='validate_'+table;old='stock_operational.project_'+table+'(';new='stock_operational.typed_project_'+table+'('
 assert BODIES[name].count(old)==1,name
 REPLACEMENTS[name]=BODIES[name].replace(old,new)


def generate():
 seal="""SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.mapper_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
"""
 s="""-- OPERATOR ONLY. Final typed schema and reviewed recovery required.
-- No table/record/role changes. Never execute through automatic discovery.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
"""+seal+"""SELECT 1/coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1/coalesce(current_setting('stock.allow_legacy_mapper_cleanup',true)='reviewed-typed-only-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_reviewed_fingerprint',true) ~ '^[a-f0-9]{64}$',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.mapper_semantics_verified',true)='exact-app-line-consumers-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
"""
 tables=['stock_migration.'+t for t in ['import_batches',*CATALOG]]+['stock_operational.'+t for t in ['commands','revision','side_effects','environment',*CATALOG]]
 s+='LOCK TABLE '+','.join(tables)+' IN ACCESS EXCLUSIVE MODE;\n'+seal+"SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\n"
 values=','.join('('+literal(SIGS[n])+','+literal(hashlib.md5(b.encode()).hexdigest())+')' for n,b in BODIES.items())
 s+='''DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+values+''') e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed mapper predecessor: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
'''
 s+=LF['replace_group'](REPLACEMENTS)
 oids=','.join(literal('stock_operational.'+SIGS[n])+'::regprocedure' for n in RETIRED)
 pattern='(^|[^a-z0-9_])('+'|'.join(RETIRED)+')([^a-z0-9_]|$)'
 s+='''-- Include external procedural consumers: PostgreSQL does not track every
-- PL/pgSQL body reference as a catalog dependency. Refuse, never cascade.
SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN ('''+oids+') AND lower(p.prosrc) ~ '+literal(pattern)+'))::int;\n'
 for name in RETIRED:s+='DROP FUNCTION stock_operational.'+SIGS[name]+' RESTRICT;\n'
 s+="SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"
 return s
if __name__=='__main__':print(generate(),end='')
