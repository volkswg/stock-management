import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import { inventoryWorksheetFiles, inventoryWorksheetDestinations, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import { hrWorksheetFiles, hrWorksheetDestinations, assertHrWorksheetHistory } from "./helpers/hr-worksheet-history.mjs";
import { directoryFiles, directoryNewFiles, assertDirectoryHistory } from "./helpers/employee-directory-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {loadSource,plain} from "./helpers/load-source.mjs";
import {salesWorksheetsBefore} from "./helpers/sales-worksheet-history.mjs";
const old="src/externals/google/sheet/sheets/sales/",root="src/infrastructure/persistence/google-sheets/";
test("original five Sales worksheets preserve header order/mutability, dynamic defaults, payload identities, awaits and exact failures without retries",async()=>{
 for(const spec of salesWorksheetsBefore.worksheets){
  const headers=loadSource(old+spec.folder+"/const.ts");assert.deepEqual(plain(headers[spec.header]),spec.headers);assert.equal(Object.isFrozen(headers[spec.header]),false);
  const values=[["id",0,null,false,"=literal"]],events=[],client={getValues:async(...a)=>{events.push(["get",...a]);return values;},appendValues:async(...a)=>events.push(["append",...a]),updateValues:async(...a)=>events.push(["update",...a])};
  const base=loadSource(root+"sheets/BaseGoogleSheet.ts"),constants=loadSource(root+"const.ts"),C=loadSource(old+spec.folder+"/"+spec.name+".ts",{imports:{"../../BaseGoogleSheet":base,"../../../const":constants,"./const":headers}})[spec.name];const sheet=new C(client,"Sales' Sheet");assert.deepEqual(events,[]);
  assert.equal(await sheet.readRows(),values);await sheet.readRows("B2:C3");await sheet.appendRows("A:ZZ",values);await sheet.updateRows("B2:C3",values);headers[spec.header].push("_probe");await sheet.readRows();headers[spec.header].pop();assert.deepEqual(plain(events),spec.events);assert.equal(events[2][3],values);assert.equal(events[3][3],values);
  let calls=0;const error=new Error("synthetic");for(const [method,operation]of [["getValues",()=>sheet.readRows()],["appendValues",()=>sheet.appendRows("A:ZZ",values)],["updateValues",()=>sheet.updateRows("B2:C3",values)]]){client[method]=async()=>{calls++;throw error;};await assert.rejects(operation(),e=>e===error);}assert.equal(calls,3);
  let release,done=false;client.appendValues=()=>new Promise(resolve=>{release=resolve;});const pending=sheet.appendRows("A:ZZ",values).then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);release();await pending;assert.equal(done,true);
 }
});

test("exact ten-file Sales history and declarations restore original bytes while all other production and earlier fixtures remain authoritative",async()=>{
 const {readFileSync,readdirSync}=await import("node:fs");const {salesWorksheetFiles,salesWorksheetDestinations,salesWorksheetHash,assertSalesWorksheetHistory}=await import("./helpers/sales-worksheet-history.mjs");
 for(const [file,hash]of Object.entries(salesWorksheetsBefore.productionHashes)){if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,hash);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,hash);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,hash);else if(directoryFiles.has(file))assertDirectoryHistory(file,hash);else if(salesWorksheetFiles.has(file))assertSalesWorksheetHistory(file,hash);else assert.equal(salesWorksheetHash(readFileSync(file)),hash,file);}
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(salesWorksheetsBefore.productionHashes,f)).sort(),[...salesWorksheetDestinations,...directoryNewFiles,...hrWorksheetDestinations,...inventoryWorksheetDestinations,...movementSchemaNewFiles].sort());
 for(const [file,hash]of Object.entries(salesWorksheetsBefore.fixtureHashes))assert.equal(salesWorksheetHash(readFileSync(`tests/fixtures/${file}`)),hash,file);
});

