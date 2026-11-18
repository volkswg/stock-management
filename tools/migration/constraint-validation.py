"""Operator-only replacement of duplicated validators, without changing records.

CHECK constraints cover the existing UTC lifecycle range. A shared trigger keeps
the OLD/NEW rules and empty-text normalization that CHECK cannot express.
"""
import hashlib
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TYPED = runpy.run_path(str(ROOT / 'tools/migration/typed-cleanup.py'))
CATALOG = TYPED['CATALOG']
literal = TYPED['literal']
BODIES = {n: b for n, b in TYPED['BODIES'].items() if n not in TYPED['RETIRED']}
BODIES.update(TYPED['REPLACEMENTS'])
SIGS = TYPED['SIGS']
GUARD = '''
DECLARE shape jsonb; blanks jsonb;
BEGIN
 IF TG_TABLE_SCHEMA<>'stock_operational' OR TG_WHEN<>'BEFORE' OR TG_LEVEL<>'ROW'
 OR TG_OP NOT IN ('INSERT','UPDATE') OR TG_NARGS<1 THEN
  RAISE EXCEPTION 'Unsupported record write guard';
 END IF;
 shape := to_jsonb(NEW);
 -- Only explicitly listed text columns are normalized. No full-row JSON
 -- reconstruction, numeric rounding, timestamp parsing or metadata edits.
 SELECT jsonb_object_agg(name,'null'::jsonb) INTO blanks
 FROM unnest(TG_ARGV[1:TG_NARGS-1]) AS fields(name)
 WHERE shape->name='""'::jsonb;
 IF blanks IS NOT NULL THEN
  NEW := jsonb_populate_record(NEW,blanks);
  shape := shape || blanks;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF shape->TG_ARGV[0] IS DISTINCT FROM to_jsonb(OLD)->TG_ARGV[0]
  OR OLD.archived_at IS NOT NULL THEN
   RAISE EXCEPTION 'Immutable identity, order or archived record';
  END IF;
  NEW.revision := OLD.revision+1;
 END IF;
 RETURN NEW;
END '''


def policy(table):
    """Fail closed if a predecessor ever acquires another validation rule."""
    body = BODIES['validate_' + table]
    text_fields = re.findall(r'NEW\."(\w+)" := nullif\(NEW\."\1",\'\'\);', body)
    timestamps = re.findall(r'PERFORM stock_operational.native_timestamp_text\(NEW\."(\w+)"\);', body)
    key = CATALOG[table]['key']
    rest = re.sub(r'NEW\."(\w+)" := nullif\(NEW\."\1",\'\'\);', '', body)
    rest = re.sub(r'PERFORM stock_operational.native_timestamp_text\(NEW\."\w+"\);', '', rest)
    expected = f'''BEGIN
IF TG_OP='UPDATE' THEN
IF NEW."{key}" IS DISTINCT FROM OLD."{key}" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
END IF;
PERFORM stock_operational.typed_project_{table}(NEW);
RETURN NEW; END'''
    assert ''.join(rest.split()) == ''.join(expected.split()), table
    assert timestamps and len(set(timestamps)) == len(timestamps)
    return key, text_fields, timestamps


def constraint_name(table):
    return table + '_lifecycle_range'


def predicate(table):
    return ' AND '.join(f'''("{field}" IS NULL OR ("{field}">=TIMESTAMPTZ '0001-01-01 00:00:00+00' AND "{field}"<TIMESTAMPTZ '10000-01-01 00:00:00+00'))'''
                        for field in policy(table)[2])


def constraint_definition(table):
    """Exact pg_get_constraintdef representation in a UTC fingerprint session."""
    clauses = [f'''(("{f}" IS NULL) OR (("{f}" >= '0001-01-01 00:00:00+00'::timestamp with time zone) AND ("{f}" < '10000-01-01 00:00:00+00'::timestamp with time zone)))'''
               for f in policy(table)[2]]
    expression = clauses[0] if len(clauses) == 1 else '(' + ' AND '.join(clauses) + ')'
    return 'CHECK (' + expression + ')'


def trigger(table):
    key, fields, _ = policy(table)
    args = ', '.join(literal(v) for v in [key, *fields])
    return f'CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.{table} FOR EACH ROW EXECUTE FUNCTION stock_operational.prepare_record_write({args});'


