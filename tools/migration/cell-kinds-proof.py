"""Verify additive install preserves all tables and original metadata/security."""
import json,re,sys
from pathlib import Path
p=Path(sys.argv[1])
read=lambda n:[json.loads(s) for s in (p/n).read_text().splitlines() if s.startswith('{')]
b,a=read('before.jsonl'),read('after.jsonl')
assert [r for r in b if 'table' in r]==[r for r in a if 'table' in r]
assert len([r for r in a if 'table' in r])==51
bm={r['metadata']:r['value'] for r in b if 'metadata' in r};am={r['metadata']:r['value'] for r in a if 'metadata' in r}
assert len(bm)==len(am)==15
for key in bm:
    if key!='functions':assert bm[key]==am[key],key
old={f['proname']:f for f in bm['functions']};new={f['proname']:f for f in am['functions']}
assert len(new)-len(old)==74
for name,definition in old.items():assert new[name]==definition,name
for name,definition in new.items():
    if name in old:continue
    assert name.startswith('column_') and definition['owner']==old['input_orders']['owner']
    assert 'SECURITY DEFINER' not in definition['definition']
    recipients={acl.split('=')[0] for acl in definition['acl']}
    assert not recipients.intersection({'','anon','authenticated'})
    if name.startswith('column_input_'):
        original=old['input_'+name[len('column_input_'):]]
        assert definition['acl']==original['acl'],name
    elif name.startswith(('column_project_','column_compatible_')):
        table=re.sub(r'^column_(project|compatible)_','',name)
        assert definition['acl']==old['project_'+table]['acl'],name
    else:
        expected={acl.split('=')[0] for name,f in old.items() if name.startswith(('project_','input_')) for acl in f['acl']}
        assert recipients==expected,name
assert len([c for c in am['columns'] if c['nspname']=='stock_operational' and c['attname']=='cell_kinds'])==23
assert len([c for c in am['columns'] if c['nspname']=='stock_operational' and c['attname'].endswith('__lexeme')])==48
print('PASS: all51 tables and all original functions/metadata/security exact; only74 invoker functions added with existing caller capabilities;23 encodings and48 lexemes retained')
