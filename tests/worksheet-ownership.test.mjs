import { remainingFiles, remainingDestinations, assertRemainingHistory } from "./helpers/remaining-worksheet-history.mjs";
import { userStateFiles, userStateDestinations, assertUserStateHistory } from "./helpers/user-state-worksheet-history.mjs";
import { salesQueryFiles, salesQueryNewFiles, assertSalesQueryHistory } from "./helpers/inventory-sales-query-history.mjs";
import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import { inventoryWorksheetFiles, inventoryWorksheetDestinations, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import { hrWorksheetFiles, hrWorksheetDestinations, assertHrWorksheetHistory } from "./helpers/hr-worksheet-history.mjs";
import { directoryFiles, directoryNewFiles, assertDirectoryHistory } from "./helpers/employee-directory-history.mjs";
import { salesWorksheetFiles, salesWorksheetDestinations, assertSalesWorksheetHistory } from "./helpers/sales-worksheet-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {loadSource,plain} from "./helpers/load-source.mjs";
import {worksheetBefore} from "./helpers/worksheet-history.mjs";
const old="src/externals/google/sheet/sheets/",root="src/infrastructure/persistence/google-sheets/";
for(const spec of worksheetBefore.worksheets)test(`original worksheet ${spec.name} preserves headers, default range, arguments, payload identity and failure without retry`,async()=>{
 const headers=loadSource(old+spec.dir+"/const.ts");assert.deepEqual(plain(headers[spec.header]),spec.headers);
 const events=[],values=[["id",0,null,false]],client={getValues:async(...a)=>{events.push(["get",...a]);return values;},appendValues:async(...a)=>events.push(["append",...a]),updateValues:async(...a)=>events.push(["update",...a]),batchUpdateValues:async(...a)=>events.push(["batch",...a])};
 const {BaseGoogleSheet}=loadSource(root+"sheets/BaseGoogleSheet.ts");
 const exports=loadSource(old+spec.dir+"/"+spec.name+".ts",{imports:{"../BaseGoogleSheet":{BaseGoogleSheet},"../../const":loadSource(root+"const.ts"),"./const":headers}});
 const sheet=new exports[spec.name](client,"O' Worksheet");assert.ok(sheet instanceof BaseGoogleSheet);assert.deepEqual(events,[]);
 assert.equal(await sheet.readRows(),values);await sheet.appendRows("A:M",values);await sheet.updateRows("B2:M2",values);if(sheet.batchUpdateRows)await sheet.batchUpdateRows([{range:"D2:E2",values}]);assert.deepEqual(plain(events),spec.events);assert.equal(events[1][3],values);assert.equal(events[2][3],values);
 const error=new Error("read");let calls=0;client.getValues=async()=>{calls++;throw error;};await assert.rejects(sheet.readRows(),e=>e===error);assert.equal(calls,1);
 const writeError=new Error("write");client.appendValues=async()=>{calls++;throw writeError;};await assert.rejects(sheet.appendRows("A:M",values),e=>e===writeError);assert.equal(calls,2);
});

test("all ten physical files restore original bytes/declarations and all other production/previous fixture bytes remain unchanged",async()=>{
 const {readFileSync,readdirSync}=await import("node:fs");const {worksheetFiles,worksheetDestinations,worksheetHash,assertWorksheetHistory}=await import("./helpers/worksheet-history.mjs");
 for(const [file,hash]of Object.entries(worksheetBefore.productionHashes)){if(remainingFiles.has(file))assertRemainingHistory(file,hash);else if(userStateFiles.has(file))assertUserStateHistory(file,hash);else if(salesQueryFiles.has(file))assertSalesQueryHistory(file,hash);else if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,hash);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,hash);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,hash);else if(directoryFiles.has(file))assertDirectoryHistory(file,hash);else if(salesWorksheetFiles.has(file))assertSalesWorksheetHistory(file,hash);else if(worksheetFiles.has(file))assertWorksheetHistory(file,hash);else assert.equal(worksheetHash(readFileSync(file)),hash,file);}
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
 assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(worksheetBefore.productionHashes,f)).sort(),[...worksheetDestinations,...salesWorksheetDestinations,...directoryNewFiles,...hrWorksheetDestinations,...inventoryWorksheetDestinations,...movementSchemaNewFiles,...salesQueryNewFiles,...remainingDestinations,...userStateDestinations].sort());
 for(const [file,hash]of Object.entries(worksheetBefore.fixtureHashes))assert.equal(worksheetHash(readFileSync(`tests/fixtures/${file}`)),hash,file);
});

