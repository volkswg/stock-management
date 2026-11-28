/* eslint-disable @typescript-eslint/no-require-imports -- Real current SQL on a fresh, synthetic localhost clone only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),{createRequire}=require('node:module');
const {Client}=require('pg');
const {transaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {beforeScopedReads}=require('../../tests/helpers/scoped-reads-history.cjs');
const {createSalesReader}=require('../../src/modules/sales/infrastructure/postgres/sales-reader.ts');
const {createSalesReports}=require('../../src/modules/sales/application/reports.ts');
const {PostgresOrderListReader}=require('../../src/modules/orders/infrastructure/postgres/order-list-reader.ts');
const {createMovementStore}=require('../../src/modules/inventory/infrastructure/postgres/movements.ts');
const movements=require('../../src/modules/inventory/application/movements.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/postgres/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/postgres/movement-journeys.ts');
const {findResumableMovementJourney}=require('../../src/modules/inventory/application/movement-journeys.ts');
const {MOVEMENT_FLOW}=require('../../src/modules/line-workflows/contracts.ts');
const route=require('../../src/app/api/orders/route.ts');
const endpoint=new URL(process.env.STOCK_DATABASE_URL);assert.equal(endpoint.hostname,'127.0.0.1');endpoint.username='postgres';endpoint.password='';
const owner=new Client({connectionString:endpoint.toString()}),storage=createBusinessDatabase();
global.fetch=()=>{throw Error('Providers forbidden in scoped query acceptance');};
const plain=x=>JSON.parse(JSON.stringify(x));
function previous(file){const exports={};vm.runInNewContext(ts.transpileModule(beforeScopedReads(file).toString(),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:createRequire(path.resolve(file)),Date,Intl,console});return exports;}
const oldReports=previous('src/modules/sales/application/reports.ts').createSalesReports(previous('src/modules/sales/infrastructure/postgres/sales-reader.ts').createSalesReader);
const reports=createSalesReports(createSalesReader);
let observed;
const originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.then?result.then(value=>{if(observed&&/^\s*(SELECT|WITH)\b/i.test(args[0]))observed.push({rows:value.rows.length,bytes:Buffer.byteLength(JSON.stringify(value.rows))});return value;}):result;};
async function measure(fn){observed=[];try{const value=await transaction(false,fn,{consistentRead:true});return {value,rows:observed.reduce((n,r)=>n+r.rows,0),bytes:observed.reduce((n,r)=>n+r.bytes,0)};}finally{observed=undefined;}}
function reduction(label,before,after){assert.ok(after.bytes<before.bytes*.35,`${label}: ${after.bytes}/${before.bytes}`);console.log(JSON.stringify({scope:label,beforeRows:before.rows,afterRows:after.rows,beforeResultJsonBytes:before.bytes,afterResultJsonBytes:after.bytes,measurement:'serialized database result rows, not billed network bytes'}));}
const command=fn=>executeCommand('scoped-read-synthetic',crypto.randomUUID(),hashIntent('synthetic'),fn);
test.before(async()=>{
 await owner.connect();
 await owner.query(`DO $$DECLARE names text;BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO names FROM pg_tables WHERE schemaname='stock_operational' AND tablename NOT IN ('environment','revision');EXECUTE 'TRUNCATE TABLE '||names||' RESTART IDENTITY CASCADE';END$$`);
 await owner.query(`INSERT INTO stock_operational.orders(id,status,seller,"createdBy","createdAt") SELECT 'ORDER-'||lpad(n::text,4,'0'),CASE WHEN n%3=0 THEN 'draft' ELSE 'complete' END,CASE WHEN n%7=0 THEN E'\\tSeller %_ ไทย\\t' WHEN n=1 THEN 'İ ΟΣ' ELSE 'Other seller' END,'web',CASE WHEN n%20=0 THEN NULL ELSE '2026-11-01T00:00:00Z'::timestamptz+(n%10)*interval '1 second' END FROM generate_series(1,400)n;
 INSERT INTO stock_operational.order_items("orderId","productCode","createdAt") SELECT id,'SYNTHETIC','2026-11-01' FROM stock_operational.orders;
 INSERT INTO stock_operational.shipments(id,status,"createdAt") VALUES('SHIP','draft','2026-11-01');
 INSERT INTO stock_operational.shipment_orders(id,"orderId","shipmentId","createdAt") SELECT 'LINK-'||id,id,'SHIP','2026-11-01' FROM stock_operational.orders WHERE right(id,1) IN ('0','2','4','6','8');
 INSERT INTO stock_operational.movements(id,"userId",status,"packingDate","createdAt","updatedAt") SELECT 'MOVE-'||n,CASE WHEN n=1 THEN 'TARGET' ELSE 'OTHER' END,'in_progress',CASE WHEN n=1 THEN '2026-11-01' ELSE '2025-10-01' END,'2026-11-01','2026-11-01' FROM generate_series(1,300)n;
 INSERT INTO stock_operational.movement_details(id,"movementMasterId",quantity,remark,"createdAt") SELECT 'DETAIL-'||n,'MOVE-'||((n-1)/10+1),1,'Synthetic note','2026-11-01' FROM generate_series(1,3000)n;
 INSERT INTO stock_operational.user_state("userId",flowname,"referenceId",state,"createdAt",context) SELECT CASE WHEN n=1 THEN 'TARGET' ELSE 'OTHER-'||n END,'MovementCreate','MOVE-'||((n-1)%300+1),'shop','2026-11-01','{}' FROM generate_series(1,2000)n;`);
 // Match the actual flow constant; fake providers are never invoked.
 await owner.query('UPDATE stock_operational.user_state SET flowname=$1',[MOVEMENT_FLOW]);
 await owner.query(`INSERT INTO stock_operational.sales_receipts(id,"salesDate","accountId","receiptType","receiptDate","createdAt",payments)
 SELECT 'RECEIPT-'||n,CASE WHEN n<=10 THEN E'\\t2026-11-01\\t' WHEN n<=20 THEN '2026-11-02' ELSE '2025-10-01' END,CASE WHEN n<=20 THEN E'\\tA\\t' ELSE 'B' END,CASE WHEN n%3=0 THEN 'REFUND' ELSE 'SALE' END,'2026-11-01T02:00:00Z','2026-11-01',
 jsonb_build_array(jsonb_build_object('id','PAY-'||n,'paymentTypeId','cash','paymentName','Cash','paymentType','CASH','moneyAmount','10.2500','syncedAt','2026-11-01','createdAt','2026-11-01T00:00:00.000Z'))
 FROM generate_series(1,2000)n;
 INSERT INTO stock_operational.sales_receipt_items(id,"receiptId","itemName",quantity,"grossTotalMoney","totalMoney","costTotal",taxes)
 SELECT 'SALE-ITEM-'||n,'RECEIPT-'||n,'Synthetic item',2,20.5000,20.5000,5.1250,1.2500 FROM generate_series(1,2000)n;
 INSERT INTO stock_operational.sales_receipt_syncs(id,"salesDate","accountId","shopName",status) VALUES('SYNC-1','2026-11-01','A','Synthetic shop','complete'),('SYNC-2','2026-11-02','A','Synthetic shop','complete'),('SYNC-3','2025-10-01','B','Other shop','complete');`);
 // Preserve split payments and filtering of cancelled/deleted records.
 await owner.query(`UPDATE stock_operational.sales_receipts SET payments=payments||jsonb_build_array(jsonb_build_object('id','SPLIT','paymentTypeId','card','paymentName','Card','paymentType','CARD','moneyAmount','2.5000','syncedAt','2026-11-01','createdAt','2026-11-01T00:00:00.000Z')) WHERE id='RECEIPT-1';UPDATE stock_operational.sales_receipts SET "cancelledAt"='2026-11-01' WHERE id='RECEIPT-2';UPDATE stock_operational.sales_receipt_items SET "deletedAt"=now() WHERE id='SALE-ITEM-3';`);
});
test.after(async()=>{await closePool();await owner.end();});
test('daily, dashboard and yearly sales equal the previous complete reports while returning only relevant rows',async()=>{
 const inputs=[['getDailySales',{accountId:'A',salesDate:'2026-11-01'}],['getDailySales',{accountId:'missing',salesDate:'2026-11-01'}],['getSalesDashboard',{accountIds:['A'],fromDate:'2026-11-01',toDate:'2026-11-02'}],['getSalesDashboard',{accountIds:[],fromDate:'2026-11-01',toDate:'2026-11-02'}],['getProfitSummary',{year:'2026',accounts:[{id:'A',shopName:'Synthetic shop'}],expenses:[],costOverrides:[]}]];
 for(const [name,input]of inputs){const before=await measure(()=>oldReports[name]({...input,storage})),after=await measure(()=>reports[name]({...input,storage}));assert.deepEqual(plain(after.value),plain(before.value));reduction(name,before,after);}
});
test('Orders pages preserve the previous order, filters, total, tie/null dates and clamp without fetching unrelated children',async()=>{
 const reader=new PostgresOrderListReader(storage);
 const baseline=await measure(async()=>(await reader.readOrderList()).reverse());
 for(const status of ['all','in-progress','completed'])for(const shipmentLink of ['all','linked','not-linked'])for(const query of ['','%_','ไทย','missing','i\u0307','ος']){
  const expected=baseline.value.filter(o=>(!query||[o.id,o.createdBy,o.seller].some(s=>s.toLowerCase().includes(query.toLowerCase())))&&(status==='all'||(status==='completed'?o.status==='complete':['draft','waiting_for_bill_image','waiting_for_product_image','waiting_for_total_price'].includes(o.status)))&&(shipmentLink==='all'||(shipmentLink==='linked'?!!o.shipmentId:!o.shipmentId)));
  const actual=await measure(()=>reader.readPage({page:999,pageSize:20,query,status,shipmentLink}));
  const page=Math.max(1,Math.ceil(expected.length/20));assert.equal(actual.value.page,page);assert.equal(actual.value.total,expected.length);assert.deepEqual(plain(actual.value.orders),plain(expected.slice((page-1)*20,page*20)));
 }
 const after=await measure(()=>reader.readPage({page:1,pageSize:20,query:'',status:'all',shipmentLink:'all'}));reduction('orders-page',baseline,after);
});
test('real paged HTTP reads return page-only row revisions, preserve unpaged responses and reject missing keys',async()=>{
 const headers={Authorization:`Bearer ${process.env.STOCK_STAGING_AUTH_TOKEN}`,'x-stock-edit-protocol':'row-v1'};
 const get=url=>route.GET(new Request('https://example.invalid/api/orders'+url,{headers}));
 const response=await get('?page=2&pageSize=10');assert.equal(response.status,200,await response.clone().text());const body=await response.json();assert.equal(body.orders.length,10);assert.equal(body.total,400);assert.equal(body.page,2);assert.equal(body.stockEditRows.filter(r=>/^\/api\/orders\/[^/]+$/.test(r.scope)).length,10);
 assert.equal(response.headers.get('x-stock-edit-revision'),null);assert.ok(response.headers.get('x-stock-revision'));
 const full=await get('');const legacy=await full.json();assert.equal(legacy.orders.length,400);assert.equal(legacy.page,undefined);
 assert.equal((await route.POST(new Request('https://example.invalid/api/orders',{method:'POST',headers,body:'{}'}))).status,428);
});
test('targeted movement and LINE reads equal previous projections with much smaller results',async()=>{
 const oldStore=previous('src/modules/inventory/infrastructure/postgres/movements.ts').createMovementStore(storage);
 const oldUseCases=previous('src/modules/inventory/application/movements.ts');
 const filter={date:'2026-11-01'};
const listBefore=await measure(()=>oldUseCases.listMovements({store:oldStore,filter}));
const listAfter=await measure(()=>movements.listMovements({store:createMovementStore(storage),filter}));assert.deepEqual(plain(listAfter.value),plain(listBefore.value));assert.equal(listAfter.value.length,1);reduction('movement-date-list',listBefore,listAfter);
const before=await measure(()=>oldUseCases.getMovementItems({store:oldStore,movementMasterId:'move-1'}));
 const after=await measure(()=>movements.getMovementItems({store:createMovementStore(storage),movementMasterId:'move-1'}));assert.deepEqual(plain(after.value),plain(before.value));assert.equal(after.value.length,10);reduction('movement-items',before,after);
 const oldJourney=previous('src/modules/inventory/infrastructure/postgres/movement-journeys.ts').createMovementJourneyAdapter(storage);
 const oldSessions=previous('src/modules/line-workflows/infrastructure/postgres/sessions.ts').createSessionAdapter(storage,oldJourney);
 const sessions=createSessionAdapter(storage,createMovementJourneyAdapter(storage));
 const photoBefore=await measure(async()=>{const c=await oldSessions.photoContext();return {entry:c.sessions.latestForReading('TARGET'),items:c.items(()=> 'MOVE-1')};});
 const photoAfter=await measure(async()=>{const c=await sessions.photoContext('TARGET');return {entry:c.sessions.latestForReading('TARGET'),items:c.items(()=> 'MOVE-1')};});assert.deepEqual(plain(photoAfter.value),plain(photoBefore.value));reduction('line-photo-context',photoBefore,photoAfter);
 const resumed=await transaction(false,()=>findResumableMovementJourney(createMovementJourneyAdapter(storage).store,'TARGET'));assert.equal(resumed.masterId,'MOVE-1');assert.equal(resumed.items.length,10);
});
test('scoped movement writes still track revisions and preserve unrelated records',async()=>{
 const before=(await owner.query(`SELECT revision::text,remark FROM stock_operational.movement_details WHERE id='DETAIL-11'`)).rows;
 await command(async()=>{const rows=await movements.updateMovementItem({store:createMovementStore(storage),movementId:'DETAIL-1',movementMasterId:'MOVE-1',quantity:'5',runtime:{now:()=> '2026-11-02T00:00:00.000Z'}});assert.equal(rows.length,10);assert.equal(rows.find(r=>r.movementId==='DETAIL-1').quantity,'5');});
 assert.deepEqual((await owner.query(`SELECT revision::text,remark FROM stock_operational.movement_details WHERE id='DETAIL-11'`)).rows,before);
 await command(async()=>{const first=(await storage.movementDetails.select('t.id=$1',['DETAIL-1']))[0],stale=(await storage.movementDetails.select('t.id=$1',['DETAIL-1']))[0];await storage.movementDetails.update(first,{remark:'saved'});await assert.rejects(storage.movementDetails.update(stale,{remark:'stale'}),e=>e.status===409);});
});
