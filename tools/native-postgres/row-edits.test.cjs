/* eslint-disable @typescript-eslint/no-require-imports -- Actual current HTTP/SQL owners on a disposable localhost database. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {rowTokens,mutationRow}=require('../../src/composition/postgres/row-edits.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const inventory=require('../../src/modules/inventory/server.ts');
const orders=require('../../src/modules/orders/server.ts');
const movements=require('../../src/app/api/movements/[id]/route.ts');
const items=require('../../src/app/api/movements/[id]/items/[itemId]/route.ts');
const orderDetail=require('../../src/app/api/orders/[id]/route.ts');
const orderItems=require('../../src/app/api/orders/[id]/items/[itemId]/route.ts');
const service=createBusinessDatabase();
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
global.fetch=()=>{throw Error('Real provider forbidden');};
const headers={Authorization:`Bearer ${process.env.STOCK_STAGING_AUTH_TOKEN}`,'x-stock-edit-protocol':'row-v1'};
const req=(path,method='GET',body,token,key=crypto.randomUUID())=>new Request('https://example.test'+path,{method,headers:{...headers,...(method==='GET'?{}:{'content-type':'application/json','Idempotency-Key':key}),...(token?{'If-Match':token.token,'x-stock-edit-scope':token.scope}:{})},body:body===undefined?undefined:JSON.stringify(body)});
const command=fn=>executeCommand('row-test',crypto.randomUUID(),hashIntent('synthetic'),fn);
const context=(id,itemId)=>({params:Promise.resolve({id,itemId})});
const identity={masterId:'ROW-M',userId:'synthetic-row-user',startedAt:'2026-11-01T01:00:00.000Z'};
const append=id=>inventory.appendMovementJourneyItem(service,()=>({id,masterId:identity.masterId,shop:'Synthetic',quantity:'1',remark:'',fromLocation:'Home',toLocation:'Synthetic',imageUrl:'https://example.invalid/'+id,status:'created',createdAt:identity.startedAt,updatedAt:identity.startedAt,stockCounted:false,isNewArrival:false}));
async function viewMovement(){const r=await movements.GET(req('/api/movements/ROW-M'),context('ROW-M'));assert.equal(r.status,200);return(await r.json()).stockEditRows;}
const find=(rows,scope)=>{const row=rows.find(r=>r.scope===scope);assert.ok(row,scope);return row;};
test.after(closePool);

test('LINE append plus parent update cannot invalidate a different movement item; totals remain current',async()=>{
 await command(async()=>{await inventory.synchronizeMovementJourney(service,identity);await append('ROW-I1');await append('ROW-I2');});
 const before=await viewMovement(),token=find(before,'/api/movements/ROW-M/items/ROW-I1');
 // Actual LINE inventory ports, not a fake array or an invented SQL writer.
 await command(async()=>{await append('ROW-I3');await inventory.synchronizeMovementJourney(service,identity);});
 const after=await viewMovement();assert.equal(find(after,token.scope).token,token.token);
 const result=await items.PATCH(req(token.scope,'PATCH',{quantity:'7'},token),context('ROW-M','ROW-I1'));assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.record.quantity,'7');assert.equal(body.records.length,3);
 await transaction(false,async()=>{assert.equal((await currentTransaction().query('SELECT "totalQuantity"::text value FROM stock_operational.movements WHERE id=$1',['ROW-M'])).rows[0].value,'9');});
});
test('different movement items save concurrently; same-row stale edits and deletes conflict',async()=>{
 const rows=await viewMovement(),a=find(rows,'/api/movements/ROW-M/items/ROW-I1'),b=find(rows,'/api/movements/ROW-M/items/ROW-I2');
 const results=await Promise.all([items.PATCH(req(a.scope,'PATCH',{quantity:'8'},a),context('ROW-M','ROW-I1')),items.PATCH(req(b.scope,'PATCH',{quantity:'4'},b),context('ROW-M','ROW-I2'))]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);
 const conflict=await items.PATCH(req(a.scope,'PATCH',{quantity:'99'},a),context('ROW-M','ROW-I1'));assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'stock_revision_conflict');
 assert.equal((await items.DELETE(req(a.scope,'DELETE',{},a),context('ROW-M','ROW-I1'))).status,409);
 const latest=await viewMovement();const row=find(latest,a.scope);
 assert.equal((await items.DELETE(req(row.scope,'DELETE',{},row),context('ROW-M','ROW-I1'))).status,200);
 assert.equal((await items.PATCH(req(row.scope,'PATCH',{quantity:'99'},row),context('ROW-M','ROW-I1'))).status,409);
});
test('a completed row edit replays after later changes, while changed intent and scope substitution fail',async()=>{
 const t=find(await viewMovement(),'/api/movements/ROW-M/items/ROW-I2'),key=crypto.randomUUID();
 const send=(body={quantity:'5'},token=t)=>items.PATCH(req(t.scope,'PATCH',body,token,key),context('ROW-M','ROW-I2'));
 const first=await send(),body=await first.text();assert.equal(first.status,200);
 const fresh=find(await viewMovement(),t.scope);assert.equal((await items.PATCH(req(t.scope,'PATCH',{quantity:'6'},fresh),context('ROW-M','ROW-I2'))).status,200);
 assert.equal(await(await send()).text(),body);assert.equal((await send({quantity:'55'})).status,409);
 const wrong={...fresh,scope:'/api/movements/ROW-M/items/ROW-I3'};
 assert.equal((await items.PATCH(req(t.scope,'PATCH',{quantity:'7'},wrong),context('ROW-M','ROW-I2'))).status,409);
 assert.equal((await items.PATCH(req(t.scope,'PATCH',{quantity:'7'}),context('ROW-M','ROW-I2'))).status,428);
});
test('order master edits ignore child additions; order item edits ignore parent and sibling changes',async()=>{
 let ids;
 await command(async()=>{await orders.createOrder({storage:service,id:'ROW-O',seller:'Synthetic',totalPrice:10,createdBy:'test'});await orders.createOrderItem({storage:service,orderId:'ROW-O',imageUrl:'https://example.invalid/a',quoteQuantity:'1',createdBy:'test'});});
 const get=async()=>{const r=await orderDetail.GET(req('/api/orders/ROW-O'),context('ROW-O'));assert.equal(r.status,200);return r.json();};
 const before=await get(),master=find(before.stockEditRows,'/api/orders/ROW-O');ids=before.order.productImages.map(i=>i.id);
 const item=find(before.stockEditRows,`/api/orders/ROW-O/items/${ids[0]}`);
 await command(async()=>{await orders.createOrderItem({storage:service,orderId:'ROW-O',imageUrl:'https://example.invalid/b',createdBy:'test'});await orders.createOrderBill({storage:service,orderId:'ROW-O',imageUrl:'https://example.invalid/c',createdBy:'test'});});
 assert.equal(find((await get()).stockEditRows,master.scope).token,master.token);
 assert.equal((await orderDetail.PATCH(req(master.scope,'PATCH',{remark:'Synthetic remark'},master),context('ROW-O'))).status,200);
 assert.equal(find((await get()).stockEditRows,item.scope).token,item.token);
 assert.equal((await orderItems.PATCH(req(item.scope,'PATCH',{quantityType:'quote',quantity:3},item),context('ROW-O',ids[0]))).status,200);
 assert.equal((await orderItems.PATCH(req(item.scope,'PATCH',{quantityType:'quote',quantity:4},item),context('ROW-O',ids[0]))).status,409);
});
test('bulk product save protects only submitted items and rejects one stale item atomically; image conflicts run no provider',async()=>{
 const {batchRevision}=require('../../src/composition/postgres/row-edits.ts');
 const bulk=require('../../src/app/api/orders/[id]/items/route.ts');
 const detail=await orderDetail.GET(req('/api/orders/ROW-O'),context('ROW-O')),body=await detail.json();
 const ids=body.order.productImages.map(i=>i.id),path='/api/orders/ROW-O/items',updates={items:[{id:ids[0],productCode:'Synthetic'}]};
 const batch={scope:path,token:await transaction(false,()=>batchRevision(req(path,'PATCH',updates)))};
 // A sibling changes after this form was read.
 await command(()=>orders.updateOrderItemProductCode({storage:service,orderId:'ROW-O',orderItemId:ids[1],productCode:'Other'}));
 const first=await bulk.PATCH(req(path,'PATCH',updates,batch),context('ROW-O'));assert.equal(first.status,200);
 const late={items:[{id:ids[0],productCode:'must not save'},{id:ids[1],productCode:'also not saved'}]};
 const stale={scope:path,token:await transaction(false,()=>batchRevision(req(path,'PATCH',late)))};
 await command(()=>orders.updateOrderItemProductCode({storage:service,orderId:'ROW-O',orderItemId:ids[0],productCode:'Direct edit'}));
 assert.equal((await bulk.PATCH(req(path,'PATCH',late,stale),context('ROW-O'))).status,409);
 await transaction(false,async()=>{const rows=(await currentTransaction().query('SELECT "productCode" FROM stock_operational.order_items WHERE "orderId"=$1 ORDER BY id',['ROW-O'])).rows;assert.deepEqual(rows.map(r=>r.productCode),['Direct edit','Other']);});
 let providerCalls=0;const upload=withPersistence(async()=>{providerCalls++;return Response.json({ok:true});});
 const old=find(body.stockEditRows,`/api/orders/ROW-O/items/${ids[0]}`);
 const image=new Request('https://example.test'+old.scope+'/image',{method:'PATCH',headers:{...headers,'Idempotency-Key':crypto.randomUUID(),'Content-Type':'image/png','If-Match':old.token,'x-stock-edit-scope':old.scope},body:new Uint8Array([137,80,78,71])});
 assert.equal((await upload(image)).status,409);assert.equal(providerCalls,0);
});
test('new order creation does not depend on an old collection/global revision and still replays exactly once',async()=>{
 const route=require('../../src/app/api/orders/route.ts');
 const head=await withPersistence(async()=>Response.json({}))(new Request('https://example.test/api/orders',{method:'HEAD',headers}));
 assert.equal(head.headers.get('x-stock-edit-protocol'),'row-v1');assert.equal(head.headers.get('x-stock-edit-revision'),null);
 await command(()=>orders.createOrder({storage:service,id:'ROW-other',createdBy:'test'}));
 const key=crypto.randomUUID();const a=await route.POST(req('/api/orders','POST',{seller:'Row protocol new order'},undefined,key));assert.equal(a.status,201);
 const b=await route.POST(req('/api/orders','POST',{seller:'Row protocol new order'},undefined,key));assert.equal(b.status,201);assert.deepEqual(await a.json(),await b.json());
});
test('other flows bind only their own row, including absent count slots; unrelated data cannot invalidate them',async()=>{
 const cases=[['/api/shipments/S',{},'shipments'],['/api/employees/E',{},'employees'],['/api/employees/timesheets/T',{},'employee_timesheets'],['/api/employees/advances',{id:'A'},'employee_advances'],['/api/expenses',{id:'X'},'expenses'],['/api/expenses/masters/shops',{id:'H'},'shops'],['/api/expenses/masters/categories',{id:'C'},'expense_categories'],['/api/stock-adjustments',{id:'A'},'stock_adjustments'],['/api/stock-counts',{month:'2026-11',accountId:'shop'},'stock_counts'],['/api/sales/profit-summary/cost-overrides',{month:'2026-11',accountId:'shop'},'sales_profit_cost_overrides']];
 const descriptors=[];for(const[path,body,table]of cases){const row=await mutationRow(req(path,'PATCH',body));assert.equal(row.table,table);descriptors.push(row);}
 const before=await transaction(false,()=>rowTokens(descriptors));
 await command(()=>orders.createOrder({storage:service,id:'ROW-another',createdBy:'test'}));
 assert.deepEqual(await transaction(false,()=>rowTokens(descriptors)),before);
 // Natural-key tokens change on first INSERT and on UPDATE, independently of sales/movement totals.
 const count=descriptors.find(r=>r.table==='stock_counts');
 await command(()=>inventory.saveMonthlyStockCount({account:{id:'shop',shopName:'Synthetic'},storage:service,month:'2026-11',physicalCount:3,note:'',updatedBy:'test'}));
 assert.notEqual((await transaction(false,()=>rowTokens([count])))[0].token,before.find(r=>r.scope===count.scope).token);
});
test('a direct database edit between payload and token queries cannot attach a new token to old data',async()=>{
 const {Client}=require('pg'),direct=new Client({connectionString:process.env.STOCK_DATABASE_URL});
 await direct.connect();await direct.query('SET ROLE stock_runtime');
 assert.equal(await transaction(false,async()=>(await currentTransaction().query("SELECT current_setting('transaction_isolation') value")).rows[0].value),'read committed');
 let original;
 const reader=withPersistence(async()=>{
  assert.equal((await currentTransaction().query("SELECT current_setting('transaction_isolation') value")).rows[0].value,'repeatable read');
  const records=await inventory.getMovementItems({storage:service,movementMasterId:'ROW-M'});
  original=(await rowTokens([{scope:'/api/movements/ROW-M/items/ROW-I2',table:'movement_details',id:'ROW-I2',parent:'ROW-M'}]))[0];
  await direct.query('UPDATE stock_operational.movement_details SET quantity=quantity+1 WHERE id=$1',['ROW-I2']);
  return Response.json({records});
 });
 try{
  const response=await reader(req('/api/movements/ROW-M'));assert.equal(response.status,200);
  const body=await response.json();assert.equal(find(body.stockEditRows,original.scope).token,original.token);
  assert.notEqual(find(await viewMovement(),original.scope).token,original.token);
  assert.equal((await items.PATCH(req(original.scope,'PATCH',{quantity:'99'},original),context('ROW-M','ROW-I2'))).status,409);
 }finally{await direct.end();}
});

test('two real browser sessions edit different movement items while LINE appends; same-row edits remain protected',async()=>{
 const http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
 let origin;
 const server=http.createServer(async(input,output)=>{
  try{
   if(input.url==='/stock-staging-operations.js'){output.setHeader('content-type','text/javascript');output.end(fs.readFileSync('public/stock-staging-operations.js'));return;}
   if(!input.url.startsWith('/api/')){output.setHeader('content-type','text/html');output.end('<!doctype html><script src="/stock-staging-operations.js"></script>');return;}
   const chunks=[];for await(const chunk of input)chunks.push(chunk);
   const request=new Request(origin+input.url,{method:input.method,headers:input.headers,body:input.method==='GET'?undefined:Buffer.concat(chunks)});
   const parts=new URL(request.url).pathname.split('/');
   const result=input.method==='GET'?await movements.GET(request,context(parts[3])):await items.PATCH(request,context(parts[3],parts[5]));
   output.writeHead(result.status,Object.fromEntries(result.headers));output.end(Buffer.from(await result.arrayBuffer()));
  }catch{output.writeHead(500);output.end('Synthetic bridge failure');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.STOCK_CHROMIUM_EXECUTABLE,headless:true,args:['--disable-dev-shm-usage']});
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  for(const c of contexts)await c.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
   await route.continue({headers:{...route.request().headers(),...(url.pathname.startsWith('/api/')?{authorization:headers.Authorization}:{})}});
  });
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(const p of pages){await p.goto(origin);assert.equal(await p.evaluate(async()=>(await fetch('/api/movements/ROW-M')).status),200);}
  await command(async()=>{await append('ROW-I4');await inventory.synchronizeMovementJourney(service,identity);});
  const save=(page,id,value)=>page.evaluate(async({id,value})=>{
   const r=await fetch('/api/movements/ROW-M/items/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({quantity:value})});return{status:r.status,body:await r.json()};
  },{id,value});
  const results=await Promise.all([save(pages[0],'ROW-I2','10'),save(pages[1],'ROW-I3','11')]);assert.deepEqual(results.map(r=>r.status),[200,200]);
  for(const page of pages)await page.evaluate(async()=> (await fetch('/api/movements/ROW-M')).json());
  assert.equal((await save(pages[0],'ROW-I2','12')).status,200);
  assert.equal((await save(pages[1],'ROW-I2','13')).status,409);
  for(const c of contexts)await c.close();
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
