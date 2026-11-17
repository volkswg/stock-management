#!/usr/bin/env python3
"""Explicit read-only, private export for the ordinal retirement application review.

Run only on an approved frozen target or a disposable restored copy. No Sheets or
providers are accessed. This tool never applies schema/data/permission changes.
"""
import argparse,json,os,subprocess,uuid
from pathlib import Path
from core import CATALOG
from recovery import guard_sql,full_row_security_reader_sql
from pg_access import client_environment,secure_connection_sql

def visibility_sql():
    # This export reads the 23 business tables, not archived imports or journals.
    # Existing owners/bypass roles can already see every row; FORCED RLS still
    # applies to ordinary owners. Other readers need an unfiltered permissive
    # SELECT policy and no applicable restrictive policy, as in recovery exports.
    sql=full_row_security_reader_sql()
    owner="EXISTS (SELECT FROM pg_roles r WHERE r.rolname=current_user AND (r.rolsuper OR r.rolbypassrls)) OR (pg_has_role(current_user,c.relowner,'USAGE') AND NOT c.relforcerowsecurity) OR "
    assert sql.count('NOT c.relrowsecurity OR (')==1
    sql=sql.replace('NOT c.relrowsecurity OR (','NOT c.relrowsecurity OR '+owner+'(')
    names=','.join("'"+t+"'" for t in CATALOG)
    sql=sql.replace("n.nspname IN ('stock_migration','stock_operational')", "n.nspname='stock_operational' AND c.relname IN ("+names+")")
    return sql.replace('count(*)>0','count(*)=23')

def review_sql(target,purpose):
    target=str(uuid.UUID(target))
    sql=["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='120s';",secure_connection_sql(),guard_sql(target,purpose),
         'SELECT pg_advisory_xact_lock_shared(835107241); SELECT pg_advisory_xact_lock_shared(835107242);',visibility_sql(),
         "SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'))::int;",
         "SELECT 1 / ((SELECT count(*)=23 FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='created_at_instant'))::int;",
         "SELECT json_build_object('metadata',json_build_object('identity',isolation_id::text,'purpose',purpose,'revision',(SELECT value::text FROM stock_operational.revision WHERE singleton))) FROM stock_operational.environment;"]
    for table,spec in CATALOG.items():
        sql.append(f"SELECT json_build_object('inventory','{table}','rows',count(*)) FROM stock_operational.{table} WHERE archived_at IS NULL;")
        for variant,order in [('legacy','row_order'),('creation','created_at_instant ASC NULLS LAST,"'+spec['key']+'" COLLATE "C" ASC'),('latest','created_at_instant DESC NULLS LAST,"'+spec['key']+'" COLLATE "C" ASC')]:
            sql.append(f"SELECT json_build_object('table','{table}','variant','{variant}','recordId',r.\"{spec['key']}\",'cells',stock_operational.project_{table}(r)) FROM stock_operational.{table} r WHERE archived_at IS NULL ORDER BY {order};")
    return '\n'.join([*sql,'COMMIT;'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target-id',required=True)
    parser.add_argument('--target-purpose',choices=['isolated-staging','production'],required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--frozen-review-approved',action='store_true',required=True,help='Explicit operator confirmation: target is frozen or an approved disposable restore')
    args=parser.parse_args()
    os.umask(0o077)
    path=Path(args.output)
    # Exclusive output, even on failure; do not replace earlier evidence.
    with path.open('x') as out:
        run=subprocess.run(['psql','-XqAtw','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],input=review_sql(args.target_id,args.target_purpose),text=True,capture_output=True,env=client_environment(),timeout=300)
        if run.returncode:
            with Path(str(path)+'.stderr.private.log').open('x') as diagnostic:diagnostic.write(run.stderr)
            raise ValueError('Read-only export failed; no mutation attempted')
        for line in run.stdout.splitlines():
            if line.startswith('{'):out.write(line+'\n')
    print(json.dumps({'privateReviewExported':True,'tables':23,'databaseWrites':False,'recordsPrinted':False}))

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('Private ordinal review export refused or failed. Inspect connection/target privately; no database write was attempted.')
