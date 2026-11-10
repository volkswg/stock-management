#!/usr/bin/env python3
"""Explicit offline CLI. No live import mode; generated SQL requires operator approval."""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from core import CATALOG, import_sql, normalize, reconcile, digest, convert, canonical, load_json
from pg_access import client_environment, secure_connection_sql
from jsonb_stream import read_session, verify_snapshot

class ExactNumber(str):
    """Keep a JSON decimal token exact while retaining its source number type."""


class RefuseRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('export redirects are forbidden; never forward bearer credentials')


def write_private(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(value)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('plan'); p.add_argument('snapshot'); p.add_argument('--output'); p.add_argument('--dry-run', action='store_true'); p.add_argument('--snapshot-encoding', choices=['plain-jsonb','gzip-json-v1'], default='plain-jsonb', help='Opt-in archive representation; use only in a separately approved generated SQL plan')
    p = sub.add_parser('reconcile'); p.add_argument('source'); p.add_argument('target'); p.add_argument('--output')
    p = sub.add_parser('export'); p.add_argument('--workbook', required=True); p.add_argument('--mapping', required=True); p.add_argument('--output', required=True); p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('database-snapshot'); p.add_argument('--output', required=True); p.add_argument('--source', required=True)
    args = parser.parse_args()
    if args.command == 'plan':
        snapshot = load_json(Path(args.snapshot).read_text()); sql = import_sql(snapshot, snapshot_encoding=args.snapshot_encoding)
        print(json.dumps({'valid': True, 'checksum': digest(snapshot), 'rows': {k:len(v) for k,v in normalize(snapshot).items()}, 'dryRun': args.dry_run or not args.output}))
        if args.output and not args.dry_run: write_private(args.output, sql)
    elif args.command == 'reconcile':
        report = reconcile(load_json(Path(args.source).read_text()), load_json(Path(args.target).read_text()))
        if args.output: write_private(args.output,json.dumps(report,indent=2)+'\n')
        # IDs, relationships and money never belong in ordinary command logs.
        print(json.dumps({'match':report['match'],'differentTables':list(report['differences']),'tableCount':len(CATALOG)})); return 0 if report['match'] else 1
    elif args.command == 'database-snapshot':
        # Bind extraction to the complete frozen batch, including formulas and
        # raw/formatted values, before reading individual business records.
        source=load_json(Path(args.source).read_text()); normalize(source)
        from core import quote
        snapshot = {'version':1,'spreadsheetId':source['spreadsheetId'],'sheets':{t:{'headers':s['headers'],'rows':[]} for t,s in CATALOG.items()}}
        begin="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL standard_conforming_strings=on;\nSET LOCAL client_encoding='UTF8';\nSET LOCAL statement_timeout='120s';\n"+secure_connection_sql()+"\nSELECT pg_advisory_xact_lock_shared(835107241);\n"
        with read_session(begin) as session:
            verify_snapshot(session,source)
            for table in CATALOG:
                query=f"SELECT json_build_object('table','{table}','workbook',source_workbook,'row',source_row,'cells',source_cells,'typed',to_jsonb(t)) FROM stock_migration.{table} t ORDER BY source_row;"
                for line in session.rows(query):
                    if not line.startswith(b'{'):continue
                    entry=load_json(line)
                    spec=CATALOG[entry['table']]
                    for col,kind in spec['columns'].items():
                        pos=spec['headers'].index(col)
                        raw=entry['cells'][pos] if pos<len(entry['cells']) else None
                        expected=convert(raw,kind); actual=entry['typed'][col]
                        if kind in ('numeric','bigint') and actual is not None:actual=str(actual)
                        if expected!=actual:raise ValueError('typed data diverged from source archive')
                    if snapshot['spreadsheetId'] and snapshot['spreadsheetId']!=entry['workbook']:raise ValueError('multiple workbooks')
                    snapshot['spreadsheetId']=entry['workbook'];rows=snapshot['sheets'][entry['table']]['rows']
                    while len(rows)<entry['row']-2:rows.append([])
                    rows.append(entry['cells'])
        normalize(snapshot)
        snapshot['archiveEvidence']={'sourceChecksum':digest(source),'fullSnapshotVerified':True}
        write_private(args.output,canonical(snapshot)+'\n')
    else:
        mapping=json.loads(Path(args.mapping).read_text())
        if set(mapping)!=set(CATALOG) or len(set(mapping.values()))!=len(mapping): raise ValueError('mapping must name every business sheet once')
        if any(not isinstance(name,str) or not name.strip() or name.strip().lower()=='loyverse_accounts' for name in mapping.values()): raise ValueError('credential/invalid worksheet mapping excluded')
        if args.dry_run:
            print(json.dumps({'method':'GET','worksheets':list(mapping.values()),'credentialSheetsExcluded':True})); return 0
        # Token provision is deliberately external: use a short-lived readonly Sheets OAuth token.
        import urllib.parse
        token=os.environ['GOOGLE_SHEETS_READONLY_TOKEN']
        opener=urllib.request.build_opener(RefuseRedirect())
        base='https://sheets.googleapis.com/v4/spreadsheets/'+urllib.parse.quote(args.workbook,safe='')
        def get(path):
            req=urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token})
            with opener.open(req,timeout=60) as response: return json.load(response, parse_float=ExactNumber)
        metadata=get('?fields=properties(locale,timeZone),sheets.properties.title')
        known={s['properties']['title'] for s in metadata['sheets']}
        if not set(mapping.values())<=known: raise ValueError('mapped worksheet missing')
        names=list(mapping)
        ranges=["'"+mapping[table].replace("'","''")+"'" for table in names]
        # Inspect only row 1 first. A mistaken mapping must not fetch token or
        # unrelated business rows before its canonical headers are checked.
        header_query=urllib.parse.urlencode([('ranges',r+'!1:1') for r in ranges]+[('valueRenderOption','FORMATTED_VALUE')])
        header_values=get('/values:batchGet?'+header_query).get('valueRanges',[])
        if len(header_values)!=len(names): raise ValueError('missing worksheet headers')
        for table,entry in zip(names,header_values):
            if entry.get('values',[]) != [CATALOG[table]['headers']]: raise ValueError('mapped worksheet headers differ; business capture forbidden')
        def capture():
            names=list(mapping)
            ranges=["'"+mapping[table].replace("'","''")+"'" for table in names]
            def rendered(mode):
                query=urllib.parse.urlencode([('ranges',r) for r in ranges]+[('valueRenderOption',mode),('dateTimeRenderOption','FORMATTED_STRING')])
                values=get('/values:batchGet?'+query).get('valueRanges',[])
                if len(values)!=len(names): raise ValueError('incomplete batch export')
                return {table:item.get('values',[]) for table,item in zip(names,values)}
            raw=rendered('UNFORMATTED_VALUE');formatted=rendered('FORMATTED_VALUE');formulas=rendered('FORMULA')
            sheets={}
            for table in names:
                rows=raw[table];display=formatted[table]
                if len(rows)!=len(display) or len(rows)!=len(formulas[table]): raise ValueError('rendered row count drift')
                if not rows or rows[0]!=CATALOG[table]['headers'] or display[0]!=CATALOG[table]['headers'] or formulas[table][0]!=CATALOG[table]['headers']: raise ValueError('header changed during capture')
                selected=[]
                for number,row in enumerate(rows[1:],1):
                    width=max(len(row),len(display[number]))
                    values=[]
                    for index in range(width):
                        if index>=len(CATALOG[table]['headers']): raise ValueError('unexpected source column')
                        source=display[number] if CATALOG[table]['columns'][CATALOG[table]['headers'][index]]=='text' else row
                        values.append(source[index] if index<len(source) else None)
                    selected.append(values)
                types=[['boolean' if isinstance(v,bool) else 'number' if isinstance(v,(int,ExactNumber)) else 'null' if v is None else 'string' for v in row] for row in rows[1:]]
                sheets[table]={'headers':display[0] if display else [],'rows':selected,'rawRows':rows[1:],'rawCellTypes':types,'formattedRows':display[1:],'formulaRows':formulas[table][1:]}
            return {'version':1,'spreadsheetId':args.workbook,'sourceProperties':metadata.get('properties',{}),'sheets':sheets}
        first=capture(); second=capture()
        if digest(first)!=digest(second): raise ValueError('source changed during export; freeze writers and retry')
        normalize(first); write_private(args.output,json.dumps(first,ensure_ascii=False)+'\n')
        print(json.dumps({'checksum':digest(first),'unknownSheets':sorted(known-set(mapping.values())-{'loyverse_accounts'})}))
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        # Provider/SQL exceptions may contain private rows or bearer tokens.
        print('Migration failed. Check headers, types, identities, relationships and access using private diagnostics.',file=sys.stderr)
        sys.exit(2)
