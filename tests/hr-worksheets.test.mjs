import { userStateFiles, userStateDestinations, assertUserStateHistory } from "./helpers/user-state-worksheet-history.mjs";
import { salesQueryFiles, salesQueryNewFiles, assertSalesQueryHistory } from "./helpers/inventory-sales-query-history.mjs";
import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import { inventoryWorksheetFiles, inventoryWorksheetDestinations, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {loadSource,plain} from "./helpers/load-source.mjs";
import {hrWorksheetsBefore} from "./helpers/hr-worksheet-history.mjs";
const old="src/externals/google/sheet/sheets/",root="src/infrastructure/persistence/google-sheets/";
test("original three HR worksheets retain headers, dynamic default/explicit ranges, payload identities, pending writes and synchronous/asynchronous failures",async()=>{
 for(const spec of hrWorksheetsBefore.worksheets){
  const headers=loadSource(old+spec.folder+"/const.ts");assert.deepEqual(plain(headers[spec.header]),spec.headers);assert.equal(Object.isFrozen(headers[spec.header]),false);
  const values=[["id",0,null,false,"=literal"]],events=[],client={getValues:async(...a)=>{events.push(["get",...a]);return values;},appendValues:async(...a)=>events.push(["append",...a]),updateValues:async(...a)=>events.push(["update",...a])};
  const base=loadSource(root+"sheets/BaseGoogleSheet.ts"),constants=loadSource(root+"const.ts"),C=loadSource(old+spec.folder+"/"+spec.name+".ts",{imports:{"../BaseGoogleSheet":base,"../../const":constants,"./const":headers}})[spec.name],sheet=new C(client,"HR' Sheet");assert.deepEqual(events,[]);
  assert.equal(await sheet.readRows(),values);await sheet.readRows("B2:C3");await sheet.appendRows("A:ZZ",values);await sheet.updateRows("B2:C3",values);headers[spec.header].push("_probe");await sheet.readRows();headers[spec.header].pop();assert.deepEqual(plain(events),spec.events);assert.equal(events[2][3],values);assert.equal(events[3][3],values);
  for(const sync of [true,false]){let calls=0;const error=new Error("synthetic");for(const [method,operation]of [["getValues",()=>sheet.readRows()],["appendValues",()=>sheet.appendRows("A:ZZ",values)],["updateValues",()=>sheet.updateRows("B2:C3",values)]]){client[method]=()=>{calls++;if(sync)throw error;return Promise.reject(error);};let pending;assert.doesNotThrow(()=>{pending=operation();});await assert.rejects(pending,e=>e===error);}assert.equal(calls,3);}
  for(const [method,operation]of [["appendValues",()=>sheet.appendRows("A:ZZ",values)],["updateValues",()=>sheet.updateRows("B2:C3",values)]]){let release,done=false;client[method]=()=>new Promise(resolve=>{release=resolve;});const pending=operation().then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);release();await pending;assert.equal(done,true);}
 }
});

test("six exact HR moves reconstruct original declarations/bytes; unique owners, all other production and earlier fixtures remain unchanged",async()=>{
 const {readFileSync,readdirSync}=await import("node:fs"),{hrWorksheetFiles,hrWorksheetDestinations,hrWorksheetHash,assertHrWorksheetHistory}=await import("./helpers/hr-worksheet-history.mjs");
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);
 for(const [file,hash]of Object.entries(hrWorksheetsBefore.productionHashes)){if(userStateFiles.has(file))assertUserStateHistory(file,hash);else if(salesQueryFiles.has(file))assertSalesQueryHistory(file,hash);else if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,hash);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,hash);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,hash);else assert.equal(hrWorksheetHash(readFileSync(file)),hash,file);}
 assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(hrWorksheetsBefore.productionHashes,f)).sort(),[...hrWorksheetDestinations,...inventoryWorksheetDestinations,...movementSchemaNewFiles,...salesQueryNewFiles,...userStateDestinations].sort());
 for(const [file,hash]of Object.entries(hrWorksheetsBefore.fixtureHashes))assert.equal(hrWorksheetHash(readFileSync(file)),hash,file);
 const sources=walk("src").filter(f=>f.endsWith(".ts")).map(f=>readFileSync(f,"utf8")).join("\n");
 for(const e of Object.values(hrWorksheetsBefore.moves))assert.equal((sources.match(new RegExp(`export ${e.to.endsWith("const.ts")?"const":"class"} ${e.export}\\b`,"g"))??[]).length,1,e.export);
});

