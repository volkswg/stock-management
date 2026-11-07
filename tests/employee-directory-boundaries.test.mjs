import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import { inventoryWorksheetFiles, inventoryWorksheetDestinations, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import { hrWorksheetsBefore, hrWorksheetFiles, hrWorksheetDestinations, assertHrWorksheetHistory } from "./helpers/hr-worksheet-history.mjs";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve,relative} from "node:path";
import test from "node:test";
import ts from "typescript";
import {ESLint} from "eslint";
import {directoryBefore,directoryLegacy,directoryNewFiles} from "./helpers/employee-directory.mjs";
import {directoryFiles,assertDirectoryHistory,directoryHash} from "./helpers/employee-directory-history.mjs";
const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
test("exact employee-seam source restoration preserves every unrelated function, class, route, DTO and production byte",()=>{
 for(const [file,expected]of Object.entries(directoryBefore.productionHashes)){if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,expected);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,expected);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,expected);else if(directoryFiles.has(file))assertDirectoryHistory(file,expected);else assert.equal(directoryHash(readFileSync(file)),expected,file);}
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(directoryBefore.productionHashes,f)).sort(),[...directoryNewFiles,...hrWorksheetDestinations,...inventoryWorksheetDestinations,...movementSchemaNewFiles].sort());
 const print=ts.createPrinter(),parse=(file,source=readFileSync(file,"utf8"))=>ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 for(const [file,saved]of Object.entries(directoryBefore.files)){const current=parse(file);for(const [name,declaration]of Object.entries(saved.declarations)){if(name==="listAdjustmentEmployees"||["AdjustmentEmployee","StockCountAccount"].includes(name))continue;const node=current.statements.find(n=>n.name?.text===name);assert.equal(print.printNode(ts.EmitHint.Unspecified,node,current),declaration.ast,`${file}:${name}`);}}
 const owned=parse("src/modules/inventory/contracts.ts");for(const [name,file]of [["AdjustmentEmployee","src/services/stock-adjustments/types.ts"],["StockCountAccount","src/services/stock-counts/manageStockCounts.ts"]]){const node=owned.statements.find(n=>n.name?.text===name);assert.equal(print.printNode(ts.EmitHint.Unspecified,node,owned),directoryBefore.files[file].declarations[name].ast);}
 const old=parse(directoryLegacy,directoryBefore.files[directoryLegacy].source),reader=parse("src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts");
 const oldBody=old.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==="listAdjustmentEmployees").body,method=reader.statements.find(ts.isClassDeclaration).members.find(n=>n.name?.getText(reader)==="listEmployees");
 const restored=print.printNode(ts.EmitHint.Unspecified,method.body,reader).replaceAll("this.service","service").replace("this.unavailableError()",'new StockAdjustmentError("Employee storage headers do not match.", 503)');
 assert.equal(restored,print.printNode(ts.EmitHint.Unspecified,oldBody,old));
 const textNode=ast=>ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations[0].name.getText(ast)==="text");assert.equal(print.printNode(ts.EmitHint.Unspecified,textNode(reader),reader),print.printNode(ts.EmitHint.Unspecified,textNode(old),old));
 assert.equal(directoryHash(readFileSync("src/app/api/stock-adjustments/route.ts")),directoryBefore.routeHash);
});