test("Sales physical/legacy/index/service constructors, prototypes, header objects and runtime keys retain strict identity",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs");const g=googleGraph(),registry=g.load("src/externals/google/sheet/index.ts"),index=g.load("src/externals/google/sheet/sheets/index.ts"),original=googleGraph({historical:true});
 assert.deepEqual(Object.keys(registry),Object.keys(original.load("src/externals/google/sheet/index.ts")));assert.deepEqual(Object.keys(index),Object.keys(original.load("src/externals/google/sheet/sheets/index.ts")));
 const settings=new Proxy({spreadsheetId:"synthetic",serviceAccountEmail:"email",serviceAccountPrivateKey:"synthetic"},{get:(o,k)=>o[k]??String(k)}),service=new registry.GoogleSheetsService(settings);
 for(const spec of salesWorksheetsBefore.worksheets){const file=old+spec.folder+"/"+spec.name+".ts",C=g.load(salesWorksheetsBefore.moves[file].to)[spec.name];assert.equal(g.load(file)[spec.name],C);assert.equal(registry[spec.name],C);assert.equal(index[spec.name],C);assert.ok(service[{SalesReceiptsSheet:"salesReceipts",SalesReceiptItemsSheet:"salesReceiptItems",SalesReceiptPaymentsSheet:"salesReceiptPayments",SalesReceiptSyncsSheet:"salesReceiptSyncs",SalesProfitCostOverridesSheet:"salesProfitCostOverrides"}[spec.name]] instanceof C);assert.equal(Object.getPrototypeOf(C),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(C.prototype),registry.BaseGoogleSheet.prototype);assert.equal(C.prototype.constructor,C);
  const leaf=old+spec.folder+"/const.ts",headers=g.load(salesWorksheetsBefore.moves[leaf].to)[spec.header];assert.equal(headers,g.load(leaf)[spec.header]);assert.equal(headers,registry[spec.header]);assert.deepEqual(plain(headers),spec.headers);assert.equal(Object.isFrozen(headers),false);
 }
 for(const file of ["src/config/index.ts","src/modules/sales/server.ts","src/services/sales/index.ts"])assert.throws(()=>g.load(file),/Unapproved provider dependency/);
});

test("saved-original/current real Sales worksheet/client requests preserve URLs, ranges, modes, cell payloads, order and rejection identity",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs");const traces=[];
 for(const historical of [true,false]){const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,...init});if(failure)throw failure;return Response.json({values:[["id",0,null,false]]});}}});const {GoogleSheetsClient}=g.load("src/externals/google/sheet/client/index.ts"),client=new GoogleSheetsClient({getAccessToken:async()=>"fake-token"},"sheet/id");
  for(const spec of salesWorksheetsBefore.worksheets){const C=g.load(old+spec.folder+"/"+spec.name+".ts")[spec.name],sheet=new C(client,"Sales' Sheet");assert.deepEqual(plain(await sheet.readRows()),[["id",0,null,false]]);assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'Sales'' Sheet'!"+spec.range)));await sheet.readRows("B2:C3");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'Sales'' Sheet'!B2:C3")));
   const values=[["id",0,null,false,"=literal"]];await sheet.appendRows("A:ZZ",values);assert.equal(requests.at(-1).method,"POST");assert.ok(requests.at(-1).url.endsWith(":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});await sheet.updateRows("B2:C3",values);assert.equal(requests.at(-1).method,"PUT");assert.ok(requests.at(-1).url.endsWith("?valueInputOption=USER_ENTERED"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});
   failure=new Error("network");const n=requests.length;await assert.rejects(sheet.readRows(),e=>e===failure);assert.equal(requests.length,n+1);failure=undefined;
  }
  for(const request of requests){assert.ok(request.url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/sheet%2Fid/values/"));assert.equal(request.headers.Authorization,"Bearer fake-token");}traces.push(plain(requests));
 }
 assert.deepEqual(traces[1],traces[0]);
});

