"""Only reviewed CHECK constraints, trigger targets and validator consolidation differ."""
import json
import re
import runpy
import sys
from pathlib import Path

m = runpy.run_path(str(Path(__file__).with_name('constraint-validation.py')))
p = Path(sys.argv[1])
read = lambda name: [json.loads(s) for s in (p / name).read_text().splitlines() if s.startswith('{')]
before, after = read('constraints-before.jsonl'), read('constraints-after.jsonl')
assert len(before) == len(after) == 66
for b, a in zip(before, after):
    section = b.get('metadata')
    if section == 'functions':
        old = next(f for f in b['value'] if f['nspname'] == 'stock_operational' and f['proname'] == 'validate_orders')
        definition = old['definition'].replace('stock_operational.validate_orders()', 'stock_operational.prepare_record_write()')
        match = re.search(r'AS \$(\w*)\$(.*?)\$\1\$', definition, re.S)
        assert match and match[2] == m['BODIES']['validate_orders']
        definition = definition[:match.start(2)] + m['GUARD'] + definition[match.end(2):]
        new = {**old, 'proname': 'prepare_record_write', 'definition': definition}
        expected = [f for f in b['value'] if not (f['nspname'] == 'stock_operational' and f['proname'] in {'validate_' + t for t in m['CATALOG']})] + [new]
        assert a['value'] == sorted(expected, key=lambda f: (f['nspname'], f['proname']))
    elif section == 'triggers':
        expected = []
        for item in b['value']:
            if item['relation'].startswith('stock_operational.') and item['tgname'] == 'a_validate':
                table = item['relation'].split('.')[1]
                item = {**item, 'definition': m['trigger'](table).removesuffix(';')}
            expected.append(item)
        assert a['value'] == expected
    elif section == 'constraints':
        additions = {(f'stock_operational.{t}', m['constraint_name'](t)) for t in m['CATALOG']}
        added = [v for v in a['value'] if (v['relation'], v['conname']) in additions]
        assert len(added) == 23 and all(v['convalidated'] for v in added)
        for v in added:
            table = v['relation'].split('.')[1]
            assert v['definition'] == m['constraint_definition'](table), table
        assert [v for v in a['value'] if v not in added] == b['value']
    else:
        assert a == b, section or b.get('table')
print('PASS: all51 tables exact; only23 CHECK constraints,23 trigger targets and23-to-1 validator functions changed; remaining metadata/ACLs exact')
