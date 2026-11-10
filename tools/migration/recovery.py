#!/usr/bin/env python3
"""Explicit private backup/recovery evidence. Requires separately approved PGSERVICE."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid
from core import CATALOG, digest
from migrate import write_private
from pg_access import client_environment, secure_connection_sql
from jsonb_stream import read_session, batch_fingerprint

METADATA_NAMES = {'schemas', 'tables', 'policies', 'grants', 'constraints', 'indexes',
                  'triggers', 'functions', 'sequences', 'defaults', 'runtimeRole',
                  'sequenceGrants', 'columns', 'memberships', 'runtimeLogins'}


def checksum(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): result.update(chunk)
    return result.hexdigest()


def guard_sql(target):
    target = str(uuid.UUID(target))
    return f"SELECT 1 / ((SELECT count(*)=1 AND bool_and(isolation_id='{target}'::uuid AND purpose='isolated-staging') FROM stock_operational.environment))::int;"


def fingerprint_sql():
    queries = []
    for schema, tables in [('stock_migration', ['import_batches'] + list(CATALOG)),
                          ('stock_operational', ['commands', 'audit', 'side_effects', 'environment'] + list(CATALOG))]:
        for table in tables:
            # Serialize large JSONB rows once, rather than rebuilding them for
            # the length prefix, concatenation and C-collation sort key.
            queries.append(f"WITH serialized AS MATERIALIZED (SELECT to_jsonb(t)::text AS v FROM {schema}.{table} t) SELECT json_build_object('table','{schema}.{table}','rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(length(v)::text||':'||v,'' ORDER BY v COLLATE \"C\"),''),'UTF8')),'hex')) FROM serialized;")
    schema_filter = "IN ('stock_migration','stock_operational')"
    principals = "WITH RECURSIVE principals(oid) AS (SELECT oid FROM pg_roles WHERE rolname='stock_runtime' UNION SELECT member FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='stock_runtime')), reachable(oid) AS (SELECT oid FROM principals UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON r.oid=m.member) "
    metadata = {
        # NULL ACL and an explicit default ACL confer the same permissions.
        # pg_dump can normalize either form; compare effective ACL sets instead.
        'schemas': f"SELECT nspname,pg_get_userbyid(nspowner) AS owner,ARRAY(SELECT a::text FROM unnest(coalesce(nspacl,acldefault('n',nspowner))) a ORDER BY a::text) AS acl FROM pg_namespace WHERE nspname {schema_filter} ORDER BY 1",
        'tables': f"SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,ARRAY(SELECT a::text FROM unnest(coalesce(c.relacl,acldefault('r',c.relowner))) a ORDER BY a::text) AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname {schema_filter} AND c.relkind IN ('r','p') ORDER BY 1,2",
        'policies': f"SELECT * FROM pg_policies WHERE schemaname {schema_filter} ORDER BY schemaname,tablename,policyname",
        'grants': f"SELECT table_schema,table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema {schema_filter} ORDER BY 1,2,3,4",
        'constraints': "SELECT conrelid::regclass::text AS relation,conname,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace IN ('stock_migration'::regnamespace,'stock_operational'::regnamespace) ORDER BY 1,2",
        'indexes': f"SELECT * FROM pg_indexes WHERE schemaname {schema_filter} ORDER BY schemaname,tablename,indexname",
        'triggers': f"SELECT t.tgrelid::regclass::text AS relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname {schema_filter} ORDER BY 1,2",
        'functions': f"SELECT n.nspname,p.proname,ARRAY(SELECT a::text FROM unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a ORDER BY a::text) AS acl,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname {schema_filter} ORDER BY 1,2",
        'sequences': f"SELECT * FROM pg_sequences WHERE schemaname {schema_filter} ORDER BY schemaname,sequencename",
        'defaults': "SELECT n.nspname,d.defaclobjtype,pg_get_userbyid(d.defaclrole) AS owner,d.defaclacl::text FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname IN ('stock_migration','stock_operational') ORDER BY 1,2,3",
        'runtimeRole': "SELECT rolname,rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname='stock_runtime'",
        'sequenceGrants': f"SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) AS owner,ARRAY(SELECT a::text FROM unnest(coalesce(c.relacl,acldefault('S',c.relowner))) a ORDER BY a::text) AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname {schema_filter} AND c.relkind='S' ORDER BY 1,2",
        'columns': f"SELECT n.nspname,c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) AS default_expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname {schema_filter} AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3",
        'memberships': principals+"SELECT pg_get_userbyid(roleid) AS role,pg_get_userbyid(member) AS member,pg_get_userbyid(grantor) AS grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE member IN (SELECT oid FROM reachable) ORDER BY 1,2,3",
        'runtimeLogins': principals+"SELECT rolname,rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE oid IN (SELECT oid FROM reachable) ORDER BY rolname",
    }
    for name, query in metadata.items():
        queries.append(f"SELECT json_build_object('metadata','{name}','value',coalesce(json_agg(to_jsonb(s)),'[]'::json)) FROM ({query}) s;")
    return '\n'.join(queries)


@contextmanager
def exported_snapshot(target):
    target = str(uuid.UUID(target))
    # Hold both cooperative writer locks until dump + fingerprints finish.
    # No SQL or driver error body is forwarded to ordinary logs.
    process = subprocess.Popen(['psql', '-XqAtw', '-v', 'ON_ERROR_STOP=1'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=client_environment())
    try:
        # Session locks precede BEGIN so the repeatable snapshot is established
        # after earlier writers drain, rather than before a lock wait.
        process.stdin.write("SET lock_timeout='10s';\nSET statement_timeout='120s';\n"+secure_connection_sql()+"\nSELECT pg_advisory_lock_shared(835107241);\nSELECT pg_advisory_lock_shared(835107242);\nBEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL idle_in_transaction_session_timeout='30min';\n" + guard_sql(target) + "\nSELECT 'snapshot:'||pg_export_snapshot();\n")
        process.stdin.flush()
        snapshot = None
        for line in process.stdout:
            if line.startswith('snapshot:'):
                snapshot = line.strip().split(':', 1)[1]; break
        if not snapshot or not re.fullmatch(r'[A-Fa-f0-9-]+', snapshot): raise ValueError('unable to hold approved target snapshot')
        yield snapshot
    finally:
        try:
            if process.poll() is None:
                process.stdin.write('ROLLBACK;\n\\q\n'); process.stdin.flush()
            process.communicate(timeout=10)
        except (BrokenPipeError, subprocess.TimeoutExpired):
            process.kill(); process.communicate()


def fingerprint(target, snapshot=None):
    deadline=time.monotonic()+150
    if snapshot is None:
        with exported_snapshot(target) as held:
            return _fingerprint_snapshot(target,held,deadline)
    return _fingerprint_snapshot(target,snapshot,deadline)


def _fingerprint_snapshot(target, snapshot, deadline):
    sql = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'
    if snapshot:
        if not re.fullmatch(r'[A-Fa-f0-9-]+', snapshot): raise ValueError('invalid snapshot')
        sql += f"SET TRANSACTION SNAPSHOT '{snapshot}';\n"
    sql += "SET LOCAL statement_timeout='120s'; SET LOCAL client_encoding='UTF8';\n" + secure_connection_sql()+'\n'+guard_sql(target) + '\n'
    sql += 'SELECT pg_advisory_xact_lock_shared(835107241);\nSELECT pg_advisory_xact_lock_shared(835107242);\n'
    # The complete frozen snapshot is much larger than individual business rows.
    # Read its exact JSONB representation in partitions; never reconstruct the
    # entire row or table-wide hash input in PostgreSQL memory.
    rows = []
    # Each backend releases its arenas on exit. Reuse the SAME exported
    # snapshot and held writer locks, rather than retaining large JSONB arenas
    # across otherwise small table reads. The original 150s overall limit stays.
    with read_session(sql + "SET LOCAL standard_conforming_strings=on; SET LOCAL client_encoding='UTF8';", deadline-time.monotonic()) as session:
        rows.append(batch_fingerprint(session))
    for schema,names in [('stock_migration',list(CATALOG)),('stock_operational',['commands','audit','side_effects','environment']+list(CATALOG))]:
        for table in names:
            with read_session(sql,deadline-time.monotonic()) as session:
                rows.append(session.table_fingerprint(f'{schema}.{table}'))
    with read_session(sql,deadline-time.monotonic()) as session:
        for query in fingerprint_sql().splitlines()[2*len(CATALOG)+5:]:
            rows.extend(json.loads(line) for line in session.rows(query) if line.startswith(b'{'))
    tables = {f'{schema}.{table}' for schema, names in [('stock_migration', ['import_batches']+list(CATALOG)), ('stock_operational', ['commands','audit','side_effects','environment']+list(CATALOG))] for table in names}
    keys = [r.get('table', r.get('metadata')) for r in rows]
    if len(keys) != len(tables | METADATA_NAMES) or set(keys) != tables | METADATA_NAMES: raise ValueError('incomplete recovery inventory')
    return rows


def capture(directory, target):
    target = str(uuid.UUID(target))
    directory = Path(directory)
    directory.mkdir(mode=0o700)  # Exclusive; never overwrite any prior backup.
    started = time.monotonic()
    with exported_snapshot(target) as snapshot:
        records = fingerprint(target, snapshot)
        fd = os.open(directory / 'database.dump', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            run = subprocess.run(['pg_dump', '-w', '-Fc', '--snapshot=' + snapshot, '-n', 'stock_migration', '-n', 'stock_operational'], stdout=stream, stderr=subprocess.PIPE, env=client_environment(), timeout=1800)
        if run.returncode: raise ValueError('backup failed; incomplete directory must be quarantined')
        if fingerprint(target, snapshot) != records: raise ValueError('security/sequence metadata changed during backup')
    with (directory / 'database.dump').open('rb') as stream:
        check = subprocess.run(['pg_restore', '--list'], stdin=stream, capture_output=True, timeout=60)
    if check.returncode: raise ValueError('backup archive is unreadable')
    write_private(directory / 'fingerprint.json', json.dumps(records, indent=2) + '\n')
    receipt = {'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(), 'sourceIsolationId': str(uuid.UUID(target)),
               'dumpSha256': checksum(directory / 'database.dump'), 'fingerprintSha256': checksum(directory / 'fingerprint.json'),
               'durationSeconds': round(time.monotonic() - started, 3), 'consistentExportedSnapshot': True,
               'restoreVerified': False, 'encryptionVerified': False}
    write_private(directory / 'receipt.json', json.dumps(receipt, indent=2) + '\n')
    return receipt


def verify(directory, target):
    directory = Path(directory); receipt = json.loads((directory / 'receipt.json').read_text())
    if checksum(directory / 'database.dump') != receipt['dumpSha256'] or checksum(directory / 'fingerprint.json') != receipt['fingerprintSha256']:
        raise ValueError('backup artifact checksum mismatch')
    expected = json.loads((directory / 'fingerprint.json').read_text())
    with exported_snapshot(target) as snapshot: actual = fingerprint(target, snapshot)
    key = lambda row: row.get('table', row.get('metadata'))
    before, after = ({key(row): row for row in rows} for rows in [expected, actual])
    differences = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    return {'version': 1, 'match': expected == actual, 'fingerprintChecksum': digest(actual),
            'differentSections': differences,
            'backupDumpSha256': receipt['dumpSha256'], 'encryptionVerified': False,
            'note': 'A matching restored state does not establish endpoint isolation, off-site key recovery, RTO/RPO or provider outcomes.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('capture'); p.add_argument('--directory', required=True); p.add_argument('--target-id', required=True)
    p = sub.add_parser('verify'); p.add_argument('--directory', required=True); p.add_argument('--target-id', required=True); p.add_argument('--output', required=True)
    args = parser.parse_args()
    result = capture(args.directory, args.target_id) if args.command == 'capture' else verify(args.directory, args.target_id)
    if args.command == 'verify': write_private(args.output, json.dumps(result, indent=2) + '\n')
    print(json.dumps({'completed': True, 'restoreMatch': result.get('match'), 'differentSections':result.get('differentSections',[]), 'dumpChecksum': result.get('dumpSha256', result.get('backupDumpSha256'))}))
    return 0 if result.get('match', True) else 1


if __name__ == '__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit('Recovery verification failed. Quarantine private artifacts and stop migration.')
