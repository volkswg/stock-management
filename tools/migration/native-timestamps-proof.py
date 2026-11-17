"""Check synthetic before/after metadata; never connects to a database."""
import json,runpy,sys
from pathlib import Path
p=Path(sys.argv[1])
read=lambda name:{r['metadata']:r['value'] for r in map(json.loads,(p/name).read_text().splitlines())}
b,a=read('metadata-before'),read('metadata-after')
for key in ['schemas','tables','policies','grants','constraints','indexes','sequences','defaults','runtimeRole','sequenceGrants','memberships','runtimeLogins']:
    assert a[key]==b[key],key
fields=runpy.run_path('tools/migration/native-timestamps.py')['fields']()
names={(table,name) for table,name,_ in fields}
expected=[]
for col in b['columns']:
    key=(col['relname'],col['attname'])
    if col['nspname']=='stock_operational' and col['attname']=='created_at_instant':continue
    if col['nspname']=='stock_operational' and key in names:
        col={**col,'type':'timestamp with time zone'}
        if (col['relname'],col['attname'],None) in fields:col['default_expression']='statement_timestamp()'
    expected.append(col)
assert a['columns']==expected
assert a['triggers']==[t for t in b['triggers'] if t['tgname']!='b_created_at_instant']
old={f['proname']:f for f in b['functions']};new={f['proname']:f for f in a['functions']}
assert set(new)==set(old)-{'set_created_at_instant'}|{'native_timestamp_text','native_timestamp_input'}
for name,original in old.items():
    if name=='set_created_at_instant':continue
    definition=original['definition']
    prefix=next((prefix for prefix in ['input_','project_','validate_'] if name.startswith(prefix)),None)
    if prefix:
        table=name[len(prefix):]
        for t,col,index in fields:
            if t!=table or index is None:continue
            if prefix=='input_':definition=definition.replace(f'r."{col}" := nullif((cells->>{index}),\'\')::text;',f'r."{col}" := stock_operational.native_timestamp_input(cells->>{index});')
            elif prefix=='project_':definition=definition.replace(f'to_jsonb(r."{col}")',f'to_jsonb(stock_operational.native_timestamp_text(r."{col}"))')
            else:definition=definition.replace(f'NEW."{col}" := nullif(NEW."{col}",\'\');',f'PERFORM stock_operational.native_timestamp_text(NEW."{col}");')
        if prefix=='validate_' and (table,'createdAt',None) in fields:
            definition=definition.replace(f'PERFORM stock_operational.project_{table}(NEW);',f'PERFORM stock_operational.native_timestamp_text(NEW."createdAt"); PERFORM stock_operational.project_{table}(NEW);')
    assert new[name]=={**original,'definition':definition},name
for name,prefixes in [('native_timestamp_text',('project_','input_')),('native_timestamp_input',('input_',))]:
    helper=new[name]
    recipients={acl.split('=')[0] for f in old.values() if f['proname'].startswith(prefixes) for acl in f['acl'] if acl.split('=')[0] not in ('','anon','authenticated')}
    assert {acl.split('=')[0] for acl in helper['acl']}==recipients
    assert helper['owner']==old['input_orders']['owner']
    assert 'SECURITY DEFINER' not in helper['definition']
print('PASS: exact native timestamp types, unchanged other data/security/metadata, scoped scalar caller rights, obsolete derivation only retired')
