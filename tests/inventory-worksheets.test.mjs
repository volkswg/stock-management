import { workforceBefore } from "./helpers/hr-application-history.mjs";
import { completionExtraFiles, completionNewFiles, assertCompletionHistory } from "./helpers/hr-application-history.mjs";
import { expectedHRDebts } from "./helpers/hr-payroll-history.mjs";
import { hrFiles, hrNewFiles, assertHRHistory } from "./helpers/hr-payroll-history.mjs";
import { expectedExpensesDebts } from "./helpers/expenses-business-history.mjs";
import { expensesFiles, expensesNewFiles, assertExpensesHistory } from "./helpers/expenses-business-history.mjs";
import { remainingFiles, remainingDestinations, assertRemainingHistory } from "./helpers/remaining-worksheet-history.mjs";
import { userStateFiles, userStateDestinations, assertUserStateHistory } from "./helpers/user-state-worksheet-history.mjs";
import { salesQueryFiles, salesQueryNewFiles, assertSalesQueryHistory } from "./helpers/inventory-sales-query-history.mjs";
import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {loadSource,plain} from "./helpers/load-source.mjs";
import {inventoryWorksheetsBefore} from "./helpers/inventory-worksheet-history.mjs";
const old="src/externals/google/sheet/sheets/",root="src/infrastructure/persistence/google-sheets/";
test("original Inventory worksheets retain dynamic/literal defaults, mutable headers, argument identities, delete-row delegation, pending operations and original errors",async()=>{
 for(const spec of inventoryWorksheetsBefore.worksheets){
  const headers=spec.header?loadSource(old+spec.folder+"/const.ts"):{};if(spec.header){assert.deepEqual(plain(headers[spec.header]),spec.headers);assert.equal(Object.isFrozen(headers[spec.header]),false);}
  const values=[["id",0,null,false,"=literal"]],events=[],client={getValues:async(...a)=>{events.push(["get",...a]);return values;},appendValues:async(...a)=>events.push(["append",...a]),updateValues:async(...a)=>events.push(["update",...a]),deleteRow:async(...a)=>events.push(["delete",...a])};
  const C=loadSource(old+spec.folder+"/"+spec.name+".ts",{imports:{"../BaseGoogleSheet":loadSource(root+"sheets/BaseGoogleSheet.ts"),"../../const":loadSource(root+"const.ts"),"./const":headers}})[spec.name],sheet=new C(client,"Inventory' Sheet");assert.deepEqual(events,[]);
  assert.equal(await sheet.readRows(),values);await sheet.readRows("B2:C3");await sheet.appendRows("A:ZZ",values);await sheet.updateRows("B2:C3",values);if(spec.header){headers[spec.header].push("_probe");await sheet.readRows();headers[spec.header].pop();}else await sheet.deleteRow(7);assert.deepEqual(plain(events),spec.events);assert.equal(events[2][3],values);assert.equal(events[3][3],values);
  const operations=[["getValues",()=>sheet.readRows()],["appendValues",()=>sheet.appendRows("A:ZZ",values)],["updateValues",()=>sheet.updateRows("B2:C3",values)],...(!spec.header?[["deleteRow",()=>sheet.deleteRow(7)]]:[])];
  for(const sync of [true,false]){let calls=0;const marker=new Error("synthetic");for(const [method,operation]of operations){client[method]=()=>{calls++;if(sync)throw marker;return Promise.reject(marker);};let pending;assert.doesNotThrow(()=>{pending=operation();});await assert.rejects(pending,e=>e===marker);}assert.equal(calls,operations.length);}
  for(const [method,operation]of operations){let release,done=false;client[method]=()=>new Promise(resolve=>{release=resolve;});const pending=operation().then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);release(values);await pending;assert.equal(done,true);}
 }
});

