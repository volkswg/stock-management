#!/usr/bin/env python3
"""Offline profiling only. Reports aggregate types/format problems; never reads Google."""
import argparse
import json
import re
from datetime import date, datetime
from decimal import Decimal
from collections import Counter
from pathlib import Path
from core import CATALOG, convert, exact_total, digest, canonical, load_json
from migrate import write_private

def profile(snapshot):
    report={'checksum':digest(snapshot),'serializedBytes':len(canonical(snapshot).encode()),'tables':{},'problems':[]}
    normalized={}
    if snapshot.get('version') != 1 or not snapshot.get('spreadsheetId'): report['problems'].append({'problem':'invalid snapshot envelope'})
    if set(snapshot.get('sheets',{})) != set(CATALOG): report['problems'].append({'problem':'worksheet inventory mismatch'})
    for table,spec in CATALOG.items():
        sheet=snapshot.get('sheets',{}).get(table,{})
        if sheet.get('headers')!=spec['headers']:
            report['problems'].append({'table':table,'problem':'missing worksheet or changed headers'});continue
        formula_like=sum(1 for row in sheet.get('formulaRows',[]) for value in row if isinstance(value,str) and value.startswith('='))
        if formula_like:report['problems'].append({'table':table,'problem':'formula-like source cells require business-rule review','count':formula_like})
        ids=Counter();types={c:Counter() for c in spec['headers']};numbers={c:[] for c,k in spec['columns'].items() if k in ('numeric','bigint')};dates={}
        normalized[table]=[]
        for number,row in enumerate(sheet.get('rows',[]),2):
            if all(v in ('',None) for v in row):continue
            record={}
            if len(row)>len(spec['headers']):report['problems'].append({'table':table,'row':number,'problem':'extra cells'})
            for index,col in enumerate(spec['headers']):
                value=row[index] if index<len(row) else None;types[col][type(value).__name__]+=1
                try:record[col]=convert(value,spec['columns'][col])
                except (ValueError,TypeError,json.JSONDecodeError):report['problems'].append({'table':table,'row':number,'column':col,'problem':'invalid value for target type'});record[col]=None
                if col in numbers:
                    numbers[col].append(record[col])
                    formatted=sheet.get('formattedRows',[])
                    if formatted and number-2<len(formatted):
                        display=formatted[number-2]
                        try:
                            projected=convert(display[index] if index<len(display) else None,spec['columns'][col])
                            if (projected is None) != (record[col] is None) or projected is not None and Decimal(projected)!=Decimal(record[col]):raise ValueError('numeric rendering mismatch')
                        except ValueError:report['problems'].append({'table':table,'row':number,'column':col,'problem':'formatted numeric value requires compatibility review'})
                if col.endswith(('At','Date')) or col in ('date','month','effectiveFrom','packingDate','deliverDateTime'):
                    shape='blank' if value in ('',None) else 'month' if isinstance(value,str) and re.fullmatch(r'\d{4}-\d{2}',value) else 'date' if isinstance(value,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',value) else 'timestamp' if isinstance(value,str) and re.match(r'^\d{4}-\d{2}-\d{2}T',value) else 'unclassified'
                    try:
                        if shape=='date': date.fromisoformat(value)
                        elif shape=='month': date.fromisoformat(value+'-01')
                        elif shape=='timestamp':
                            if datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is None: shape='unclassified'
                    except ValueError: shape='unclassified'
                    dates.setdefault(col,Counter())[shape]+=1
                    if shape=='unclassified':report['problems'].append({'table':table,'row':number,'column':col,'problem':'date format needs owner review'})
            for col in spec.get('required',[]):
                if record.get(col) is None:report['problems'].append({'table':table,'row':number,'column':col,'problem':'missing required relationship'})
            key=f'sheet-row:{number}' if spec['key']=='migration_id' else record.get('id')
            if not key:report['problems'].append({'table':table,'row':number,'problem':'missing ID'})
            ids[key]+=1;normalized[table].append((number,record))
        duplicates=sum(n-1 for n in ids.values() if n>1)
        if duplicates:report['problems'].append({'table':table,'problem':'duplicate IDs','count':duplicates})
        report['tables'][table]={'rows':len(normalized[table]),'uniqueIDs':len(ids),'duplicateRows':duplicates,'types':{k:dict(v) for k,v in types.items()},'rawTypes':{col:dict(Counter(row[index] if index<len(row) else 'null' for row in sheet.get('rawCellTypes',[]))) for index,col in enumerate(spec['headers'])},'dateShapes':{k:dict(v) for k,v in dates.items()},'totals':{k:exact_total(v) for k,v in numbers.items()}}
    for table,rows in normalized.items():
        for col,parent in CATALOG[table]['references'].items():
            ids={r['id'] for _,r in normalized.get(parent,[])}
            for number,row in rows:
                if row[col] is not None and row[col] not in ids:report['problems'].append({'table':table,'row':number,'column':col,'problem':'orphan relationship'})
    report['readyForReview']=not report['problems']
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('snapshot');p.add_argument('--output',required=True);args=p.parse_args()
    result=profile(load_json(Path(args.snapshot).read_text()));write_private(args.output,json.dumps(result,indent=2)+'\n')
    print(json.dumps({'readyForReview':result['readyForReview'],'problemCount':len(result['problems']),'serializedBytes':result['serializedBytes']}))
    return 0 if result['readyForReview'] else 1

if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit('Profiling failed. Inspect restricted source artifacts; no records were changed.')
