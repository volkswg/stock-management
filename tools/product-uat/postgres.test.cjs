/* eslint-disable @typescript-eslint/no-require-imports -- Actual TypeScript owners, real PostgreSQL, synthetic local target only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Client}=require('pg');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
global.fetch=()=>{throw Error('Real providers are forbidden in product UAT');};
let loseCommit=false;
const query=Client.prototype.query;
Client.prototype.query=function(...args){const result=query.apply(this,args);return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT ACK');}return value;}).catch(error=>{console.error('Synthetic PostgreSQL diagnostic',error.code,error.message);throw error;}):result;};
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
const itemRoute=require('../../src/app/api/orders/[id]/items/[itemId]/product/route.ts');
const listRoute=require('../../src/app/api/products/route.ts');
const productRoute=require('../../src/app/api/products/[id]/route.ts');
const {createOrderItemCatalogue,OrderCatalogueError}=require('../../src/modules/orders/product-catalogue-server.ts');
const {orderItemCatalogue}=require('../../src/modules/orders/application/product-catalogue.ts');
const {PostgresOrderCatalogue}=require('../../src/modules/orders/infrastructure/postgres/product-catalogue.ts');
const {createProductCatalogue}=require('../../src/modules/products/server.ts');
const storage=createBusinessDatabase(),auth={Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN,'x-stock-edit-protocol':'row-v1'};
const command=fn=>executeCommand('product-uat','uat:'+crypto.randomUUID(),hashIntent('synthetic'),fn);
const read=fn=>transaction(false,fn);
const count=()=>read(async()=>(await currentTransaction().query('SELECT count(*)::int n FROM stock_operational.products')).rows[0].n);
const context=itemId=>({params:Promise.resolve({id:'product-uat-order',itemId})});
function request(path,method='GET',body,key){return new Request('http://local.test'+path,{method,headers:{...auth,...(key?{'Idempotency-Key':key}:{}),'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
const path=id=>'/api/orders/product-uat-order/items/'+id+'/product';
const get=async id=>{const r=await itemRoute.GET(request(path(id)),context(id));assert.equal(r.status,200,await r.clone().text());return (await r.json()).item;};
const post=(id,body,key='product:'+crypto.randomUUID())=>itemRoute.POST(request(path(id),'POST',body,key),context(id));
const details={productCode:'CHAIR',productName:'Synthetic chair',variant:'Blue'};
const create=(revision,extra={})=>({expectedRevision:revision,mode:'create',product:details,useItemImage:true,confirmSimilar:false,...extra});
let a,b,c,product;
test.after(closePool);

test('seed through actual Orders owners; existing order shapes stay intact',async()=>{
 await command(async()=>{
  await orders.createOrder({storage,id:'product-uat-order',seller:'Synthetic',remark:'Keep remark',totalPrice:120,createdBy:'synthetic'});
  a=(await orders.createOrderItem({storage,orderId:'product-uat-order',imageUrl:'https://example.invalid/synthetic-photo',quoteQuantity:'3',deliveredQuantity:'1',productCode:'CHAIR',createdBy:'synthetic'})).id;
  b=(await orders.createOrderItem({storage,orderId:'product-uat-order',imageUrl:'https://example.invalid/synthetic-photo',quoteQuantity:'2',productCode:'CHAIR',createdBy:'synthetic'})).id;
  c=(await orders.createOrderItem({storage,orderId:'product-uat-order',imageUrl:'https://example.invalid/synthetic-photo',quoteQuantity:'4',productCode:'OTHER',createdBy:'synthetic'})).id;
 });
 assert.equal((await get(a)).product,null);
});
test('auth and missing idempotency/revision fail before catalogue writes',async()=>{
 const item=await get(a);
 assert.equal((await itemRoute.POST(new Request('http://local.test'+path(a),{method:'POST'}),context(a))).status,401);
 assert.equal((await post(a,create(item.revision),'')).status,428);
 assert.equal((await post(a,{...create(item.revision),expectedRevision:undefined})).status,428);
 assert.equal(await count(),0);
});
test('atomic create/link, reused media, concurrent exact retry and changed-intent conflict',async()=>{
 const before=await get(a),input=create(before.revision),key='product:'+crypto.randomUUID();
 const replies=await Promise.all([post(a,input,key),post(a,input,key)]);
 assert.ok(replies.every(r=>r.status===201),await replies[0].clone().text());
 const [first,second]=await Promise.all(replies.map(r=>r.json()));assert.deepEqual(first,second);product=first.item.product;
 assert.equal(await count(),1);assert.equal(product.productName,details.productName);assert.ok(product.referenceImageMediaId);assert.equal(product.imageUrl,before.imageUrl);assert.notEqual(first.item.revision,before.revision);
 assert.equal((await post(a,{...input,product:{...details,productName:'Changed'}},key)).status,409);
 await read(async()=>{const row=(await currentTransaction().query('SELECT "quoteQuantity"::text q,"deliveredQuantity"::text d,"productCode" c FROM stock_operational.order_items WHERE id=$1',[a])).rows[0];assert.deepEqual(row,{q:'3',d:'1',c:'CHAIR'});assert.equal((await currentTransaction().query('SELECT remark FROM stock_operational.orders WHERE id=$1',['product-uat-order'])).rows[0].remark,'Keep remark');assert.equal((await currentTransaction().query('SELECT count(*)::int n FROM stock_operational.media')).rows[0].n,1);});
});
test('duplicate review is explicit; existing link and an intentional confirmed duplicate both work',async()=>{
 const item=await get(b),input=create(item.revision);
 const warning=await post(b,input);assert.equal(warning.status,409);assert.equal((await warning.json()).code,'product_similar');assert.equal(await count(),1);
 assert.equal((await post(b,{mode:'link',productId:product.id,expectedRevision:item.revision})).status,200);
 const other=await get(c);assert.equal((await post(c,create(other.revision,{confirmSimilar:true,useItemImage:false}))).status,201);assert.equal(await count(),2);
 const found=await listRoute.GET(request('/api/products?q=cha'));assert.equal(found.status,200);assert.equal((await found.json()).products.length,2);
 assert.equal((await listRoute.GET(request('/api/products?q=%25'))).status,200);
});
test('unrelated item changes do not block; same-item stale revision is refused without an orphan product',async()=>{
 const before=await get(b);await command(()=>orders.updateOrderItemQuantity({storage,orderId:'product-uat-order',orderItemId:a,quantity:5,quantityType:'quote'}));
 assert.equal((await post(b,{mode:'link',productId:null,expectedRevision:before.revision})).status,200);
 const n=await count();assert.equal((await post(b,create(before.revision,{confirmSimilar:true}))).status,409);assert.equal(await count(),n);
});
test('late row conflict rolls back product insert inside the real command transaction',async()=>{
 const actual=new PostgresOrderCatalogue(),store={read:actual.read.bind(actual),link:async()=>false},before=await get(b),n=await count();
 // Route HTTP error translation is what permits the wrapper to reject/roll back.
 const {withPersistence}=require('../../src/composition/postgres/route.ts');
 const handler=withPersistence(async()=>{try{await orderItemCatalogue(store,createProductCatalogue()).save('product-uat-order',b,create(before.revision,{confirmSimilar:true}));return Response.json({});}catch(e){if(e instanceof OrderCatalogueError)return Response.json({error:e.message},{status:e.status});throw e;}});
 assert.equal((await handler(request('/api/product-uat-late-conflict','POST',{},'product:'+crypto.randomUUID()))).status,409);assert.equal(await count(),n);
});
test('lost COMMIT acknowledgement reconciles through the same durable key without a second product',async()=>{
 const before=await get(b),input=create(before.revision,{product:{...details,productCode:'LOST',productName:'Lost response chair'},confirmSimilar:true}),key='product:'+crypto.randomUUID(),n=await count();
 loseCommit=true;assert.equal((await post(b,input,key)).status,503);assert.equal(await count(),n+1);
 const retry=await post(b,input,key);assert.equal(retry.status,201);assert.equal(await count(),n+1);assert.equal((await retry.json()).item.product.productCode,'LOST');
});
test('product edits protect product rows; archive keeps old links and rejects new ones',async()=>{
 const target='/api/products/'+product.id,ctx={params:Promise.resolve({id:product.id})};
 const edited=await productRoute.PATCH(request(target,'PATCH',{...details,productName:'Edited chair',expectedRevision:product.revision},'product:'+crypto.randomUUID()),ctx);assert.equal(edited.status,200);const updated=(await edited.json()).product;
 assert.equal((await productRoute.PATCH(request(target,'PATCH',{...details,expectedRevision:product.revision},'product:'+crypto.randomUUID()),ctx)).status,409);
 assert.equal((await productRoute.DELETE(request(target,'DELETE',{expectedRevision:updated.revision},'product:'+crypto.randomUUID()),ctx)).status,200);
 assert.ok((await get(a)).product.deletedAt);const other=await get(c);assert.equal((await post(c,{mode:'link',productId:product.id,expectedRevision:other.revision})).status,409);
});
test('catalogue privileges are private and identities are lossless strings',async()=>{
 await read(async()=>{
  const r=(await currentTransaction().query("SELECT relrowsecurity FROM pg_class WHERE oid='stock_operational.products'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);
  const p=(await currentTransaction().query("SELECT has_table_privilege('anon','stock_operational.products','SELECT') a,has_table_privilege('authenticated','stock_operational.products','SELECT') u,has_table_privilege('stock_runtime','stock_operational.products','DELETE') d,has_sequence_privilege('stock_runtime','stock_operational.products_id_seq','UPDATE') s")).rows[0];assert.deepEqual(p,{a:false,u:false,d:false,s:false});
 });
 const service=createProductCatalogue();await assert.rejects(read(()=>service.find('9223372036854775808')));await assert.rejects(read(()=>service.find('1 OR 1=1')));
 assert.equal((await read(()=>service.find('9007199254740993'))),undefined);
});
