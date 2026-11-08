import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,uuid,uuid2,uuid3,input,plain} from './helpers/product-master.mjs';
test('Product Master create/search/edit/archive preserve immutable identity, timestamps and nonunique codes',async()=>{
 const w=harness(),first=await w.products.create(uuid,input,'staff',false);assert.equal(first.id,`PROD-${uuid}`);assert.equal(first.productName,'Tea');
 assert.equal((await w.products.search('dup large')).length,1);assert.equal((await w.products.suggest(input))[0].product.id,first.id);
 await assert.rejects(w.products.create(uuid2,{...input,variant:'Small'},'staff',false),error=>error.name==='ProductDuplicatesError'&&error.suggestions.length===1);
 const second=await w.products.create(uuid2,{...input,variant:'Small'},'staff',true);assert.notEqual(second.id,first.id);assert.equal(second.productCode,first.productCode);
 const edited=await w.products.edit({id:first.id,values:{...input,productName:'Tea renamed',active:false},expectedUpdatedAt:first.updatedAt,requestId:uuid3});
 assert.equal(edited.createdBy,'staff');assert.equal(edited.createdAt,first.createdAt);assert.equal(edited.id,first.id);assert.equal(edited.active,false);assert.ok(edited.updatedAt>first.updatedAt);
 assert.equal((await w.products.search('')).length,1);assert.equal((await w.products.search('',true)).length,2);
});
test('creation retry and ambiguous outcomes reuse one permanent product without appending duplicates',async()=>{
 for(const mode of ['normal','commit-timeout','timeout-before']){const w=harness();w.state.mode=mode;if(mode==='timeout-before')await assert.rejects(w.products.create(uuid,input,'staff',false),/outcome is not yet confirmed/);else await w.products.create(uuid,input,'staff',false);w.state.mode='normal';await w.products.create(uuid,input,'staff',false);assert.equal(w.state.sheets.products.length,2);await assert.rejects(w.products.create(uuid,{...input,productName:'Changed'},'staff',false),/different details/);assert.equal(w.state.sheets.products.length,2);}
});
test('independent simultaneous creation attempts are guarded by one atomic provider metadata constraint',async()=>{
 const w=harness();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let first=true;w.state.gate=async()=>{if(first){first=false;entered();await gate;}};
 const a=w.products.create(uuid,input,'staff',false);await started;const b=await w.products.create(uuid,input,'staff',false);release();assert.equal((await a).id,b.id);assert.equal(w.state.sheets.products.length,2);
});
test('link, relink, remove and retry never rewrite legacy A–J; archival preserves existing Orders and associations',async()=>{
 const w=harness(),before=plain(w.state.sheets.order_items[1].slice(0,10)),product=await w.products.create(uuid,input,'staff',false);
 const link=await w.save({revision:'initial',productId:product.id,requestId:uuid2});assert.equal(link.productId,product.id);
 const unlinked=await w.save({revision:link.revision,productId:null,requestId:uuid3});assert.equal(unlinked.productId,null);
 const retried=await w.save({revision:'initial',productId:product.id,requestId:uuid2});assert.equal(retried.productId,null,'A late retry must not restore a removed link');
 assert.deepEqual(w.state.sheets.order_items[1].slice(0,10),before);assert.equal(w.state.sheets.orders.length,2);
 await w.products.edit({id:product.id,values:{...input,active:false},expectedUpdatedAt:product.updatedAt,requestId:uuid2});
 await assert.rejects(w.save({revision:unlinked.revision,productId:product.id,requestId:uuid}),/active Product/);
});
test('link partial failure retains the created product and retries only the association',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);w.state.mode='timeout-before';await assert.rejects(w.save({revision:'initial',productId:product.id,requestId:uuid2}),/outcome is not yet confirmed/);assert.equal(w.state.sheets.products.length,2);w.state.mode='normal';await w.save({revision:'initial',productId:product.id,requestId:uuid2});assert.equal(w.state.sheets.products.length,2);assert.equal(w.state.sheets.order_items[1][10],product.id);
});
test('invalid inputs, product identity reuse, corrupt headers and duplicate rows fail without storage rewrites',async()=>{
 const w=harness();for(const value of [{...input,productName:''},{...input,referenceImageUrl:'javascript:alert(1)'},{...input,referenceImageUrl:'https://u:p@example.test'},{...input,productCode:1}])await assert.rejects(w.products.create(uuid,value,'staff',false));assert.equal(w.state.metadata.size,0);
 const product=await w.products.create(uuid,input,'staff',false);w.state.sheets.products.push([...w.state.sheets.products[1]]);await assert.rejects(w.products.search(''),/duplicate records/);assert.equal(w.state.sheets.products.length,3);assert.equal(product.id,`PROD-${uuid}`);
});

