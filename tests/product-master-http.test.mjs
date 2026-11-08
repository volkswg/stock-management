import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness,uuid,uuid2,uuid3,input} from './helpers/product-master.mjs';
const origin='https://example.test';
const request=(path,body,method='POST',cookie='',site=origin)=>new Request(origin+path,{method,headers:{Origin:site,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});
async function login(w){const result=await w.load('src/app/api/product-access/route.ts').POST(request('/api/product-access',{staffId:'editor',accessKey:'k'.repeat(43)}));assert.equal(result.status,200);return result.headers.get('set-cookie').split(';')[0];}
const itemParams={params:Promise.resolve({id:'order',itemId:'item'})};
test('staff login cookies are scoped, secure, expiring, tamper-resistant and immediately revoked by current settings',async()=>{
 const w=harness(),api=w.load('src/app/api/product-access/route.ts'),cookie=await login(w);
 const get=()=>api.GET(request('/api/product-access',undefined,'GET',cookie));assert.equal((await (await get()).json()).staff.id,'editor');
 const response=await api.POST(request('/api/product-access',{staffId:'editor',accessKey:'k'.repeat(43)}));const header=response.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);assert.match(header,/Path=\/api\//);assert.match(header,/Max-Age=28800/);
 const tampered=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a');assert.equal((await (await api.GET(request('/api/product-access',undefined,'GET',tampered))).json()).staff,null);
 w.state.nowMs+=8*60*60*1000;assert.equal((await (await get()).json()).staff,null);
 w.state.nowMs-=8*60*60*1000;w.env.PRODUCT_MASTER_STAFF_KEYS_JSON=JSON.stringify([{id:'editor',keyHash:crypto.createHash('sha256').update('q'.repeat(43)).digest('hex')}]);assert.equal((await (await get()).json()).staff,null);
 w.env.PRODUCT_MASTER_STAFF_KEYS_JSON='[]';assert.equal((await (await get()).json()).staff,null);assert.equal(w.state.compositions,0);
});
test('new writes reject anonymous, cross-origin, malformed and disabled staff access before any provider composition',async()=>{
 const w=harness();const collection=w.load('src/app/api/products/route.ts'),item=w.load('src/app/api/orders/[id]/items/[itemId]/product/route.ts'),product=w.load('src/app/api/products/[id]/route.ts');
 assert.equal((await collection.POST(request('/api/products',{requestId:uuid,product:input,confirmed:true}))).status,401);
 assert.equal((await item.PATCH(request('/api/orders/order/items/item/product',{productId:null,revision:'initial',requestId:uuid}),itemParams)).status,401);
 assert.equal((await product.PATCH(request('/api/products/id',{}),{params:Promise.resolve({id:'id'})})).status,401);
 const cookie=await login(w);assert.equal((await collection.POST(request('/api/products',{},'POST',cookie,'https://attacker.test'))).status,403);
 w.env.PRODUCT_MASTER_SESSION_SECRET='bad';const response=await collection.POST(request('/api/products',{},'POST',cookie));assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/bad|kkkk|ssss/);
 assert.equal(w.state.compositions,0);assert.equal(w.state.metadata.size,0);
});
test('actual authenticated Product and Order link HTTP methods preserve all nine master fields, immutable metadata and K-only associations',async()=>{
 const w=harness(),cookie=await login(w),collection=w.load('src/app/api/products/route.ts');
 const create=()=>collection.POST(request('/api/products',{requestId:uuid,product:input,confirmed:true,createdBy:'spoofed'},'POST',cookie));const first=await create();assert.equal(first.status,201);const product=(await first.json()).product;assert.equal(product.createdBy,'editor');assert.equal((await create()).status,201);assert.equal(w.state.sheets.products.length,2);
 const list=await collection.GET(request('/api/products?q=Tea',undefined,'GET'));assert.equal((await list.json()).products.length,1);
 const suggestions=await w.load('src/app/api/products/suggestions/route.ts').POST(request('/api/products/suggestions',input));assert.equal((await suggestions.json()).suggestions[0].product.id,product.id);
 const duplicate=await collection.POST(request('/api/products',{requestId:uuid2,product:input,confirmed:true},'POST',cookie));assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).code,'duplicate_suggestions');
 const bulk=w.load('src/app/api/orders/[id]/product-links/route.ts');assert.equal((await (await bulk.GET(request('/api/orders/order/product-links',undefined,'GET'),{params:Promise.resolve({id:'order'})})).json()).links[0].productId,null);
 const linkApi=w.load('src/app/api/orders/[id]/items/[itemId]/product/route.ts');const old=w.state.sheets.order_items[1].slice(0,10);
 const linked=await linkApi.PATCH(request('/api/orders/order/items/item/product',{productId:product.id,revision:'initial',requestId:uuid2},'PATCH',cookie),itemParams);assert.equal(linked.status,200);assert.equal((await linked.json()).link.productId,product.id);assert.deepEqual(w.state.sheets.order_items[1].slice(0,10),old);
 const single=w.load('src/app/api/products/[id]/route.ts'),params={params:Promise.resolve({id:product.id})};const archived=await single.PATCH(request('/api/products/'+product.id,{requestId:uuid3,expectedUpdatedAt:product.updatedAt,product:{...input,active:false}},'PATCH',cookie),params);assert.equal(archived.status,200);assert.equal((await archived.json()).product.active,false);
 const lookup=await linkApi.GET(request('/api/orders/order/items/item/product',undefined,'GET'),itemParams);const body=await lookup.json();assert.equal(body.link.productId,product.id);assert.equal(body.product.active,false);assert.equal(w.state.sheets.orders.length,2);
});
test('explicit confirmation, immutable-field validation, body bounds, missing records and storage errors have safe HTTP responses',async()=>{
 const w=harness(),cookie=await login(w),collection=w.load('src/app/api/products/route.ts');
 for(const body of [{requestId:uuid,product:input},{requestId:uuid,product:{...input,id:'overwrite'},confirmed:true},{requestId:uuid,product:{...input,productName:'x'.repeat(20000)},confirmed:true}])assert.equal((await collection.POST(request('/api/products',body,'POST',cookie))).status,400);
 assert.equal(w.state.metadata.size,0);
 const get=await w.load('src/app/api/products/[id]/route.ts').GET(request('/api/products/missing',undefined,'GET'),{params:Promise.resolve({id:'missing'})});assert.equal(get.status,404);
 const link=w.load('src/app/api/orders/[id]/items/[itemId]/product/route.ts');const invalid=await link.PATCH(request('/api/orders/order/items/item/product',{productId:null,revision:'initial',requestId:'not-a-uuid'},'PATCH',cookie),itemParams);assert.equal(invalid.status,400);
 w.state.sheets.products[0][0]='wrong';const error=await collection.GET(request('/api/products',undefined,'GET'));assert.equal(error.status,503);assert.doesNotMatch(JSON.stringify(await error.json()),/kkkk|ssss|synthetic/);
});
test('sign-in rejects wrong keys, cross-origin requests and unconfigured access without logging or returning credentials',async()=>{
 const w=harness(),api=w.load('src/app/api/product-access/route.ts');for(const staffId of ['editor','absent']){const response=await api.POST(request('/api/product-access',{staffId,accessKey:'w'.repeat(43)}));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'Staff sign-in failed.'});}
 assert.equal((await api.POST(request('/api/product-access',{staffId:'editor',accessKey:'k'.repeat(43)},'POST','','https://attacker.test'))).status,403);
 const cookie=await login(w),logout=await api.DELETE(request('/api/product-access',undefined,'DELETE',cookie));assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 delete w.env.PRODUCT_MASTER_SESSION_SECRET;w.env.PRODUCT_MASTER_STAFF_KEYS_JSON='[]';assert.equal((await api.POST(request('/api/product-access',{staffId:'editor',accessKey:'k'.repeat(43)}))).status,503);assert.equal(w.state.compositions,0);
});

