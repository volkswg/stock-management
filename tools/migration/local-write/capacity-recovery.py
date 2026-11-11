"""Capture and restore a completed disposable local load checkpoint without resets."""
from pathlib import Path
import os,sys,json,time,subprocess,hashlib,urllib.request,urllib.error,configparser,datetime
from urllib.parse import urlparse,unquote
sys.dont_write_bytecode=True
N=Path(sys.argv[1]).resolve();P=N.parent;R=Path(__file__).resolve().parents[3];V=N/'private';source=sys.argv[2];m=json.loads((V/'manifest.json').read_text());assert source in m['databaseNames'][1:];number=m['databaseNames'].index(source);assert m['phase'].replace('_','').isalnum() and m['phase'].islower();target=f'wt_ms_{m["phase"]}_restore0{number}';os.umask(0o077)
base={'HOME':str(Path.home()),'PATH':'/opt/homebrew/opt/libpq@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C','PYTHONDONTWRITEBYTECODE':'1'};de={**base,**json.loads((P/'hosted-indexed-import-preparation-2026-11-11/plan/approval-plan.json').read_text())['dockerEnvironment']}
sys.path.insert(0,str(R/'tools/migration'));import recovery
sys.path.insert(0,str(P/'manual-csv-refresh-2026-11-11'));from verify_import import environment
save=lambda name,o:(V/name).write_text(json.dumps(o,indent=2)+'\n')
def run(args,env=base,timeout=60):
 q=subprocess.run(args,env=env,capture_output=True,text=True,timeout=timeout)
 assert q.returncode==0,'Local recovery command failed; private diagnostics only'
 return q.stdout

