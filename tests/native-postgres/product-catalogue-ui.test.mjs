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
const other={...product,id:'2',productName:'Green chair',productCode:'GREEN',variant:'Green'};
function setup(initial=original,overrides={}){
 let current=structuredClone(initial),pending=null;const calls=[];
 const api={CatalogueRequestError:RequestError,itemCataloguePath:()=>'/item-scope',pendingCatalogueRequest:()=>pending,readItemCatalogue:async()=>({item:structuredClone(current)}),searchCatalogue:async q=>{calls.push({type:'search',query:q});return{products:[structuredClone(product),structuredClone(other)]};},updateCatalogueProduct:async()=>{throw Error('Item selection must not edit a catalogue product');},saveItemCatalogue:async(o,id,input)=>{calls.push({type:'link',input:plain(input)});current={...current,product:input.mode==='create'?{...product,...input.product}:input.productId===other.id?other:input.productId?product:null,revision:'9'};},retryItemCatalogue:async()=>{calls.push({type:'retry',key:pending.key});pending=null;current={...current,product};},archiveCatalogueProduct:async()=>{throw Error('Item selection must not archive a catalogue product');},...overrides};
 const h=componentHarness('src/modules/orders/ui/OrderItemCatalogue.tsx',{load:(file,options)=>load(file,{...options,imports:{...options.imports,'./catalogue-api':api}})});
 const props={orderId:'o',itemId:'7',productCode:'ORIGINAL',onSaved:async()=>calls.push({type:'parent-refresh'}),reloadVersion:0};
 h.mount(h.module.OrderItemCatalogue,props);
 return{h,api,calls,props,get tree(){return h.render();},setCurrent(v){current=structuredClone(v);},setPending(v){pending=v;h.render(h.module.OrderItemCatalogue,{...props,reloadVersion:1});},async ready(){await flush();return this.tree;},async click(name){const button=elements(this.tree,'Button').find(b=>b.props.children===name||b.props['aria-label']===name);assert.ok(button,'Missing button '+name);button.props.onClick();await flush();return this.tree;}};
}
const footer=(b,name)=>{const modal=elements(b.tree,'Modal')[0],children=modal.props.footer.props.children;const button=(Array.isArray(children)?children:[children]).find(v=>v?.props.children===name);assert.ok(button,name);return button;};
const select=b=>elements(b.tree,'Select')[0];
const open=async b=>{await b.ready();await b.click('Change linked product: Blue chair');};
test('the item pencil opens a dropdown with the current product selected, not a catalogue editor',async()=>{
 const b=setup();await b.ready();assert.equal(elements(b.tree,'Modal').length,0);await open(b);
 assert.equal(elements(b.tree,'Modal')[0].props.title,'Select linked product');assert.equal(select(b).props.value,'1');assert.deepEqual(plain(select(b).props.options.map(o=>o.value)),['1','2']);assert.equal(elements(b.tree,'Input').length,0);assert.equal(elements(b.tree,'Checkbox').length,0);assert.ok(footer(b,'Save link').props.disabled);assert.equal(b.calls.some(c=>c.type==='link'),false);
});
test('selecting another product waits for Save link, changes only the item link and closes the popup',async()=>{
 const b=setup();await open(b);select(b).props.onChange('2');assert.equal(b.calls.some(c=>c.type==='link'),false);assert.equal(footer(b,'Save link').props.disabled,false);footer(b,'Save link').props.onClick();await b.ready();assert.equal(elements(b.tree,'Modal').length,0);assert.deepEqual(b.calls.find(c=>c.type==='link'),{type:'link',input:{mode:'link',productId:'2',expectedRevision:'8'}});assert.ok(elements(b.tree,'Button').some(x=>x.props['aria-label']==='Change linked product: Green chair'));
});
test('Cancel discards a draft selection without writes and reopens with the saved link',async()=>{
 const b=setup();await open(b);select(b).props.onChange('2');footer(b,'Cancel').props.onClick();assert.equal(elements(b.tree,'Modal').length,0);await b.click('Change linked product: Blue chair');assert.equal(select(b).props.value,'1');assert.equal(b.calls.some(c=>c.type==='link'),false);
});
test('an unlinked item opens the same dropdown; product creation stays an explicit separate step',async()=>{
 const b=setup({...original,product:null});await b.ready();await b.click('Link product');assert.equal(elements(b.tree,'Modal')[0].props.title,'Select linked product');assert.equal(select(b).props.value,undefined);assert.ok(footer(b,'Save link').props.disabled);assert.equal(elements(b.tree,'Input').length,0);
 await b.click('Create new product');assert.equal(elements(b.tree,'Select').length,0);assert.equal(elements(b.tree,'Modal')[0].props.title,'Create product');assert.deepEqual(plain(elements(b.tree,'Input').map(i=>i.props.value)),['','ORIGINAL','']);footer(b,'Choose existing product').props.onClick();await b.ready();assert.ok(select(b));
});
test('a background label refresh does not advance the open selector item revision',async()=>{
 const b=setup();await open(b);select(b).props.onChange('2');b.setCurrent({...original,revision:'99',product:other});b.h.render(b.h.module.OrderItemCatalogue,{...b.props,reloadVersion:1});await b.ready();assert.equal(select(b).props.value,'2');footer(b,'Save link').props.onClick();await b.ready();assert.equal(b.calls.find(c=>c.type==='link').input.expectedRevision,'8');
});
test('pending requests from the previous item editor reopen recovery only and replay unchanged',async()=>{
 const b=setup();b.setPending({key:'original-product-key',path:'/api/products/1',method:'PATCH'});await b.ready();await b.click('Review pending product change');assert.equal(elements(b.tree,'Modal')[0].props.title,'Confirm previous product change');assert.equal(elements(b.tree,'Input').length,0);assert.equal(elements(b.tree,'Select').length,0);footer(b,'Retry saved request').props.onClick();await b.ready();assert.deepEqual(b.calls.find(c=>c.type==='retry'),{type:'retry',key:'original-product-key'});assert.equal(elements(b.tree,'Modal').length,0);
});
test('a link conflict requires explicit reload and discards the old draft selection',async()=>{
 const b=setup(original,{saveItemCatalogue:async()=>{throw new RequestError('Changed','product_revision_conflict');}});await open(b);select(b).props.onChange('2');footer(b,'Save link').props.onClick();await b.ready();assert.ok(select(b).props.disabled);b.setCurrent({...original,revision:'99'});footer(b,'Reload latest values').props.onClick();await b.ready();assert.equal(select(b).props.value,'1');assert.ok(footer(b,'Save link').props.disabled);
});
test('an uncertain link save hides the dropdown and offers the saved request only',async()=>{
 const b=setup(original,{saveItemCatalogue:async()=>{throw new RequestError('Uncertain',undefined,true);}});await open(b);select(b).props.onChange('2');footer(b,'Save link').props.onClick();await b.ready();assert.equal(elements(b.tree,'Select').length,0);assert.ok(footer(b,'Retry saved request'));
});
test('an acknowledged link save followed by failed refresh offers a read, not another link mutation',async()=>{
 let reads=0;const b=setup(original,{readItemCatalogue:async()=>{if(++reads>=3)throw Error('network');return{item:structuredClone(original)};}});await open(b);select(b).props.onChange('2');footer(b,'Save link').props.onClick();await b.ready();assert.equal(elements(b.tree,'Select').length,0);assert.ok(footer(b,'Refresh saved product'));assert.equal(b.calls.filter(c=>c.type==='link').length,1);
});
test('remote dropdown search ignores out-of-order results and keeps the selected product label',async()=>{
 let first,second;const b=setup(original,{searchCatalogue:q=>q==='a'?new Promise(resolve=>{first=resolve;}):q==='b'?new Promise(resolve=>{second=resolve;}):Promise.resolve({products:[product]})});await open(b);select(b).props.showSearch.onSearch('a');select(b).props.showSearch.onSearch('b');second({products:[other]});await b.ready();first({products:[]});await b.ready();assert.deepEqual(plain(select(b).props.options.map(o=>o.value)),['1','2']);assert.equal(select(b).props.value,'1');assert.equal(select(b).props.loading,false);
});
test('an archived current link remains visible but cannot be newly selected or silently saved',async()=>{
 const b=setup({...original,product:{...product,deletedAt:'2026-11-22T00:00:00Z'}});await open(b);assert.equal(select(b).props.value,'1');assert.ok(select(b).props.options.find(o=>o.value==='1').disabled);assert.ok(footer(b,'Save link').props.disabled);
});
