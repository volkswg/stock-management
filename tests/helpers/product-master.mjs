import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
export const headers=['id','productCode','productName','variant','referenceImageUrl','active','createdAt','updatedAt','createdBy'];
export const itemHeaders=['id','orderId','imageUrl','quoteQuantity','deliveredQuantity','productCode','createdAt','updatedAt','deletedAt','createdBy','productId'];
export const uuid='11111111-1111-4111-8111-111111111111',uuid2='22222222-2222-4222-8222-222222222222',uuid3='33333333-3333-4333-8333-333333333333';
export const input={productCode:'DUP',productName:'Tea',variant:'Large',referenceImageUrl:'https://example.test/tea.jpg'};
export const plain=value=>JSON.parse(JSON.stringify(value));
export function harness(){
 const state={sheets:{products:[headers.slice()],order_items:[itemHeaders.slice(),['item','order','https://example.test/i.jpg','1','0','DUP','c','u','','staff','']],order_bills:[['id','orderId','imageUrl','createdAt','updatedAt','deletedAt','createdBy']],orders:[['id','status','seller','totalPrice','remark','createdAt','updatedAt','deletedAt','createdBy'],['order','complete','Seller',100,'','c','u','','staff']]},metadata:new Map(),mode:'normal',gate:null},events=[],cache=new Map();
 const env={PRODUCT_MASTER_STAFF_KEYS_JSON:JSON.stringify([{id:'editor',keyHash:crypto.createHash('sha256').update('k'.repeat(43)).digest('hex')}]),PRODUCT_MASTER_SESSION_SECRET:'s'.repeat(43)};state.compositions=0;state.nowMs=Date.parse('2026-11-08T06:00:00Z');
 const names=['products','order_items','orders','order_bills'];
 function address(value){
  const [,quoted,range]=/^'(.+)'!(.*)$/.exec(value),name=quoted.replaceAll("''", "'");
  const [,a,start,b,end]=/^([A-Z]+)([1-9]\d*)?(?::([A-Z]+)([1-9]\d*)?)?$/.exec(range);
  const column=text=>[...text].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
  return {name,startRow:Number(start??1)-1,endRow:end?Number(end):b?state.sheets[name].length:Number(start??1),startColumn:column(a),endColumn:column(b??a)+1};
 }
 function update(range,values){const target=address(range);values.forEach((row,i)=>{const dest=state.sheets[target.name][target.startRow+i]??=[];row.forEach((value,j)=>{dest[target.startColumn+j]=value;});});events.push(['legacy-write',range]);}
 const fetch=async(url,init)=>{
  const path=new URL(url).pathname;events.push([init.method,path]);
  if(init.method==='GET'&&path.endsWith('/book'))return Response.json({sheets:names.map((title,sheetId)=>({properties:{title,sheetId}}))});
  if(path.includes('/values/')){
   const range=decodeURIComponent(path.split('/values/')[1]).replace(/:append$/,''),target=address(range);
   if(init.method==='GET')return Response.json({values:state.sheets[target.name].slice(target.startRow,target.endRow).map(row=>row.slice(target.startColumn,target.endColumn))});
   const body=JSON.parse(init.body);
   if(init.method==='PUT')update(range,body.values);
   else if(init.method==='POST'){state.sheets[target.name].push(...body.values);events.push(['legacy-append',range]);}
   else assert.fail('Unexpected values method');return Response.json({});
  }
  if(path.endsWith('/values:batchUpdate')){for(const entry of JSON.parse(init.body).data)update(entry.range,entry.values);return Response.json({});}
  const body=JSON.parse(init.body);
  if(path.endsWith('/developerMetadata:search')){if(state.failMetadataReads>0){state.failMetadataReads--;throw new Error('synthetic metadata read timeout');}const query=body.dataFilters[0].developerMetadataLookup;return Response.json({matchedDeveloperMetadata:[...state.metadata.values()].filter(record=>(query.metadataId===undefined||query.metadataId===record.metadataId)&&(query.metadataKey===undefined||query.metadataKey===record.metadataKey)).map(developerMetadata=>({developerMetadata}))});}
  assert.ok(path.endsWith('/book:batchUpdate'),path);
  if(state.gate)await state.gate();
  if(state.mode==='timeout-before')throw new Error('synthetic timeout');
  if(state.mode==='timeout-late'){state.lateCommit=()=>fetch(url,init);throw new Error('synthetic timeout with delayed provider request');}
  if(state.mode==='provider-error')return new Response('synthetic private provider body',{status:503});
  const sheets=structuredClone(state.sheets),metadata=new Map(state.metadata);
  for(const request of body.requests){
   if(request.createDeveloperMetadata){const record=request.createDeveloperMetadata.developerMetadata;if(metadata.has(record.metadataId))return new Response('guard ID exists',{status:400});metadata.set(record.metadataId,record);}
   else if(request.appendCells){const {sheetId,rows}=request.appendCells;const data=rows.map(row=>row.values.map(cell=>Object.values(cell.userEnteredValue)[0]));sheets[names[sheetId]].push(...data);}
   else if(request.updateCells){const {range,rows}=request.updateCells;rows.forEach((row,offset)=>row.values.forEach((cell,column)=>{sheets[names[range.sheetId]][range.startRowIndex+offset][range.startColumnIndex+column]=Object.values(cell.userEnteredValue)[0];}));}
   else assert.fail('Unexpected request');
  }
  const allocations=new Map();for(const record of metadata.values()){const scope=record.location?.spreadsheet?'spreadsheet':record.location?.sheetId??record.location?.dimensionRange?.sheetId;const total=(allocations.get(scope)??0)+[...(record.metadataKey??'')].length+[...(record.metadataValue??'')].length;allocations.set(scope,total);if(total>30000)return new Response('synthetic metadata character limit',{status:400});}
  state.sheets=sheets;state.metadata=metadata;events.push(['commit',plain(body)]);
  if(state.mode==='commit-timeout')throw new Error('synthetic lost response');if(state.failVerification){state.failVerification=false;state.failMetadataReads=2;}return Response.json({});
 };
 function load(file){
  assert.ok(file.startsWith('src/modules/products/')||['src/modules/orders/application/product-links.ts','src/modules/orders/infrastructure/google-sheets/product-links.ts','src/modules/orders/infrastructure/google-sheets/order-items/const.ts','src/modules/orders/infrastructure/google-sheets/orders/const.ts','src/infrastructure/persistence/google-sheets/client/index.ts','src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts','src/infrastructure/persistence/google-sheets/guarded-write.ts','src/infrastructure/persistence/google-sheets/const.ts','src/shared/lib/request-id.ts','src/config/product-master-access.ts','src/infrastructure/security/product-staff-session.ts','src/infrastructure/http/read-json.ts','src/composition/product-master-http.ts','src/composition/product-master.ts','src/modules/orders/product-link-server.ts','src/shared/lib/is-record.ts','src/app/api/product-access/route.ts','src/app/api/products/route.ts','src/app/api/products/suggestions/route.ts','src/app/api/products/[id]/route.ts','src/app/api/products/creations/[requestId]/cancel/route.ts','src/app/api/orders/[id]/product-links/route.ts','src/app/api/orders/[id]/items/[itemId]/product/route.ts'].includes(file),`Unapproved source ${file}`);
  if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[state.nowMs]));}static now(){return state.nowMs;}}
  new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date:Clock,URL,URLSearchParams,Response,Request,TextEncoder,TextDecoder,Uint8Array,Buffer,process:{env},fetch,require(spec){
   if(spec==='next/server')return {NextResponse:Response};
   if(spec==='@/composition/product-master')return {createProductMasterServices:()=>{state.compositions++;return {products,links:load('src/modules/orders/product-link-server.ts').createOrderProductLinkService(client,{orderItems:'order_items',orders:'orders'},products)};}};
   if(spec==='@/config')return {getConfig:()=>({googleService:{accountEmail:'synthetic@example.test',accountPrivateKey:'synthetic'},googleSheets:{spreadsheetId:'book',orderItemsWorksheetName:'order_items',ordersWorksheetName:'orders'}})};
   if(spec==='@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth')return {GoogleServiceAccountAuth:class {async getAccessToken(){return 'synthetic';}}};if(spec==='server-only')return {};if(spec==='node:crypto')return crypto;const path=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);return load(path+(existsSync(path+'.ts')?'.ts':'/index.ts'));}});return exports;
 }
 const Client=load('src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts').GoogleSheetsClient,client=new Client({getAccessToken:async()=> 'synthetic'},'book');
 const products=load('src/modules/products/server.ts').createProductsService(client,()=> '2026-11-08T06:00:00.000Z');
 const links=load('src/modules/orders/infrastructure/google-sheets/product-links.ts').createOrderItemProductLinks(client,'order_items','orders');
 const saveLink=load('src/modules/orders/application/product-links.ts').saveOrderItemProductLink;
 return {state,env,client,events,products,links,load,save:values=>saveLink(links,products,{orderId:'order',itemId:'item',...values})};
}
