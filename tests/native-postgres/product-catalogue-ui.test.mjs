import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,{imports={},globals={},source=readFileSync(file,'utf8')}={}){
 const exports={};const code=ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new vm.Script(code).runInNewContext({exports,Error,Promise,AbortController,JSON,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;
}
const {componentHarness,elements}=load('tests/helpers/component-harness.mjs',{source:readFileSync('tests/helpers/component-harness.mjs','utf8').replace(/^import .*;\n/gm,''),globals:{readFileSync,dirname,resolve,ts,canonicalPath:path=>path,loadSource:load}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const product={id:'1',productName:'Blue chair',productCode:'CHAIR',variant:'Blue',revision:'4',imageUrl:'/synthetic.svg',deletedAt:null};
const original={itemId:'7',orderId:'o',productCode:'ORIGINAL',imageUrl:'/synthetic.svg',revision:'8',product};
class RequestError extends Error{constructor(message,code,uncertain=false){super(message);this.code=code;this.uncertain=uncertain;}}
function setup(initial=original,overrides={}){
 let current=structuredClone(initial),pending=null;const calls=[];
 const api={CatalogueRequestError:RequestError,itemCataloguePath:()=>'/item-scope',pendingCatalogueRequest:()=>pending,readItemCatalogue:async()=>({item:structuredClone(current)}),searchCatalogue:async()=>({products:[structuredClone(product)]}),updateCatalogueProduct:async(p,input,scope)=>{calls.push({type:'update',product:plain(p),input:plain(input),scope});current.product={...p,...input,revision:'5'};},saveItemCatalogue:async(o,id,input)=>{calls.push({type:'link',input:plain(input)});current={...current,product:input.mode==='create'?{...product,...input.product}:input.productId?product:null,revision:'9'};},retryItemCatalogue:async()=>{calls.push({type:'retry',key:pending.key});pending=null;current={...current,product};},archiveCatalogueProduct:async()=>{},...overrides};
 const h=componentHarness('src/modules/orders/ui/OrderItemCatalogue.tsx',{load:(file,options)=>load(file,{...options,imports:{...options.imports,'./catalogue-api':api}})});
 const props={orderId:'o',itemId:'7',productCode:'ORIGINAL',onSaved:async()=>calls.push({type:'parent-refresh'}),reloadVersion:0};
 let tree=h.mount(h.module.OrderItemCatalogue,props);
 return{h,api,calls,props,get tree(){tree=h.render();return tree;},setCurrent(v){current=structuredClone(v);},setPending(v){pending=v;h.render(h.module.OrderItemCatalogue,{...props,reloadVersion:1});},async ready(){await flush();tree=h.render();return tree;},async click(name){const button=elements(this.tree,'Button').find(b=>b.props.children===name||b.props['aria-label']===name);assert.ok(button,'Missing button '+name);button.props.onClick();await flush();tree=h.render();return tree;}};
}
test('a linked item shows its product link without an open form; clicking opens only the prefilled edit popup',async()=>{
 const b=setup();await b.ready();assert.equal(elements(b.tree,'Modal').length,0);assert.ok(elements(b.tree,'Button').some(x=>x.props['aria-label']==='Edit product: Blue chair'));assert.equal(elements(b.tree,'Input').length,0);
 await b.click('Edit product: Blue chair');const modal=elements(b.tree,'Modal')[0];assert.equal(modal.props.title,'Edit product');assert.deepEqual(plain(elements(b.tree,'Input').map(i=>i.props.value)),['Blue chair','CHAIR','Blue']);assert.equal(elements(b.tree,'Input.Search').length,0);assert.equal(elements(b.tree,'Checkbox').length,0);
});
test('an unlinked item starts with a chooser and reveals creation fields only after Create new product',async()=>{
 const b=setup({...original,product:null});await b.ready();await b.click('Link product');assert.equal(elements(b.tree,'Modal')[0].props.title,'Link product');assert.equal(elements(b.tree,'Input').length,0);
 await b.click('Create new product');assert.equal(elements(b.tree,'Modal')[0].props.title,'Create product');assert.deepEqual(plain(elements(b.tree,'Input').map(i=>i.props.value)),['','ORIGINAL','']);
});
test('saving an edit closes the popup and updates the inline product link; Cancel issues no write',async()=>{
 const b=setup();await b.ready();await b.click('Edit product: Blue chair');elements(b.tree,'Input')[0].props.onChange({target:{value:'Green chair'}});
 const save=elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Save product');save.props.onClick();await b.ready();assert.equal(elements(b.tree,'Modal').length,0);assert.ok(elements(b.tree,'Button').some(x=>x.props['aria-label']==='Edit product: Green chair'));assert.deepEqual(b.calls[0],{type:'update',product, input:{productCode:'CHAIR',productName:'Green chair',variant:'Blue'},scope:'/item-scope'});
 await b.click('Edit product: Green chair');elements(b.tree,'Modal')[0].props.onCancel();assert.equal(b.calls.filter(c=>c.type==='update').length,1);
});
test('a background label refresh does not retarget an open edit to a newer revision',async()=>{
 const b=setup();await b.ready();await b.click('Edit product: Blue chair');b.setCurrent({...original,product:{...product,revision:'99',productName:'Concurrent edit'}});b.h.render(b.h.module.OrderItemCatalogue,{...b.props,reloadVersion:1});await b.ready();
 assert.equal(elements(b.tree,'Input')[0].props.value,'Blue chair');elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Save product').props.onClick();await b.ready();assert.equal(b.calls[0].product.revision,'4');
});
test('pending saves reopen a recovery-only popup and retry the original request',async()=>{
 const b=setup();b.setPending({key:'original-product-key'});await b.ready();await b.click('Review pending product change');assert.equal(elements(b.tree,'Modal')[0].props.title,'Confirm previous product change');assert.equal(elements(b.tree,'Input').length,0);
 const retry=elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Retry saved request');retry.props.onClick();await b.ready();assert.deepEqual(b.calls[0],{type:'retry',key:'original-product-key'});assert.equal(elements(b.tree,'Modal').length,0);
});
test('a stale product requires explicit reload; it never silently adopts a new revision with the old draft',async()=>{
 const b=setup(original,{updateCatalogueProduct:async()=>{throw new RequestError('Changed','product_revision_conflict');}});await b.ready();await b.click('Edit product: Blue chair');elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Save product').props.onClick();await b.ready();assert.ok(elements(b.tree,'Input').every(x=>x.props.disabled));
 b.setCurrent({...original,product:{...product,revision:'99',productName:'Latest chair'}});const reload=elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Reload latest values');assert.ok(reload);reload.props.onClick();await b.ready();assert.equal(elements(b.tree,'Input')[0].props.value,'Latest chair');
});
test('an acknowledged save followed by a failed refresh offers a read-only refresh, not another creation',async()=>{
 let reads=0;const b=setup(original,{readItemCatalogue:async()=>{if(++reads>=3)throw Error('network');return{item:structuredClone(original)};}});await b.ready();await b.click('Edit product: Blue chair');elements(b.tree,'Modal')[0].props.footer.props.children.find(x=>x?.props.children==='Save product').props.onClick();await b.ready();assert.equal(elements(b.tree,'Input').length,0);assert.ok(elements(b.tree,'Modal')[0].props.footer.props.children.some(x=>x?.props.children==='Refresh saved product'));
});
