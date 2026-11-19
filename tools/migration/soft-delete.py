"""Explicit operator-only archive consolidation. Synthetic verification has no IO.

The inverse consumes a PRIVATE pre-change deletion-state export. It is only safe
before reopening, with the original global revision; never restore a stale dump
over later writes. Existing schema history and Sheets wire columns stay frozen.
"""
import hashlib
import json
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MU = runpy.run_path(str(ROOT / 'tools/migration/media-url-retirement.py'))
CV = MU['CV']
TABLES = CV['CATALOG']
EXISTING = [t for t in TABLES if 'deletedAt' in TABLES[t]['headers']]
RENAMED = [t for t in TABLES if t not in EXISTING]
literal = MU['literal']
OLD_GUARD = CV['GUARD']
GUARD = OLD_GUARD.replace('OLD.archived_at', 'OLD."deletedAt"').replace('archived record', 'deleted record')
OLD_CONTRACT = MU['typed_contract']()


def typed_contract():
    body = OLD_CONTRACT
    for table in TABLES:
        entry = f"('{table}','archived_at','timestamp with time zone')"
        assert body.count(entry) == 1
        body = body.replace(entry + ',', '') if table in EXISTING else body.replace(entry, entry.replace('archived_at', 'deletedAt'))
    match = re.search(r'IF valid<>(\d+)', body)
    assert match
    body = body.replace(match[0], 'IF valid<>' + str(int(match[1]) - len(EXISTING)), 1)
    return body.replace('BEGIN\n', 'BEGIN\n PERFORM stock_operational.soft_delete_contract_v1();\n', 1)


def contract():
    names = ','.join(literal(t) for t in TABLES)
    return f'''
BEGIN
 IF (SELECT count(*)<>23 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 WHERE c.relnamespace='stock_operational'::regnamespace AND c.relname IN ({names})
 AND a.attname='deletedAt' AND a.atttypid='timestamptz'::regtype AND NOT a.attisdropped)
 OR EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 WHERE c.relnamespace='stock_operational'::regnamespace AND c.relname IN ({names})
 AND a.attname='archived_at' AND NOT a.attisdropped)
 OR (SELECT count(*)<>23 FROM pg_trigger WHERE tgname='a_validate' AND tgenabled='O'
 AND tgfoid='stock_operational.prepare_record_write()'::regprocedure AND tgrelid IN ({','.join(literal('stock_operational.'+t)+'::regclass' for t in TABLES)}))
 OR (SELECT md5(prosrc)<>{literal(hashlib.md5(GUARD.encode()).hexdigest())} OR prosecdef
 FROM pg_proc WHERE oid='stock_operational.prepare_record_write()'::regprocedure)
 THEN RAISE EXCEPTION 'Incomplete deletedAt schema'; END IF;
 RETURN 'deletedAt';
END '''


def header(phase):
    tables = ','.join('stock_operational.' + t for t in ['environment', 'revision', 'commands', 'side_effects', 'media', *TABLES])
    return f'''-- OPERATOR ONLY: separately approved maintenance, all writers fenced.
-- Fresh private 52-table/15-metadata recovery must have been restored and verified.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_soft_delete_{phase}',true)='reviewed-deleted-at-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.soft_delete_restore_verified',true)='52-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.soft_delete_source',true)~'^[a-f0-9]{{40}}$' AND current_setting('stock.soft_delete_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.soft_delete_fingerprint',true)~'^[a-f0-9]{{64}}$',false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE {tables} IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.soft_delete_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
-- Owner-only: never widen permissions or disable row security for a partial reader.
SELECT 1/((SELECT count(*)=23 AND bool_and(relowner=current_user::regrole AND NOT relforcerowsecurity) FROM pg_class WHERE oid IN ({','.join(literal('stock_operational.'+t)+'::regclass' for t in TABLES)})))::int;
'''


def witness(signature, body):
    return f"SELECT 1/coalesce((SELECT NOT prosecdef AND md5(prosrc)={literal(hashlib.md5(body.encode()).hexdigest())} FROM pg_proc WHERE oid=to_regprocedure('stock_operational.{signature}')),false)::int;\n"


def quiet_update(table, assignments, condition='true'):
    # Exclusive locks + one transaction; no session-wide trigger/RLS bypass.
    # Keep row/global revisions unchanged for a representation-only backfill.
    return f'''ALTER TABLE stock_operational.{table} DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.{table} DISABLE TRIGGER advance_revision;
UPDATE stock_operational.{table} SET {assignments} WHERE {condition};
ALTER TABLE stock_operational.{table} ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.{table} ENABLE TRIGGER a_validate;
'''