def generate():
    assert len(BODIES) == 74 and sum(len(policy(t)[2]) for t in CATALOG) == 47
    seal = '''SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.constraint_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
'''
    sql = '''-- OPERATOR ONLY. PR80 final typed schema; no automatic migration discovery.
-- Separate maintenance approval and fresh verified recovery required.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
''' + seal + '''SELECT 1/coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1/coalesce(current_setting('stock.allow_constraint_validation',true)='reviewed-row-constraints-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.constraint_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1/coalesce(current_setting('stock.constraint_reviewed_fingerprint',true) ~ '^[a-f0-9]{64}$',false)::int;
SELECT 1/coalesce(current_setting('stock.constraint_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.constraint_semantics_verified',true)='exact-app-line-consumers-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
'''
    tables = ['stock_migration.' + t for t in ['import_batches', *CATALOG]] + ['stock_operational.' + t for t in ['commands', 'revision', 'side_effects', 'environment', *CATALOG]]
    sql += 'LOCK TABLE ' + ','.join(tables) + ' IN ACCESS EXCLUSIVE MODE;\n' + seal
    sql += "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\n"
    sql += "SELECT 1/(to_regprocedure('stock_operational.prepare_record_write()') IS NULL)::int;\n"
    witnesses = ','.join('(' + literal(SIGS[n]) + ',' + literal(hashlib.md5(b.encode()).hexdigest()) + ')' for n, b in BODIES.items())
    sql += '''DO $witnesses$ DECLARE item record; actual text; BEGIN
 FOR item IN SELECT * FROM (VALUES ''' + witnesses + ''') e(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed typed function drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
-- The predecessor range check interprets the instant in UTC. Refuse settings
-- drift instead of silently changing its accepted domain to the fixed bounds.
SELECT 1/((SELECT NOT prosecdef AND provolatile='i' AND proconfig @> ARRAY['TimeZone=UTC'] FROM pg_proc WHERE oid='stock_operational.native_timestamp_text(timestamptz)'::regprocedure))::int;
'''
    validators = ','.join(literal('stock_operational.validate_' + t + '()') + '::regprocedure' for t in CATALOG)
    pattern = '(^|[^a-z0-9_])(validate_' + '|validate_'.join(CATALOG) + ')([^a-z0-9_]|$)'
    sql += '''-- Unknown procedural consumers must be reviewed, never cascaded away.
SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.oid NOT IN (''' + validators + ') AND lower(p.prosrc) ~ ' + literal(pattern) + '''))::int;
-- All predecessor guards must share exactly one invoker owner/ACL/config.
SELECT 1/((SELECT count(*)=1 FROM (SELECT DISTINCT proowner,proacl::text,proconfig,prosecdef FROM pg_proc WHERE oid IN (''' + validators + ''')) s))::int;
SELECT 1/((SELECT bool_and(NOT prosecdef AND proowner=current_user::regrole) FROM pg_proc WHERE oid IN (''' + validators + ''')))::int;
'''
    for table in CATALOG:
        old = 'CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.' + table + ' FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_' + table + '()'
        sql += f"SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(tgenabled='O' AND pg_get_triggerdef(oid)={literal(old)}) FROM pg_trigger WHERE tgrelid='stock_operational.{table}'::regclass AND tgname='a_validate'),false)::int;\n"
    sql += '''CREATE FUNCTION stock_operational.prepare_record_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$''' + GUARD + '''$$;
-- Copy the exact common ACL, including grant options, rather than granting
-- a new runtime capability. Refuse defaults/ownership that cannot be preserved.
DO $permissions$ DECLARE item record; caller text; BEGIN
 FOR item IN SELECT * FROM aclexplode((SELECT coalesce(proacl,acldefault('f',proowner)) FROM pg_proc WHERE oid='stock_operational.prepare_record_write()'::regprocedure)) LOOP
  caller := CASE WHEN item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(item.grantee)) END;
  EXECUTE 'REVOKE ALL ON FUNCTION stock_operational.prepare_record_write() FROM '||caller;
 END LOOP;
 FOR item IN SELECT * FROM aclexplode((SELECT coalesce(proacl,acldefault('f',proowner)) FROM pg_proc WHERE oid='stock_operational.validate_orders()'::regprocedure)) LOOP
  IF item.grantee=0 OR pg_get_userbyid(item.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public validator access'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.prepare_record_write() TO %I%s',pg_get_userbyid(item.grantee),CASE WHEN item.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
END $permissions$;
SELECT 1/((SELECT ARRAY(SELECT a::text FROM unnest(coalesce(proacl,acldefault('f',proowner))) a ORDER BY a::text) FROM pg_proc WHERE oid='stock_operational.prepare_record_write()'::regprocedure)=(SELECT ARRAY(SELECT a::text FROM unnest(coalesce(proacl,acldefault('f',proowner))) a ORDER BY a::text) FROM pg_proc WHERE oid='stock_operational.validate_orders()'::regprocedure))::int;
SELECT 1/((SELECT proconfig FROM pg_proc WHERE oid='stock_operational.prepare_record_write()'::regprocedure)=(SELECT proconfig FROM pg_proc WHERE oid='stock_operational.validate_orders()'::regprocedure))::int;
'''
    for table in CATALOG:
        sql += f'ALTER TABLE stock_operational.{table} ADD CONSTRAINT {constraint_name(table)} CHECK ({predicate(table)}) NOT VALID;\n'
        sql += f'ALTER TABLE stock_operational.{table} VALIDATE CONSTRAINT {constraint_name(table)};\n'
        sql += f'DROP TRIGGER a_validate ON stock_operational.{table};\n' + trigger(table) + '\n'
    for table in CATALOG:
        sql += f'DROP FUNCTION stock_operational.validate_{table}() RESTRICT;\n'
    sql += "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"
    return sql


if __name__ == '__main__':
    print(generate(), end='')
