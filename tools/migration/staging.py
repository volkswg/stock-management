#!/usr/bin/env python3
"""Metadata-only inspection and offline deployment planning. No hosted write mode."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from migrate import write_private
from pg_access import client_environment

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_TARGET = json.loads(Path(__file__).with_name('staging-target.example.json').read_text())


def inspect_sql():
    # Do not read auth users, storage objects, private account rows or business rows.
    return """BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT json_build_object(
 'database',current_database(),'postgresVersion',current_setting('server_version'),
 'databaseBytes',pg_database_size(current_database()),'maxConnections',current_setting('max_connections')::int,
 'tls',coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false),
 'login',(SELECT json_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,'createRole',rolcreaterole,'createDb',rolcreatedb,'inherit',rolinherit) FROM pg_roles WHERE rolname=session_user),
 'migrationSchemas',(SELECT coalesce(json_agg(nspname ORDER BY nspname),'[]'::json) FROM pg_namespace WHERE nspname IN ('stock_migration','stock_operational')),
 'publicRelations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')),
 'tables',(SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'owner',pg_get_userbyid(c.relowner)) ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('stock_migration','stock_operational') AND c.relkind IN ('r','p')),
 'runtimeRole',(SELECT json_build_object('login',rolcanlogin,'superuser',rolsuper,'bypassRls',rolbypassrls,'createRole',rolcreaterole,'createDb',rolcreatedb,'inherit',rolinherit) FROM pg_roles WHERE rolname='stock_runtime')
);
ROLLBACK;
"""


def deployment_plan(target):
    if target != EXPECTED_TARGET:
        raise ValueError('only the explicitly identified Tokyo staging candidate is supported')
    migrations = [{'file': str(p.relative_to(ROOT)), 'version': p.name.split('_')[0],
                   'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((ROOT / 'supabase/migrations').glob('*.sql'))]
    return {'version': 1, 'target': target, 'migrations': migrations, 'cliVersion':'3.0.0',
            'baseline':'e97a1c9ad9ca9402de33a9796933fece38a92eeb',
            'expectedTables':{'stock_migration':24,'stock_operational':27},
            'executionAuthorized': False, 'productionCutoverAllowed': False,
            'steps': [
                'Verify endpoint/service, owner isolation attestation, pinned source hashes and reviewed migration ledger.',
                'Use metadata-only inspection; stop on existing private schemas, unexpected public relations or a different project/database.',
                'Verify encrypted target backup/recovery arrangement; obtain separate exact-target DDL approval.',
                'Use Supabase CLI 3.0.0: migration list --remote=orjnazrothkdgmzlsuto, then db push --remote=orjnazrothkdgmzlsuto --skip-vault --dry-run; review exact pending files.',
                'After approval only, db push --remote=orjnazrothkdgmzlsuto --skip-vault; never reset/repair/truncate/drop/include-seed. If partial migration fails, inspect and stop.',
                'Record migration ledger and recheck RLS/grants/triggers/indexes and purpose/isolation UUID.',
                'Provision separate least-privilege runtime login privately; verify direct and transaction-pooler TLS/role behavior.',
                'Before approved import: capture and restore the empty-schema backup with recovery.py, then require independent sign-off.',
            ], 'blockedUntil': ['exact-target-owner-DDL-approval', 'Cloud-PostgreSQL-access-and-TLS',
                                 'verified-backup-and-restore', 'Data-API-exposure-and-runtime-role-review']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('plan'); p.add_argument('--target', required=True); p.add_argument('--output', required=True)
    p = sub.add_parser('inspect'); p.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'plan':
        result = deployment_plan(json.loads(Path(args.target).read_text()))
    else:
        run = subprocess.run(['psql', '-XqAtw', '-v', 'ON_ERROR_STOP=1'], input=inspect_sql(), text=True, capture_output=True, env=client_environment(), timeout=30)
        if run.returncode: raise ValueError('metadata inspection failed')
        records = [json.loads(line) for line in run.stdout.splitlines() if line.startswith('{')]
        if len(records) != 1: raise ValueError('incomplete inspection')
        result = {'observed': records[0], 'resourceIdentityVerified': False, 'executionAuthorized': False,
                  'note': 'SQL metadata cannot attest the project endpoint, billing plan, production isolation or owner approval.'}
    write_private(args.output, json.dumps(result, indent=2) + '\n')
    print(json.dumps({'written': True, 'hostedWrites': False, 'executionAuthorized': False}))


if __name__ == '__main__':
    try: main()
    except Exception: raise SystemExit('Staging preparation failed. Inspect private configuration; no hosted write was attempted.')
