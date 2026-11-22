"""No-cost synthetic local product UAT. Owns only its new container and temporary app copy."""
from pathlib import Path
import argparse,hashlib,json,os,re,secrets,shutil,socket,subprocess,tempfile,time,uuid,urllib.request
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--snapshot',required=True,type=Path,help='Existing synthetic final-schema fixture, never a production checkpoint')
parser.add_argument('--artifacts',required=True,type=Path)
parser.add_argument('--serve',action='store_true')
parser.add_argument('--docker-host',default=os.environ.get('DOCKER_HOST','unix:///var/run/docker.sock'))
a=parser.parse_args();a.artifacts=a.artifacts.resolve();a.snapshot=a.snapshot.resolve();os.umask(0o077)
root=Path(__file__).resolve().parents[2];fixture=a.snapshot.read_bytes()
if hashlib.sha256(fixture).hexdigest()!='8d8feb268ca551a71e2953146945fe9f8635dd94fa434bbe374654576fe8e13c':raise SystemExit('Refusing unknown snapshot; use the pinned SYNTHETIC fixture only')
a.artifacts.mkdir(parents=True,exist_ok=True);log=(a.artifacts/'local-uat.private.log').open('w');docker=shutil.which('docker') or '/opt/homebrew/bin/docker'
env={'PATH':os.environ['PATH'],'DOCKER_HOST':a.docker_host};container=None;children=[];app=None
name='stock-product-uat-'+uuid.uuid4().hex[:10]
def run(args,body=None,check=True):
 r=subprocess.run([docker,'--host='+a.docker_host,*args],input=body,text=True,capture_output=True,env=env,timeout=180);log.write(r.stdout+r.stderr);log.flush()
 if check and r.returncode:raise RuntimeError('Local UAT database step failed; inspect the private synthetic log')
 return r

