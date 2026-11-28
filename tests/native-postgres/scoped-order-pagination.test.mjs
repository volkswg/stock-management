import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {dirname,resolve} from 'node:path';
function load(file,{imports={},globals={},source=readFileSync(file,'utf8')}={}){
 const exports={};new vm.Script(ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText).runInNewContext({exports,URL,URLSearchParams,Error,AbortController,Promise,setTimeout,clearTimeout,...globals,require(name){assert.ok(Object.hasOwn(imports,name),name);return imports[name];}});return exports;
}
const {componentHarness,elements}=load('tests/helpers/component-harness.mjs',{source:readFileSync('tests/helpers/component-harness.mjs','utf8').replace(/^import .*;\n/gm,''),globals:{readFileSync,dirname,resolve,ts,canonicalPath:path=>path,loadSource:load}});
const data=Array.from({length:135},(_,n)=>({id:`order-${n}`,seller:n%2?'Thai ไทย':'Other',createdBy:'web',status:n%3?'complete':'draft',shipmentId:n%2?'SHIP':null,createdAt:'2026-11-01',totalPrice:10,productImages:[]}));
const plain=x=>JSON.parse(JSON.stringify(x));
function result(q){
 const matching=data.filter(o=>(!q.query||[o.id,o.seller,o.createdBy].some(s=>s.toLowerCase().includes(q.query.trim().toLowerCase())))&&(q.status==='all'||(q.status==='completed'?o.status==='complete':o.status==='draft'))&&(q.shipmentLink==='all'||(q.shipmentLink==='linked'?!!o.shipmentId:!o.shipmentId)));
 const page=Math.min(q.page,Math.max(1,Math.ceil(matching.length/q.pageSize)));
 return {orders:matching.slice((page-1)*q.pageSize,page*q.pageSize),total:matching.length,page,pageSize:q.pageSize};
}
function setup(href='https://example.invalid/orders',request=async q=>result(q)){
 let url=new URL(href);const listeners=new Map(),calls=[],historyState={keep:true};
 const window={get location(){return{href:url.href};},history:{state:historyState,replaceState(state,_title,next){assert.equal(state,historyState);url=new URL(next);}},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n)=>listeners.delete(n)};
 const h=componentHarness('src/modules/orders/ui/OrderListPage.tsx',{load,globals:{window},api:{getOrderPage:(q,signal)=>{calls.push({query:plain(q),signal});return request(q,signal);}}});h.mount(h.module.OrderListPage);
 const tree=()=>h.render(),controls=()=>elements(tree(),'Pagination'),rows=()=>plain(elements(tree(),'Table')[0].props.dataSource);
 return{h,tree,controls,rows,calls,listeners,get href(){return url.href;},navigate(href){url=new URL(href);listeners.get('popstate')();},async settle(){for(let i=0;i<5;i++){tree();await new Promise(resolve=>setImmediate(resolve));}}};
}
test('current page fetches only its requested slice; top/bottom size changes stay synchronized and survive refresh',async()=>{
 const b=setup('https://example.invalid/orders?page=2&pageSize=20&keep=yes#list');await b.settle();
 assert.equal(b.calls.length,1);assert.equal(b.calls[0].query.page,2);assert.equal(b.rows().length,20);assert.equal(b.rows()[0].id,'order-20');assert.equal(elements(b.tree(),'OrderMobileCard').length,20);
 b.controls()[1].props.onChange(3,20);await b.settle();assert.ok(b.controls().every(c=>c.props.current===3));assert.equal(b.rows()[0].id,'order-40');
 b.controls()[0].props.onChange(1,50);await b.settle();assert.ok(b.controls().every(c=>c.props.pageSize===50&&c.props.current===1&&c.props.responsive));assert.equal(b.rows().length,50);
 assert.equal(new URL(b.href).searchParams.get('pageSize'),'50');assert.equal(new URL(b.href).searchParams.get('keep'),'yes');assert.equal(new URL(b.href).hash,'#list');
 const url=b.href;b.h.unmount();const refreshed=setup(url);await refreshed.settle();assert.deepEqual(refreshed.rows(),b.rows());assert.equal(refreshed.calls[0].query.pageSize,50);refreshed.h.unmount();
});
test('server clamping, empty results and popstate restore page/size without a duplicate clamp request',async()=>{
 const b=setup('https://example.invalid/orders?page=999&pageSize=20');await b.settle();assert.equal(b.controls()[0].props.current,7);assert.equal(b.rows().length,15);assert.equal(b.calls.length,1);assert.equal(new URL(b.href).searchParams.get('page'),'7');
 b.navigate('https://example.invalid/orders?page=2&pageSize=50');await b.settle();assert.equal(b.rows()[0].id,'order-50');assert.ok(b.controls().every(c=>c.props.current===2&&c.props.pageSize===50));b.h.unmount();
 const empty=setup('https://example.invalid/orders?page=9',async q=>({orders:[],total:0,page:1,pageSize:q.pageSize}));await empty.settle();assert.equal(empty.rows().length,0);assert.equal(empty.controls()[0].props.current,1);assert.equal(new URL(empty.href).searchParams.has('page'),false);empty.h.unmount();
});
test('search is debounced and all filters are server requests, reset page and retain the chosen page size',async()=>{
 const b=setup('https://example.invalid/orders?page=3&pageSize=20');await b.settle();
 elements(b.tree(),'Input')[0].props.onChange({target:{value:'ไทย'}});b.tree();await b.settle();assert.equal(b.calls.length,1);
 await new Promise(resolve=>setTimeout(resolve,270));await b.settle();assert.equal(b.calls.at(-1).query.query,'ไทย');assert.equal(b.calls.at(-1).query.page,1);assert.equal(b.calls.at(-1).query.pageSize,20);assert.equal(b.controls()[0].props.total,67);
 elements(b.tree(),'Tabs')[0].props.onChange('completed');await b.settle();assert.equal(b.calls.at(-1).query.status,'completed');assert.ok(b.rows().every(o=>o.status==='complete'));
 elements(b.tree(),'Select')[0].props.onChange('linked');await b.settle();assert.equal(b.calls.at(-1).query.shipmentLink,'linked');assert.ok(b.rows().every(o=>o.shipmentId));b.h.unmount();
});
test('failed loads preserve the requested URL and retry the same page; returning to a previous page refetches',async()=>{
 let fail=true;const b=setup('https://example.invalid/orders?page=3&pageSize=20',async q=>{if(fail)throw Error('Offline');return result(q);});await b.settle();assert.equal(new URL(b.href).searchParams.get('page'),'3');assert.equal(b.rows().length,0);
 fail=false;elements(b.tree(),'Button').find(c=>c.props.children==='Retry').props.onClick();await b.settle();assert.equal(b.rows()[0].id,'order-40');
 b.controls()[0].props.onChange(1,20);await b.settle();b.controls()[0].props.onChange(3,20);await b.settle();assert.equal(b.rows()[0].id,'order-40');assert.equal(b.calls.length,4);b.h.unmount();
});
test('late responses from aborted filter requests never overwrite newer rows, totals or URL',async()=>{
 const pending=[];const b=setup('https://example.invalid/orders?page=2',q=>new Promise(resolve=>pending.push({q,resolve})));await b.settle();
 elements(b.tree(),'Tabs')[0].props.onChange('completed');await b.settle();assert.equal(pending.length,2);assert.equal(b.calls[0].signal.aborted,true);
 pending[1].resolve(result(pending[1].q));await b.settle();const rows=b.rows(),total=b.controls()[0].props.total,url=b.href;
 pending[0].resolve(result(pending[0].q));await b.settle();assert.deepEqual(b.rows(),rows);assert.equal(b.controls()[0].props.total,total);assert.equal(b.href,url);b.h.unmount();assert.equal(b.listeners.size,0);
});
