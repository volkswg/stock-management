/* eslint-disable @typescript-eslint/no-require-imports -- Real current owners with fake provider IO on disposable localhost PostgreSQL only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {Client}=require('pg');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
const factory=require('../../src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts');
const actualFactory=factory.createGoogleDriveServiceFromConfig;
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');
url.username='postgres';url.password='';const owner=new Client({connectionString:url.toString()});
let uploads=0,deletes=0,providerUncertain=false,loseAfterUpload=false,loseCommit=false;
const realQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=realQuery.apply(this,args);return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return value;}):result;};
const drive={async uploadImage(input){uploads++;assert.ok(input.bytes.byteLength>0);if(providerUncertain)throw Error('Synthetic accepted bytes without provider identity');const id='SYNTHETIC_'+randomUUID().replaceAll('-','');if(loseAfterUpload){loseAfterUpload=false;loseCommit=true;}return {id,name:input.fileName,webViewLink:`https://drive.google.com/file/d/${id}/view`};},async deleteFile(){deletes++;},async makeFileReadableByLink(){},async checkConnection(){}};
factory.createGoogleDriveServiceFromConfig=()=>drive;
global.fetch=()=>{throw Error('Real provider calls forbidden in image upload acceptance');};
const route=require('../../src/app/api/orders/with-images/route.ts').POST;
const auth={Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN};
const key=()=>`order-image:${randomUUID()}`;
function imageRequest(uploadKey,type='bill',content='synthetic image',size){const form=new FormData();form.set('operation','upload');form.set('imageType',type);form.set('image',new File([size?new Uint8Array(size):content],`${type}.jpeg`,{type:'image/jpeg'}));return new Request('https://example.test/api/orders/with-images',{method:'POST',headers:{...auth,...(uploadKey?{'Idempotency-Key':uploadKey}:{})},body:form});}
function orderRequest(orderKey,images,extra={}){return new Request('https://example.test/api/orders/with-images',{method:'POST',headers:{...auth,'Idempotency-Key':orderKey,'Content-Type':'application/json'},body:JSON.stringify({seller:'UPLOAD_ACCEPTANCE',images,...extra})});}
async function upload(type='bill'){const response=await route(imageRequest(key(),type));assert.equal(response.status,201,await response.clone().text());return (await response.json()).image;}
const count=async(table)=>(await owner.query(`SELECT count(*)::int n FROM stock_operational.${table}`)).rows[0].n;
test.before(async()=>{await owner.connect();});
test.after(async()=>{factory.createGoogleDriveServiceFromConfig=actualFactory;Client.prototype.query=realQuery;await db.closePool();await owner.end();});

test('actual upload endpoint requires key/auth, rejects size before provider, and does not create an order',async()=>{
 const before=uploads,ordersBefore=await count('orders');
 assert.equal((await route(imageRequest())).status,428);
 const noAuth=imageRequest(key());noAuth.headers.delete('Authorization');assert.equal((await route(noAuth)).status,401);
 assert.equal((await route(imageRequest(key(),'bill','',4_000_001))).status,413);assert.equal(uploads,before);
 const image=await upload();assert.match(image.id,/^[a-f0-9-]{36}$/);assert.equal(await count('orders'),ordersBefore);
 const row=(await owner.query('SELECT "sourceUrl",provider,"mimeType" FROM stock_operational.media WHERE id=$1',[image.id])).rows[0];assert.equal(row.sourceUrl,image.url);assert.equal(row.provider,'google_drive');assert.equal(row.mimeType,'image/jpeg');
});
test('completed upload retries replay exactly; changed bytes with the same key conflict',async()=>{
 const id=key(),before=uploads,first=await route(imageRequest(id));assert.equal(first.status,201);const body=await first.text();
 const replay=await route(imageRequest(id));assert.equal(replay.status,201);assert.equal(await replay.text(),body);assert.equal(uploads,before+1);
 assert.equal((await route(imageRequest(id,'bill','changed'))).status,409);assert.equal(uploads,before+1);
});
test('lost upload COMMIT acknowledgement reconciles from the journal without uploading or deleting again',async()=>{
 const id=key(),before=uploads,deleted=deletes;loseAfterUpload=true;
 const first=await route(imageRequest(id));assert.equal(first.status,503);
 const retry=await route(imageRequest(id));assert.equal(retry.status,201,await retry.clone().text());assert.equal(uploads,before+1);assert.equal(deletes,deleted);
});
test('provider uncertainty is held; identical retry cannot blindly resubmit bytes',async()=>{
 const id=key(),before=uploads;providerUncertain=true;
 try{assert.equal((await route(imageRequest(id))).status,503);}finally{providerUncertain=false;}
 assert.equal((await route(imageRequest(id))).status,503);assert.equal(uploads,before+1);
 const states=(await owner.query("SELECT state FROM stock_operational.side_effects WHERE state='uncertain'")).rows;assert.ok(states.length>0);
});
test('order creation validates completed upload receipts and canonical active media before writing',async()=>{
 const bill=await upload('bill'),product=await upload('product');const before=await count('orders');
 for(const bad of [{...bill,url:'https://unapproved.invalid/forged'},{...bill,id:randomUUID()},{...bill,imageType:'product'},{...bill,uploadKey:key()}])assert.equal((await route(orderRequest(randomUUID(),[bad,product]))).status,400);
 await owner.query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=$1',[bill.id]);
 assert.equal((await route(orderRequest(randomUUID(),[bill,product]))).status,400);
 // A deleted media identity is immutable; use a fresh upload for the valid case.
 assert.equal(await count('orders'),before);
});
test('JSON creation commits the order and references atomically and replays a lost committed response',async()=>{
 const images=[await upload('bill'),await upload('product')],before=await count('orders'),beforeUploads=uploads,id=randomUUID();
 loseCommit=true;const first=await route(orderRequest(id,images));assert.equal(first.status,503);
 const retry=await route(orderRequest(id,images));assert.equal(retry.status,201,await retry.clone().text());const created=(await retry.json()).order;
 assert.equal(await count('orders'),before+1);assert.equal(uploads,beforeUploads);
 const replay=await route(orderRequest(id,images));assert.equal(replay.status,201);assert.equal((await replay.json()).order.id,created.id);
 assert.equal((await route(orderRequest(id,images,{remark:'changed after uncertain save'}))).status,409);
 const refs=(await owner.query('SELECT "imageMediaId"::text id FROM stock_operational.order_bills WHERE "orderId"=$1 UNION ALL SELECT "imageMediaId"::text FROM stock_operational.order_items WHERE "orderId"=$1',[created.id])).rows;
 assert.deepEqual(refs.map(r=>r.id).sort(),images.map(r=>r.id).sort());
 const beforeRollback=await count('orders'),beforeBills=await count('order_bills');
 const abort=withPersistence(async()=>{await orders.createOrderFromUploadedImages({storage:createBusinessDatabase(),images,seller:'MUST_ROLL_BACK'});return Response.json({error:'Synthetic final rejection'},{status:409});});
 assert.equal((await abort(orderRequest(randomUUID(),images))).status,409);assert.equal(await count('orders'),beforeRollback);assert.equal(await count('order_bills'),beforeBills);assert.equal(uploads,beforeUploads);
});

test('actual browser uploads selections separately and recovers a lost upload response across reload before creating a JSON order',async()=>{
 const http=require('node:http'),fs=require('node:fs'),ts=require('typescript'),{chromium}=require('playwright');
 const {GET}=require('../../src/app/api/orders/route.ts');let origin,lost=false;
 const received=[],server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/orders-client.js'){res.setHeader('Content-Type','text/javascript');res.end(ts.transpileModule(fs.readFileSync('src/modules/orders/ui/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);return;}
   if(req.url==='/stock-staging-operations.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('public/stock-staging-operations.js'));return;}
   if(!req.url.startsWith('/api/')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic order uploads</title><script src="/stock-staging-operations.js"></script>');return;}
   const parts=[];for await(const part of req)parts.push(part);const bytes=Buffer.concat(parts);
   const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:bytes});
   received.push({key:request.headers.get('Idempotency-Key'),type:request.headers.get('Content-Type'),bytes:bytes.length,method:req.method});
   const response=await (req.url==='/api/orders'?GET:route)(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Synthetic image API bridge failed',error.message);res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.STOCK_CHROMIUM_EXECUTABLE,headless:true,args:['--disable-dev-shm-usage']});
  const context=await browser.newContext();await context.route('**/*',async intercepted=>{
   const request=intercepted.request(),url=new URL(request.url());if(url.origin!==origin)return intercepted.abort();
   if(!url.pathname.startsWith('/api/'))return intercepted.continue();
   const headers={...request.headers(),authorization:auth.Authorization};
   if(request.method()==='POST'&&headers['content-type']?.includes('multipart/form-data')&&!lost){
    const response=await intercepted.fetch({headers,maxRedirects:0});assert.equal(response.status(),201);lost=true;await intercepted.abort('failed');
   }else await intercepted.continue({headers});
  });
  const page=await context.newPage();await page.goto(origin);const before=uploads;
  const select=type=>page.evaluate(async type=>{const api=await import('/orders-client.js');try{return {image:await api.uploadOrderCreationImage(new File([new Uint8Array(3_000_000)],`${type}.jpeg`,{type:'image/jpeg'}),type)};}catch(error){return {error:error.message};}},type);
  assert.match((await select('bill')).error,/unconfirmed/);const original=received.find(r=>r.method==='POST').key;
  await page.reload();const bill=(await select('bill')).image;assert.ok(bill);assert.equal(received.filter(r=>r.method==='POST')[1].key,original);
  const product=(await select('product')).image;assert.ok(product);assert.equal(uploads,before+2);
  const result=await page.evaluate(async images=>{const api=await import('/orders-client.js');return api.createOrderFromUploadedImages({seller:'BROWSER_IMAGE_ACCEPTANCE',images});},[bill,product]);
  assert.ok(result.order.id);const posts=received.filter(r=>r.method==='POST');assert.equal(posts.length,4);
  assert.ok(posts.slice(0,3).every(r=>r.bytes<4_100_000&&r.type.includes('multipart/form-data')));
  assert.ok(posts.at(-1).bytes<2000);assert.match(posts.at(-1).type,/application\/json/);
  assert.equal(await page.evaluate(()=>JSON.stringify({...sessionStorage}).includes('synthetic-authorization-token')),false);
  await context.close();
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('the retained multipart creation path still creates the same order and images',async()=>{
 const form=new FormData();form.set('seller','LEGACY_UPLOAD_ACCEPTANCE');form.set('totalPrice','12.34');
 for(const type of ['bill','product'])form.set(type+'Images',new File(['synthetic legacy image'],type+'.jpeg',{type:'image/jpeg'}));
 const before=uploads,response=await route(new Request('https://example.test/api/orders/with-images',{method:'POST',headers:{...auth,'Idempotency-Key':'order-create:'+randomUUID()},body:form}));
 assert.equal(response.status,201,await response.clone().text());const order=(await response.json()).order;assert.ok(order.id);assert.equal(uploads,before+2);
 assert.equal((await owner.query('SELECT "totalPrice"::text price FROM stock_operational.orders WHERE id=$1',[order.id])).rows[0].price,'12.34');
});

test('an intentional repeated image selection keeps two references without a duplicate provider upload',async()=>{
 const bill=await upload('bill'),product=await upload('product'),before=uploads;
 const response=await route(orderRequest(randomUUID(),[bill,bill,product]));assert.equal(response.status,201,await response.clone().text());
 const {order}=await response.json();assert.equal((await owner.query('SELECT count(*)::int n FROM stock_operational.order_bills WHERE "orderId"=$1',[order.id])).rows[0].n,2);assert.equal(uploads,before);
});