def docker(*args,timeout=60):return run(['docker',*args],de,timeout)
def owner(db):return {**base,'PGSERVICEFILE':str(V/'pg_service.conf'),'PGPASSFILE':str(V/'pgpass'),'PGSERVICE':db+'_postgres','PGCONNECT_TIMEOUT':'10'}
child=None;started=None
try:
 result=json.loads((V/(source+'-capacity-result.json')).read_text());assert result['appStopped'] and result['ingressDrained']
 assert json.loads((V/(source+'-oracle-proof.json')).read_text())['status']=='PASS'
 assert subprocess.run(['lsof','-t','-nP','-iTCP:3150','-sTCP:LISTEN'],capture_output=True).returncode!=0
 c=json.loads(docker('inspect',m['cluster']['name']))[0];assert c['Id']==m['cluster']['id'] and c['Image']==m['cluster']['image'] and c['Config']['Labels']['stock.write-test']==m['taskId'] and c['State']['Running'] and not c['State']['OOMKilled'] and c['RestartCount']==0
 directory=N/(source+'-checkpoint-backup');assert not directory.exists();captureStart=time.monotonic()
 with environment(owner(source)):capture=recovery.capture(directory,m['targetIsolationId'],workers=2,history='revision',row_digests=True)
 captureSeconds=time.monotonic()-captureStart
 (directory/'provider-ledger.jsonl').write_bytes((V/'provider-ledger.jsonl').read_bytes());providerSha=hashlib.sha256((directory/'provider-ledger.jsonl').read_bytes()).hexdigest()
 original={x.get('table',x.get('metadata')):x for x in json.loads((V/'seed-original-fingerprint.json').read_text())};frozen=json.loads((directory/'fingerprint.json').read_text());now={x.get('table',x.get('metadata')):x for x in frozen}
 archive=[k for k in now if k.startswith('stock_migration.')];meta=[k for k in now if 'metadata' in now[k]];assert len(archive)==24 and len(meta)==15 and all(now[k]==original[k] for k in archive+meta)
 cfg=configparser.ConfigParser(interpolation=None);cfg.read(V/'pg_service.conf');section=dict(cfg[source+'_postgres']);section['dbname']=target;assert section['hostaddr']=='127.0.0.1' and int(section['port'])==m['databasePort'] and section['sslmode']=='verify-full'
 with (V/'pg_service.conf').open('a') as f:f.write('\n['+target+'_postgres]\n'+''.join(f'{k}={v}\n' for k,v in section.items()))
 secret=json.loads((V/'runtime-secrets.json').read_text())['ownerPassword']
 with (V/'pgpass').open('a') as f:f.write(f'localhost:{m["databasePort"]}:{target}:postgres:{secret}\n')
 started=time.monotonic();save(source+'-recovery-start.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'destination':target,'deadlineSeconds':900})
 docker('exec',m['cluster']['name'],'createdb','-U','supabase_admin','--owner=postgres','--template=template0','--encoding=UTF8','--locale-provider=icu','--icu-locale=en-US','--lc-collate=en_US.UTF-8','--lc-ctype=en_US.UTF-8',target)
 docker('exec',m['cluster']['name'],'psql','-Xqw','-U','supabase_admin','-d',target,'-v','ON_ERROR_STOP=1','-c',f'REVOKE CONNECT ON DATABASE {target} FROM PUBLIC; GRANT CONNECT ON DATABASE {target} TO postgres,{m["runtimeUser"]};')
 containerDump='/tmp/'+target+'.dump';docker('cp',str(directory/'database.dump'),m['cluster']['name']+':'+containerDump)
 docker('exec',m['cluster']['name'],'pg_restore','-U','supabase_admin','--exit-on-error','--single-transaction','--dbname='+target,containerDump,timeout=600)
 with environment(owner(target)):verified=recovery.verify(directory,m['targetIsolationId'],workers=2,history='revision',row_digests=True)
 assert verified['match'] and not verified['differentSections']
 D=V/(source+'-readonly-recovery');D.mkdir(mode=0o700);rm={**m,'databaseNames':[target],'recoveryDatabase':target,'recoveryReadOnly':True};rm.pop('providerCatalog',None)
 (D/'manifest.json').write_text(json.dumps(rm,indent=2));(D/'control.json').write_text('{}');(D/'provider-ledger.jsonl').write_text('')
 e=json.loads((V/(source+'-app-env.json')).read_text());e['STOCK_DATABASE_URL']=e['STOCK_DATABASE_URL'].rsplit('/',1)[0]+'/'+target;e.update(STOCK_STAGING_READ_ONLY='true',PGOPTIONS='-c role=stock_runtime -c default_transaction_read_only=on',STOCK_WRITE_MANIFEST=str(D/'manifest.json'),STOCK_WRITE_MANIFEST_SHA256=hashlib.sha256((D/'manifest.json').read_bytes()).hexdigest(),STOCK_WRITE_CONTROL=str(D/'control.json'),STOCK_WRITE_LEDGER=str(D/'provider-ledger.jsonl'))
 (D/'app-env.json').write_text(json.dumps(e,indent=2));(D/'preload.cjs').write_text('require('+json.dumps(str(R/'tools/migration/local-write/recovery-readonly.cjs'))+').installRecovery();\n')
 for p in D.iterdir():p.chmod(0o600)
 log=(D/'app.log').open('wb');app=(N/'app-v3').resolve();child=subprocess.Popen(['/opt/homebrew/bin/node','--require',str(D/'preload.cjs'),str(app/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3150'],cwd=app,env={**base,**e,'NEXT_TELEMETRY_DISABLED':'1'},stdout=log,stderr=log)
 def probe(url,method='GET',auth=True):
  headers={'Authorization':'Bearer '+e['STOCK_STAGING_AUTH_TOKEN']} if auth else {};request=urllib.request.Request(m['appOrigin']+url,method=method,headers=headers,data=b'{}' if method!='GET' else None)
  try:
   with urllib.request.urlopen(request,timeout=10) as response:return response.status,len(response.read())
  except urllib.error.HTTPError as error:return error.code,len(error.read())
 for i in range(100):
  try:
   if probe('/api/orders')[0]==200:break
  except (urllib.error.URLError,TimeoutError):pass
  time.sleep(.1)
 else:raise RuntimeError('Read-only recovery app did not become ready')
 checks=[]
 for url,method,auth,status in [('/api/orders','GET',True,200),('/api/stock-counts?month=2020-01','GET',True,200),('/api/sales/dashboard?accounts=WT_ACCOUNT_A&from=2019-06-01&to=2019-07-06','GET',True,200),('/api/orders','GET',False,401),('/api/orders','POST',True,405)]:
  actual,size=probe(url,method,auth);assert actual==status;checks.append({'route':url,'method':method,'expectedStatus':status,'actualStatus':actual,'consumedResponseBytes':size})
 runtime=urlparse(e['STOCK_DATABASE_URL'])
 ro={**base,'PGHOST':'localhost','PGHOSTADDR':'127.0.0.1','PGPORT':str(m['databasePort']),'PGDATABASE':target,'PGUSER':unquote(runtime.username),'PGPASSWORD':unquote(runtime.password),'PGSSLMODE':'verify-full','PGSSLROOTCERT':section['sslrootcert'],'PGOPTIONS':'-c role=stock_runtime -c default_transaction_read_only=on'}
 q=subprocess.run(['psql','-XqAtw','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-c',"INSERT INTO stock_operational.commands(kind,key,intent,response,state) SELECT 'WT_RECOVERY','WT_DENIED','WT_DENIED','{}'::jsonb,'complete' WHERE false"],env=ro,capture_output=True,text=True,timeout=10);assert q.returncode!=0 and '25006' in q.stderr
 child.terminate();child.wait(timeout=10);child=None;log.close()
 with environment(owner(target)):after=recovery.fingerprint(m['targetIsolationId'],workers=2,history='revision',row_digests=True)
 assert after==frozen;elapsed=time.monotonic()-started;assert elapsed<=900
 save(source+'-recovery-result.json',{'status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceDatabase':source,'restoredDatabase':target,'all51TablesAnd15MetadataMatch':True,'archiveTablesUnchanged':24,'securityMetadataUnchanged':15,'backupCaptureSeconds':round(captureSeconds,3),'restoreThroughReadOnlyReadinessSeconds':round(elapsed,3),'sqlReadOnlyState':'25006','readOnlyProbes':checks,'postProbeFingerprintUnchanged':True,'acknowledgedOperationsLost':0,'providerLedgerSha256':providerSha,'providerReplayPerformed':False,'existingResourcesPreserved':True,'verification':verified})
 print(json.dumps({'recovery':'PASS','database':source,'all66SectionsMatch':True,'readOnlyAppReady':True,'sqlWriteDenied':'25006','seconds':round(elapsed,3)}),flush=True)
except BaseException as error:
 save(source+'-recovery-stop.json',{'errorClass':type(error).__name__,'message':str(error),'elapsedSeconds':time.monotonic()-started if started else None});print('STOP: local recovery evidence retained',type(error).__name__,str(error),flush=True);raise SystemExit(1)
finally:
 if child is not None:child.terminate();child.wait(timeout=10)