def sql(statement,check=True,db='uat'):
 return run(['exec','-i',container,'psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],statement,check)
def freeport():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
try:
 container=run(['run','-d','--pull=never','--name',name,'--memory=2g','--memory-swap=2g','--cpus=2','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.7']).stdout.strip()
 for _ in range(100):
  if run(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],check=False).returncode==0:break
  time.sleep(.2)
 inspection=json.loads(run(['inspect',container]).stdout)[0];assert not inspection['HostConfig']['Binds']
 roles={'anon','authenticated','stock_runtime','stock_test','stock_prod_reader','stock_prod_backup'}
 for line in fixture.decode().splitlines():
  if line.startswith(('GRANT ','REVOKE ')):
   match=re.search(r' (?:TO|FROM) ([^;]+);$',line)
   if match:
    for token in match[1].split(','):
     token=token.strip().strip('"');assert re.fullmatch('[A-Za-z_][A-Za-z_0-9]*',token);roles.add(token)
 statements=''.join('CREATE ROLE "'+r+'" '+("LOGIN PASSWORD 'synthetic-only' NOINHERIT" if r=='stock_test' else 'NOLOGIN')+';\n' for r in sorted(roles-{'PUBLIC','postgres'}) if not r.startswith('pg_'))
 run(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],statements+'GRANT stock_runtime TO stock_test;')
 run(['exec',container,'createdb','-U','postgres','uat']);sql(fixture.decode())
 isolation,purpose=sql('SELECT isolation_id,purpose FROM stock_operational.environment WHERE singleton').stdout.strip().split('|')
 run(['exec',container,'createdb','-U','postgres','-T','uat','production_packet'])
 assert purpose=='isolated-staging' and isolation!='349b9289-f684-4ec5-ac22-924b2be1946b'
 # Clear only THIS owned synthetic clone before adding the UAT schema.
 sql("DO $$DECLARE names text;BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';END$$;")
 migration=(root/'supabase/migrations/20261122050700_product_master_order_item_uat.sql').read_text()
 assert sql(migration,False).returncode!=0 # Missing opt-in must fail atomically.
 settings="SET stock.product_master_uat='reviewed-product-master-uat-v1';SET stock.expected_isolation_id='"+isolation+"';"
 assert sql(settings.replace(isolation,str(uuid.uuid4()))+migration,False).returncode!=0
 sql(settings+"UPDATE stock_operational.environment SET purpose='production';")
 assert sql(settings+migration,False).returncode!=0
 sql("UPDATE stock_operational.environment SET purpose='isolated-staging';")
 sql(settings+migration)
 # Empty inverse restores the baseline shape and is itself target guarded.
 sql("SET stock.expected_isolation_id='"+isolation+"';"+(root/'tools/product-uat/rollback-empty.sql').read_text())
 assert sql("SELECT to_regclass('stock_operational.products') IS NULL").stdout.strip()=='t'
 sql(settings+migration)
 port=run(['port',container,'5432/tcp']).stdout.strip().split(':')[-1]
 childenv={'PATH':env['PATH'],'CI':'1','NEXT_TELEMETRY_DISABLED':'1','STOCK_STORAGE':'supabase','STOCK_STAGING_ENABLED':'true','STOCK_ALLOW_LOCAL_TEST_DATABASE':'true','STOCK_TARGET_ISOLATION_ID':isolation,'STOCK_DATABASE_URL':'postgres://stock_test:synthetic-only@127.0.0.1:'+port+'/uat','STOCK_STAGING_AUTH_TOKEN':secrets.token_hex(32)}
 productionenv={**childenv,'STOCK_DATABASE_URL':childenv['STOCK_DATABASE_URL'].replace('/uat','/production_packet')}
 releasecheck=subprocess.run(['node','--test','tools/product-uat/production-release.test.cjs'],cwd=root,env=productionenv,text=True,capture_output=True,timeout=180);log.write(releasecheck.stdout+releasecheck.stderr);log.flush();print(releasecheck.stdout+releasecheck.stderr,flush=True);assert releasecheck.returncode==0,'Production release SQL guards failed'
 r=subprocess.run(['node','--test','tools/product-uat/postgres.test.cjs'],cwd=root,env=childenv,text=True,capture_output=True,timeout=180);log.write(r.stdout+r.stderr);log.flush();print(r.stdout+r.stderr,flush=True);assert r.returncode==0,'Product UAT PostgreSQL tests failed'
 assert sql("SET stock.expected_isolation_id='"+isolation+"';"+(root/'tools/product-uat/rollback-empty.sql').read_text(),False).returncode!=0
 # Full private logical recovery includes the new identity high-water state.
 dumped=run(['exec',container,'pg_dump','-U','postgres','-d','uat','--schema=stock_operational','--schema=stock_migration','--schema=stock_configuration']).stdout
 (a.artifacts/'synthetic-uat-recovery.sql').write_text(dumped)
 run(['exec',container,'createdb','-U','postgres','uat_restore']);sql(dumped,db='uat_restore')
 fingerprint="SELECT to_jsonb(t)::text FROM stock_operational.products t ORDER BY id;SELECT to_jsonb(t)::text FROM stock_operational.order_items t ORDER BY id;SELECT to_jsonb(t)::text FROM stock_operational.media t ORDER BY id;SELECT last_value,is_called FROM stock_operational.products_id_seq;SELECT stock_operational.media_catalog_v1(),stock_operational.media_record_contract_v1();"
 assert sql(fingerprint).stdout==sql(fingerprint,db='uat_restore').stdout
 # Existing app and LINE/database behavior must remain usable with the added FK.
 for testfile in ['tools/native-postgres/application.test.cjs','tools/native-postgres/media-line.test.cjs']:
  run(['exec',container,'createdb','-U','postgres','-T','uat','regression'])
  sql("DO $$DECLARE names text;BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';END$$;",db='regression')
  regressionenv={**childenv,'STOCK_DATABASE_URL':childenv['STOCK_DATABASE_URL'].replace('/uat','/regression')}
  result=subprocess.run(['node','--test',testfile],cwd=root,env=regressionenv,text=True,capture_output=True,timeout=240);log.write(result.stdout+result.stderr);log.flush();print(result.stdout+result.stderr,flush=True);assert result.returncode==0,testfile
  run(['exec',container,'dropdb','-U','postgres','regression'])
 if not a.serve:
  print(json.dumps({'pass':True,'syntheticLocalOnly':True,'paidResourcesCreated':0,'hostedWrites':0,'guardsAndEmptyInverse':True}));raise SystemExit(0)
 # Separate UI database, untouched by automated write tests.
 run(['exec',container,'createdb','-U','postgres','-T','uat','uat_browser'])
 sql('TRUNCATE stock_operational.products,stock_operational.order_items,stock_operational.orders,stock_operational.commands RESTART IDENTITY CASCADE;',db='uat_browser')
 sql((root/'tools/product-uat/seed.sql').read_text(),db='uat_browser')
 childenv['STOCK_DATABASE_URL']=childenv['STOCK_DATABASE_URL'].replace('/uat','/uat_browser')
 app=Path(tempfile.mkdtemp(prefix='product-uat-app-',dir=a.artifacts))
 for entry in ['src','public'] :shutil.copytree(root/entry,app/entry)
 for entry in ['package.json','yarn.lock','tsconfig.json','next.config.ts']:shutil.copy2(root/entry,app/entry)
 shutil.copytree((root/'node_modules').resolve(),app/'node_modules',symlinks=True)
 childenv['NODE_OPTIONS']='--require='+str(root/'tools/product-uat/no-providers.cjs')
 upstream,proxy=freeport(),freeport()
 build=subprocess.run(['node',str(app/'node_modules/next/dist/bin/next'),'build'],cwd=app,env=childenv,stdout=log,stderr=log,timeout=300)
 assert build.returncode==0,'Isolated UAT app build failed'
 children.append(subprocess.Popen(['node',str(app/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',str(upstream)],cwd=app,env=childenv,stdout=log,stderr=log))
 children.append(subprocess.Popen(['node',str(root/'tools/product-uat/proxy.mjs'),str(proxy),str(upstream)],cwd=root,env=childenv,stdout=log,stderr=log))
 state={'version':1,'syntheticOnly':True,'url':'http://127.0.0.1:'+str(proxy)+'/orders/UAT-PRODUCT-ORDER','container':container,'isolationId':isolation,'pids':[p.pid for p in children],'launcherPid':os.getpid(),'sourceBranch':'uat/product-master-from-order-item'}
 (a.artifacts/'running.private.json').write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state),flush=True)
 while all(p.poll() is None for p in children):time.sleep(1)
 raise RuntimeError('UAT service stopped unexpectedly')
except KeyboardInterrupt:pass
finally:
 for child in reversed(children):
  child.terminate()
  try:child.wait(timeout=10)
  except subprocess.TimeoutExpired:child.kill();child.wait()
 if container:run(['rm','-fv',container],check=False)
 if app:shutil.rmtree(app)
 log.close()
