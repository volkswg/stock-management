"""Mac local capacity telemetry; credentials stay in the prepared private state."""
from pathlib import Path
import os,sys,json,time,subprocess,re,shutil,datetime
N=Path(sys.argv[1]).resolve();P=N.parent;V=N/'private';db=sys.argv[2];m=json.loads((V/'manifest.json').read_text());assert db in m['databaseNames'][1:];os.umask(0o077)
active=json.loads((V/(db+'-active.json')).read_text());assert active['database']==db
base={'HOME':str(Path.home()),'PATH':'/opt/homebrew/opt/libpq@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'};de={**base,**json.loads((P/'hosted-indexed-import-preparation-2026-11-11/plan/approval-plan.json').read_text())['dockerEnvironment']}
pe={**base,'PGSERVICEFILE':str(V/'pg_service.conf'),'PGPASSFILE':str(V/'pgpass'),'PGSERVICE':db+'_postgres','PGCONNECT_TIMEOUT':'2','PGOPTIONS':'-c default_transaction_read_only=on -c statement_timeout=1500 -c lock_timeout=1000'}
latest=V/(db+'-resources-latest.json');log=V/(db+'-resources.jsonl');assert not latest.exists() and not log.exists()
def run(args,env=base,timeout=3):
 q=subprocess.run(args,env=env,capture_output=True,text=True,timeout=timeout)
 if q.returncode:raise RuntimeError('Resource command failed: '+args[0])
 return q.stdout.strip()
def docker(*args):return run(['docker',*args],de)
def pg(sql):return json.loads(run(['psql','-XqAtw','-v','ON_ERROR_STOP=1','-c',sql],pe))
def processes():
 records={}
 for line in run(['ps','-axo','pid=,ppid=,rss=']).splitlines():
  pid,parent,rss=map(int,line.split());records[pid]=(parent,rss*1024)
 def group(root):
  result={root};changed=True
  while changed:
   add={pid for pid,(parent,_) in records.items() if parent in result};changed=not add.issubset(result);result|=add
  assert root in records;return result
 app=group(active['applicationPid']);driver=group(active['driverPid'])-app
 return sum(records[x][1] for x in app),sum(records[x][1] for x in driver)
