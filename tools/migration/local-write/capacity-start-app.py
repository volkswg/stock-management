"""Launch the attested test build using only its prepared synthetic environment."""
from pathlib import Path
import os,sys,json,hashlib
W=Path(sys.argv[1]).resolve();V=W/'private';A=W/'app-v3';m=json.loads((V/'manifest.json').read_text());db=sys.argv[2];assert db in m['databaseNames'];assert (V/'copy-ready.json').exists() and (V/'protected-before.json').exists()
e=json.loads((V/(db+'-app-env.json')).read_text());assert e['STOCK_WRITE_MANIFEST_SHA256']==hashlib.sha256((V/'manifest.json').read_bytes()).hexdigest()
packet=json.loads((V/'execution-packet.json').read_text());assert packet['applicationHeapMiB']==384 and packet['applicationRssBudgetBytes']==1073741824
base={'HOME':str(Path.home()),'PATH':'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin','NEXT_TELEMETRY_DISABLED':'1'}
os.chdir(A);os.execve('/opt/homebrew/bin/node',['node','--max-old-space-size=384','--require',str(A/'__local-write-harness/preload.cjs'),str(A/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3150'],{**base,**e})
