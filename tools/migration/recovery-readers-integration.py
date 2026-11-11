"""Exact serial/parallel parity on disposable synthetic databases only."""
import json
import subprocess
import sys
from recovery import fingerprint
from pg_access import client_environment
history=sys.argv[1]
assert history in ('audit','revision')
result=subprocess.run(['psql','-XqAtw','-v','ON_ERROR_STOP=1'],input="BEGIN READ ONLY; SELECT json_build_object('database',current_database(),'socket',inet_client_addr() IS NULL,'id',(SELECT isolation_id FROM stock_operational.environment)); ROLLBACK;",capture_output=True,text=True,env=client_environment(),timeout=10)
assert result.returncode==0
info=json.loads(result.stdout.strip())
assert info['socket'] and info['database'] in ('postgres','audit_history_test')
serial=fingerprint(info['id'],history=history)
parallel=fingerprint(info['id'],history=history,workers=2)
assert serial==parallel and len(serial)==66
try:fingerprint(info['id'],history='revision' if history=='audit' else 'audit',workers=2)
except ValueError:pass
else:raise AssertionError('wrong schema layout must fail')
print('PASS: real PostgreSQL serial/two-reader exact parity, 66 sections and wrong-layout rejection ('+history+')')
# Independent oracle: hash canonical full-row bytes locally, including every
# source field, and compare with PostgreSQL's compact per-row hash stream.
import hashlib
compact=fingerprint(info['id'],history=history,workers=2,row_digests=True)
for entry in compact:
 if 'table' not in entry or entry['table']=='stock_migration.import_batches':continue
 table=entry['table']
 result=subprocess.run(['psql','-XqAtw','-v','ON_ERROR_STOP=1'],input="SELECT encode(convert_to(to_jsonb(t)::text,'UTF8'),'hex') FROM "+table+" t;",capture_output=True,text=True,env=client_environment(),timeout=10)
 assert result.returncode==0
 raw=[bytes.fromhex(line) for line in result.stdout.splitlines()]
 hashes=sorted(hashlib.sha256(row).digest() for row in raw)
 assert entry['rows']==len(raw) and entry['algorithm']=='sorted-row-sha256-v2'
 assert entry['sha256']==hashlib.sha256(b'stock-table-row-sha256-v2\x00'+b''.join(hashes)).hexdigest()
print('PASS: full canonical-row Python/SHA256 oracle for every compact table fingerprint ('+history+')')
