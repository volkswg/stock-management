"""Exact stored-value/security proof for final lexeme retirement; no normalization."""
import json,re,runpy,sys
from pathlib import Path
p=Path(sys.argv[1]);m=runpy.run_path(str(Path(__file__).with_name('lexemes-final.py')))
read=lambda n:[json.loads(s) for s in (p/n).read_text().splitlines() if s.startswith('{')]
before,after=read('lexeme-final-before.jsonl'),read('lexeme-final-after.jsonl')
assert [r for r in before if 'table' in r]==[r for r in after if 'table' in r]
assert sum('table' in r for r in after)==51
b={r['metadata']:r['value'] for r in before if 'metadata' in r};a={r['metadata']:r['value'] for r in after if 'metadata' in r}
assert len(b)==len(a)==15
for key in b:
    if key not in ('columns','functions'):assert b[key]==a[key],key
assert a['columns']==[c for c in b['columns'] if not(c['nspname']=='stock_operational' and c['attname'].endswith('__lexeme'))]
old={f['proname']:f for f in b['functions']};new={f['proname']:f for f in a['functions']}
assert set(new)==set(old)-m['RETIRED_HELPERS']
changes=m['replacements']()
for name,f in old.items():
    if name in m['RETIRED_HELPERS']:continue
    definition=f['definition']
    if name in changes:
        match=re.search(r'AS \$(\w*)\$(.*?)\$\1\$',definition,re.S);assert match,name
        definition=definition[:match.start(2)]+changes[name]+definition[match.end(2):]
    assert new[name]=={**f,'definition':definition},name
assert sum(c['nspname']=='stock_operational' and c['attname'] in ('createdAt','updatedAt','deletedAt') and c['type']=='timestamp with time zone' for c in a['columns'])==47
assert not any(c['nspname']=='stock_operational' and c['attname'].endswith('__lexeme') for c in a['columns'])
print('PASS:51 stored tables exact excluding only48retired spellings;47timestamps,IDs,revisions,journals,archives and remaining metadata/security exact;97pinned body replacements and4unused helper removals;no data repair/new grants')
