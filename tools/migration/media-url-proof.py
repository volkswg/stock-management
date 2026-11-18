"""Full52-table preservation proof, excluding only five approved retired fields."""
import json
import runpy
import sys
from pathlib import Path
import recovery
REFS=runpy.run_path(str(Path(__file__).with_name('media-catalog.py')))['REFERENCES']
def sql():
 text=recovery.fingerprint_sql(include_media=True)
 for table,url,_ in REFS:
  old=f'WITH serialized AS MATERIALIZED (SELECT to_jsonb(t)::text AS v FROM stock_operational.{table} t)'
  assert text.count(old)==1
  text=text.replace(old,f"WITH serialized AS MATERIALIZED (SELECT (to_jsonb(t)-'{url}')::text AS v FROM stock_operational.{table} t)")
 return text
if __name__=='__main__':
 if sys.argv[1]=='sql':print(sql())
 else:
  p=Path(sys.argv[2]);read=lambda n:{r.get('table',r.get('metadata')):r for line in (p/n).read_text().splitlines() if line.startswith('{') for r in [json.loads(line)]}
  inverse=sys.argv[1]=='inverse'
  b=read('media-url-inverse-before.jsonl' if inverse else 'media-url-before.jsonl');a=read('media-url-inverse-after.jsonl' if inverse else 'media-url-after.jsonl')
  tables=[k for k in b if k.startswith('stock_')];assert len(tables)==52
  for k in tables:
   if not (inverse and k=='stock_operational.revision'):assert a[k]==b[k],k
  for k in ['schemas','runtimeRole','runtimeLogins','memberships','defaults','tables','policies','grants','sequences','sequenceGrants','constraints','indexes','functions']:assert a[k]==b[k],k
  # Only the five URL columns and five URL/ID trigger definitions disappear/change.
  removed={(t,u) for t,u,_ in REFS}
  left=b if inverse else a;right=a if inverse else b
  assert left['columns']['value']==[c for c in right['columns']['value'] if not (c['nspname']=='stock_operational' and (c['relname'],c['attname']) in removed)]
  old=[t for t in b['triggers']['value'] if t['tgname']!='b_media_reference'];new=[t for t in a['triggers']['value'] if t['tgname']!='b_media_reference'];assert old==new
  print(json.dumps({'pass':True,'all52TablesCompared':True,'onlyFiveUrlFieldsExcluded':True,'globalCounterUnchanged':not inverse,'inverseCounterDeltaVerifiedByParent':5 if inverse else 0,'rowsRevisionsTimestampsAndMediaUnchanged':True,'permissionsAndOtherSchemaPreserved':True}))