test("original/current actual stock-count and movement workflows preserve equations, count IDs, reversals, delivery, deletion and real HTTP responses",async()=>{
 const {inventoryWorkflow}=await import("./helpers/inventory-worksheet-workflows.mjs"),results=[];
 for(const historical of [true,false]){const w=inventoryWorkflow(historical),responses=[];
  const save=()=>w.routes.counts.PUT(new Request("https://example.test/api/stock-counts",{method:"PUT",body:JSON.stringify({month:"2026-11",accountId:"shop",physicalCount:9,note:" note "})}));
  for(let i=0;i<2;i++){const r=await save();assert.equal(r.status,200);responses.push(await r.json());}assert.equal(w.data.counts[2][0],"STC-fixed-uuid");assert.equal(w.events.filter(e=>e[0]==="uuid").length,1);
  const adjustment=await w.adjustments.createStockAdjustment(w.service,[{id:"shop",shopName:"Shop"}],{requestId:"11111111-1111-4111-8111-111111111111",accountId:"shop",date:"2026-11-06",direction:"out",reason:"damage",quantity:2,notInLoyverse:true,itemDescription:"item"});
  const r=await w.routes.movement.PATCH(new Request("https://example.test/api/movements/M",{method:"PATCH",body:JSON.stringify({status:"delivered"})}),{params:Promise.resolve({id:" M "})});assert.equal(r.status,200);const delivered=await r.json();assert.equal(delivered.movementMaster.status,"delivered");assert.equal(delivered.movementMaster.totalQuantity,"5");responses.push(delivered);
  const removed=await w.routes.item.DELETE(new Request("https://example.test/api/movements/M/items/I2",{method:"DELETE"}),{params:Promise.resolve({id:" M ",itemId:" I2 "})});assert.equal(removed.status,200);responses.push(await removed.json());assert.equal(w.data.masters[1][5],"3");assert.ok(w.events.some(e=>e[0]==="delete"&&e[1]==="details"&&e[2]===3));
  const get=()=>w.routes.counts.GET(new Request("https://example.test/api/stock-counts?month=2026-11"));const before=await (await get()).json();assert.equal(before.stockCounts[0].calculatedStock,7);assert.equal(before.stockCounts[0].variance,2);
  const reversal=await w.adjustments.reverseStockAdjustment(w.service,{id:adjustment.id,note:"reverse"});assert.equal(reversal.id,"REV-"+adjustment.id);const after=await (await get()).json();assert.equal(after.stockCounts[0].calculatedStock,9);assert.equal(after.stockCounts[0].matches,true);responses.push(before,after);
  assert.ok(w.events.filter(e=>e[0]==="append"&&e[1]==="adjustments").every(e=>e[4]==="RAW"));results.push(plain({responses,data:w.data,events:w.events}));
 }assert.deepEqual(results[1],results[0]);
});

