"""Exact additive preservation proof; no record normalization or relaxed ACLs."""
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
read=lambda n:[json.loads(s) for s in (p/n).read_text().splitlines() if s.startswith('{')]
b,a=read('lexemes-before.jsonl'),read('lexemes-after.jsonl')
assert [r for r in b if 'table' in r]==[r for r in a if 'table' in r]
assert sum('table' in r for r in a)==51
bm={r['metadata']:r['value'] for r in b if 'metadata' in r};am={r['metadata']:r['value'] for r in a if 'metadata' in r}
assert len(bm)==len(am)==15
for key in bm:
    if key!='functions':assert bm[key]==am[key],key
old={f['proname']:f for f in bm['functions']};new={f['proname']:f for f in am['functions']}
assert len(new)-len(old)==47
for name,value in old.items():assert new[name]==value,name
for name,value in new.items():
    if name in old:continue
    assert value['owner']==old['column_input_orders']['owner']
    assert 'SECURITY DEFINER' not in value['definition']
    recipients={acl.split('=')[0] for acl in value['acl']}
    assert not recipients.intersection({'','anon','authenticated'})
    if name.startswith('typed_input_'):assert value['acl']==old['column_input_'+name[len('typed_input_'):]]['acl']
    elif name.startswith('typed_project_'):assert value['acl']==old['column_project_'+name[len('typed_project_'):]]['acl']
    else:
        assert name=='lexeme_mapping_contract_v1'
        expected={acl.split('=')[0] for n,f in old.items() if n.startswith(('column_project_','column_input_')) for acl in f['acl']}
        assert recipients==expected
assert sum(c['nspname']=='stock_operational' and c['attname'].endswith('__lexeme') for c in am['columns'])==48
print('PASS:51tables and15metadata sections exact; only47invoker functions added with existing callers;48lexemes retained; no record repair or original ACL changes')
