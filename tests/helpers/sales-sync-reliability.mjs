import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {googleGraph} from './google-infrastructure.mjs';
import {loadSalesSource} from './sales-source.mjs';
export const plain=value=>JSON.parse(JSON.stringify(value));
export const salesDate='2026-11-01';
export const sampleReceipt={receipt_number:'R/1',receipt_type:'SALE',receipt_date:'2026-11-01T01:00:00Z',created_at:'c',updated_at:'u',total_money:99.987654,line_items:[{id:'i',item_id:'item',item_name:'Item',quantity:3,gross_total_money:120,total_money:99.987654,total_discount:20.012346,cost_total:11.1,line_taxes:[],line_discounts:[],line_modifiers:[]}],payments:[{payment_type_id:'cash',money_amount:99.987654,payment_details:{}}]};
const specs=[['salesReceipts','SALES_RECEIPT_HEADERS'],['salesReceiptItems','SALES_RECEIPT_ITEM_HEADERS'],['salesReceiptPayments','SALES_RECEIPT_PAYMENT_HEADERS'],['salesReceiptSyncs','SALES_RECEIPT_SYNC_HEADERS']];
// Contract model ONLY: a shared durable-backend simulation across independent
// client objects. This is deliberately not a production mutex or lock adapter.
export function coordinatorModel(backend={pending:null,tail:Promise.resolve(),events:[]}){
 return {backend,async run(key,work){
  const previous=backend.tail;let release;backend.tail=new Promise(resolve=>release=resolve);await previous;
  const name=JSON.stringify(key);
  try{
   if(backend.pending&&backend.pending.key!==name)throw new Error('Workbook quarantined by another pending account/date');
   return await work({get pendingFingerprint(){return backend.pending?.fingerprint??null;},async beginWrite(fingerprint){assert.equal(backend.pending,null);backend.events.push('intent');backend.pending={key:name,fingerprint};},async confirmWrite(){backend.events.push('confirmed');backend.pending=null;}});
  }finally{release();}
 }};
}
export function syncHarness({rows,receipts=[structuredClone(sampleReceipt)],backend,clock='2026-11-08T01:00:00Z'}={}){
 const events=[],data={},state={mode:'normal',capacity:100000,reads:0,providerError:null,gate:null,afterPost:null};let post=false;
 const fetch=async(url,init)=>{
  const path=new URL(url);events.push([init.method,path.pathname+path.search]);
  if(init.method==='GET'&&path.pathname.endsWith('/book'))return Response.json({sheets:specs.map(([title])=>({properties:{title,gridProperties:{rowCount:state.capacity,columnCount:26}}}))});
  if(init.method==='GET'&&path.pathname.endsWith('/values:batchGet')){
   assert.equal(path.searchParams.get('valueRenderOption'),'FORMULA');
   if(state.beforeDestinationRead)state.beforeDestinationRead(data);
   return Response.json({valueRanges:path.searchParams.getAll('ranges').map(range=>{
    const [,name,start,end]=/^'(.+)'!A(\d+):[A-Z]+(\d+)$/.exec(range);
    return {values:data[name.replaceAll("''","'")].slice(Number(start)-1,Number(end))};
   })});
  }
  if(init.method==='GET'){
   state.reads++;
   if(post&&state.mode==='post-read-fail')throw new Error('synthetic confidential Google body');
   const address=decodeURIComponent(path.pathname.split('/values/')[1]),name=/^'(.+)'!/.exec(address)?.[1]?.replaceAll("''", "'");
   assert.ok(Object.hasOwn(data,name),address);return Response.json({values:structuredClone(data[name])});
  }
  assert.ok(path.pathname.endsWith('/values:batchUpdate'),'Independent append/update is forbidden');
  const body=JSON.parse(init.body);assert.equal(body.valueInputOption,'USER_ENTERED');events.push(['atomic',plain(body)]);
  assert.ok(coordinator.backend.pending,'Durable intent must precede POST');
  if(state.gate)await state.gate();
  if(state.mode==='reject')return new Response('synthetic invalid request',{status:400});
  if(state.mode==='timeout-before')throw new Error('synthetic timeout');
  const next=structuredClone(data);
  for(const entry of body.data){const match=/^'(.+)'!A(\d+):[A-Z]+(\d+)$/.exec(entry.range);assert.ok(match,entry.range);const name=match[1].replaceAll("''", "'");const start=Number(match[2])-1;assert.equal(entry.values.length,Number(match[3])-start);entry.values.forEach((row,index)=>next[name][start+index]=row);}
  Object.assign(data,next);post=true;
  if(state.afterPost)state.afterPost(data);
  if(state.mode==='commit-timeout')throw new Error('synthetic lost response');
  return Response.json({totalUpdatedRows:body.data.reduce((n,e)=>n+e.values.length,0)});
 };
 const graph=googleGraph({globals:{fetch,TextEncoder}}),registry=graph.registry();
 for(const [name,header]of specs)data[name]=rows?.[name]?structuredClone(rows[name]):[Array.from(registry[header])];
 const source=readFileSync('src/composition/google-sheets/GoogleSheetsService.ts','utf8');
 const config={spreadsheetId:'book',serviceAccountEmail:'fake@example.test',serviceAccountPrivateKey:'synthetic-not-a-key'};
 for(const [,field]of source.matchAll(/config\.(\w+WorksheetName)/g))config[field]=field.replace('WorksheetName','');
 const service=new registry.GoogleSheetsService(config);service.client.auth.getAccessToken=async()=> 'synthetic-google-token';
 // Configured workbook names stay canonical and all real worksheet objects use
 // the same actual client. No network/auth implementation is mocked wholesale.
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}}
 const api=loadSalesSource('src/modules/sales/server.ts',{globals:{Date:Clock},imports:{'node:crypto':{createHash}}});
 const coordinator=coordinatorModel(backend),account={id:'shop',shopName:'Shop',service:{async getReceipts(query){events.push(['loyverse',plain(query)]);if(state.providerError)throw state.providerError;return receipts;}}};
 return {api,account,service,data,events,state,coordinator,async sync(extra={}){return api.syncLoyverseDailySales({account,googleSheetsService:service,salesDate,coordinator,...extra});}};
}
