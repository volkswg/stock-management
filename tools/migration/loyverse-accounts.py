#!/usr/bin/env python3
"""Private, explicit configuration import. Never reads Google or calls Loyverse.

Input: {"headers":["id","shopName","storeId","accessToken","active","sortOrder"],
        "rows":[...]} captured privately from the approved fixed A:F range.
No token/SQL/provider error body is printed. Hosted execution needs owner approval.
"""
import argparse
import configparser
import json
import os
from pathlib import Path
import re
import subprocess
import uuid

HEADERS = ['id', 'shopName', 'storeId', 'accessToken', 'active', 'sortOrder']
MAX_SAFE = 9007199254740991
# Match ECMAScript trim, including BOM; do not apply Python's extra C0 whitespace.
JS_SPACE = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
def text(value): return value.strip(JS_SPACE) if isinstance(value, str) else ''

def normalize(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get('headers') != HEADERS or not isinstance(snapshot.get('rows'), list):
        raise ValueError('Invalid configuration envelope')
    accounts = []; ids = set(); orders = set()
    for source in snapshot['rows']:
        if not isinstance(source, list): raise ValueError('Invalid configuration row')
        if all(v is None or v == '' or isinstance(v, str) and not text(v) for v in source): continue
        if len(source) > 6: raise ValueError('Unexpected configuration cells')
        row = source + [None] * (6 - len(source))
        identity, name, store, token, flag, order = row
        identity, name = text(identity), text(name)
        active = flag if type(flag) is bool else {'true': True, 'false': False}.get(text(flag).lower())
        if type(order) in (int, float): sequence = order
        elif re.fullmatch(r'[0-9]+', text(order)): sequence = int(text(order))
        else: raise ValueError('Invalid configuration order')
        if not identity or not name or active is None or type(sequence) not in (int, float) or not 0 <= sequence <= MAX_SAFE or int(sequence) != sequence:
            raise ValueError('Invalid account configuration')
        if store is not None and not isinstance(store, str) or token is not None and not isinstance(token, str):
            raise ValueError('Invalid configuration fields')
        if active and not text(token) or identity in ids or sequence in orders: raise ValueError('Invalid or duplicate account')
        ids.add(identity); orders.add(sequence)
        accounts.append(dict(zip(HEADERS, [identity, name, text(store) or None, text(token) or None, active, int(sequence)])))
    if not accounts: raise ValueError('Configuration is empty')
    return sorted(accounts, key=lambda row: row['sortOrder'])

def secure_service(project, allow_local=False):
    if not re.fullmatch('[a-z]{20}', project): raise ValueError('Invalid project identity')
    file = Path(os.environ.get('PGSERVICEFILE', '')); name = os.environ.get('PGSERVICE')
    if not name or not file.is_absolute() or not file.is_file(): raise ValueError('Explicit PGSERVICEFILE and PGSERVICE required')
    services = configparser.ConfigParser(interpolation=None); services.read(file); service = services[name]
    local = service.get('host') in ('localhost', '127.0.0.1', '::1')
    if local:
        if not allow_local: raise ValueError('Local execution must be explicit')
    elif service.get('host') != 'db.' + project + '.supabase.co' or service.get('sslmode') != 'verify-full':
        raise ValueError('Wrong host or unverified TLS')
    if service.get('dbname') != 'postgres' or service.get('port', '5432') != '5432' or service.get('user') != 'postgres':
        raise ValueError('Expected approved owner service')
    # Do not inherit PGHOST/PGUSER/PGPASSWORD or URL/options overrides.
    env = {key: os.environ[key] for key in ('PATH', 'PGSERVICE', 'PGSERVICEFILE')}
    env.update(PGCONNECT_TIMEOUT='10', PGAPPNAME='stock-private-account-import')
    return env

def import_sql(accounts, isolation, purpose):
    isolation = str(uuid.UUID(isolation))
    if purpose not in ('isolated-staging', 'production'): raise ValueError('Invalid target purpose')
    payload = json.dumps(accounts, ensure_ascii=False, separators=(',', ':'))
    delimiter = '$config_' + uuid.uuid4().hex + '$'
    assert delimiter not in payload
    return f'''BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL client_min_messages='error';
SELECT 1 / ((SELECT count(*)=1 AND bool_and(isolation_id='{isolation}'::uuid AND purpose='{purpose}') FROM stock_operational.environment))::int;
LOCK TABLE stock_configuration.loyverse_accounts IN ACCESS EXCLUSIVE MODE;
DO $$BEGIN IF EXISTS(SELECT FROM stock_configuration.loyverse_accounts) THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Configuration is populated; import refused'; END IF; END$$;
INSERT INTO stock_configuration.loyverse_accounts (id,"shopName","storeId","accessToken",active,"sortOrder")
SELECT id,"shopName","storeId","accessToken",active,"sortOrder" FROM jsonb_to_recordset({delimiter}{payload}{delimiter}::jsonb)
AS a(id text,"shopName" text,"storeId" text,"accessToken" text,active boolean,"sortOrder" bigint);
SELECT coalesce(json_agg(json_build_object('id',id,'shopName',"shopName",'storeId',"storeId",'accessToken',"accessToken",'active',active,'sortOrder',"sortOrder") ORDER BY "sortOrder"),'[]'::json) FROM stock_configuration.loyverse_accounts;
'''

def apply(accounts, env, isolation, purpose):
    # Keep the transaction open until the exact read-back comparison succeeds.
    process = subprocess.Popen(['psql','-XqAtw','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    try:
        process.stdin.write(import_sql(accounts, isolation, purpose)); process.stdin.flush()
        guard = process.stdout.readline().strip()
        if guard != '1': raise ValueError('Target guard failed')
        result = process.stdout.readline()
        if json.loads(result) != accounts: raise ValueError('Configuration read-back mismatch')
        process.stdin.write('COMMIT;\n'); process.stdin.flush()
        output, error = process.communicate(timeout=40)
        if process.returncode: raise ValueError('Import outcome requires read-only reconciliation; never retry blindly')
    finally:
        if process.poll() is None:
            process.kill(); process.communicate()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--apply-empty', action='store_true')
    parser.add_argument('--approved', action='store_true', help='Operator confirms separate approval for this import')
    parser.add_argument('--project-ref'); parser.add_argument('--isolation-id')
    parser.add_argument('--purpose', choices=['production','isolated-staging'])
    parser.add_argument('--allow-local', action='store_true')
    args = parser.parse_args(); file = Path(args.input)
    if file.is_symlink() or not file.is_file() or file.stat().st_mode & 0o077: raise ValueError('Input must be an owner-only regular file')
    accounts = normalize(json.loads(file.read_text()))
    if args.apply_empty:
        if not args.approved or not args.project_ref or not args.isolation_id or not args.purpose: raise ValueError('Explicit approval and target required')
        apply(accounts, secure_service(args.project_ref, args.allow_local), args.isolation_id, args.purpose)
    print(json.dumps({'valid':True,'accounts':len(accounts),'active':sum(row['active'] for row in accounts),'imported':args.apply_empty,'tokensDisplayed':False}))

if __name__ == '__main__':
    try: main()
    except Exception: raise SystemExit('Private account operation failed or has an uncertain outcome. Inspect the target read-only before retrying. No credentials displayed.')
