#!/usr/bin/env python3
"""Opt-in private, read-only comparison; no normalization or removal authority."""
import argparse,json,os,runpy,subprocess,uuid
from pathlib import Path
from core import CATALOG
from pg_access import client_environment,secure_connection_sql
from recovery import guard_sql

def audit_sql(target,purpose):
    target=str(uuid.UUID(target))
    visibility=runpy.run_path(str(Path(__file__).with_name('row-order-review.py')))['visibility_sql']()
    sql=["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='120s';",
         secure_connection_sql(),guard_sql(target,purpose),
         'SELECT pg_advisory_xact_lock_shared(835107241); SELECT pg_advisory_xact_lock_shared(835107242);',visibility,
         "SELECT 1 / (stock_operational.column_mapping_contract_v1()='retained')::int;",
         "SELECT json_build_object('metadata',json_build_object('identity',isolation_id::text,'purpose',purpose,'revision',(SELECT value::text FROM stock_operational.revision WHERE singleton),'atUtc',clock_timestamp())) FROM stock_operational.environment;"]
    for table,spec in CATALOG.items():
        names=','.join("('"+name+"',"+str(i)+')' for i,name in enumerate(spec['headers']))
        sql.append(f'''WITH source AS MATERIALIZED (
 SELECT archived_at IS NOT NULL archived,stock_operational.project_{table}(t) original,
 stock_operational.column_project_{table}(t) candidate FROM stock_operational.{table} t
), differences AS (
 SELECT name,i,count(*) FILTER(WHERE original->i IS DISTINCT FROM candidate->i) mismatches,
 count(*) FILTER(WHERE archived AND original->i IS DISTINCT FROM candidate->i) archived_mismatches
 FROM (VALUES {names}) fields(name,i) LEFT JOIN source ON true GROUP BY name,i
)
SELECT json_build_object('table','{table}','rows',(SELECT count(*) FROM source),
 'archivedRows',(SELECT count(*) FROM source WHERE archived),
 'nonidenticalRows',(SELECT count(*) FROM source WHERE original IS DISTINCT FROM candidate),
 'widthDifferences',(SELECT count(*) FROM source WHERE jsonb_array_length(original)<>jsonb_array_length(candidate)),
 'fields',(SELECT coalesce(json_agg(json_build_object('name',name,'position',i,'mismatches',mismatches,'archivedMismatches',archived_mismatches) ORDER BY i),'[]'::json) FROM differences));''')
    return '\n'.join([*sql,'COMMIT;'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target-id',required=True)
    parser.add_argument('--target-purpose',required=True,choices=['production','isolated-staging'])
    parser.add_argument('--output',required=True)
    parser.add_argument('--frozen-or-local-review-approved',required=True,action='store_true')
    args=parser.parse_args();os.umask(0o077)
    path=Path(args.output)
    with path.open('x') as out:
        result=subprocess.run(['psql','-XqAtw','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],input=audit_sql(args.target_id,args.target_purpose),env=client_environment(),capture_output=True,text=True,timeout=300)
        if result.returncode:
            Path(str(path)+'.stderr.private.log').write_text(result.stderr)
            raise ValueError('Read-only mapping review refused')
        rows=[json.loads(s) for s in result.stdout.splitlines() if s.startswith('{')]
        metadata=[s['metadata'] for s in rows if 'metadata' in s];tables=[s for s in rows if 'table' in s]
        assert len(metadata)==1 and [t['table'] for t in tables]==list(CATALOG)
        report={'version':1,'scope':'private-retained-per-column-comparison','metadata':metadata[0],
                'tables':tables,'nonidenticalRows':sum(t['nonidenticalRows'] for t in tables),
                'exactProjectionMatch':all(t['nonidenticalRows']==0 for t in tables),
                'businessSemanticReviewRequired':True,'physicalRemovalAuthorized':False,
                'writesPerformed':False,'recordValuesOrIdsExported':False}
        json.dump(report,out,indent=2);out.write('\n')
    print(json.dumps({'privateReviewExported':True,'tables':23,'exactProjectionMatch':report['exactProjectionMatch'],'physicalRemovalAuthorized':False,'writesPerformed':False}))

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('Private mapping audit refused or failed; inspect private diagnostics. No write or provider operation was attempted.')
