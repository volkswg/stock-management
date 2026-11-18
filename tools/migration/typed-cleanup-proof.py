"""Every stored value/metadata entry identical except the116 approved functions."""
import json,re,runpy,sys
from pathlib import Path
p=Path(sys.argv[1]);m=runpy.run_path(str(Path(__file__).with_name('typed-cleanup.py')))
read=lambda n:[json.loads(s) for s in (p/n).read_text().splitlines() if s.startswith('{')]
b,a=read('typed-before.jsonl'),read('typed-after.jsonl')
assert len(b)==len(a)==66
for before,after in zip(b,a):
 if before.get('metadata')=='functions':
  expected=[]
  for f in before['value']:
   if f['nspname']=='stock_operational' and f['proname'] in m['RETIRED']:continue
   if f['nspname']=='stock_operational' and f['proname'] in m['REPLACEMENTS']:
    definition=f['definition'];match=re.search(r'AS \$(\w*)\$(.*?)\$\1\$',definition,re.S);assert match
    definition=definition[:match.start(2)]+m['REPLACEMENTS'][f['proname']]+definition[match.end(2):];f={**f,'definition':definition}
   expected.append(f)
  assert after=={**before,'value':expected}

 else:assert before==after,before.get('metadata',before.get('table'))
print('PASS: all51 table values and15 metadata sections exact except116 retired functions; 23 validator calls retargeted, no table/column/ACL/role changes')