test('cancellation durably prevents a late ambiguous creation, while an already-created product is retained',async()=>{
 const w=harness();let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);let first=true;w.state.gate=async()=>{if(first){first=false;enter();await gate;}};
 const pending=w.products.create(uuid,input,'staff',false).then(product=>({product}),error=>({error}));await entered;
 const cancelled=await w.products.cancelCreation(uuid,'staff');assert.equal(cancelled.outcome,'cancelled');release();const result=await pending;assert.ok(result.error);assert.equal(w.state.sheets.products.length,1);
 await assert.rejects(w.products.create(uuid,input,'staff',true),error=>error.name==='ProductCreationCancelledError');assert.equal((await w.products.cancelCreation(uuid,'staff')).outcome,'cancelled');
 const product=await w.products.create(uuid2,input,'staff',false),known=await w.products.cancelCreation(uuid2,'staff');assert.equal(known.outcome,'created');assert.equal(known.product.id,product.id);assert.equal(w.state.sheets.products.length,2);
});
test('stale edits and simultaneous link selections cannot overwrite newer state; successful retries return current state',async()=>{
 const w=harness(),first=await w.products.create(uuid,input,'staff',false),second=await w.products.create(uuid2,{...input,productCode:'OTHER',productName:'Other Tea'},'staff',false);
 const changed=await w.products.edit({id:first.id,values:{...input,productName:'New name',active:true},expectedUpdatedAt:first.updatedAt,requestId:uuid2});
 await assert.rejects(w.products.edit({id:first.id,values:{...input,active:false},expectedUpdatedAt:first.updatedAt,requestId:uuid3}),/different details|Refresh/);
 assert.equal((await w.products.findById(first.id)).productName,changed.productName);
 const results=await Promise.allSettled([w.save({revision:'initial',requestId:uuid,productId:first.id}),w.save({revision:'initial',requestId:uuid2,productId:second.id})]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);assert.equal(w.state.sheets.order_items[1][10],results.find(result=>result.status==='fulfilled').value.productId);
});
test('a product row without its durable creation history is never appended a second time',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);w.state.metadata.clear();await assert.rejects(w.products.create(uuid,input,'staff',false),/creation history is unavailable/);assert.equal(w.state.sheets.products.length,2);assert.equal(w.state.sheets.products[1][0],product.id);
});

test('reusing a request ID cannot form association-history cycles or reapply an edit to a newer revision',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);
 const linked=await w.save({revision:'initial',requestId:uuid2,productId:product.id});
 await assert.rejects(w.save({revision:linked.revision,requestId:uuid2,productId:null}),/new request ID/);
 const unlinked=await w.save({revision:linked.revision,requestId:uuid3,productId:null});
 await assert.rejects(w.save({revision:unlinked.revision,requestId:uuid2,productId:product.id}),/different details|Refresh/);assert.equal((await w.links.read('order','item')).productId,null);
 const edit=await w.products.edit({id:product.id,values:{...input,active:true},expectedUpdatedAt:product.updatedAt,requestId:uuid2});
 await assert.rejects(w.products.edit({id:product.id,values:{...input,active:false},expectedUpdatedAt:edit.updatedAt,requestId:uuid2}),/different details|Refresh/);assert.equal((await w.products.findById(product.id)).active,true);
});

test('atomic transport preserves literal cells, fixed guard IDs, and fails closed on provider rejection or metadata collisions',async()=>{
 const w=harness(),guard=w.load('src/infrastructure/persistence/google-sheets/guarded-write.ts');
 const literal={...input,productCode:'001',productName:'=literal',variant:' +one '};
 const product=await w.products.create(uuid,literal,'staff',false);assert.equal(product.productCode,'001');assert.equal(product.productName,'=literal');
 const commit=w.events.find(event=>event[0]==='commit')[1];assert.equal(commit.requests.length,2);assert.ok(commit.requests[0].createDeveloperMetadata);assert.ok(commit.requests[1].appendCells);assert.equal(commit.requests[1].appendCells.rows[0].values[1].userEnteredValue.stringValue,'001');
 const expected=guard.guardMetadataId('collision','id');w.state.metadata.set(expected,{metadataId:expected,metadataKey:'another-operation',metadataValue:'{}'});
 await assert.rejects(guard.guardedWrite(w.client,{key:'collision',identity:'id',fingerprint:guard.stableFingerprint(['safe'])},[]),/collision/);assert.equal(w.state.sheets.products.length,2);
 const count=w.state.metadata.size;w.state.mode='provider-error';await assert.rejects(w.products.create(uuid2,{...input,productCode:'OTHER',productName:'Other'},'staff',false),/outcome is not yet confirmed/);assert.equal(w.state.metadata.size,count);assert.equal(w.state.sheets.products.length,2);
 w.state.mode='normal';await w.products.create(uuid2,{...input,productCode:'OTHER',productName:'Other'},'staff',false);assert.equal(w.state.sheets.products.length,3);
});
test('a lost successful link response is recovered across independent service instances with one K write',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);w.state.mode='commit-timeout';
 const first=await w.save({revision:'initial',requestId:uuid2,productId:product.id});assert.equal(first.productId,product.id);
 w.state.mode='normal';const next=w.load('src/modules/orders/product-link-server.ts').createOrderProductLinkService(w.client,{orders:'orders',orderItems:'order_items'},w.products);
 const again=await next.save({orderId:'order',itemId:'item',revision:'initial',requestId:uuid2,productId:product.id});assert.equal(again.productId,product.id);
 assert.equal(w.events.filter(event=>event[0]==='commit'&&event[1].requests.some(request=>request.updateCells?.range.startColumnIndex===10)).length,1);
});
