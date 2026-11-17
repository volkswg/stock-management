#!/usr/bin/env python3
"""Generate the explicit operator-only lifecycle timestamp conversion.

Uses immutable predecessor bodies as drift witnesses. No connections or data IO.
"""
import hashlib, json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CATALOG=json.loads((ROOT/'tools/migration/worksheets.json').read_text())
NAMED=(ROOT/'supabase/migrations/20261116200541_named_column_authority.sql').read_text()
STABLE=(ROOT/'supabase/migrations/20261117024806_stable_record_ids_created_at.sql').read_text()
TARGET_FIELDS=('createdAt','updatedAt','deletedAt')
def body(name,source=NAMED):
    found=re.search(r'CREATE FUNCTION stock_operational\.'+re.escape(name)+r'\(.*? AS \$\$(.*?)\$\$;',source,re.S)
    if not found:raise ValueError('Missing immutable predecessor function '+name)
    return found[1]
def fields():
    return [(table,name,spec['headers'].index(name) if name in spec['headers'] else None) for table,spec in CATALOG.items() for name in TARGET_FIELDS if name in spec['columns'] or name=='createdAt']
def generate():
    witnesses=[]
    for table in CATALOG:
        for name in ['input_'+table,'project_'+table,'validate_'+table]:
            text=body(name).replace(' OR NEW.row_order IS DISTINCT FROM OLD.row_order','')
            signature=name+('()' if name.startswith('validate_') else '(jsonb)' if name.startswith('input_') else '(stock_operational.'+table+')')
            witnesses.append("('"+signature+"','"+hashlib.md5(text.encode()).hexdigest()+"')")
    for name,args in [('created_at_timestamp','text'),('set_created_at_instant','')]:
        witnesses.append("('"+name+'('+args+")','"+hashlib.md5(body(name,STABLE).encode()).hexdigest()+"')")
    manifest=','.join("('"+t+"','"+c+"',"+('NULL' if i is None else str(i))+')' for t,c,i in fields())
    locks=','.join('stock_operational.'+t for t in ['environment','revision',*CATALOG])
    sql="""-- OPERATOR ONLY. Deploy the compatible reader first, then execute under an approved freeze.
-- Existing names become native timestamptz; no timestamp text sidecars or inferred history.
-- Outside automatic migration discovery. Reviewed recovery/semantic evidence is mandatory.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce(current_setting('stock.expected_purpose',true) IN ('production','isolated-staging'),false)::int;
SELECT 1 / coalesce(current_setting('stock.allow_native_timestamps',true)='reviewed-lifecycle-timestamptz-v1',false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.timestamp_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
SELECT 1 / coalesce(current_setting('stock.timestamp_reviewed_source',true) ~ '^[a-f0-9]{40}$',false)::int;
SELECT 1 / coalesce(current_setting('stock.timestamp_restore_verified',true)='51-tables-15-metadata-v1',false)::int;
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
SELECT 1 / (NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename LIKE 'stock_%' AND xact_start IS NOT NULL))::int;
SELECT 1 / (NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('row_order','business_cells')))::int;
SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant' AND data_type='timestamp with time zone'))::int;
"""+f'LOCK TABLE {locks} IN ACCESS EXCLUSIVE MODE;\n'
    # A writer may have committed while this transaction waited for its locks.
    # Re-read the seal only AFTER owning both writer channels and all tables;
    # keep identity/revision control rows locked through the conversion too.
    sql+="""SELECT 1 / coalesce((SELECT count(*)=1 AND bool_and(isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true)) FROM stock_operational.environment),false)::int;
SELECT 1 / coalesce((SELECT value::text=current_setting('stock.timestamp_reviewed_revision',true) FROM stock_operational.revision WHERE singleton),false)::int;
"""
    sql+="""-- Validate all predecessor bodies before rewriting any schema or functions.
DO $witnesses$
DECLARE item record; actual text;
BEGIN
 FOR item IN SELECT * FROM (VALUES """+','.join(witnesses)+""") expected(signature,hash) LOOP
  SELECT prosrc INTO STRICT actual FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.signature);
  IF md5(actual)<>item.hash THEN RAISE EXCEPTION 'Unreviewed timestamp mapper/validator drift: %',item.signature; END IF;
 END LOOP;
END $witnesses$;
CREATE FUNCTION stock_operational.native_timestamp_text(value timestamptz) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
BEGIN
 IF value IS NULL THEN RETURN NULL; END IF;
 IF NOT isfinite(value) OR extract(year FROM value)<1 OR extract(year FROM value)>9999 THEN RAISE EXCEPTION 'Timestamp outside supported finite ISO range'; END IF;
 IF mod(extract(microseconds FROM value)::bigint,1000)=0 THEN
  RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 END IF;
 RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
END $$;
CREATE FUNCTION stock_operational.native_timestamp_input(value text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
DECLARE instant timestamptz;
BEGIN
 IF value IS NULL OR value='' THEN RETURN NULL; END IF;
 instant := stock_operational.created_at_timestamp(value);
 IF instant IS NULL THEN RAISE EXCEPTION 'Nonempty timestamp requires an unambiguous valid ISO date/time'; END IF;
 PERFORM stock_operational.native_timestamp_text(instant);
 RETURN instant;
END $$;
REVOKE ALL ON FUNCTION stock_operational.native_timestamp_text(timestamptz),stock_operational.native_timestamp_input(text) FROM PUBLIC,anon,authenticated;
-- Preserve existing mapper callers' capabilities, without granting a role,
-- granting business writes, exposing data or changing existing function ACLs.
DO $callers$
DECLARE item record;
BEGIN
 FOR item IN SELECT DISTINCT pg_get_userbyid(a.grantee) AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname='stock_operational' AND (p.proname LIKE 'input\\_%' ESCAPE '\\' OR p.proname LIKE 'project\\_%' ESCAPE '\\') AND a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.native_timestamp_text(timestamptz) TO %I',item.name);
 END LOOP;
 FOR item IN SELECT DISTINCT pg_get_userbyid(a.grantee) AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname='stock_operational' AND p.proname LIKE 'input\\_%' ESCAPE '\\' AND a.privilege_type='EXECUTE' AND a.grantee<>0 AND pg_get_userbyid(a.grantee) NOT IN ('anon','authenticated') LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.native_timestamp_input(text) TO %I',item.name);
 END LOOP;
END $callers$;
-- Check every active AND archived value first. Invalid/ambiguous nonempty text
-- aborts the whole transaction; blanks remain NULL, and time precision is kept.
DO $values$
DECLARE item record; actual regtype; bad boolean;
BEGIN
 FOR item IN SELECT * FROM (VALUES """+manifest+""") f(name,column_name,cell_index) LOOP
  SELECT atttypid::regtype INTO STRICT actual FROM pg_attribute WHERE attrelid=('stock_operational.'||item.name)::regclass AND attname=item.column_name AND NOT attisdropped;
  IF actual<>'text'::regtype THEN RAISE EXCEPTION 'Unexpected predecessor timestamp type'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT FROM stock_operational.%I WHERE %I IS NOT NULL AND %I<>'''' AND stock_operational.created_at_timestamp(%I) IS NULL)',item.name,item.column_name,item.column_name,item.column_name) INTO bad;
  IF bad THEN RAISE EXCEPTION 'Unconvertible timestamp in %.%; inspect privately, never coerce to NULL',item.name,item.column_name; END IF;
  EXECUTE format('SELECT count(stock_operational.native_timestamp_text(stock_operational.native_timestamp_input(%I))) FROM stock_operational.%I',item.column_name,item.name);
 END LOOP;
END $values$;
"""
    # Remove only the known obsolete derivation, never disable validation/RLS.
    for table in CATALOG:
        sql+=f'DROP TRIGGER b_created_at_instant ON stock_operational.{table};\n'
    for table in CATALOG:
        columns=[(name,index) for name_table,name,index in fields() if name_table==table]
        for name,index in columns:
            if index is None:sql+=f'ALTER TABLE stock_operational.{table} ALTER COLUMN "{name}" DROP DEFAULT;\n'
        # One table rewrite, including tables with all three lifecycle fields.
        changes=','.join(f'ALTER COLUMN "{name}" TYPE timestamptz USING stock_operational.native_timestamp_input("{name}")' for name,index in columns)
        sql+=f'ALTER TABLE stock_operational.{table} {changes};\n'
        for name,index in columns:
            if index is None:sql+=f'ALTER TABLE stock_operational.{table} ALTER COLUMN "{name}" SET DEFAULT statement_timestamp();\n'
    sql+="""DO $mappers$
DECLARE item record; field record; signature text; definition text; replacement text; old_fragment text; new_fragment text;
BEGIN
 FOR item IN SELECT unnest(ARRAY["""+','.join("'"+t+"'" for t in CATALOG)+"""]) AS name LOOP
  FOREACH signature IN ARRAY ARRAY['input_'||item.name||'(jsonb)','project_'||item.name||'(stock_operational.'||item.name||')','validate_'||item.name||'()'] LOOP
   SELECT pg_get_functiondef(to_regprocedure('stock_operational.'||signature)) INTO STRICT definition;
   replacement:=definition;
   FOR field IN SELECT * FROM (VALUES """+manifest+""") f(name,column_name,cell_index) WHERE name=item.name AND cell_index IS NOT NULL LOOP
    IF signature LIKE 'input\\_%' ESCAPE '\\' THEN
     old_fragment:=format('r.%I := nullif((cells->>%s),'''')::text;',field.column_name,field.cell_index);
     -- pg_get_functiondef retains quoted camelCase identifiers in the body.
     new_fragment:=format('r.%I := stock_operational.native_timestamp_input(cells->>%s);',field.column_name,field.cell_index);
    ELSIF signature LIKE 'project\\_%' ESCAPE '\\' THEN
     old_fragment:=format('to_jsonb(r.%I)',field.column_name);
     new_fragment:=format('to_jsonb(stock_operational.native_timestamp_text(r.%I))',field.column_name);
    ELSE
     old_fragment:=format('NEW.%I := nullif(NEW.%I,'''');',field.column_name,field.column_name);
     new_fragment:=format('PERFORM stock_operational.native_timestamp_text(NEW.%I);',field.column_name);
    END IF;
    IF (length(replacement)-length(replace(replacement,old_fragment,'')))/length(old_fragment)<>1 THEN RAISE EXCEPTION 'Unexpected timestamp mapper fragment'; END IF;
    replacement:=replace(replacement,old_fragment,new_fragment);
   END LOOP;
   IF signature LIKE 'validate\\_%' ESCAPE '\\' AND item.name IN ('sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','stock_counts') THEN
    replacement:=replace(replacement,'PERFORM stock_operational.project_'||item.name||'(NEW);','PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_'||item.name||'(NEW);');
   END IF;
   EXECUTE replacement;
  END LOOP;
 END LOOP;
END $mappers$;
"""
    for table in CATALOG:sql+=f'ALTER TABLE stock_operational.{table} DROP COLUMN created_at_instant RESTRICT;\n'
    sql+="""DROP FUNCTION stock_operational.set_created_at_instant() RESTRICT;
SELECT 1 / (NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant'))::int;
SELECT 1 / ((SELECT count(*)=47 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'))::int;
COMMIT;
"""
    return sql
if __name__=='__main__':print(generate(),end='')