test("physical/legacy/both-index/registry HR constructors, prototypes, exports and mutable header objects retain exact identity",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs"),g=googleGraph(),registry=g.load("src/externals/google/sheet/index.ts"),index=g.load(old+"index.ts"),original=googleGraph({historical:true});
 assert.deepEqual(Object.keys(registry),Object.keys(original.load("src/externals/google/sheet/index.ts")));assert.deepEqual(Object.keys(index),Object.keys(original.load(old+"index.ts")));
 const settings=new Proxy({spreadsheetId:"synthetic",serviceAccountEmail:"email",serviceAccountPrivateKey:"synthetic"},{get:(o,k)=>o[k]??String(k)}),service=new registry.GoogleSheetsService(settings);
 for(const spec of hrWorksheetsBefore.worksheets){
  const file=old+spec.folder+"/"+spec.name+".ts",C=g.load(hrWorksheetsBefore.moves[file].to)[spec.name];assert.equal(g.load(file)[spec.name],C);assert.equal(registry[spec.name],C);assert.equal(index[spec.name],C);assert.equal(service[spec.property].constructor,C);assert.equal(Object.getPrototypeOf(C),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(C.prototype),registry.BaseGoogleSheet.prototype);assert.equal(C.prototype.constructor,C);
  const leaf=old+spec.folder+"/const.ts",headers=g.load(hrWorksheetsBefore.moves[leaf].to)[spec.header];assert.equal(headers,g.load(leaf)[spec.header]);assert.equal(headers,registry[spec.header]);assert.deepEqual(plain(headers),spec.headers);assert.equal(Object.isFrozen(headers),false);
  const calls=[],sheet=new C({getValues:async(...a)=>{calls.push(a);return []; }},"mutable");headers.push("extra");await sheet.readRows();headers.pop();await sheet.readRows();assert.deepEqual(plain(calls),[["mutable",`A:${String.fromCharCode(spec.range.at(-1).charCodeAt(0)+1)}`],["mutable",spec.range]]);
 }
 for(const file of ["src/config/index.ts","src/modules/hr/server.ts","src/services/employees/manageEmployees.ts"])assert.throws(()=>g.load(file),/Unapproved provider dependency/);
});

test("saved-original/current real HR worksheets and GoogleSheetsClient preserve quoted URLs, methods, USER_ENTERED/INSERT_ROWS payloads and errors",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs"),traces=[];
 for(const historical of [true,false]){const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,...init});if(failure)throw failure;return Response.json({values:[["row",0,null,false]]});}}}),{GoogleSheetsClient}=g.load("src/externals/google/sheet/client/index.ts"),client=new GoogleSheetsClient({getAccessToken:async()=>"fake-token"},"sheet/id");
  for(const spec of hrWorksheetsBefore.worksheets){const C=g.load(old+spec.folder+"/"+spec.name+".ts")[spec.name],sheet=new C(client,"HR' Sheet");assert.deepEqual(plain(await sheet.readRows()),[["row",0,null,false]]);assert.equal(requests.at(-1).method,"GET");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'HR'' Sheet'!"+spec.range)));await sheet.readRows("B2:C3");assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'HR'' Sheet'!B2:C3")));
   const values=[["id",0,null,false,"=original"]];await sheet.appendRows("A:ZZ",values);assert.equal(requests.at(-1).method,"POST");assert.ok(requests.at(-1).url.endsWith(":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});await sheet.updateRows("B2:C3",values);assert.equal(requests.at(-1).method,"PUT");assert.ok(requests.at(-1).url.endsWith("?valueInputOption=USER_ENTERED"));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});
   failure=new Error("synthetic network");const n=requests.length;await assert.rejects(sheet.updateRows("A1",values),e=>e===failure);assert.equal(requests.length,n+1);failure=undefined;
  }
  for(const r of requests){assert.ok(r.url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/sheet%2Fid/values/"));assert.equal(r.headers.Authorization,"Bearer fake-token");}traces.push(plain(requests));
 }
 assert.deepEqual(traces[1],traces[0]);
});

test("actual HR worksheet with unchanged directory/application/stock-adjustment HTTP retains original responses, prefix/errors and read timing",async()=>{
 const {googleGraph}=await import("./helpers/google-infrastructure.mjs"),{directoryGraph,directorySheets}=await import("./helpers/employee-directory.mjs");
 for(const scenario of ["valid","extra-header","bad-header","reject"]){const results=[];for(const historical of [true,false]){
  const events=[],g=googleGraph({historical}),registry=g.load("src/externals/google/sheet/index.ts"),headers=Array.from(registry.EMPLOYEE_HEADERS),marker=new Error("read failed"),rows=[scenario==="bad-header"?["wrong"]:scenario==="extra-header"?[...headers,"extra"]:headers,[" e "," Name ","phone","unknown","2026-01-01","","c","u","actor"]];
  const service=directorySheets({events});service.employees=new registry.EmployeesSheet({getValues:async(...args)=>{events.push(["get",...args]);if(scenario==="reject")throw marker;return rows;}},"Employees");
  const dir=directoryGraph({service,events}),response=await dir.load("src/app/api/stock-adjustments/route.ts").GET(new Request("https://example.test/api/stock-adjustments?month=2026-11"));results.push({status:response.status,body:await response.json(),events});assert.equal(events.filter(e=>e[0]==="get").length,1);assert.ok(events.some(e=>e[0]==="get"&&e[1]==="Employees"&&e[2]==="A:I"));
 }assert.deepEqual(results[1],results[0]);assert.equal(results[0].status,scenario==="bad-header"?503:scenario==="reject"?500:200);}
});