test("unchanged legacy Sales sync/report/refund/override workflows retain original rows, Bangkok query, results and partial-failure event order",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs");
 async function scenario(historical,failItems=false){
  class Clock extends Date{constructor(...args){super(args.length?args[0]:"2026-11-06T12:00:00.000Z");}}
  const g=googleGraph({historical}),registry=g.load("src/externals/google/sheet/index.ts"),events=[],data={},service={},error=new Error("item append failed");
  const client={ensureWorksheet:async(name)=>{events.push(["ensure",name]);},getValues:async(name,range)=>{events.push(["read",name,range]);return (range.startsWith("A1:")?data[name].slice(0,1):data[name]).map(row=>row.slice());},appendValues:async(name,range,values)=>{events.push(["append",name,range,plain(values)]);if(failItems&&name==="receipt-items")throw error;data[name].push(...values.map(row=>Array.from(row)));},updateValues:async(name,range,values)=>{events.push(["update",name,range,plain(values)]);const index=Number(/\d+/.exec(range)?.[0]??1)-1;values.forEach((row,i)=>{data[name][index+i]=Array.from(row);});}};
  for(const spec of salesWorksheetsBefore.worksheets){data[spec.folder]=[Array.from(registry[spec.header])];service[{receipts:"salesReceipts","receipt-items":"salesReceiptItems","receipt-payments":"salesReceiptPayments","receipt-syncs":"salesReceiptSyncs","profit-cost-overrides":"salesProfitCostOverrides"}[spec.folder]]=new registry[spec.name](client,spec.folder);}
  const globals={Date:Clock,Error},imports={"@/externals/google/sheet":registry};const ids=loadSource("src/services/sales/idBuilders.ts"),mappers=loadSource("src/services/sales/rowMappers.ts"),receipts=loadSource("src/services/sales/getLoyverseReceiptsForSalesDate.ts",{globals});
  const sync=loadSource("src/services/sales/syncLoyverseDailySales.ts",{imports:{...imports,"./idBuilders":ids,"./rowMappers":mappers,"./getLoyverseReceiptsForSalesDate":receipts},globals});
  const records=[{receipt_number:"r/1",receipt_type:"SALE",receipt_date:"2026-11-06T00:00:00.000Z",created_at:"created",updated_at:"updated",total_money:10,total_tax:0,line_items:[{id:"i",item_id:"item",item_name:"Item",quantity:2,price:5,total_money:10,cost:2}],payments:[{money_amount:10,payment_type_id:"cash",name:"Cash",type:"CASH"}]},{receipt_number:"r/2",receipt_type:"REFUND",refund_for:"r/1",receipt_date:"2026-11-06T01:00:00.000Z",created_at:"c",updated_at:"u",total_money:2,line_items:[],payments:[]}];
  const account={id:"shop/id",shopName:"Synthetic",storeId:"store/1",service:{getReceipts:async(query)=>{events.push(["loyverse",plain(query)]);return records;}}};
  let outcome;try{outcome=await sync.syncLoyverseDailySales({account,googleSheetsService:service,salesDate:"2026-11-06"});}catch(e){assert.equal(e,error);return {failed:true,events,data};}
  assert.equal(outcome.receiptCount,2);const skipped=await sync.syncLoyverseDailySales({account,googleSheetsService:service,salesDate:"2026-11-06"});assert.equal(skipped.outcome,"already_synced");
  const report=loadSource("src/services/sales/getGoogleSheetsDailySales.ts",{imports,globals});const daily=await report.getGoogleSheetsDailySales({accountId:account.id,googleSheetsService:service,salesDate:"2026-11-06"});
  const overrides=loadSource("src/services/sales/manageSalesProfitCostOverrides.ts",{imports:{...imports,"node:crypto":{randomUUID:()=>"synthetic-uuid"}},globals});const created=await overrides.setSalesProfitCostOverride({accountId:account.id,averageItemCost:0,createdBy:" actor ",googleSheetsService:service,month:"2026-11",note:" note "});const updated=await overrides.setSalesProfitCostOverride({accountId:account.id,averageItemCost:2.5,createdBy:"ignored",googleSheetsService:service,month:"2026-11",note:"updated"});
  return {outcome:plain(outcome),skipped:plain(skipped),daily:plain(daily),created:plain(created),updated:plain(updated),events,data};
 }
 for(const fail of [false,true]){const original=await scenario(true,fail),current=await scenario(false,fail);assert.deepEqual(plain(current),plain(original));const query=current.events.find(e=>e[0]==="loyverse")[1];assert.deepEqual(query,{receiptDateMin:"2026-11-05T17:00:00.000Z",receiptDateMax:"2026-11-06T16:59:59.999Z",storeId:"store/1"});if(fail){assert.equal(current.failed,true);assert.ok(!current.events.some(e=>e[0]==="append"&&e[1]==="receipt-syncs"));}}
});