initial=json.loads((V/'execution-packet.json').read_text())['initialHostFreeBytes'];initialDisk=None;initialStats=None;initialState=None;previous=None;overMs=0;samples=[];error=None;diskSample=None;lastDiskAt=0
sql="SELECT json_build_object('database',current_database(),'target',(SELECT isolation_id::text FROM stock_operational.environment WHERE singleton),'totalClientBackends',(SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend'),'runtimeBackends',(SELECT count(*) FROM pg_stat_activity WHERE usename='"+m['runtimeUser']+"'),'waits',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT wait_event_type,count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active' GROUP BY wait_event_type) x),'deadlocks',deadlocks,'statsReset',stats_reset,'maxConnections',current_setting('max_connections')::int,'runtimeConnectionLimit',(SELECT rolconnlimit FROM pg_roles WHERE rolname='"+m['runtimeUser']+"')) FROM pg_stat_database WHERE datname=current_database();"
metricScript="for f in memory.current memory.max memory.swap.max memory.events cpu.stat cpu.max cpu.pressure memory.pressure io.pressure; do printf 'FILE %s\\n' \"$f\"; cat /sys/fs/cgroup/\"$f\"; done; printf 'FILE meminfo\\n'; cat /proc/meminfo"
try:
 deadline=time.monotonic()+1800
 while time.monotonic()<deadline:
  start=time.monotonic()
  if (V/(db+'-stop-observer')).exists():break
  os.kill(active['driverPid'],0)
  c=json.loads(docker('inspect',m['cluster']['name']))[0];assert c['Id']==m['cluster']['id'] and c['Image']==m['cluster']['image'] and c['Config']['Labels']['stock.write-test']==m['taskId']
  if initialState is None:initialState=(c['State']['StartedAt'],c['RestartCount'])
  raw=docker('exec',m['cluster']['name'],'sh','-c',metricScript);parts={}
  for section in raw.split('FILE ')[1:]:
   name,content=section.split('\n',1);parts[name]=content.strip()
  cgtime=time.monotonic();cpu=dict((k,int(v)) for k,v in re.findall(r'^(\w+) (\d+)$',parts['cpu.stat'],re.M));events=dict((k,int(v)) for k,v in re.findall(r'^(\w+) (\d+)$',parts['memory.events'],re.M));vm={k:int(v) for k,v in re.findall(r'^(MemTotal|MemAvailable):\s+(\d+) kB$',parts['meminfo'],re.M)}
  stat=pg(sql);assert stat['database']==db and stat['target']==m['targetIsolationId']
  if initialStats is None:initialStats=stat
  ratio=(cpu['usage_usec']-previous[1])/(1e6*(cgtime-previous[0])*1.5) if previous else 0
  delta=(cgtime-previous[0])*1000 if previous else 0
  overMs=overMs+delta if ratio>.8 else 0
  reset=bool(previous and cpu['usage_usec']<previous[1]) or stat['statsReset']!=initialStats['statsReset'] or stat['deadlocks']<initialStats['deadlocks']
  previous=(cgtime,cpu['usage_usec'])
  if diskSample is None or time.monotonic()-lastDiskAt>=10:
   df=docker('exec',m['cluster']['name'],'df','-Pk','/var/lib/postgresql/data').splitlines()[-1].split();used=int(df[2])*1024
   if initialDisk is None:initialDisk=used
   disk=shutil.disk_usage(N);sizes=pg("SELECT json_build_object('databaseBytes',pg_database_size(current_database()),'walBytes',(SELECT coalesce(sum(size),0) FROM pg_ls_waldir()),'tableAndIndexBytes',(SELECT coalesce(sum(pg_total_relation_size(c.oid)),0) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('stock_operational','stock_migration') AND c.relkind='r'));")
   diskSample={'sampledAtMs':int(time.time()*1000),'hostDiskFreeFraction':disk.free/disk.total,'vmDiskFreeFraction':int(df[3])/int(df[1]),'hostFreeDiskBytes':disk.free,'storageGrowthBytes':max(0,initial-disk.free,used-initialDisk),'vmUsedBytes':used,**sizes};lastDiskAt=time.monotonic()
  host=int(re.search(r'System-wide memory free percentage:\s*(\d+)%',run(['memory_pressure','-Q']))[1])/100
  appRss,driverRss=processes();limit=c['HostConfig'];quota=parts['cpu.max'].split();limits=limit['Memory']==limit['MemorySwap']==1073741824 and limit['NanoCpus']==1500000000 and int(parts['memory.max'])==1073741824 and int(parts['memory.swap.max'])==0 and int(quota[0])/int(quota[1])==1.5 and stat['maxConnections']==24 and stat['runtimeConnectionLimit']==6
  record={'atMs':int(time.time()*1000),'databaseMemoryBytes':int(parts['memory.current']),'applicationRssBytes':appRss,'driverRssBytes':driverRss,'totalClientBackends':stat['totalClientBackends'],'runtimeBackends':stat['runtimeBackends'],'hostMemoryFreeFraction':host,'vmMemoryFreeFraction':vm['MemAvailable']/vm['MemTotal'],'cpuQuotaFraction':ratio,'cpuOver80PercentMs':overMs,'oom':bool(c['State']['OOMKilled'] or events.get('oom_kill',0)),'unplannedRestart':not c['State']['Running'] or (c['State']['StartedAt'],c['RestartCount'])!=initialState,'counterReset':reset,'limitsMatch':limits,'newDeadlocks':stat['deadlocks']-initialStats['deadlocks'],'waits':stat['waits'],'pressure':{k:parts[k] for k in ['cpu.pressure','memory.pressure','io.pressure']},'readOnlyAggregateSql':True,'observerSeconds':round(time.monotonic()-start,4),**{k:v for k,v in diskSample.items() if k!='sampledAtMs'},'diskSampleAtMs':diskSample['sampledAtMs']}
  with log.open('a') as f:f.write(json.dumps(record)+'\n')
  tmp=latest.with_suffix('.tmp');tmp.write_text(json.dumps(record));tmp.replace(latest);samples.append(record)
  if record['newDeadlocks']>0:raise RuntimeError('New database deadlock during non-fault capacity phase')
  time.sleep(max(0,1-(time.monotonic()-start)))
except BaseException as e:error=type(e).__name__+': '+str(e)
finally:
 keys=['databaseMemoryBytes','applicationRssBytes','driverRssBytes','totalClientBackends','runtimeBackends','cpuQuotaFraction','cpuOver80PercentMs','storageGrowthBytes','observerSeconds','newDeadlocks'];minKeys=['hostMemoryFreeFraction','vmMemoryFreeFraction','hostDiskFreeFraction','vmDiskFreeFraction','hostFreeDiskBytes']
 summary={'samples':len(samples),'maxima':{k:max((s[k] for s in samples),default=None) for k in keys},'minima':{k:min((s[k] for s in samples),default=None) for k in minKeys},'observerError':error,'oneSecondPolling':True,'tenSecondDiskAndSizePolling':True,'hostedAccess':False,'sqlPayloadsLogged':False}
 (V/(db+'-resource-summary.json')).write_text(json.dumps(summary,indent=2));print(json.dumps({'observerSamples':len(samples),'observerError':error}),flush=True)