def forward():
    s = header('retirement')
    s += "SELECT 1/(stock_operational.media_record_contract_v1()='id-only' AND stock_operational.lexeme_mapping_contract_v1()='typed' AND to_regprocedure('stock_operational.soft_delete_contract_v1()') IS NULL)::int;\n"
    s += witness('prepare_record_write()', OLD_GUARD) + witness('lexeme_mapping_contract_v1()', OLD_CONTRACT)
    # Names/predicates are immutable predecessor witnesses. Renames update these
    # four index predicates automatically. Only shipment_orders needs a rebuild.
    indexes = {
        'stock_count_month_account': 'CREATE UNIQUE INDEX stock_count_month_account ON stock_operational.stock_counts USING btree (month, "accountId") WHERE (archived_at IS NULL)',
        'override_month_account': 'CREATE UNIQUE INDEX override_month_account ON stock_operational.sales_profit_cost_overrides USING btree (month, "accountId") WHERE (archived_at IS NULL)',
        'settlement_employee_month': 'CREATE UNIQUE INDEX settlement_employee_month ON stock_operational.payroll_settlements USING btree ("employeeId", month) WHERE (archived_at IS NULL)',
        'shop_account': 'CREATE UNIQUE INDEX shop_account ON stock_operational.shops USING btree ("loyverseAccountId") WHERE (("loyverseAccountId" IS NOT NULL) AND (archived_at IS NULL))',
        'active_order_shipment': 'CREATE UNIQUE INDEX active_order_shipment ON stock_operational.shipment_orders USING btree ("orderId") WHERE (("deletedAt" IS NULL) AND (archived_at IS NULL))',
    }
    for name, definition in indexes.items():
        s += f"SELECT 1/coalesce(pg_get_indexdef(to_regclass('stock_operational.{name}'))={literal(definition)},false)::int;\n"
    for table in TABLES:
        s += f'''SELECT 1/coalesce((SELECT atttypid='timestamptz'::regtype AND attacl IS NULL AND NOT attnotnull AND NOT atthasdef FROM pg_attribute WHERE attrelid='stock_operational.{table}'::regclass AND attname='archived_at' AND NOT attisdropped),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
 WHERE a.attrelid='stock_operational.{table}'::regclass AND a.attname='archived_at'
 AND NOT(d.classid='pg_class'::regclass AND d.objid IN ({','.join(literal('stock_operational.'+n)+'::regclass' for n in indexes)}))))::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.{table} WHERE archived_at IS NOT NULL AND NOT(archived_at>=TIMESTAMPTZ '0001-01-01 00:00:00+00' AND archived_at<TIMESTAMPTZ '10000-01-01 00:00:00+00')))::int;
SELECT 1/((SELECT count(*)=2 AND bool_and(tgenabled='O') FROM pg_trigger WHERE tgrelid='stock_operational.{table}'::regclass AND tgname IN ('a_validate','advance_revision')))::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='stock_operational.{table}'::regclass AND NOT tgisinternal AND tgname NOT IN ('a_validate','advance_revision','b_media_reference')))::int;
'''
        if table in EXISTING:
            s += f'''-- Never choose silently between two different deletion instants.
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.{table} WHERE archived_at IS NOT NULL AND "deletedAt" IS NOT NULL AND archived_at<>"deletedAt"))::int;
'''
    s += '''SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND p.prokind IN ('f','p') AND p.oid NOT IN ('stock_operational.prepare_record_write()'::regprocedure,'stock_operational.lexeme_mapping_contract_v1()'::regprocedure)
 AND lower(p.prosrc) ~ '(^|[^a-z_])archived_at([^a-z_]|$)'))::int;
'''
    s += 'DROP INDEX stock_operational.active_order_shipment;\n'
    for table in EXISTING:
        s += quiet_update(table, '"deletedAt"=archived_at', '"deletedAt" IS NULL AND archived_at IS NOT NULL')
        s += f'ALTER TABLE stock_operational.{table} DROP COLUMN archived_at RESTRICT;\n'
    for table in RENAMED:
        s += f'''ALTER TABLE stock_operational.{table} RENAME COLUMN archived_at TO "deletedAt";
ALTER TABLE stock_operational.{table} ADD CONSTRAINT {table}_deleted_at_range CHECK ("deletedAt" IS NULL OR ("deletedAt">=TIMESTAMPTZ '0001-01-01 00:00:00+00' AND "deletedAt"<TIMESTAMPTZ '10000-01-01 00:00:00+00'));
'''
    s += 'CREATE UNIQUE INDEX active_order_shipment ON stock_operational.shipment_orders("orderId") WHERE "deletedAt" IS NULL;\n'
    s += MU['replace_body']('prepare_record_write()', GUARD)
    s += "CREATE FUNCTION stock_operational.soft_delete_contract_v1() RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$" + contract() + '$$;\n'
    s += '''-- Copy the existing private read-contract ACL, including grant options.
DO $acl$ DECLARE a record; caller text; BEGIN
 FOR a IN SELECT * FROM aclexplode((SELECT coalesce(proacl,acldefault('f',proowner)) FROM pg_proc WHERE oid='stock_operational.soft_delete_contract_v1()'::regprocedure)) LOOP
  caller:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
  EXECUTE 'REVOKE ALL ON FUNCTION stock_operational.soft_delete_contract_v1() FROM '||caller;
 END LOOP;
 FOR a IN SELECT * FROM aclexplode((SELECT coalesce(proacl,acldefault('f',proowner)) FROM pg_proc WHERE oid='stock_operational.lexeme_mapping_contract_v1()'::regprocedure)) LOOP
  IF a.grantee=0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public contract access'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.soft_delete_contract_v1() TO %I%s',pg_get_userbyid(a.grantee),CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
END $acl$;
'''
    s += MU['replace_body']('lexeme_mapping_contract_v1()', typed_contract())
    return s + "SELECT 1/(stock_operational.soft_delete_contract_v1()='deletedAt' AND stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