test("original/current real Inventory handlers preserve validation, rejection identity and nontransactional delivery/delete/count partial failures",async()=>{
 const {inventoryWorkflow}=await import("./helpers/inventory-worksheet-workflows.mjs");
 for(const scenario of ["invalid-count","missing-shop","read-failure","count-append","invalid-quantity","missing-movement","detail-write","delete-refresh"]){const results=[];for(const historical of [true,false]){
  const w=inventoryWorkflow(historical);let response;
  if(["invalid-count","missing-shop","count-append"].includes(scenario)){w.setFailure(op=>scenario==="count-append"&&op==="append");response=await w.routes.counts.PUT(new Request("https://example.test/api/stock-counts",{method:"PUT",body:JSON.stringify({month:"2026-11",accountId:scenario==="missing-shop"?"missing":"shop",physicalCount:scenario==="invalid-count"?-1:9})}));if(scenario==="count-append")assert.equal(w.data.counts.length,2);}
  else if(scenario==="read-failure"){w.setFailure(()=>true);response=await w.routes.counts.GET(new Request("https://example.test/api/stock-counts?month=2026-11"));assert.equal(w.events.filter(e=>e[0]==="read").length,1);}
  else if(scenario==="delete-refresh"){w.setFailure((op,name)=>op==="update"&&name==="masters");response=await w.routes.item.DELETE(new Request("https://example.test/x",{method:"DELETE"}),{params:Promise.resolve({id:"M",itemId:"I2"})});assert.equal(w.data.details.length,2);assert.equal(w.data.masters[1][5],"5");w.setFailure();const retry=await w.routes.item.DELETE(new Request("https://example.test/x",{method:"DELETE"}),{params:Promise.resolve({id:"M",itemId:"I2"})});assert.equal(retry.status,200);assert.equal(w.data.masters[1][5],"3");assert.equal(w.events.filter(e=>e[0]==="delete").length,1);}
  else{if(scenario==="invalid-quantity")w.data.details[1][3]="0";if(scenario==="missing-movement")w.data.masters.length=1;w.setFailure((op,name,range)=>scenario==="detail-write"&&op==="update"&&name==="details"&&range==="A3:N3");response=await w.routes.movement.PATCH(new Request("https://example.test/x",{method:"PATCH",body:JSON.stringify({status:"delivered"})}),{params:Promise.resolve({id:"M"})});if(scenario==="detail-write"){assert.equal(w.data.details[1][9],"delivered");assert.equal(w.data.details[2][9],"created");assert.equal(w.data.masters[1][4],"created");}}
  assert.equal(response.status,scenario==="invalid-count"?400:scenario==="missing-shop"||scenario==="missing-movement"?404:scenario==="invalid-quantity"?409:500);results.push(plain({status:response.status,body:await response.json(),data:w.data,events:w.events}));
 }assert.deepEqual(results[1],results[0],scenario);}
});

test("three Inventory moves restore exact original sources/ASTs, single owners and every unrelated production/earlier fixture byte",async()=>{
 const {readFileSync,readdirSync,existsSync}=await import("node:fs"),{inventoryWorksheetFiles,inventoryWorksheetDestinations,inventoryWorksheetHash,assertInventoryWorksheetHistory}=await import("./helpers/inventory-worksheet-history.mjs");
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);
 for(const [file,hash]of Object.entries(inventoryWorksheetsBefore.productionHashes)){if(completionExtraFiles.has(file))assertCompletionHistory(file,hash);else if(hrFiles.has(file))assertHRHistory(file,hash);else if(expensesFiles.has(file))assertExpensesHistory(file,hash);else if(remainingFiles.has(file))assertRemainingHistory(file,hash);else if(userStateFiles.has(file))assertUserStateHistory(file,hash);else if(salesQueryFiles.has(file))assertSalesQueryHistory(file,hash);else if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,hash);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,hash);else assert.equal(inventoryWorksheetHash(readFileSync(file)),hash,file);}
 assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(inventoryWorksheetsBefore.productionHashes,f)).sort(),[...inventoryWorksheetDestinations,...movementSchemaNewFiles,...salesQueryNewFiles,...completionNewFiles,...hrNewFiles,...expensesNewFiles,...remainingDestinations,...userStateDestinations].sort());
 for(const [file,hash]of Object.entries(inventoryWorksheetsBefore.fixtureHashes))assert.equal(inventoryWorksheetHash(readFileSync(file)),hash,file);
 const sources=walk("src").filter(f=>f.endsWith(".ts")).map(f=>readFileSync(f,"utf8")).join("\n");for(const e of Object.values(inventoryWorksheetsBefore.moves))assert.equal((sources.match(new RegExp(`export ${e.to.endsWith("const.ts")?"const":"class"} ${e.export}\\b`,"g"))??[]).length,1,e.export);
 assert.equal(existsSync("src/modules/inventory/infrastructure/google-sheets/movements/const.ts"),false);
});

