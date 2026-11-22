import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto,createHash} from 'node:crypto';
import {ESLint} from 'eslint';
function load(file,globals={},imports={},source=readFileSync(file,'utf8')){
 const exports={};new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({exports,Error,Map,Set,Promise,JSON,BigInt,crypto:webcrypto,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;
}
const plain=value=>JSON.parse(JSON.stringify(value));
function storage(){const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
const path='/api/orders/order-1/items/7/product';
const input={mode:'create',expectedRevision:'1',product:{productCode:'P1',productName:'Chair',variant:'Blue'},useItemImage:true,confirmSimilar:false};
const saved=()=>Response.json({item:{itemId:'7',orderId:'order-1',revision:'2',product:{id:'1'}}},{status:201});
function browser(fetch,store=storage()){const globals={fetch,sessionStorage:store};const products=load('src/modules/products/browser.ts',globals);return{...load('src/modules/orders/ui/catalogue-api.ts',globals,{'@/modules/products/browser':products}),store};}
test('success and double click share one durable key; a new intentional operation gets a new identity',async()=>{
 let finish;const wait=new Promise(resolve=>finish=resolve),posts=[];
 const b=browser(async(url,init)=>{posts.push(init);await wait;return saved();});
 const a=b.saveItemCatalogue('order-1','7',input),c=b.saveItemCatalogue('order-1','7',input);assert.equal(a,c);assert.equal(posts.length,1);assert.match(posts[0].headers['Idempotency-Key'],/^product:/);assert.equal(posts[0].headers['x-stock-edit-protocol'],'row-v1');
 await assert.rejects(b.saveItemCatalogue('order-1','7',{...input,expectedRevision:'2'}),/different product/);
 finish();await a;assert.equal(b.pendingCatalogueRequest(path),null);
 await b.saveItemCatalogue('order-1','7',{...input,expectedRevision:'2'});assert.notEqual(posts[0].headers['Idempotency-Key'],posts[1].headers['Idempotency-Key']);
});
test('lost response survives reload; changed inputs are blocked; saved retry uses the identical body and key',async()=>{
 const store=storage(),requests=[];const old=browser(async(url,init)=>{requests.push(init);throw Error('lost');},store);
 await assert.rejects(old.saveItemCatalogue('order-1','7',input),/not confirmed/);
 const fresh=browser(async(url,init)=>{requests.push(init);return saved();},store);
 await assert.rejects(fresh.saveItemCatalogue('order-1','7',{...input,useItemImage:false}),/previous product operation/);assert.equal(requests.length,1);
 await fresh.retryItemCatalogue('order-1','7');assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);
});
test('uncertain catalogue edit/archive share the item recovery slot and remain retryable on reopening',async()=>{
 for(const method of ['PATCH','DELETE']){
  const store=storage(),calls=[],product={id:'9007199254740993',revision:'3'};
  const b=browser(async(url,init)=>{calls.push([url,init]);throw Error('lost');},store);
  await assert.rejects(method==='PATCH'?b.updateCatalogueProduct(product,input.product,path):b.archiveCatalogueProduct(product,path));
  await assert.rejects(b.saveItemCatalogue('order-1','7',input),/previous product operation/);
  const fresh=browser(async(url,init)=>{calls.push([url,init]);return Response.json({product:{...product,revision:'4'}});},store);
  await fresh.retryItemCatalogue('order-1','7');assert.equal(calls.length,2);assert.equal(calls[1][0],'/api/products/'+product.id);assert.equal(calls[1][1].method,method);assert.equal(calls[0][1].body,calls[1][1].body);assert.equal(calls[0][1].headers['Idempotency-Key'],calls[1][1].headers['Idempotency-Key']);assert.equal(fresh.pendingCatalogueRequest(path),null);
 }
});
test('unreadable or malformed success retains identity; storage failure prevents network writes',async()=>{
 for(const response of [new Response('bad'),Response.json({ok:true})]){const b=browser(async()=>response);await assert.rejects(b.saveItemCatalogue('order-1','7',input));assert.ok(b.pendingCatalogueRequest(path));}
 const b=browser(()=>assert.fail('Storage failure issued a write'),{getItem:()=>null,setItem(){throw Error('disabled');}});await assert.rejects(b.saveItemCatalogue('order-1','7',input),/session storage/);
});
test('known first-attempt rejection can be corrected; an uncertain retry rejection preserves the saved identity',async()=>{
 const b=browser(async()=>Response.json({error:'Review similar products',code:'product_similar'},{status:409}));await assert.rejects(b.saveItemCatalogue('order-1','7',input),/similar/);assert.equal(b.pendingCatalogueRequest(path),null);
 const store=storage(),old=browser(async()=>{throw Error('lost');},store);await assert.rejects(old.saveItemCatalogue('order-1','7',input));
 const next=browser(async()=>Response.json({error:'Conflict'},{status:409}),store);await assert.rejects(next.retryItemCatalogue('order-1','7'));assert.ok(next.pendingCatalogueRequest(path));
});
test('input validation preserves bigint precision and rejects unsafe identities',()=>{
 const v=load('src/modules/products/domain/validation.ts');assert.equal(v.productId('9007199254740993'),'9007199254740993');assert.throws(()=>v.productId(7));assert.throws(()=>v.productId('9223372036854775808'));assert.throws(()=>v.productId('1; DROP TABLE products'));assert.throws(()=>v.revision('01'));assert.throws(()=>v.productInput({...input.product,productName:'  '}));assert.deepEqual(plain(v.productInput({...input.product,productName:' Chair '})),input.product);
});
test('create/link always select server-owned item media and protect the exact item row',async()=>{
 const item={id:'7',orderId:'o',productCode:'Original',imageMediaId:'trusted-media',imageUrl:'trusted-url',productId:null,revision:'5'};let created,linked;
 const service=load('src/modules/orders/application/product-catalogue.ts').orderItemCatalogue({read:async()=>item,link:async(row,id)=>{linked=[row,id];return true;}},{find:async()=>undefined,create:async value=>{created=value;return{id:'9007199254740993'};}});
 await assert.rejects(service.save('o','7',{...input,expectedRevision:'4'}),/changed/);assert.equal(created,undefined);
 await service.save('o','7',{...input,expectedRevision:'5',referenceImageMediaId:'untrusted-media'});assert.equal(created.referenceImageMediaId,'trusted-media');assert.equal(linked[0],item);assert.equal(linked[1],'9007199254740993');assert.equal(item.productCode,'Original');
});
test('new owner boundaries reject server/provider imports and allow only the documented public product contract',async()=>{
 const eslint=new ESLint();const cases=[['src/modules/orders/application/product-catalogue.ts',"import type {X} from '@/modules/products/infrastructure/postgres/catalogue';"],['src/modules/products/application/catalogue.ts',"import {x} from '@/config';"],['src/modules/products/domain/validation.ts',"import {x} from 'node:fs';"]];
 for(const [filePath,source]of cases){const [result]=await eslint.lintText(source,{filePath});assert.ok(result.messages.some(m=>m.ruleId==='no-restricted-imports'),filePath);}
 const [ok]=await eslint.lintText("import type { Product } from '@/modules/products/contracts'; export type P = Product;",{filePath:'src/modules/orders/application/ports/product-catalogue.ts'});assert.equal(ok.errorCount,0);
});

test('Product Master shares durable identities while keeping pending operations independent of item forms',async()=>{
 const store=storage(),posts=[];const original=load('src/modules/products/browser.ts',{sessionStorage:store,fetch:async(url,init)=>{posts.push(init);throw Error('lost');}});
 await assert.rejects(original.updateCatalogueProduct({id:'1',revision:'3'},input.product,'product-master'));
 const fresh=load('src/modules/products/browser.ts',{sessionStorage:store,fetch:async(url,init)=>{posts.push(init);return Response.json({product:{id:'1',revision:'4'}});}});
 await assert.rejects(fresh.updateCatalogueProduct({id:'2',revision:'1'},input.product,'product-master'),/previous product operation/);
 await fresh.retryCatalogueRequest('product-master');assert.equal(posts.length,2);assert.equal(posts[0].body,posts[1].body);assert.equal(posts[0].headers['Idempotency-Key'],posts[1].headers['Idempotency-Key']);assert.equal(fresh.pendingCatalogueRequest('product-master'),null);
});


test('a pending request from the pre-menu browser replays unchanged through the Products-owned client',async()=>{
 const witness=JSON.parse(readFileSync('tests/fixtures/product-browser-owner-before.json','utf8'));assert.equal(createHash('sha256').update(witness.source).digest('hex'),witness.sha256);
 const store=storage(),posts=[];const old=load('previous.ts',{sessionStorage:store,fetch:async(url,init)=>{posts.push(init);throw Error('lost');}},{},witness.source);
 await assert.rejects(old.saveItemCatalogue('order-1','7',input));
 const next=browser(async(url,init)=>{posts.push(init);return saved();},store);await next.retryItemCatalogue('order-1','7');
 assert.equal(posts[0].body,posts[1].body);assert.equal(posts[0].headers['Idempotency-Key'],posts[1].headers['Idempotency-Key']);assert.equal(next.pendingCatalogueRequest(path),null);
});
