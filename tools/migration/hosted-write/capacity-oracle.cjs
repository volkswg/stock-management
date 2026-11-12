/* eslint-disable @typescript-eslint/no-require-imports -- Mechanical transport port; the complete reviewed post-load oracle below is unchanged. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {assertExecution,requireGate,sha}=require('./policy.cjs');
const plan=require('../hosted-acceptance-plan.json');
requireGate(plan.authorization.executionEnabled===true,'EXECUTION_DISABLED');
requireGate(process.argv.length===3,'ORACLE_PRIVATE_PACKET');
const packet=JSON.parse(fs.readFileSync(process.argv[2]));
assertExecution(packet.plan,packet.binding,packet.approval,packet.env);
const R=path.resolve(__dirname,'../../..'),V=path.resolve(packet.evidenceDirectory),db=packet.levelLabel;
requireGate(/^WT_[A-Za-z0-9_]+$/.test(db),'ORACLE_LEVEL_LABEL');
process.chdir(R);
require(path.join(R,'tests/helpers/postgres-runtime.cjs'));
const {Client}=require(path.join(R,'node_modules/pg'));const {memoryService}=require(path.join(R,'tools/migration/local-write/oracle.cjs'));const catalog=require(path.join(R,'tools/migration/worksheets.json'));
const orders=require(path.join(R,'src/modules/orders/server.ts')),shipments=require(path.join(R,'src/modules/shipments/server.ts')),expenses=require(path.join(R,'src/modules/expenses/server.ts')),inventory=require(path.join(R,'src/modules/inventory/server.ts')),sales=require(path.join(R,'src/modules/sales/server.ts'));const {receipts}=require(path.join(R,'tools/migration/local-write/capacity-workload.cjs'));const {classifyUploads}=require(path.join(R,'tools/migration/local-write/provider-outcomes.cjs'));
const m={databaseNames:['WT_FROZEN_BASELINE',db],targetIsolationId:packet.binding.isolationId},env=packet.env;
const baselineBytes=fs.readFileSync(path.join(V,'baseline-business-rows.json'));
requireGate(sha(baselineBytes)===packet.binding.baselineRowsSha256,'ORACLE_BASELINE_SEAL');
const baseline=JSON.parse(baselineBytes);
let source,target;const save=(name,o)=>fs.writeFileSync(path.join(V,name),JSON.stringify(o,null,2),{mode:0o600});
async function connect(name){
 if(name===m.databaseNames[0])return require('./baseline-client.cjs').baselineClient(baseline,packet.binding.baselineRevision);
 requireGate(name===db,'ORACLE_TARGET_LABEL');const config=packet.observerConfig,u=new URL(config.connectionString),runtime=new URL(env.STOCK_DATABASE_URL);
 requireGate(u.hostname===runtime.hostname&&u.port===runtime.port&&u.pathname===runtime.pathname&&!u.search&&!u.hash&&u.username.startsWith('stock_ha_observer')&&config.ssl?.rejectUnauthorized===true,'ORACLE_OBSERVER_BINDING');
 requireGate(packet.binding.connectionMode==='session'?decodeURIComponent(u.username).endsWith('.'+packet.binding.projectRef):!decodeURIComponent(u.username).includes('.'),'ORACLE_POOLER_PROJECT');
 const c=new Client({connectionString:u.toString(),ssl:{rejectUnauthorized:true,ca:config.ssl.ca},connectionTimeoutMillis:5000});await c.connect();const role=(await c.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];requireGate(role&&[role.rolsuper,role.rolbypassrls,role.rolcreatedb,role.rolcreaterole].every(v=>v===false),'ORACLE_OBSERVER_PRIVILEGES');await c.query('SET default_transaction_read_only=on');
 const i=(await c.query('SELECT isolation_id::text AS target FROM stock_operational.environment WHERE singleton')).rows[0];requireGate(i.target===m.targetIsolationId,'ORACLE_TARGET_IDENTITY');return c;
}
async function table(c,name){return (await c.query('SELECT row_order::text n,business_cells,revision::text revision,archived_at FROM stock_operational.'+name+' ORDER BY row_order')).rows;}
function object(table,row){return Object.fromEntries(catalog[table].headers.map((name,i)=>[name,row.business_cells[i]]));}
async function at(instant,run){assert.ok(Number.isFinite(Date.parse(instant)));const RealDate=global.Date;global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return RealDate.parse(instant);}};try{return await run();}finally{global.Date=RealDate;}}
function boundedTime(time,record){assert.ok(Date.parse(time)>=Date.parse(record.at)&&Date.parse(time)<=Date.parse(record.completedAt),'Nondeterministic timestamp outside its HTTP operation');return time;}
(async()=>{
 const result=JSON.parse(fs.readFileSync(path.join(V,db+'-capacity-result.json')));assert.ok(result.ingressStopped&&result.ingressDrained,'Close durable admission and drain every backend before the final oracle');source=await connect(m.databaseNames[0]);target=await connect(db);
 const before={},after={},seed={},revisions={},archive={};
 for(const name of Object.keys(catalog)){
  before[name]=await table(source,name);after[name]=await table(target,name);const max=Math.max(0,...before[name].map(r=>Number(r.n)));seed[name]=Array.from({length:max},()=>[]);revisions[name]=new Map();archive[name]=new Map();
  for(const row of before[name]){seed[name][Number(row.n)-1]=row.archived_at?[]:row.business_cells;revisions[name].set(Number(row.n),Number(row.revision));archive[name].set(Number(row.n),row.archived_at);}
 }
 const imported=JSON.parse(fs.readFileSync(path.join(V,'original-row-hashes.json')));let importedRows=0;
 for(const [name,hashes] of Object.entries(imported)){
  const actual=Object.fromEntries((await target.query("SELECT row_order::text n,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h FROM stock_operational."+name+' t ORDER BY row_order')).rows.map(r=>[r.n,r.h]));
  for(const [n,h]of Object.entries(hashes)){assert.equal(actual[n],h,'Original imported row changed: '+name);importedRows++;}
 }
 const oracle=memoryService(seed),client=oracle.service.client;let sqlStatements=0;
 const append=client.appendValues,update=client.updateValues;
 client.appendValues=async(name,range,values)=>{const start=oracle.rows[name].length;await append(name,range,values);for(let i=0;i<values.length;i++){revisions[name].set(start+i,1);archive[name].set(start+i,null);sqlStatements++;}};
 client.updateValues=async(name,range,values)=>{const match=/^[A-Z]+(\d+)/.exec(range);assert.ok(match,'Expected explicit row updates');const start=Number(match[1])-1;await update(name,range,values);for(let i=0;i<values.length;i++)if(start+i>0){revisions[name].set(start+i,(revisions[name].get(start+i)||0)+1);sqlStatements++;}};
 const records=fs.existsSync(path.join(V,db+'-http-ledger.jsonl'))?fs.readFileSync(path.join(V,db+'-http-ledger.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 assert.ok(records.every(r=>r.status===r.expectedStatus),'Unexpected normal response retained');const writes=records.filter(r=>r.method!=='GET').sort((a,b)=>Number(a.revision.match(/stock-v2-(\d+)/)[1])-Number(b.revision.match(/stock-v2-(\d+)/)[1]));assert.equal(new Set(writes.map(r=>r.key)).size,writes.length);
 const baselineRevision=BigInt((await source.query('SELECT value::text v FROM stock_operational.revision WHERE singleton')).rows[0].v);let priorStatements=0;const acknowledged=new Set();
 for(const record of writes){const type=record.variant.split(':')[1],input=record.intent,response=record.response;
  if(type==='create-order'||type==='create-multipart-order'){
   const o=response.order;boundedTime(o.createdAt,record);await at(o.createdAt,()=>orders.createOrder({googleSheetsService:oracle.service,id:o.id,seller:input.seller,totalPrice:Number(input.totalPrice),remark:input.remark,createdBy:'web'}));
   if(type==='create-multipart-order')for(const [name,fn]of [['order_bills',orders.createOrderBill],['order_items',orders.createOrderItem]]){
    const found=after[name].filter(r=>object(name,r).orderId===o.id);assert.equal(found.length,1);const attachment=object(name,found[0]);boundedTime(attachment.createdAt,record);await at(attachment.createdAt,()=>fn({googleSheetsService:oracle.service,orderId:o.id,imageUrl:attachment.imageUrl,createdBy:'web'}));
   }
  }else if(type==='create-expense'){
   const row=after.expenses.find(r=>object('expenses',r).id===response.id);assert.ok(row);const value=object('expenses',row);boundedTime(value.createdAt,record);await at(value.createdAt,async()=>assert.equal(await expenses.saveExpense(oracle.service,input),response.id));
  }else if(type==='save-stock-count'){
   const r=response.stockCounts.find(c=>c.accountId===input.accountId);assert.ok(r);boundedTime(r.updatedAt,record);await at(r.updatedAt,()=>inventory.saveMonthlyStockCount({googleSheetsService:oracle.service,account:{id:input.accountId,shopName:'WT Shop A'},month:input.month,note:input.note,physicalCount:input.physicalCount,updatedBy:'web'}));
  }else if(type==='save-cost-override'){
   const o=response.costOverride;boundedTime(o.updatedAt,record);await at(o.updatedAt,()=>sales.setSalesProfitCostOverride({...input,googleSheetsService:oracle.service,createdBy:'web'}));
  }else if(type==='advance-shipping-bill'){
   const s=response.shipment;boundedTime(s.updatedAt,record);const id=record.url.split('/').at(-1);const expected=await at(s.updatedAt,()=>shipments.updateShipmentStatus({googleSheetsService:oracle.service,shipmentId:id,status:'shipping',poNumber:input.poNumber,shippingBillUrl:s.shippingBillUrl}));assert.deepEqual(expected.shipment,s);
  }else if(type==='sync-sales'){
   boundedTime(response.syncedAt,record);const fake=receipts(record.fixture);const expected=await at(response.syncedAt,()=>sales.syncLoyverseDailySales({googleSheetsService:oracle.service,account:{id:input.account,shopName:'WT Shop A',storeId:'WT_STORE_A',service:{getReceipts:async()=>fake}},salesDate:input.date}));assert.equal(expected.receiptCount,2);assert.equal(expected.itemCount,2);assert.equal(expected.paymentCount,2);assert.equal(response.outcome,'synced');
  }else assert.fail('Unreviewed load operation');
  const revision=BigInt(record.revision.match(/stock-v2-(\d+)/)[1]);assert.equal(revision,baselineRevision+BigInt(sqlStatements),'Statement revision differs from independent offline projection');assert.ok(sqlStatements>priorStatements);priorStatements=sqlStatements;acknowledged.add(record.key);
 }
 let exactRows=0;
 for(const name of Object.keys(catalog)){
  const expected=oracle.rows[name].slice(1);assert.equal(after[name].length,expected.length,'Unexpected row count: '+name);
  for(const row of after[name]){const n=Number(row.n);assert.deepEqual(row.business_cells,expected[n-1],'Offline business cells differ: '+name+' row '+n);assert.equal(Number(row.revision),revisions[name].get(n),'Row revision differs: '+name);assert.deepEqual(row.archived_at,archive[name].get(n),'Unexpected archive change: '+name);exactRows++;}
 }
 assert.equal(BigInt((await target.query('SELECT value::text v FROM stock_operational.revision WHERE singleton')).rows[0].v),baselineRevision+BigInt(sqlStatements));
 const commands=(await target.query('SELECT kind,key,intent,response,state FROM stock_operational.commands WHERE key LIKE $1',[JSON.parse(fs.readFileSync(path.join(V,'workload-plan.json'))).prefix+'_L%'])).rows;assert.equal(commands.length,acknowledged.size);
 const {hashIntent}=require(path.join(R,'src/infrastructure/persistence/postgres/commands.ts'));
 const {sizedPng}=require(path.join(R,'tools/migration/local-write/binary-fixtures.cjs'));const {pdf,BYTES}=require(path.join(R,'tools/migration/local-write/capacity-workload.cjs'));
 const digest=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
 for(const c of commands){assert.ok(acknowledged.has(c.key));assert.equal(c.state,'complete');const r=writes.find(r=>r.key===c.key);assert.equal(c.kind,r.method+':'+r.url);const stored=c.response.value;assert.equal(stored.status,r.status);assert.deepEqual(JSON.parse(Buffer.from(stored.body,'base64').toString()),r.response);
  let input=r.intent;if(r.fileBytes){input=Object.entries(input);for(const file of r.fileBytes){assert.equal(file.size,BYTES);input.push([file.field,file.name,file.type,digest(file.type==='application/pdf'?pdf():sizedPng(BYTES))]);}}
  assert.equal(c.intent,hashIntent({query:'',body:hashIntent(input)}),'Stored request intent differs from the sealed workload');
 }
 const allEvents=fs.readFileSync(path.join(V,'provider-ledger.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),first=allEvents.findIndex(e=>e.kind==='harness-installed'&&e.database===db);assert.ok(first>=0);
 const next=allEvents.findIndex((e,i)=>i>first&&e.kind==='harness-installed'&&e.database!==db);const events=allEvents.slice(first,next<0?undefined:next),refs=[];
 for(const name of Object.keys(catalog))for(const row of after[name])for(const v of row.business_cells)if(typeof v==='string'&&v.includes('/__wt/images/WT_FILE_'))refs.push(v.split('/').at(-1));
 const graph=classifyUploads(events,refs);assert.ok(graph.pass,'Unexplained fake provider file or outcome');const uploadOperations=writes.filter(r=>['create-multipart-order','advance-shipping-bill'].includes(r.variant.split(':')[1]));assert.equal(events.filter(e=>e.kind==='fake-provider'&&e.provider==='drive'&&e.operation==='upload').length,uploadOperations.reduce((n,r)=>n+(r.variant.endsWith('create-multipart-order')?2:1),0));
 const effects=(await target.query('SELECT key,state FROM stock_operational.side_effects')).rows;assert.equal(effects.length,uploadOperations.length);
 for(const r of uploadOperations){const command=commands.find(c=>c.key===r.key),prefix='UPLOAD:'+hashIntent({kind:command.kind,key:command.key})+':'+command.intent+':';const claims=effects.filter(e=>e.key.startsWith(prefix));assert.equal(claims.length,1);assert.equal(claims[0].state,'done');}
 save(db+'-oracle-proof.json',{status:'PASS',at:new Date().toISOString(),readOnlyVerification:true,exactBusinessRowsCompared:exactRows,originalBusinessRowsUnchanged:importedRows,acknowledgedCommands:writes.length,expectedMutatingStatements:sqlStatements,commandBodiesAndStatusesExact:true,perRowAndGlobalRevisionsExact:true,fakeProviderGraph:graph,providerReplayPerformed:false,nondeterministicValues:'Generated IDs/file references and timestamps are witnessed separately; timestamps bounded to each HTTP operation; all deterministic business cells and deltas replayed through the offline Sheets-compatible implementation'});
 console.log(JSON.stringify({oracle:'PASS',database:db,exactBusinessRows:exactRows,originalRows:importedRows,commands:writes.length,statements:sqlStatements}));
})().catch(error=>{save(db+'-oracle-stop.json',{errorClass:error.name,message:error.message,stack:error.stack});console.error('Hosted post-load oracle stopped:',error.name);process.exitCode=1;}).finally(async()=>{await source?.end();await target?.end();});