test('creation cancellation HTTP requires staff and confirmation, preserves created products, and forbids later retry',async()=>{
 const w=harness(),cookie=await login(w),api=w.load('src/app/api/products/creations/[requestId]/cancel/route.ts'),context={params:Promise.resolve({requestId:uuid})};
 assert.equal((await api.POST(request('/api/products/creations/'+uuid+'/cancel',{confirmed:true}),context)).status,401);
 assert.equal((await api.POST(request('/api/products/creations/'+uuid+'/cancel',{},'POST',cookie),context)).status,400);
 const response=await api.POST(request('/api/products/creations/'+uuid+'/cancel',{confirmed:true},'POST',cookie),context);assert.equal(response.status,200);assert.equal((await response.json()).outcome,'cancelled');
 const create=await w.load('src/app/api/products/route.ts').POST(request('/api/products',{requestId:uuid,product:input,confirmed:true},'POST',cookie));assert.equal(create.status,409);assert.equal((await create.json()).code,'creation_cancelled');assert.equal(w.state.sheets.products.length,1);
 const product=await w.products.create(uuid2,input,'editor',false);const retained=await api.POST(request('/api/products/creations/'+uuid2+'/cancel',{confirmed:true},'POST',cookie),{params:Promise.resolve({requestId:uuid2})});assert.equal((await retained.json()).product.id,product.id);assert.equal(w.state.sheets.products.length,2);
});
test('staff sessions cannot cross hosts/ports, insecure nonlocal writes, repeated cookies or invalid settings',async()=>{
 const w=harness(),cookie=await login(w),api=w.load('src/app/api/product-access/route.ts');
 for(const site of ['https://other.test','https://example.test:444']){const response=await api.GET(new Request(site+'/api/product-access',{headers:{Cookie:cookie}}));assert.equal((await response.json()).staff,null);}
 assert.equal((await (await api.GET(request('/api/product-access',undefined,'GET',cookie+'; '+cookie))).json()).staff,null);
 const insecure=await api.POST(new Request('http://example.test/api/product-access',{method:'POST',headers:{Origin:'http://example.test','Content-Type':'application/json'},body:JSON.stringify({staffId:'editor',accessKey:'k'.repeat(43)})}));assert.equal(insecure.status,403);
 const valid=JSON.parse(w.env.PRODUCT_MASTER_STAFF_KEYS_JSON);w.env.PRODUCT_MASTER_STAFF_KEYS_JSON=JSON.stringify([valid[0],{...valid[0],id:'second'}]);assert.equal((await api.GET(request('/api/product-access',undefined,'GET'))).status,503);assert.equal(w.state.compositions,0);
});
