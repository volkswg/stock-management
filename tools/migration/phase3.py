#!/usr/bin/env python3
"""Offline freeze/delta review and read-only operational extraction. Never imports data."""
import argparse
import json
import os
import subprocess
import uuid
from pathlib import Path
from core import CATALOG, normalize, convert, digest, canonical, load_json
from migrate import write_private
from pg_access import client_environment, secure_connection_sql


def delta_review(before, final):
    if before['spreadsheetId'] != final['spreadsheetId']:
        raise ValueError('workbook identity changed')
    left, right = normalize(before), normalize(final)
    tables = {}
    for table, spec in CATALOG.items():
        key = spec['key']
        old, new = ({r[key]: r for r in rows} for rows in (left[table], right[table]))
        shared = old.keys() & new.keys()
        without_position = lambda r: {k: v for k, v in r.items() if k != 'source_row'}
        tables[table] = {
            'addedIDs': sorted(new.keys() - old.keys()), 'removedIDs': sorted(old.keys() - new.keys()),
            'changedIDs': sorted(k for k in shared if without_position(old[k]) != without_position(new[k])),
            'movedIDs': sorted(k for k in shared if old[k]['source_row'] != new[k]['source_row']),
            'identityIsPositional': key == 'migration_id',
        }
    return {'beforeChecksum': digest(before), 'finalChecksum': digest(final), 'tables': tables,
            'automaticDeltaSupported': False, 'executionStrategy': 'fresh-empty-target-from-final-full-snapshot'}


def operational_snapshot(source):
    """For pristine promoted targets; refuse archived rows or wrong target, never omit them."""
    normalize(source)
    target = str(uuid.UUID(os.environ['STOCK_TARGET_ISOLATION_ID']))
    # SQL assertion runs before any business SELECT, in the same transaction.
    queries = [f"SELECT 1 / ((SELECT count(*)=1 AND bool_and(isolation_id='{target}'::uuid AND purpose='isolated-staging') FROM stock_operational.environment))::int;",
               "SELECT json_build_object('environment',to_jsonb(t)) FROM stock_operational.environment t;"]
    for table in CATALOG:
        queries.append(f"SELECT json_build_object('table','{table}','row',row_order+1,'cells',business_cells,'typed',to_jsonb(t)) FROM stock_operational.{table} t ORDER BY row_order;")
    sql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout='120s';\n"+secure_connection_sql()+"\nSELECT pg_advisory_xact_lock_shared(835107242);\n" + '\n'.join(queries) + '\nCOMMIT;'
    run = subprocess.run(['psql', '-XAtw', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True, env=client_environment(), timeout=150)
    if run.returncode:
        raise ValueError('operational extraction failed; inspect access privately')
    snapshot = {'version': 1, 'spreadsheetId': source['spreadsheetId'], 'sheets': {t: {'headers': s['headers'], 'rows': []} for t, s in CATALOG.items()}}
    environments = []
    for line in run.stdout.splitlines():
        if not line.startswith('{'):
            continue
        entry = load_json(line)
        if 'environment' in entry:
            environments.append(entry['environment'])
            continue
        spec = CATALOG[entry['table']]
        if entry['typed']['archived_at'] is not None or not 2 <= entry['row'] <= 1000001:
            raise ValueError('target is mutated or has unsupported row ordinals')
        if spec['key'] == 'migration_id' and entry['typed']['migration_id'] != f"sheet-row:{entry['row']}":
            raise ValueError('historical positional identity changed')
        for index, col in enumerate(spec['headers']):
            kind = spec['columns'][col]
            expected = convert(entry['cells'][index] if index < len(entry['cells']) else None, kind)
            actual = entry['typed'][col]
            if kind in ('numeric', 'bigint') and actual is not None:
                actual = str(actual)
            if expected != actual:
                raise ValueError('typed operational data diverged from business cells')
        rows = snapshot['sheets'][entry['table']]['rows']
        while len(rows) < entry['row'] - 2:
            rows.append([])
        rows.append(entry['cells'])
    if len(environments) != 1 or environments[0]['isolation_id'] != target or environments[0]['purpose'] != 'isolated-staging':
        raise ValueError('wrong isolated staging target')
    normalize(snapshot)
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('delta-review'); p.add_argument('before'); p.add_argument('final'); p.add_argument('--output', required=True)
    p = sub.add_parser('operational-snapshot'); p.add_argument('--source', required=True); p.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'delta-review':
        result = delta_review(load_json(Path(args.before).read_text()), load_json(Path(args.final).read_text()))
    else:
        result = operational_snapshot(load_json(Path(args.source).read_text()))
    write_private(args.output, canonical(result) + '\n')
    print(json.dumps({'written': True, 'checksum': digest(result), 'remoteWrites': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('Phase 3 planning/extraction failed; inspect private artifacts. No import was attempted.')