test("Inventory physical/legacy/index/registry constructors, prototypes, mutable header identity and existing movement batch mapping remain exact",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs"),g=googleGraph(),registry=g.load("src/externals/google/sheet/index.ts"),index=g.load(old+"index.ts"),original=googleGraph({historical:true});
 assert.deepEqual(Object.keys(registry),Object.keys(original.load("src/externals/google/sheet/index.ts")));assert.deepEqual(Object.keys(index),Object.keys(original.load(old+"index.ts")));
 const settings=new Proxy({spreadsheetId:"synthetic",serviceAccountEmail:"email",serviceAccountPrivateKey:"synthetic"},{get:(o,k)=>o[k]??String(k)}),service=new registry.GoogleSheetsService(settings);
 for(const spec of inventoryWorksheetsBefore.worksheets){const file=old+spec.folder+"/"+spec.name+".ts",C=g.load(inventoryWorksheetsBefore.moves[file].to)[spec.name];assert.equal(g.load(file)[spec.name],C);assert.equal(Object.getPrototypeOf(C),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(C.prototype),registry.BaseGoogleSheet.prototype);assert.equal(C.prototype.constructor,C);assert.equal(service[spec.property].constructor,C);
  if(spec.header){assert.equal(registry[spec.name],C);assert.equal(index[spec.name],C);const leaf=old+spec.folder+"/const.ts",headers=g.load(inventoryWorksheetsBefore.moves[leaf].to)[spec.header];assert.equal(headers,g.load(leaf)[spec.header]);assert.equal(headers,registry[spec.header]);assert.deepEqual(plain(headers),spec.headers);assert.equal(Object.isFrozen(headers),false);
   const ranges=[],sheet=new C({getValues:async(...a)=>{ranges.push(a);return [];}},"mutable");headers.push("extra");await sheet.readRows();headers.pop();await sheet.readRows();assert.deepEqual(plain(ranges),[["mutable","A:J"],["mutable","A:I"]]);
  }else{assert.equal(Object.hasOwn(registry,spec.name),false);assert.equal(Object.hasOwn(index,spec.name),false);assert.equal(service.movementDetails.constructor,C);const calls=[],sheet=new C({deleteRow:async(...a)=>calls.push(a)},"movement");await sheet.deleteRow(0);assert.deepEqual(calls,[["movement",0]]);}
 }
 const batches=[],result=[["details"],["user"],["masters"]];service.client.getValuesBatch=async(ranges)=>{batches.push(ranges);return result;};
 assert.equal(await service.readMovementRanges([{sheet:"movementDetails",range:"A:N"},{sheet:"userState",range:"A:H"},{sheet:"movementMasters",range:"A2:H"}]),result);
 assert.deepEqual(plain(batches),[[{worksheetName:"movementDetailWorksheetName",range:"A:N"},{worksheetName:"userStateWorksheetName",range:"A:H"},{worksheetName:"movementMasterWorksheetName",range:"A2:H"}]]);
 for(const file of ["src/config/index.ts","src/modules/inventory/server.ts","src/services/movements/manageMovements.ts"])assert.throws(()=>g.load(file),/Unapproved provider dependency/);
});

test("saved-original/current real Inventory worksheet/client requests retain exact URLs, modes, payloads and delete-row transport/error behavior",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs"),traces=[];
 for(const historical of [true,false]){const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,...init});if(failure)throw failure;return Response.json({values:[["row",0,null,false]],sheets:[{properties:{sheetId:7,title:"Inventory' Sheet"}}]});}}}),{GoogleSheetsClient}=g.load("src/externals/google/sheet/client/index.ts"),client=new GoogleSheetsClient({getAccessToken:async()=>"fake-token"},"sheet/id");
  for(const spec of inventoryWorksheetsBefore.worksheets){const C=g.load(old+spec.folder+"/"+spec.name+".ts")[spec.name],sheet=new C(client,"Inventory' Sheet");assert.deepEqual(plain(await sheet.readRows()),[["row",0,null,false]]);assert.equal(requests.at(-1).method,"GET");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'Inventory'' Sheet'!"+spec.range)));await sheet.readRows("B2:C3");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'Inventory'' Sheet'!B2:C3")));
   const values=[["id",0,null,false,"=original"]];await sheet.appendRows("A:ZZ",values);assert.equal(requests.at(-1).method,"POST");assert.ok(requests.at(-1).url.endsWith(":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});await sheet.updateRows("B2:C3",values);assert.equal(requests.at(-1).method,"PUT");assert.ok(requests.at(-1).url.endsWith("?valueInputOption=USER_ENTERED"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});
   if(!spec.header){const before=requests.length;await sheet.deleteRow(7);assert.equal(requests.length,before+2);assert.equal(requests.at(-2).method,"GET");assert.ok(requests.at(-2).url.endsWith("?fields=sheets.properties(sheetId,title)"));assert.equal(requests.at(-1).method,"POST");assert.ok(requests.at(-1).url.endsWith(":batchUpdate"));assert.deepEqual(JSON.parse(requests.at(-1).body),{requests:[{deleteDimension:{range:{sheetId:7,dimension:"ROWS",startIndex:6,endIndex:7}}}]});const n=requests.length;await assert.rejects(sheet.deleteRow(1),/Only data rows/);assert.equal(requests.length,n);}
   failure=new Error("synthetic network");const before=requests.length;await assert.rejects(spec.header?sheet.updateRows("A1",values):sheet.deleteRow(7),e=>e===failure);assert.equal(requests.length,before+1);failure=undefined;
  }
  for(const r of requests){assert.ok(r.url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/sheet%2Fid"));assert.equal(r.headers.Authorization,"Bearer fake-token");}traces.push(plain(requests));
 }
 assert.deepEqual(traces[1],traces[0]);
});

