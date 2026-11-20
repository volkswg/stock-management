import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const {collisionPngPair}=createRequire(import.meta.url)('../tools/migration/local-write/binary-fixtures.cjs');

function client(fetch,store=new Map()) {
 const window={fetch};
 vm.runInNewContext(readFileSync('public/stock-staging-operations.js','utf8'),{
  window,fetch,Request,Response,Headers,URL,TextEncoder,Uint8Array,FormData,crypto:webcrypto,
  location:{href:'https://example.test/orders/create',origin:'https://example.test'},
  sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 });
 return {fetch:window.fetch,store};
}
const input={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seller:'Synthetic',totalPrice:10})};
test('staging browser persists the same operation key through connection loss and reload, and permits a new intentional create after confirmed success',async()=>{
 const keys=[];let attempts=0;
 const fetch=async request=>{keys.push(request.headers.get('Idempotency-Key'));if(++attempts===1)throw new Error('lost acknowledgement');return Response.json({order:{id:'synthetic'}});};
 const first=client(fetch);
 await assert.rejects(first.fetch('/api/orders',input),/lost acknowledgement/);
 assert.equal(first.store.size,1);
 const reloaded=client(fetch,first.store);
 await (await reloaded.fetch('/api/orders',input)).json();
 assert.equal(keys[0],keys[1]);assert.equal(first.store.size,0);
 await (await reloaded.fetch('/api/orders',input)).json();
 assert.notEqual(keys[1],keys[2]);
});
test('staging browser retains identity when a response body cannot be read; missing session storage prevents a blind write',async()=>{
 const keys=[];
 const run=client(async request=>{keys.push(request.headers.get('Idempotency-Key'));return new Response('{broken',{status:201});});
 await assert.rejects((await run.fetch('/api/orders',input)).json());
 await assert.rejects((await run.fetch('/api/orders',input)).json());
 assert.equal(keys[0],keys[1]);assert.equal(run.store.size,1);
});
test('staging browser leaves readonly and cross-origin requests untouched and contains no database credential path',async()=>{
 const calls=[];const run=client(async(...args)=>{calls.push(args);return Response.json({});});
 await run.fetch('/api/orders');await run.fetch('https://other.test/api/orders',input);
 assert.equal(calls[0][0],'/api/orders');assert.equal(calls[1][0],'https://other.test/api/orders');
 assert.equal(run.store.size,0);
 assert.doesNotMatch(readFileSync('public/stock-staging-operations.js','utf8'),/STOCK_DATABASE|service_role|postgres:\/\//);
});
test('query parameters distinguish operation intents and foreign responses cannot supply a local revision',async()=>{
 const keys=[],revisions=[];
 const run=client(async request=>{
  if(typeof request==='string')return Response.json({},{headers:{'x-stock-revision':'"foreign"'}});
  keys.push(request.headers.get('Idempotency-Key'));revisions.push(request.headers.get('If-Match'));
  return new Response('{broken',{status:201});
 });
 await run.fetch('https://other.test/api/orders');
 await run.fetch('/api/orders?shop=one',input);await run.fetch('/api/orders?shop=two',input);await run.fetch('/api/orders?shop=one',input);
 assert.notEqual(keys[0],keys[1]);assert.equal(keys[0],keys[2]);assert.deepEqual(revisions,[null,null,null]);
});
test('uncertain browser image requests keep byte identity across reload and give different valid image bytes a different key',async()=>{
 const keys=[],[first,changed]=collisionPngPair();
 assert.equal(first.toString('utf8'),changed.toString('utf8'));
 const lost=async request=>{keys.push(request.headers.get('Idempotency-Key'));throw Error('WT response lost');};
 const run=client(lost),input=bytes=>({method:'PATCH',headers:{'content-type':'image/png'},body:bytes});
 await assert.rejects(run.fetch('/api/movements/WT/items/WT/image',input(first)));
 const reloaded=client(lost,run.store);
 await assert.rejects(reloaded.fetch('/api/movements/WT/items/WT/image',input(changed)));
 await assert.rejects(reloaded.fetch('/api/movements/WT/items/WT/image',input(first)));
 assert.notEqual(keys[0],keys[1]);assert.equal(keys[0],keys[2]);assert.equal(run.store.size,2);
});
test('browser raw-image identity includes the media type consumed by the route',async()=>{
 const keys=[],[bytes]=collisionPngPair(),run=client(async request=>{keys.push(request.headers.get('Idempotency-Key'));throw Error('WT response lost');});
 for(const contentType of ['image/png','image/webp','image/png'])await assert.rejects(run.fetch('/api/movements/WT/items/WT/image',{method:'PATCH',headers:{'content-type':contentType},body:bytes}));
 assert.notEqual(keys[0],keys[1]);assert.equal(keys[0],keys[2]);
});
test('replaying an old completed response cannot move the browser revision behind a later observed write',async()=>{
 const revisions=[];
 const run=client(async request=>{
  if(typeof request==='string')return Response.json({},{headers:{'x-stock-revision':'"stock-v2-90071992547409930"'}});
  revisions.push(request.headers.get('If-Match'));return Response.json({ok:true},{headers:{'x-stock-revision':'"stock-v2-5"'}});
 });
 await run.fetch('/api/orders');
 await (await run.fetch('/api/orders',input)).json();
 await (await run.fetch('/api/orders',{...input,body:JSON.stringify({seller:'Another synthetic intent',totalPrice:20})})).json();
 assert.deepEqual(revisions,['"stock-v2-90071992547409930"','"stock-v2-90071992547409930"']);
});

const token = n => `"stock-edit-v1-${String(n).padStart(64,'0')}"`;
const scoped = (scope,n,global=n) => Response.json({ok:true},{headers:{'x-stock-edit-scope':scope,'x-stock-edit-revision':token(n),'x-stock-revision':`"stock-v2-${global}"`}});
const patch = remark => ({method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({remark})});
test('browser selects the viewed entity rather than an unrelated order/movement or collection revision',async()=>{
 const writes=[];
 const run=client(async request=>{
  if(typeof request==='string')return scoped(request,request.endsWith('WT')?1:2);
  writes.push([request.headers.get('x-stock-edit-scope'),request.headers.get('If-Match')]);
  return Response.json({ok:true});
 });
 await run.fetch('/api/movements/WT');await run.fetch('/api/orders/O1');await run.fetch('/api/movements');
 await (await run.fetch('/api/movements/wt/items/I1',patch('movement'))).json();
 await (await run.fetch('/api/orders/O1',patch('order'))).json();
 assert.deepEqual(writes,[['/api/movements/WT',token(1)],['/api/orders/O1',token(2)]]);
});
test('uncertain edits preserve both identity and original view through reload and a newer GET',async()=>{
 const writes=[];let version=1;
 const transport=async request=>{
  if(typeof request==='string')return scoped('/api/movements/WT',version);
  writes.push([request.headers.get('Idempotency-Key'),request.headers.get('If-Match'),request.headers.get('x-stock-edit-scope')]);
  throw Error('lost acknowledgement');
 };
 const first=client(transport);await first.fetch('/api/movements/WT');
 await assert.rejects(first.fetch('/api/movements/WT/items/I1',patch('draft')));
 const next=client(transport,first.store);version=2;await next.fetch('/api/movements/WT');
 await assert.rejects(next.fetch('/api/movements/WT/items/I1',patch('draft')));
 assert.deepEqual(writes[1],writes[0]);assert.equal(writes[0][1],token(1));assert.equal(first.store.size,1);
});
test('only a confirmed pre-handler conflict clears an edit, with no automatic retry or draft rewrite',async()=>{
 let status=503;const writes=[];
 const run=client(async request=>{
  if(typeof request==='string')return scoped('/api/orders/O1',1);
  writes.push([request.headers.get('Idempotency-Key'),await request.clone().text()]);
  return Response.json({error:'review',...(status===409?{code:'stock_revision_conflict'}:{})},{status});
 });
 await run.fetch('/api/orders/O1');
 await (await run.fetch('/api/orders/O1',patch('retained draft'))).json();assert.equal(run.store.size,1);
 status=409;await (await run.fetch('/api/orders/O1',patch('retained draft'))).json();
 assert.equal(run.store.size,0);assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
 await (await run.fetch('/api/orders/O1',patch('retained draft'))).json();assert.notEqual(writes[2][0],writes[1][0]);
 assert.equal(writes[2][1],writes[1][1]);
});
test('older replay, wrong scope, error and foreign responses cannot replace a newer scoped view',async()=>{
 const writes=[];let response;
 const run=client(async request=>{
  if(typeof request==='string')return response;
  writes.push(request.headers.get('If-Match'));return Response.json({ok:true});
 });
 response=scoped('/api/orders/O1',5,90071992547409930n);await run.fetch('/api/orders/O1');
 response=scoped('/api/orders/O1',1,4);await run.fetch('/api/orders/O1');
 response=scoped('/api/orders/O1',9,90071992547409931n);await run.fetch('https://foreign.test/api/orders/O1');
 response=scoped('/api/orders/O2',9,90071992547409931n);await run.fetch('/api/orders/O1');
 response=new Response('{}',{status:500,headers:{'x-stock-edit-scope':'/api/orders/O1','x-stock-edit-revision':token(9),'x-stock-revision':'"stock-v2-90071992547409932"'}});await run.fetch('/api/orders/O1');
 await (await run.fetch('/api/orders/O1',patch('a'))).json();assert.deepEqual(writes,[token(5)]);
});
test('legacy key-only scoped edits require reconciliation instead of inventing a new view',async()=>{
 let sends=0;const run=client(async()=>{sends++;throw Error('lost');});
 await assert.rejects(run.fetch('/api/orders/O1',patch('draft')));
 const key=[...run.store.keys()][0];run.store.set(key,'legacy-pending-key');
 const reload=client(async()=>{sends++;return Response.json({});},run.store);
 await assert.rejects(reload.fetch('/api/orders/O1',patch('draft')),/older page needs review/);
 assert.equal(sends,1);assert.equal(run.store.get(key),'legacy-pending-key');
});

const rowToken = n => `"stock-row-v1-${String(n).padStart(64,'0')}"`;
const rowView = (entries, global = 1) => Response.json({stockEditRows:entries.map(([scope,n])=>({scope,token:rowToken(n)}))},{headers:{'x-stock-edit-protocol':'row-v1','x-stock-revision':`"stock-v2-${global}"`}});
test('row protocol pins movement items and order items, never their master or collection',async()=>{
 const writes=[];
 const run=client(async input=>{
  if(typeof input==='string')return rowView([['/api/movements/WT',1],['/api/movements/WT/items/I1',2],['/api/movements/WT/items/I2',3],['/api/orders/O1',4],['/api/orders/O1/items/2',5]]);
  writes.push([input.headers.get('x-stock-edit-scope'),input.headers.get('If-Match')]);return Response.json({ok:true});
 });
 await run.fetch('/api/movements/WT');await run.fetch('/api/orders/O1');
 for(const path of ['/api/movements/wt/items/i1','/api/movements/WT/items/I2/image','/api/orders/O1/items/2','/api/orders/O1'])await(await run.fetch(path,patch('synthetic'))).json();
 assert.deepEqual(writes,[['/api/movements/WT/items/I1',rowToken(2)],['/api/movements/WT/items/I2',rowToken(3)],['/api/orders/O1/items/2',rowToken(5)],['/api/orders/O1',rowToken(4)]]);
});
test('row-only writes retain key and exact row precondition after loss, reload and newer reads',async()=>{
 const writes=[];let version=1;
 const transport=async input=>{
  if(typeof input==='string')return rowView([['/api/movements/WT/items/I1',version]],version);
  writes.push([input.headers.get('Idempotency-Key'),input.headers.get('If-Match'),input.headers.get('x-stock-edit-scope')]);throw Error('lost');
 };
 const first=client(transport);await first.fetch('/api/movements/WT');await assert.rejects(first.fetch('/api/movements/WT/items/I1',patch('draft')));
 const second=client(transport,first.store);version=2;await second.fetch('/api/movements/WT');await assert.rejects(second.fetch('/api/movements/WT/items/I1',patch('draft')));
 assert.deepEqual(writes[0],writes[1]);assert.equal(writes[1][1],rowToken(1));
});
test('other edit flows select only the requested row or month/shop slot; creates omit a stale collection precondition',async()=>{
 const scopes=['/api/shipments/S1','/api/employees/E1','/api/employees/timesheets/T1','/api/employees/advances/A1','/api/expenses/X1','/api/expenses/masters/shops/H1','/api/expenses/masters/categories/C1','/api/stock-adjustments/A1','/api/stock-counts?month=2026-11&accountId=shop','/api/sales/profit-summary/cost-overrides?month=2026-11&accountId=shop'];
 const writes=[];const run=client(async input=>{
  if(typeof input==='string')return rowView(scopes.map((s,i)=>[s,i+1]));
  writes.push([input.headers.get('x-stock-edit-scope'),input.headers.get('If-Match')]);return Response.json({ok:true});
 });
 await run.fetch('/api/expenses');
 const operations=[['/api/shipments/S1',{}],['/api/employees/E1',{}],['/api/employees/timesheets/T1',{}],['/api/employees/advances',{id:'A1'}],['/api/expenses',{id:'X1'}],['/api/expenses/masters/shops',{id:'H1'}],['/api/expenses/masters/categories',{id:'C1'}],['/api/stock-adjustments',{id:'A1'}],['/api/stock-counts',{month:'2026-11',accountId:'shop'}],['/api/sales/profit-summary/cost-overrides',{month:'2026-11',accountId:'shop'}]];
 for(const [url,body] of operations)await(await run.fetch(url,{...patch(''),body:JSON.stringify(body)})).json();
 assert.deepEqual(writes,scopes.map((s,i)=>[s,rowToken(i+1)]));
 await(await run.fetch('/api/orders',input)).json();await(await run.fetch('/api/orders/O1/items',input)).json();
 assert.deepEqual(writes.slice(-2),[[null,null],[null,null]]);
});
test('row mode fails closed on unseen items and ignores foreign, failed and older snapshots',async()=>{
 let response=rowView([['/api/movements/WT/items/I1',5]],5);const writes=[];
 const run=client(async input=>{if(typeof input==='string')return response;writes.push(input.headers.get('If-Match'));return Response.json({ok:true});});
 await run.fetch('/api/movements/WT');response=rowView([['/api/movements/WT/items/I1',1]],1);await run.fetch('/api/movements/WT');
 response=rowView([['/api/movements/WT/items/I1',9]],9);await run.fetch('https://foreign.test/api/movements/WT');
 await assert.rejects(run.fetch('/api/movements/WT/items/unseen',patch('draft')),/Read this record/);
 await(await run.fetch('/api/movements/WT/items/I1',patch('draft'))).json();assert.deepEqual(writes,[rowToken(5)]);
});
test('bulk product saves witness exactly the selected rows and keep their original witness through uncertain reload',async()=>{
 const store=new Map(),writes=[];let version=1;
 const fetch=async input=>{
  if(typeof input==='string')return rowView([['/api/orders/O/items/1',version],['/api/orders/O/items/2',2],['/api/orders/O/items/3',3]],version);
  writes.push([input.headers.get('Idempotency-Key'),input.headers.get('If-Match'),input.headers.get('x-stock-edit-scope')]);throw Error('lost');
 };
 const body={method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({items:[{id:'2',productCode:'B'},{id:'1',productCode:'A'}]})};
 const first=client(fetch,store);await first.fetch('/api/orders/O');await assert.rejects(first.fetch('/api/orders/O/items',body));
 const expected='"stock-batch-v1-'+ await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([['/api/orders/O/items/1',rowToken(1)],['/api/orders/O/items/2',rowToken(2)]]))).then(b=>Buffer.from(b).toString('hex'))+'"';
 assert.equal(writes[0][1],expected);assert.equal(writes[0][2],'/api/orders/O/items');
 const reload=client(fetch,store);version=9;await reload.fetch('/api/orders/O');await assert.rejects(reload.fetch('/api/orders/O/items',body));assert.deepEqual(writes[1],writes[0]);
});
