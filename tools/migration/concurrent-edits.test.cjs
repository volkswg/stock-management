/* eslint-disable @typescript-eslint/no-require-imports -- Actual HTTP owners and real pg under the synthetic TypeScript loader. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto,randomUUID}=require('node:crypto');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const inventory=require('../../src/modules/inventory/server.ts');
const orders=require('../../src/modules/orders/server.ts');
const orderRoute=require('../../src/app/api/orders/[id]/route.ts');
const movementRoute=require('../../src/app/api/movements/[id]/route.ts');
const itemRoute=require('../../src/app/api/movements/[id]/items/[itemId]/route.ts');
global.fetch=()=>{throw Error('Live provider network is forbidden');};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const service=createPostgresService();
const auth={Authorization:`Bearer ${process.env.STOCK_STAGING_AUTH_TOKEN}`};
const command=run=>executeCommand('concurrent-fixture',randomUUID(),hashIntent(randomUUID()),run);
const request=(path,method='GET',body,headers={})=>new Request('https://example.test'+path,{method,headers:{...auth,...(body===undefined?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
async function dispatch(req){
 const [, ,family,id,,itemId]=new URL(req.url).pathname.split('/');
 const context={params:Promise.resolve({id,itemId})};
 return (family==='orders'?orderRoute: itemId?itemRoute:movementRoute)[req.method](req,context);
}
const read=path=>dispatch(request(path));
const precondition=response=>({'If-Match':response.headers.get('x-stock-edit-revision'),'x-stock-edit-scope':response.headers.get('x-stock-edit-scope')});
const save=(path,body,view,key=randomUUID())=>dispatch(request(path,'PATCH',body,{'Idempotency-Key':key,...precondition(view)}));
async function fixture(suffix){
 const order='CC_ORDER_'+suffix,movement='CC_MOVEMENT_'+suffix,item='CC_ITEM_'+suffix;
 await command(async()=>{
  await orders.createOrder({googleSheetsService:service,id:order,totalPrice:10,remark:'original',createdBy:'synthetic'});
  const identity={masterId:movement,userId:'synthetic',startedAt:'2026-11-01T01:00:00.000Z'};
  await inventory.synchronizeMovementJourney(service,identity);
  await inventory.appendMovementJourneyItem(service,()=>({id:item,masterId:movement,shop:'Synthetic shop',quantity:'3',remark:'original',fromLocation:'',toLocation:'',imageUrl:'https://example.test/photo',purchaseDetailId:'',status:'created',createdAt:identity.startedAt,updatedAt:identity.startedAt,stockCounted:true,isNewArrival:true}));
 });
 return {order:'/api/orders/'+order,movement:'/api/movements/'+movement,item:'/api/movements/'+movement+'/items/'+item,orderId:order,movementId:movement,itemId:item};
}
async function assertConflict(response){assert.equal(response.status,409,await response.clone().text());assert.equal((await response.json()).code,'stock_revision_conflict');}
test.after(closePool);

test('actual order and movement HTTP saves succeed from the same original global revision, in either order',async()=>{
 for(const reverse of [false,true,'simultaneous']){
  const f=await fixture('CROSS_'+reverse);
  const [orderView,movementView]=await Promise.all([read(f.order),read(f.movement)]);
  assert.equal(orderView.status,200);assert.equal(movementView.status,200);
  assert.equal(orderView.headers.get('x-stock-revision'),movementView.headers.get('x-stock-revision'));
  const steps=[()=>save(f.order,{remark:'order saved'},orderView),()=>save(f.item,{quantity:'7',remark:'movement saved'},movementView)];
  if(reverse===true)steps.reverse();
  const results=reverse==='simultaneous'?await Promise.all(steps.map(step=>step())):[await steps[0](),await steps[1]()];
  for(const result of results)assert.equal(result.status,200,await result.clone().text());
  assert.equal((await (await read(f.order)).json()).order.remark,'order saved');
  const detail=await (await read(f.movement)).json();assert.equal(detail.records[0].remark,'movement saved');
 }
});
test('two real browser sessions can save an order and movement concurrently through actual API owners',async()=>{
 const http=require('node:http'),{chromium}=require('playwright');
 const f=await fixture('CHROME');let origin;
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/operations.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync('public/stock-staging-operations.js'));return;}
   if(!req.url.startsWith('/api/')){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Concurrent edit acceptance</title><script src="/operations.js"></script>');return;}
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await dispatch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Synthetic bridge failed');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.STOCK_CHROMIUM_EXECUTABLE,headless:true,args:['--disable-dev-shm-usage']});
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  const pages=[];
  for(const context of contexts){
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
    return route.continue({headers:{...route.request().headers(),...(url.pathname.startsWith('/api/')?{authorization:auth.Authorization}:{})}});
   });
   const page=await context.newPage();await page.goto(origin);pages.push(page);
  }
  await Promise.all(pages.map((page,i)=>page.evaluate(async path=>{const response=await fetch(path);if(!response.ok)throw Error('view failed');await response.json();},i===0?f.order:f.movement)));
  const results=await Promise.all(pages.map((page,i)=>page.evaluate(async path=>{
   const r=await fetch(path,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({remark:'independent browser save'})});return {status:r.status,body:await r.json()};
  },i===0?f.order:f.item)));
  for(const result of results)assert.equal(result.status,200,JSON.stringify(result));
  for(const context of contexts)await context.close();
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('different entities in the same family save; stale same-entity edits conflict without overwriting',async()=>{
 const a=await fixture('SAME_A'),b=await fixture('SAME_B');
 for(const family of ['order','movement']){
  const [viewA,viewB]=await Promise.all([read(a[family]),read(b[family])]);
  const pathA=family==='order'?a.order:a.item,pathB=family==='order'?b.order:b.item;
  assert.equal((await save(pathA,{remark:'winner'},viewA)).status,200);
  assert.equal((await save(pathB,{remark:'independent'},viewB)).status,200);
  await assertConflict(await save(pathA,{remark:'must not overwrite'},viewA));
  const refreshed=await read(a[family]);assert.notEqual(refreshed.headers.get('x-stock-edit-revision'),viewA.headers.get('x-stock-edit-revision'));
  assert.equal((await save(pathA,{remark:'reviewed after refresh'},refreshed)).status,200);
 }
});
test('child writes and direct typed edits invalidate the parent token; case-insensitive movement IDs retain behavior',async()=>{
 const f=await fixture('DEPENDENCY'),view=await read(f.order);
 await command(()=>orders.createOrderItem({googleSheetsService:service,orderId:f.orderId,imageUrl:'https://example.test/image',quoteQuantity:'1',createdBy:'synthetic'}));
 await assertConflict(await save(f.order,{remark:'stale'},view));
 const movement=await read(f.movement.toLowerCase());assert.equal(movement.status,200);
 await command(()=>currentTransaction().query('UPDATE stock_operational.movement_details SET remark=$1 WHERE id=$2',['direct typed edit',f.itemId]));
 await assertConflict(await save(f.item.toLowerCase(),{remark:'stale'},movement));
});
test('wrong resource, malformed scoped token and legacy global mismatch cannot bypass validation',async()=>{
 const f=await fixture('GUARDS'),g=await fixture('GUARDS_OTHER');
 const [view,other]=await Promise.all([read(f.order),read(g.order)]);
 await assertConflict(await save(f.order,{remark:'wrong resource'},other));
 const invalid=request(f.order,'PATCH',{remark:'invalid'},{'Idempotency-Key':randomUUID(),'If-Match':'"stock-edit-v1-invalid"','x-stock-edit-scope':view.headers.get('x-stock-edit-scope')});
 await assertConflict(await dispatch(invalid));
 await save(g.order,{remark:'unrelated'},other);
 const legacy=await dispatch(request(f.order,'PATCH',{remark:'legacy'},{'Idempotency-Key':randomUUID(),'If-Match':view.headers.get('x-stock-revision')}));
 assert.equal(legacy.status,409);assert.match((await legacy.json()).error,/Storage revision changed/);
 const noKey=await dispatch(request(f.order,'PATCH',{remark:'no key'},precondition(view)));assert.equal(noKey.status,428);
 const unauthorized=new Request('https://example.test'+f.order);assert.equal((await dispatch(unauthorized)).status,401);
});
test('collection fallback ignores other families but stays conservative within its own family',async()=>{
 const f=await fixture('COLLECTION');
 const head=withPersistence(async()=>new Response(null));
 const view=await head(request('/api/movements','HEAD'));
 const orderView=await read(f.order);assert.equal((await save(f.order,{remark:'unrelated'},orderView)).status,200);
 assert.equal((await save(f.item,{remark:'collection save'},view)).status,200);
 await assertConflict(await save(f.item,{remark:'stale collection'},view));
});
test('upload conflict rejects before effect work; completed replay precedes revision checking and never repeats an upload',async()=>{
 const f=await fixture('UPLOAD'),view=await read(f.movement);let effects=0;
 const upload=withPersistence(async()=>{effects++;return Response.json({uploaded:true,effects});});
 const key=randomUUID();const image=()=>new Request('https://example.test'+f.item+'/image',{method:'PATCH',headers:{...auth,...precondition(view),'Idempotency-Key':key,'content-type':'image/png'},body:new Uint8Array([137,80,78,71])});
 const first=await upload(image());assert.equal(first.status,200);const body=await first.text();
 await save(f.item,{remark:'changed after lost acknowledgement'},view);
 const replay=await upload(image());assert.equal(replay.status,200);assert.equal(await replay.text(),body);assert.equal(effects,1);
 const fresh=image();fresh.headers.set('Idempotency-Key',randomUUID());await assertConflict(await upload(fresh));assert.equal(effects,1);
});
test('two isolated browser clients send independent scopes; uncertain commit replays the original intent after reload',async()=>{
 const f=await fixture('BROWSER');const calls=[];let lose=false;
 const transport=async(input,init)=>{
  const req=new Request(input instanceof Request?input:'https://example.test'+input,init);req.headers.set('Authorization',auth.Authorization);
  const result=await dispatch(req);
  if(req.method==='PATCH')calls.push({path:new URL(req.url).pathname,key:req.headers.get('Idempotency-Key'),scope:req.headers.get('x-stock-edit-scope'),expected:req.headers.get('If-Match')});
  if(lose&&req.method==='PATCH'){lose=false;assert.equal(result.status,200);throw Error('lost committed response');}return result;
 };
 function browser(store=new Map()){
  const window={fetch:transport};vm.runInNewContext(fs.readFileSync('public/stock-staging-operations.js','utf8'),{window,Request,Response,URL,FormData,TextEncoder,Uint8Array,crypto:webcrypto,location:{href:'https://example.test/',origin:'https://example.test'},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});return {fetch:window.fetch,store};
 }
 const a=browser(),b=browser();await a.fetch(f.movement);await b.fetch(f.order);
 const patch=remark=>({method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({remark})});
 assert.equal((await b.fetch(f.order,patch('other user order'))).status,200);
 lose=true;await assert.rejects(a.fetch(f.item,patch('movement draft')),/lost committed response/);
 const original=calls.at(-1),reloaded=browser(a.store);await reloaded.fetch(f.movement);
 const retry=await reloaded.fetch(f.item,patch('movement draft'));assert.equal(retry.status,200);await retry.json();
 assert.deepEqual(calls.at(-1),original);assert.equal(a.store.size,0);
 await transaction(false,async()=>assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.commands WHERE key=$1',[original.key])).rows[0].count,'1'));
});