test("Inventory exact lint and resolved runtime/type graphs reject LINE/private/barrel bypasses and preserve the four original browser erased debts",async()=>{
 const {readFileSync}=await import("node:fs"),{resolve,relative}=await import("node:path"),{ESLint}=await import("eslint"),{default:ts}=await import("typescript"),{inventoryWorksheetDestinations}=await import("./helpers/inventory-worksheet-history.mjs");
 const eslint=new ESLint();for(const file of inventoryWorksheetDestinations){const [r]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(r.errorCount,0,JSON.stringify(r.messages));}
 const bad=[
 'import type { IGoogleSheetsService } from "@/externals/google/sheet"; export type X=IGoogleSheetsService;',
 'import { parseQuantity } from "@/features/backend/line/services/movements/utils"; export {parseQuantity};',
 'import { parseQuantity } from "../../../../../../features/backend/line/services/movements/utils"; export {parseQuantity};',
 'import { listMovements } from "@/services/movements"; export {listMovements};',
 'import { EMPLOYEE_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employees/const"; export {EMPLOYEE_HEADERS};',
 'import { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client"; export {GoogleSheetsClient};',
 'export { GoogleSheetsService } from "@/externals/google/sheet";',
 'const x=import("@/config"); export {x};',
 'const x=require("node:fs"); export {x};',
 'export type X=import("@/externals/google/sheet/types").GoogleSheetRow;',
 'import { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types"; export const x=GoogleSheetRow;',
 'export const x=Date.now();',
 ];
 for(const file of inventoryWorksheetDestinations)for(const source of bad){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,`${file}: ${source}`);}
 const movement="src/modules/inventory/infrastructure/google-sheets/movements/MovementSheet.ts";
 for(const path of ["@/infrastructure/persistence/google-sheets/const","./const"]){const [r]=await eslint.lintText(`import { x } from "${path}"; export {x};`,{filePath:movement});assert.ok(r.errorCount>0,path);}
 const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
 const resolved=(file,spec)=>{const target=ts.resolveModuleName(spec,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;return target&&relative(process.cwd(),target);};
 function deps(file,types,overrides={}){const ast=ts.createSourceFile(file,overrides[file]??readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);return ast.statements.flatMap(n=>{if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];const named=n.importClause?.namedBindings,e=named&&ts.isNamedImports(named)?named.elements:undefined,erased=n.isTypeOnly||n.importClause?.isTypeOnly||(e?.length&&!n.importClause.name&&e.every(x=>x.isTypeOnly));if(!types&&erased)return [];const p=resolved(file,n.moduleSpecifier.text);return p?.startsWith("src/")&&/\.tsx?$/.test(p)?[p]:[];});}
 function graph(types,overrides={}){const active=[],seen=new Set(),edges=new Set();function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/([^/]+)\//.exec(file)?.[1]??from;if(from&&owner!==from)edges.add(`${from}->${owner}`);if(owner==="inventory")assert.ok(!file.startsWith("src/features/backend/line/"),"Inventory -> LINE private dependency: "+file);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);deps(file,types,overrides).forEach(dep=>visit(dep,owner));active.pop();seen.add(key);}
  [...Object.keys(inventoryWorksheetsBefore.productionHashes),...inventoryWorksheetDestinations].filter(f=>f.startsWith("src/modules/")&&/\.tsx?$/.test(f)).forEach(f=>visit(f));assert.deepEqual([...edges].sort(),["shipments->orders"]);return {edges:[...edges].sort(),files:seen.size,paths:[...seen].map(key=>key.slice(key.indexOf(":")+1))};
 }
 for(const types of [false,true]){
  const base=graph(types,{"src/modules/hr/server.ts":workforceBefore.files["src/modules/hr/server.ts"].source}),actual=graph(types),added=completionNewFiles.filter(file=>types||!file.includes('/ports/'));
  if(types)added.push('src/modules/hr/application/ports/payroll.ts');
  assert.deepEqual({edges:base.edges,files:base.files},inventoryWorksheetsBefore.moduleGraphs[types?'types':'runtime'].proposed);
  assert.deepEqual(actual.edges,base.edges);assert.equal(actual.files,base.files+added.length);
  assert.deepEqual(actual.paths.filter(file=>!base.paths.includes(file)).sort(),added.sort());
  for(const path of ["@/features/backend/line/services/movements/utils","@/services/movements"])assert.throws(()=>graph(types,{[movement]:`import * as x from "${path}"; export {x};`}),/Inventory -> LINE/);
  assert.throws(()=>graph(types,{[movement]:'export { EMPLOYEE_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employees/const";'}),/inventory->hr/);
  assert.throws(()=>graph(types,{[movement]:'export { EMPLOYEE_HEADERS } from "@/externals/google/sheet";'}),/MovementSheet\.ts -> src\/externals\/google\/sheet\/index\.ts/);
 }
 assert.throws(()=>graph(true,{[movement]:'import type { MovementStatus } from "@/services/movements/manageMovements"; export type X=MovementStatus;'}),/Inventory -> LINE/);
 for(const file of inventoryWorksheetDestinations)for(const dep of deps(file,true))assert.ok(dep.startsWith(root)||dep===file.replace(/[^/]+$/,"const.ts"),`${file} -> ${dep}`);
 const reverse=new Map(Object.entries(inventoryWorksheetsBefore.moves).map(([from,e])=>[e.to,from])),actual=[];
 for(const entry of inventoryWorksheetsBefore.audit)assert.equal(resolved(entry.file,entry.specifier),entry.target);
 for(const file of Object.keys(inventoryWorksheetsBefore.productionHashes).filter(f=>f.startsWith(root)))for(const dep of deps(file,true))assert.ok(!dep.startsWith("src/modules/"),`${file} -> ${dep}`);
 for(const client of Object.keys(inventoryWorksheetsBefore.productionHashes).filter(f=>/\.tsx?$/.test(f)&&/^\s*["']use client["']/.test(readFileSync(f,"utf8"))))for(const types of [false,true]){
  const seen=new Set(),leaves=new Set();function visit(file){if(seen.has(file))return;seen.add(file);const from=reverse.get(file)??file;if(Object.hasOwn(inventoryWorksheetsBefore.moves,from))leaves.add(from);deps(file,types).forEach(visit);}visit(client);if(leaves.size)actual.push({root:client,types,leaves:[...leaves].sort()});
 }
 assert.deepEqual(actual,expectedHRDebts(expectedExpensesDebts(inventoryWorksheetsBefore.browserBaseline)));assert.equal(actual.length,0);assert.ok(actual.every(e=>e.types));assert.equal(inventoryWorksheetsBefore.operationalScripts.length,3);
});
