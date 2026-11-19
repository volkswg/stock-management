/* eslint-disable @typescript-eslint/no-require-imports -- Real TypeScript HTTP owners under the synthetic integration loader. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const orders=require('../../src/app/api/orders/route.ts');

test('authorized real browser/API acceptance: scoped bearer, committed response loss, reload and exact replay',async()=>{
 assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
 const token=process.env.STOCK_STAGING_AUTH_TOKEN;
 assert.ok(token?.length>=32);
 let origin,lost=false,authorize=false;
 const received=[];
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/stock-staging-operations.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync('public/stock-staging-operations.js'));return;}
   if(!req.url.startsWith('/api/')){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Synthetic Orders acceptance</title><script src="/stock-staging-operations.js"></script>');return;}
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:Buffer.concat(chunks)});
   received.push({key:request.headers.get('Idempotency-Key'),authorized:request.headers.get('authorization')===`Bearer ${token}`});
   const result=await (req.method==='GET'?orders.GET:orders.POST)(request);
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Synthetic acceptance bridge failed');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 const localFetch=global.fetch;
 global.fetch=(input,init)=>{
  if(new URL(input instanceof Request?input.url:input).origin!==origin)throw new Error('Live provider requests are forbidden in synthetic browser acceptance');
  return localFetch(input,init);
 };
 let browser;
 try{
  // Node-only API runner: no redirects and exact origin; never inject secrets in page JS.
  const api=async(auth)=>fetch(origin+'/api/orders',{redirect:'error',headers:auth?{Authorization:`Bearer ${token}`}:{}});
  assert.equal((await api(false)).status,401);assert.equal((await api(true)).status,200);
  const executablePath=process.env.STOCK_CHROMIUM_EXECUTABLE||['/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
  assert.ok(executablePath,'Install Chromium or set STOCK_CHROMIUM_EXECUTABLE');
  browser=await chromium.launch({executablePath,headless:true,args:['--disable-dev-shm-usage']});
  const context=await browser.newContext();let foreignAuthorization;
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin){foreignAuthorization=request.headers().authorization;await route.abort();return;}
   if(authorize&&url.pathname.startsWith('/api/')){
    const headers={...request.headers(),authorization:`Bearer ${token}`};
    if(url.search==='?lost=once'&&request.method()==='POST'&&!lost){
     // Complete the real server transaction, then drop only its browser delivery.
     const committed=await route.fetch({headers,maxRedirects:0});assert.equal(committed.status(),201);
     lost=true;await route.abort('failed');
    }else await route.continue({headers});
   }else await route.continue();
  });
  const page=await context.newPage();await page.goto(origin);
  assert.equal(await page.evaluate(async()=> (await fetch('/api/orders')).status),401);
  authorize=true;
  const submit=()=>page.evaluate(async()=>{
   try{const r=await fetch('/api/orders?lost=once',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seller:'Browser acceptance synthetic',totalPrice:42.13})});return {status:r.status,body:await r.json()};}
   catch{return {networkFailed:true};}
  });
  const firstResult=await submit();
  assert.equal(firstResult.networkFailed,true,`First POST must commit before socket loss: ${JSON.stringify(firstResult)}`);
  const firstKey=received.at(-1).key;assert.ok(firstKey);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('stock-pending-operation:')).length),1);
  await page.reload();const retry=await submit();assert.equal(retry.status,201);assert.equal(received.at(-1).key,firstKey);
  const intentional=await submit();assert.equal(intentional.status,201);assert.notEqual(received.at(-1).key,firstKey);assert.notEqual(intentional.body.order.id,retry.body.order.id);
  await page.evaluate(async()=>{try{await fetch('https://unapproved.invalid/api/orders');}catch{/* Deliberately denied before network. */}});
  assert.equal(foreignAuthorization,undefined);
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('synthetic-authorization-token')),false);
  await transaction(false,async()=>{
   assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.orders WHERE seller=$1',['Browser acceptance synthetic'])).rows[0].count,'2');
   assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.commands WHERE key=$1',[firstKey])).rows[0].count,'1');
  });
  await context.close();
 }finally{global.fetch=localFetch;await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await closePool();}
});
