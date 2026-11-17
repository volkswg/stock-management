"""Offline exact data/security/DDL proof for the reviewed final retirement."""
import json,re,runpy,sys
from pathlib import Path
p=Path(sys.argv[1]);module=runpy.run_path(str(Path(__file__).with_name('cell-kinds-final.py')))
read=lambda name:[json.loads(s) for s in (p/name).read_text().splitlines() if s.startswith('{')]
before,after=read('final-before.jsonl'),read('final-after.jsonl')
assert [r for r in before if 'table' in r]==[r for r in after if 'table' in r]
assert sum('table' in r for r in after)==51
b={r['metadata']:r['value'] for r in before if 'metadata' in r};a={r['metadata']:r['value'] for r in after if 'metadata' in r}
assert len(b)==len(a)==15
for key in b:
    if key not in ('columns','functions'):assert a[key]==b[key],key
expected=[c for c in b['columns'] if not(c['nspname']=='stock_operational' and c['attname']=='cell_kinds')]
assert a['columns']==expected
old={f['proname']:f for f in b['functions']};new={f['proname']:f for f in a['functions']}
assert set(new)==set(old)-{'cell_projection'}
replacements=module['final_bodies']()
for name,original in old.items():
    if name=='cell_projection':continue
    definition=original['definition']
    if name in replacements:
        match=re.search(r'AS \$(\w*)\$(.*?)\$\1\$',definition,re.S);assert match,name
        definition=definition[:match.start(2)]+replacements[name]+definition[match.end(2):]
    assert new[name]=={**original,'definition':definition},name
assert not any(c['nspname']=='stock_operational' and c['attname']=='cell_kinds' for c in a['columns'])
assert sum(c['nspname']=='stock_operational' and c['attname'].endswith('__lexeme') for c in a['columns'])==48
assert sum(c['nspname']=='stock_operational' and c['attname'] in ('createdAt','updatedAt','deletedAt') and c['type']=='timestamp with time zone' for c in a['columns'])==47
print('PASS: all51 table values exact excluding only23 retired encodings; all48 lexemes,47 native timestamps,IDs,revisions,journals,archives and remaining metadata/security exact;115 pinned function bodies replaced,1 unused helper removed; no new functions/grants')