test("legacy leaf, both unchanged indexes, physical classes/headers and real service instances share exact runtime identity",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs");const g=googleGraph();const registry=g.load("src/externals/google/sheet/index.ts"),index=g.load(old+"index.ts");
 const config=new Proxy({spreadsheetId:"synthetic",serviceAccountEmail:"email",serviceAccountPrivateKey:"synthetic"},{get:(target,key)=>target[key]??String(key)});
 const service=new registry.GoogleSheetsService(config);
 const original=googleGraph({historical:true});assert.deepEqual(Object.keys(registry),Object.keys(original.load("src/externals/google/sheet/index.ts")));assert.deepEqual(Object.keys(index),Object.keys(original.load(old+"index.ts")));
 for(const file of ["src/config/index.ts","src/modules/orders/server.ts","src/modules/shipments/application/update-shipment-status.ts"])assert.throws(()=>g.load(file),/Unapproved provider dependency/);
 for(const spec of worksheetBefore.worksheets){
  const file=old+spec.dir+"/"+spec.name+".ts",entry=worksheetBefore.moves[file],Class=g.load(entry.to)[spec.name];
  assert.equal(Object.getPrototypeOf(Class),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(Class.prototype),registry.BaseGoogleSheet.prototype);assert.equal(Class.prototype.constructor,Class);assert.equal(g.load(file)[spec.name],Class);assert.equal(index[spec.name],Class);assert.equal(registry[spec.name],Class);assert.equal(g.load(entry.to)[spec.name],Class);
  const field={OrdersSheet:"orders",OrderItemsSheet:"orderItems",OrderBillsSheet:"orderBills",ShipmentsSheet:"shipments",ShipmentOrdersSheet:"shipmentOrders"}[spec.name];
  assert.ok(service[field] instanceof Class);assert.ok(service[field] instanceof registry.BaseGoogleSheet);
  const headerFile=old+spec.dir+"/const.ts",headers=g.load(worksheetBefore.moves[headerFile].to)[spec.header];assert.equal(g.load(headerFile)[spec.header],headers);assert.equal(registry[spec.header],headers);assert.deepEqual(plain(headers),spec.headers);
 }
});

test("original/current actual five-worksheet transports retain quoted URLs, default/explicit ranges, JSON payloads, batch modes and rejection identity",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs");const traces=[];
 for(const historical of [true,false]){
  const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,method:init.method,headers:init.headers,body:init.body});if(failure)throw failure;return Response.json({values:[["row",0,null]]});}}});
  const {GoogleSheetsClient}=g.load("src/externals/google/sheet/client/index.ts");const client=new GoogleSheetsClient({getAccessToken:async()=>"fake-token"},"sheet/id");
  for(const spec of worksheetBefore.worksheets){
   const { [spec.name]:Class }=g.load(old+spec.dir+"/"+spec.name+".ts"),sheet=new Class(client,"O' Worksheet");
   assert.deepEqual(plain(await sheet.readRows()),[["row",0,null]]);
   assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'O'' Worksheet'!"+spec.range)));
   const cells=[["id",0,null,false,"=original"]];await sheet.appendRows("A:M",cells);assert.deepEqual(JSON.parse(requests.at(-1).body),{values:cells});assert.ok(requests.at(-1).url.endsWith(":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"));
   await sheet.updateRows("B2:M2",cells);assert.equal(requests.at(-1).method,"PUT");assert.ok(requests.at(-1).url.endsWith("?valueInputOption=USER_ENTERED"));
   await sheet.readRows("A:I");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'O'' Worksheet'!A:I")));
   if(sheet.batchUpdateRows){await sheet.batchUpdateRows([{range:"D2:E2",values:cells}]);assert.deepEqual(JSON.parse(requests.at(-1).body),{valueInputOption:"USER_ENTERED",data:[{range:"'O'' Worksheet'!D2:E2",majorDimension:"ROWS",values:cells}]});const count=requests.length;await sheet.batchUpdateRows([]);assert.equal(requests.length,count);}
   failure=new Error("synthetic network");const count=requests.length;await assert.rejects(sheet.updateRows("M1",[["shippingBillUrl"]]),e=>e===failure);assert.equal(requests.length,count+1);failure=undefined;
  }
  for(const r of requests){assert.ok(r.url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/sheet%2Fid/"));assert.equal(r.headers.Authorization,"Bearer fake-token");}
  traces.push(requests);
 }
 assert.deepEqual(plain(traces[1]),plain(traces[0]));
});