test("directory modules and composition have exact imports, erased interfaces and no private cross-feature or dynamic bypass",async()=>{
 const eslint=new ESLint();for(const file of directoryNewFiles){const [r]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(r.errorCount,0,JSON.stringify(r.messages));}
 for(const file of directoryNewFiles)for(const source of ['import { x } from "@/config"; export {x};','import { X } from "../../../../services/stock-adjustments/manageStockAdjustments"; export {X};','export { X } from "@/modules/hr/infrastructure/google-sheets/employee-directory-reader";','const x=import("@/externals/google/sheet"); export {x};','const x=require("node:fs"); export {x};','export type X=import("@/externals/google/sheet/types").GoogleSheetRow;']){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,source);}
 for(const file of [directoryLegacy,"src/services/stock-counts/manageStockCounts.ts","src/services/movements/manageMovements.ts"]){const [r]=await eslint.lintText('import { EMPLOYEE_HEADERS } from "@/externals/google/sheet"; export {EMPLOYEE_HEADERS};',{filePath:file});assert.ok(r.errorCount>0);}
 for(const file of ["src/modules/hr/server.ts","src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts","src/services/stock-adjustments/employee-directory.ts"])assert.ok(readFileSync(file,"utf8").startsWith('import "server-only";'));
 assert.doesNotMatch(readFileSync("src/modules/inventory/application/ports/employee-directory.ts","utf8"),/GoogleSheet|headers|range|createdAt|File|Buffer|config/);
});
for(const types of [false,true])test(`actual relocated HR worksheet graphs preserve module direction and no private Inventory->HR edge (${types?"including types":"runtime"})`,()=>{
 for(const [file,saved]of Object.entries(hrWorksheetsBefore.moves))assertHrWorksheetHistory(file,saved.sha256);
 function graph(overrides={}){const host={...ts.sys,directoryExists:d=>Object.keys(overrides).some(f=>resolve(f).startsWith(resolve(d)+"/"))||ts.sys.directoryExists(d),fileExists:f=>Object.hasOwn(overrides,relative(process.cwd(),f))||ts.sys.fileExists(f)},edges=new Set(),seen=new Set(),active=[];
  function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/([^/]+)\//.exec(file)?.[1]??from;if(from&&owner!==from)edges.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);const ast=ts.createSourceFile(file,overrides[file]??readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);for(const n of ast.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier||(!types&&(n.isTypeOnly||n.importClause?.isTypeOnly)))continue;const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,host).resolvedModule?.resolvedFileName,dep=target&&relative(process.cwd(),target);if(dep?.startsWith("src/"))visit(dep,owner);}active.pop();seen.add(key);}
  [...Object.keys(directoryBefore.productionHashes),...directoryNewFiles,...hrWorksheetDestinations,...inventoryWorksheetDestinations].filter(f=>f.startsWith("src/modules/")&&/\.tsx?$/.test(f)).forEach(f=>visit(f));assert.deepEqual([...edges].sort(),["shipments->orders"]);
  // Composition is outside modules and depends on both public surfaces, never HR private adapters from Inventory.
  visit("src/services/stock-adjustments/employee-directory.ts");
 }
 graph();
 for(const path of ["@/modules/hr/infrastructure/google-sheets/employees/const","@/externals/google/sheet/sheets/employees/const","@/externals/google/sheet"]){
  assert.throws(()=>graph({"src/modules/inventory/application/ports/employee-directory.ts":`export { EMPLOYEE_HEADERS } from "${path}";`}),/inventory->hr/);
 }
 const blocked=new Set(["src/modules/hr/server.ts","src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts","src/services/stock-adjustments/employee-directory.ts","src/modules/inventory/application/list-adjustment-employees.ts"]),browserSeen=new Set();
 function browser(file){if(browserSeen.has(file))return;browserSeen.add(file);assert.ok(!blocked.has(file),`New employee IO entered a browser graph: ${file}`);const ast=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);for(const n of ast.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier||(!types&&(n.isTypeOnly||n.importClause?.isTypeOnly)))continue;const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName,dep=target&&relative(process.cwd(),target);if(dep?.startsWith("src/")&&/\.tsx?$/.test(dep))browser(dep);}}
 Object.keys(directoryBefore.productionHashes).filter(f=>/\.tsx?$/.test(f)&&/^\s*["']use client["']/.test(readFileSync(f,"utf8"))).forEach(browser);
 const source=readFileSync(directoryLegacy,"utf8");assert.doesNotMatch(source,/EMPLOYEE_HEADERS|modules\/hr\/|from "@\/externals\/google\/sheet"/);
});
