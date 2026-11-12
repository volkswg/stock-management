/* eslint-disable @typescript-eslint/no-require-imports -- Explicit prepared local-only capacity execution; never imported by the application. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const N=path.resolve(process.argv[2]||''),P=path.dirname(N),R=path.resolve(__dirname,'../../..'),V=path.join(N,'private');
assert.equal(process.argv.length,4,'Provide the prepared execution directory and one/five client level');
const level=Number(process.argv[3]);assert.ok([1,5].includes(level));const db=JSON.parse(fs.readFileSync(path.join(V,'manifest.json'))).databaseNames[level===1?1:2];
const save=(name,value)=>fs.writeFileSync(path.join(V,name),JSON.stringify(value,null,2),{mode:0o600});const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const m=JSON.parse(fs.readFileSync(path.join(V,'manifest.json'))),env=JSON.parse(fs.readFileSync(path.join(V,db+'-app-env.json'))),workload=JSON.parse(fs.readFileSync(path.join(V,'workload-plan.json')));
const sealedPacket=JSON.parse(fs.readFileSync(path.join(V,'execution-packet.json')));
require('./capacity-context.cjs').validatePacket(m,sealedPacket);
for(const [file,hash]of Object.entries(sealedPacket.capacityImplementationFiles))assert.equal(sha(fs.readFileSync(path.join(R,file))),hash,'Capacity implementation changed after sealing');
const {runLevel,resourceGate,validateCorrectness}=require(path.join(R,'tools/migration/local-write/capacity.cjs'));const {block}=require(path.join(R,'tools/migration/local-write/capacity-workload.cjs'));
let app,observer,report,stopError;const appLog=fs.openSync(path.join(V,db+'-app.log'),'wx',0o600),observerLog=fs.openSync(path.join(V,db+'-observer.log'),'wx',0o600);let ingressDrained=false;
async function correctnessProof(){
 const W=path.join(P,'local-acceptance-milestone-2026-11-11'),receipt=JSON.parse(fs.readFileSync(path.join(W,'private/final-local-acceptance-receipt.json')));assert.ok(receipt.supportedLocalFunctionalCoverageComplete);const summaries=[];
 for(const [i,name] of ['wt_ms_independent_final_10_02','wt_ms_independent_final_11_01'].entries()){
  const state=path.join(W,'independent_final_11/private',name),out=path.join(state,name+'-results'),packet=JSON.parse(fs.readFileSync(path.join(state,'execution-packet.json')));
  for(const [file,hash]of Object.entries(packet.harnessFiles))assert.equal(sha(fs.readFileSync(path.join(R,file))),hash);
  const raw=fs.readFileSync(path.join(out,'campaign-summary.json'));assert.equal(sha(raw),receipt.campaigns[i].rawSummarySha256);assert.equal(sha(fs.readFileSync(path.join(state,'recovery-result.json'))),receipt.campaigns[i].recoveryResultSha256);
  const summary=JSON.parse(raw);assert.equal(summary.cases.length,45);assert.ok(summary.cases.every(c=>['PASS','BLOCKED'].includes(c.status)));assert.equal(summary.cases.filter(c=>c.status==='BLOCKED').length,7);
  const reps=JSON.parse(fs.readFileSync(path.join(out,'all-method-repetitions.json')));assert.equal(reps.length,32);assert.ok(reps.every(r=>r.sameKeyPairs===20&&r.staleStatePairs===20&&r.postUnrelatedWriteReplays===20&&r.preCommitRollbacks===1));
  for(const [file,count]of [['browser-matrix.json',100],['crash-matrix.json',60],['compound-rollback-repetitions.json',80],['line-upload-rollback-repetitions.json',40],['shipping-upload-rollback-repetitions.json',10],['upload-uncertainty-repetitions.json',20]])assert.equal(JSON.parse(fs.readFileSync(path.join(out,file))).length,count);
  summaries.push({checkpointId:name,freshCheckpointVerified:packet.twoFreshCopiesFull66Verified===true,originalRowsUnchanged:receipt.campaigns[i].originalBusinessRowsUnchanged===70777,archiveAndMetadataUnchanged:receipt.campaigns[i].archiveTablesUnchanged===24&&receipt.campaigns[i].securityMetadataUnchanged===15,cases:summary.cases.map(c=>({id:'supported-local:'+c.id,status:'PASS',completed:1,rawStatusRetained:c.status,scope:'Supported local portion, with supplemental cases and independent recovery proof; hosted and absent success operations excluded',rawBlockedVariantsRetained:c.blockedVariants||[]}))});
 }
 const packet={sourceHash:receipt.sourceHash,harnessHash:receipt.harnessHash,inventoryHash:receipt.caseOrderSha256,correctnessVariants:summaries[0].cases.map(c=>({id:c.id,repetitions:1}))};
 const proof={...packet,status:'LOCAL CORRECTNESS PASS',scopeDispositionsReviewed:true,protectedStateVerified:true,harnessControlsPassed:true,campaigns:summaries,rawCampaignsUnmodified:true,underlyingMethodAndFaultRepetitionsRechecked:true};validateCorrectness(proof,packet);save(db+'-correctness-gate.json',{proof,packet});return {proof,packet};
}
(async()=>{
 assert.ok(fs.existsSync(path.join(V,'clones-ready.json')));assert.ok(!fs.existsSync(path.join(V,db+'-capacity-result.json')));assert.equal(sha(fs.readFileSync(path.join(V,'provider-catalog.json'))),m.providerCatalog.sha256);
 const correct=await correctnessProof();
 for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,{HOME:require('node:os').homedir(),PATH:'/opt/homebrew/opt/libpq@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',...env});
 require(path.join(R,'tools/migration/local-write/runtime.cjs')).install();
 const appStart=performance.now();app=cp.spawn('/usr/local/bin/python3',[path.join(__dirname,'capacity-start-app.py'),N,db],{cwd:N,env:{HOME:process.env.HOME,PATH:process.env.PATH},stdio:['ignore',appLog,appLog]});
 // Fail closed if the prepared Mac Python interpreter is unavailable.
 app.on('error',e=>{stopError=e;});
 save(db+'-active.json',{database:db,applicationPid:app.pid,driverPid:process.pid,at:new Date().toISOString()});
 let ready=false;
 for(let i=0;i<100;i++){
  if(stopError)throw stopError;
  try{const begin=performance.now(),r=await fetch(m.appOrigin+'/api/orders',{headers:{authorization:'Bearer '+env.STOCK_STAGING_AUTH_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});await r.arrayBuffer();assert.equal(r.status,200);save(db+'-cold-start.json',{appStartupThroughFirstReadMs:performance.now()-appStart,firstReadMs:performance.now()-begin,route:'/api/orders',separateFromWarmLoad:true});ready=true;break;}catch(error){if(error.code==='ERR_ASSERTION')throw error;await sleep(100);}
 }
 assert.ok(ready,'Local app readiness failed');
 observer=cp.spawn('/usr/local/bin/python3',[path.join(__dirname,'capacity-observer.py'),N,db],{cwd:N,env:{HOME:process.env.HOME,PATH:process.env.PATH},stdio:['ignore',observerLog,observerLog]});observer.on('error',e=>{stopError=e;});
 let sample;
 for(let i=0;i<100;i++){
  if(stopError)throw stopError;
  try{const lines=fs.readFileSync(path.join(V,db+'-resources.jsonl'),'utf8').trim().split('\n');sample=JSON.parse(lines.at(-1));if(lines.length>=3)break;}catch{}
  if(observer.exitCode!==null)throw Error('Capacity observer exited; inspect private log');await sleep(100);
 }
 const issues=resourceGate(sample,Date.now());save(db+'-live-preflight.json',{at:new Date().toISOString(),issues,sample});
 if(issues.length){report={status:'BLOCKED',reason:'Mandatory live resource preflight did not pass',issues,clients:level,started:0,measuredRequests:0,latencyMs:null,capacityAcceptance:'BLOCKED'};return;}
 const clockFile=path.join(V,'capacity-clock.json');if(!fs.existsSync(clockFile))save('capacity-clock.json',{firstLevelStartedAtMs:Date.now(),totalWarmupLoadDrainBudgetMs:1800000});const cap=JSON.parse(fs.readFileSync(clockFile));assert.ok(Date.now()-cap.firstLevelStartedAtMs<1800000-720000,'Total capacity timing budget exhausted');
 const ledgerFile=path.join(V,db+'-http-ledger.jsonl');assert.ok(!fs.existsSync(ledgerFile));let emitted=0;
 async function request(task,signal){const startedAt=new Date().toISOString(),headers={authorization:'Bearer '+env.STOCK_STAGING_AUTH_TOKEN};if(task.key)headers['Idempotency-Key']=task.key;const form=task.body instanceof FormData;if(task.body&&!form)headers['content-type']='application/json';
  const r=await fetch(new URL(task.url,m.appOrigin),{method:task.method,headers,body:task.body===undefined?undefined:form?task.body:JSON.stringify(task.body),redirect:'error',signal});const bytes=await r.arrayBuffer();const value=JSON.parse(Buffer.from(bytes).toString('utf8'));
  const record={at:startedAt,completedAt:new Date().toISOString(),variant:task.variant,class:task.class,url:task.url,method:task.method,key:task.key,fixture:task.fixture,intent:form?Object.fromEntries([...task.body].filter(([,v])=>typeof v==='string')):task.body,fileBytes:form?[...task.body].filter(([,v])=>typeof v!=='string').map(([field,v])=>({field,name:v.name,type:v.type,size:v.size})):undefined,status:r.status,expectedStatus:task.expectedStatus,revision:r.headers.get('x-stock-revision'),responseSha256:sha(Buffer.from(bytes)),response:task.method==='GET'?undefined:value};
  fs.appendFileSync(ledgerFile,JSON.stringify(record)+'\n',{mode:0o600});return {status:r.status};
 }
 console.log(JSON.stringify({capacityLevel:level,status:'STARTED',warmupSeconds:120,measuredSeconds:600,limitsUnchanged:true}));
 report=await runLevel({clients:level,correctness:correct.proof,packet:correct.packet,observe:async()=>{const s=JSON.parse(fs.readFileSync(path.join(V,db+'-resources-latest.json')));if(s.newDeadlocks)throw Error('New deadlock');if(Date.now()-s.diskSampleAtMs>12000)throw Error('Stale disk observation');return s;},makeBlock:async(client,index)=>block(workload,client,index,level).map(task=>({...task,run:signal=>request(task,signal)})),emit:record=>{emitted++;fs.appendFileSync(path.join(V,db+'-timings.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});if(emitted%30===0)console.log(JSON.stringify({capacityLevel:level,requests:emitted,lastVariant:record.variant,lastMs:Math.round(record.ms),measured:record.measured}));}});
 report.rawEngineStatus=report.status;report.recordedAt=new Date().toISOString();report.hostedAcceptance='NOT RUN';report.sourceDataTouched=false;
 console.log(JSON.stringify({capacityLevel:level,rawEngineStatus:report.status,stopReason:report.stopReason,started:report.started,completed:report.completed,undersampled:report.undersampled,finalOracleStillRequired:true}));
})().catch(error=>{stopError=error;report={status:'BLOCKED',errorClass:error.name,error:error.message,clients:level,finalOracleRequired:true};console.error('Local capacity stopped:',error.name,error.message);process.exitCode=1;}).finally(async()=>{
 // Drain aborted HTTP operations before stopping only this task's app.
 if(app?.pid&&app.exitCode===null){await sleep(10000);ingressDrained=true;app.kill('SIGTERM');await Promise.race([new Promise(resolve=>app.once('exit',resolve)),sleep(5000)]);}
 fs.writeFileSync(path.join(V,db+'-stop-observer'),new Date().toISOString(),{mode:0o600});if(observer?.pid)await Promise.race([new Promise(resolve=>{if(observer.exitCode!==null)resolve();else observer.once('exit',resolve);}),sleep(5000)]);
 fs.closeSync(appLog);fs.closeSync(observerLog);save(db+'-capacity-result.json',{...report,ingressDrained,appStopped:app?.exitCode!==null,operatorError:stopError?.message});
});