def checkpoint_sql():
    # Save psql -XqAt output to a mode-0600 PRIVATE file after verified freeze.
    s = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC';\nSELECT pg_advisory_xact_lock_shared(835107241); SELECT pg_advisory_xact_lock_shared(835107242);\n"
    s += "SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) FROM stock_operational.environment),false)::int;\n"
    s += "SELECT 1/((SELECT count(*)=6 AND bool_and(relowner=current_user::regrole AND NOT relforcerowsecurity) FROM pg_class WHERE oid IN (" + ','.join(literal('stock_operational.'+t)+'::regclass' for t in EXISTING) + ")))::int;\n"
    s += "SELECT json_build_object('environment',row_to_json(e),'revision',(SELECT value::text FROM stock_operational.revision WHERE singleton)) FROM stock_operational.environment e;\n"
    for table in EXISTING:
        s += f'''SELECT json_build_object('table','{table}','rows',coalesce(json_agg(json_build_object('id',id,'revision',revision::text,'archived_at',archived_at,'deletedAt',"deletedAt") ORDER BY id COLLATE "C"),'[]'::json)) FROM stock_operational.{table};\n'''
    return s + 'COMMIT;\n'


def inverse(state):
    records = [json.loads(line) for line in state.splitlines() if line.startswith('{')]
    metadata = [r for r in records if 'environment' in r]
    data = {r['table']: r['rows'] for r in records if 'table' in r}
    assert len(metadata) == 1 and len(records) == 7 and set(data) == set(EXISTING)
    for rows in data.values():
        assert len(rows) == len({r['id'] for r in rows})
        assert all(set(r) == {'id', 'revision', 'archived_at', 'deletedAt'} for r in rows)
    metadata = metadata[0]
    s = header('rollback') + "SELECT 1/(stock_operational.soft_delete_contract_v1()='deletedAt')::int;\n"
    s += witness('lexeme_mapping_contract_v1()', typed_contract())
    s += f"SELECT 1/((SELECT isolation_id::text={literal(metadata['environment']['isolation_id'])} AND purpose={literal(metadata['environment']['purpose'])} FROM stock_operational.environment) AND (SELECT value::text={literal(metadata['revision'])} FROM stock_operational.revision WHERE singleton))::int;\n"
    s += 'DROP INDEX stock_operational.active_order_shipment;\n'
    for table in EXISTING:
        rows = json.dumps(data[table], separators=(',', ':'))
        source = f"jsonb_to_recordset({literal(rows)}::jsonb) AS original(id text,revision bigint,archived_at timestamptz,\"deletedAt\" timestamptz)"
        s += f'''-- Exact identities/revisions/deletion instants, not a stale replacement import.
SELECT 1/((SELECT count(*)={len(data[table])} FROM stock_operational.{table}) AND NOT EXISTS(SELECT FROM {source} LEFT JOIN stock_operational.{table} t USING(id) WHERE t.id IS NULL OR t.revision<>original.revision OR t."deletedAt" IS DISTINCT FROM coalesce(original."deletedAt",original.archived_at)))::int;
ALTER TABLE stock_operational.{table} ADD COLUMN archived_at timestamptz;
'''
        s += quiet_update(table, 'archived_at=original.archived_at,"deletedAt"=original."deletedAt" FROM ' + source, 'stock_operational.' + table + '.id=original.id')
    for table in RENAMED:
        s += f'ALTER TABLE stock_operational.{table} DROP CONSTRAINT {table}_deleted_at_range;\nALTER TABLE stock_operational.{table} RENAME COLUMN "deletedAt" TO archived_at;\n'
    s += MU['replace_body']('prepare_record_write()', OLD_GUARD) + MU['replace_body']('lexeme_mapping_contract_v1()', OLD_CONTRACT)
    s += 'DROP FUNCTION stock_operational.soft_delete_contract_v1() RESTRICT;\n'
    s += 'CREATE UNIQUE INDEX active_order_shipment ON stock_operational.shipment_orders("orderId") WHERE "deletedAt" IS NULL AND archived_at IS NULL;\n'
    return s + "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


if __name__ == '__main__':
    import sys
    phase = sys.argv[1]
    if phase == 'retirement':
        output = forward()
    elif phase == 'checkpoint-sql':
        output = checkpoint_sql()
    elif phase == 'rollback':
        output = inverse(Path(sys.argv[2]).read_text())
    else:
        raise ValueError('Unsupported phase')
    print(output, end='')