test("exact HR lint/import allowlists and resolved consumer/browser graphs preserve the four named erased debts without new provider or reverse edges",async()=>{
 const {readFileSync}=await import("node:fs"),{resolve,relative}=await import("node:path"),{ESLint}=await import("eslint"),{default:ts}=await import("typescript"),{hrWorksheetDestinations}=await import("./helpers/hr-worksheet-history.mjs");
 const eslint=new ESLint();for(const file of hrWorksheetDestinations){const [r]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(r.errorCount,0,JSON.stringify(r.messages));}
 const bad=[
 'import type { IGoogleSheetsService } from "@/externals/google/sheet"; export type X=IGoogleSheetsService;',
 'import type { IGoogleRowsSheet } from "../../../../../../externals/google/sheet/types"; export type X=IGoogleRowsSheet;',
 'import { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client"; export {GoogleSheetsClient};',
 'import { X } from "../../../../inventory/server"; export {X};',
 'export { GoogleSheetsService } from "@/externals/google/sheet";',
 'const x=import("@/config"); export {x};',
 'const x=require("node:fs"); export {x};',
 'export type X=import("@/externals/google/sheet/types").GoogleSheetRow;',
 'import { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types"; export const x=GoogleSheetRow;',
 'export const x=Date.now();',
 ];
 for(const file of hrWorksheetDestinations)for(const source of bad){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,`${file}: ${source}`);}
 for(const file of ["src/modules/inventory/application/ports/employee-directory.ts","src/services/stock-adjustments/manageStockAdjustments.ts"])
  for(const path of ["@/modules/hr/infrastructure/google-sheets/employees/const","@/externals/google/sheet/sheets/employees/const","@/externals/google/sheet"]){const [r]=await eslint.lintText(`import { EMPLOYEE_HEADERS } from "${path}"; export {EMPLOYEE_HEADERS};`,{filePath:file});assert.ok(r.errorCount>0,path);}
 const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
 const resolved=(file,spec)=>{const target=ts.resolveModuleName(spec,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;return target&&relative(process.cwd(),target);};
 function deps(file,types){const ast=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);return ast.statements.flatMap(n=>{if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];const named=n.importClause?.namedBindings,e=named&&ts.isNamedImports(named)?named.elements:undefined,erased=n.isTypeOnly||n.importClause?.isTypeOnly||(e?.length&&!n.importClause.name&&e.every(x=>x.isTypeOnly));if(!types&&erased)return [];const p=resolved(file,n.moduleSpecifier.text);return p?.startsWith("src/")&&/\.tsx?$/.test(p)?[p]:[];});}
 for(const file of hrWorksheetDestinations)for(const dep of deps(file,true))assert.ok(dep.startsWith(root)||dep===file.replace(/[^/]+$/,"const.ts"),`${file} -> ${dep}`);
 const reverse=new Map(Object.entries(hrWorksheetsBefore.moves).map(([from,e])=>[e.to,from])),actual=[];
 for(const entry of hrWorksheetsBefore.audit)assert.equal(resolved(entry.file,entry.specifier),entry.target);
 for(const entry of Object.keys(hrWorksheetsBefore.productionHashes).filter(f=>f.startsWith(root)))for(const dep of deps(entry,true))assert.ok(!dep.startsWith("src/modules/"),`${entry} -> ${dep}`);
 for(const client of Object.keys(hrWorksheetsBefore.productionHashes).filter(f=>/\.tsx?$/.test(f)&&/^\s*["']use client["']/.test(readFileSync(f,"utf8"))))for(const types of [false,true]){
  const seen=new Set(),leaves=new Set();function visit(file){if(seen.has(file))return;seen.add(file);const old=reverse.get(file)??file;if(Object.hasOwn(hrWorksheetsBefore.moves,old))leaves.add(old);deps(file,types).forEach(visit);}visit(client);if(leaves.size)actual.push({root:client,types,leaves:[...leaves].sort()});
 }
 assert.deepEqual(actual,hrWorksheetsBefore.browserBaseline);assert.equal(actual.length,4);assert.ok(actual.every(e=>e.types));assert.equal(hrWorksheetsBefore.operationalScripts.length,3);
});
