/* eslint-disable @typescript-eslint/no-require-imports -- Current owners with synthetic ports; no providers or database credentials. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {createMovementStore}=require('../../src/modules/inventory/infrastructure/postgres/movements.ts');
const {getMovementItems}=require('../../src/modules/inventory/application/movements.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/postgres/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/postgres/movement-journeys.ts');
const {createSalesReports}=require('../../src/modules/sales/application/reports.ts');
const {MOVEMENT_FLOW}=require('../../src/modules/line-workflows/contracts.ts');
const at='2026-11-01T00:00:00.000Z';
function scoped(rows,field){
 const calls=[];return {calls,prepare:async()=>{},all:async()=>{throw Error('Unscoped collection read');},select:async(sql,values,direction)=>{calls.push({sql,values,direction});return rows.filter(r=>Array.isArray(values[0])?values[0].includes(r[field]):String(r[field]).toUpperCase()===String(values[0]).toUpperCase());}};
}
test('movement item reads scope the parent, retain case matching and exclude unrelated details',async()=>{
 const details=scoped([{id:'D1',movementMasterId:'Move-1',quantity:'3'},{id:'D2',movementMasterId:'other',quantity:'9'}],'movementMasterId');
 const store=createMovementStore({movementDetails:details});
 assert.deepEqual((await getMovementItems({store,movementMasterId:'move-1'})).map(r=>r.movementId),['D1']);
 assert.deepEqual(details.calls[0].values,['MOVE-1']);
});
test('LINE movement synchronization and photo lookups never request unrelated master/item collections',async()=>{
 const masters=scoped([{id:'M1',userId:'U',status:'in_progress'}],'id'),details=scoped([{id:'D1',movementMasterId:'M1'},{id:'D2',movementMasterId:'M2'}],'movementMasterId');
 const adapter=createMovementJourneyAdapter({movementMasters:masters,movementDetails:details});
 const combined=await adapter.store.readCombined('M1');assert.equal(combined.findMaster(()=> 'M1').id,'M1');assert.equal(combined.items(()=> 'M1').length,1);
 assert.equal((await adapter.store.readItems('M1')).length,1);
 const photo=await adapter.itemSnapshot(['M1']);assert.equal(photo.items(()=> 'M1').length,1);
 assert.ok(details.calls.every(c=>!c.sql.includes('M1')));assert.equal(details.calls.length,3);
});
test('LINE sessions scope user/flow, keep latest valid order state and retain all matching rows for clearing',async()=>{
 const records=[{id:'3',userId:'U',flowname:'OrderCreate',state:'invalid',referenceId:'O',createdAt:at},{id:'2',userId:'U',flowname:'OrderCreate',state:'draft',referenceId:'O',createdAt:at},{id:'1',userId:'U',flowname:MOVEMENT_FLOW,state:'shop',referenceId:'M1',context:'{}'},{id:'0',userId:'other',flowname:MOVEMENT_FLOW,state:'shop',referenceId:'M2'}];
 const calls=[],erased=[];
 const userState={all:async()=>{throw Error('Unscoped sessions');},select:async(sql,values,direction)=>{calls.push({sql,values,direction});return records.filter(r=>r.userId===values[0]&&r.flowname===values[1]);},softDelete:async r=>erased.push(r.id)};
 let selected;
 const adapter=createSessionAdapter({userState},{itemSnapshot:async ids=>{selected=ids;return{items:()=>[]};}});
 assert.equal((await adapter.orders.findLatest('U','OrderCreate')).id,'2');
 const snapshot=await adapter.movements.read('U');await snapshot.eraseMovement('U');assert.deepEqual(erased,['1']);
 await adapter.photoContext('U');assert.deepEqual(selected,['M1']);
 await adapter.movements.read("U' OR true --");assert.deepEqual(calls.at(-1).values,["U' OR true --",MOVEMENT_FLOW]);assert.ok(!calls.at(-1).sql.includes("U'"));
});
test('report use cases supply date/account scopes without changing the financial algorithms',async()=>{
 const scopes=[],reports=createSalesReports((_storage,scope)=>{scopes.push(scope);return{receipts:async()=>[],items:async()=>[],payments:async()=>[],syncs:async()=>[]};});
 await reports.getDailySales({storage:{},accountId:'A',salesDate:'2026-11-01'});
 await reports.getSalesDashboard({storage:{},accountIds:['A','B'],fromDate:'2026-10-01',toDate:'2026-11-01'});
 await reports.getProfitSummary({storage:{},year:'2026',accounts:[{id:'A',shopName:'Shop'}],expenses:[],costOverrides:[]});
 assert.deepEqual(scopes,[{fromDate:'2026-11-01',toDate:'2026-11-01',accountIds:['A']},{fromDate:'2026-10-01',toDate:'2026-11-01',accountIds:['A','B']},{year:'2026',accountIds:['A']}]);
});
function load(file,imports={},globals={}){
 const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:file}).outputText;
 vm.runInNewContext(code,{exports,URL,URLSearchParams,Request,Response,Error,console,...globals,require:name=>{assert.ok(Object.hasOwn(imports,name),name);return imports[name];}});return exports;
}
test('Orders API preserves unpaged shape and validates opt-in pages before reading storage',async()=>{
 let reads=0,last;const route=load('src/app/api/orders/route.ts',{
  '@/composition/postgres/route':{withPersistence:fn=>fn},'next/server':{NextResponse:Response},
  '@/composition/postgres/service':{createBusinessDatabase:()=>{reads++;return{};}},
  '@/modules/orders/server':{listOrders:async()=>[],listOrderPage:async({query})=>{last=query;return{orders:[],total:0,page:1,pageSize:query.pageSize};}},
 });
 const get=query=>route.GET(new Request('https://example.invalid/api/orders'+query));
 assert.equal(await (await get('')).text(),'{"orders":[],"total":0}');
 assert.equal((await get('?page=999&pageSize=20&query=%25_&status=completed&shipmentLink=linked')).status,200);
 assert.equal(last.query,'%_');assert.equal(last.page,999);assert.equal(last.pageSize,20);
 const before=reads;
 for(const invalid of ['?page=0','?page=1e2','?page=9007199254740992','?pageSize=500','?page=1&status=wrong','?page=1&shipmentLink=wrong'])assert.equal((await get(invalid)).status,400);
 assert.equal(reads,before);
});
test('paged browser API sends all filters and row protocol, rejects invalid pages and preserves HTTP errors',async()=>{
 let reply={orders:[],total:0,page:1,pageSize:20},status=200,request;
 const api=load('src/modules/orders/ui/api.ts',{}, {fetch:async(url,options)=>{request={url,options};return Response.json(reply,{status});}});
 const query={page:3,pageSize:20,query:'ไทย %_',status:'completed',shipmentLink:'linked'};
 await api.getOrderPage(query);
 const url=new URL(request.url,'https://example.invalid');for(const[k,v]of Object.entries(query))assert.equal(url.searchParams.get(k),String(v));
 assert.equal(request.options.headers['x-stock-edit-protocol'],'row-v1');assert.equal(request.options.cache,'no-store');
 reply={...reply,page:0};await assert.rejects(api.getOrderPage(query),/invalid response/);
 reply={error:'Unavailable'};status=503;await assert.rejects(api.getOrderPage(query),/Unavailable/);
});
