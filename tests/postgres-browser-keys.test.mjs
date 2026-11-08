import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

function client(fetch,store=new Map()) {
 const window={fetch};
 vm.runInNewContext(readFileSync('public/stock-staging-operations.js','utf8'),{
  window,fetch,Request,Response,URL,TextEncoder,Uint8Array,FormData,crypto:webcrypto,
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
