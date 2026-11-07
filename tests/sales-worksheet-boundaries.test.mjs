import { expectedExpensesDebts } from "./helpers/expenses-business-history.mjs";
import { assertDirectoryHistory } from "./helpers/employee-directory-history.mjs";
import { directoryBefore } from "./helpers/employee-directory.mjs";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,relative} from "node:path";
import test from "node:test";
import ts from "typescript";
import {ESLint} from "eslint";
import {salesWorksheetsBefore,salesWorksheetDestinations} from "./helpers/sales-worksheet-history.mjs";
import {browserOwnership,ownershipEdges} from "./helpers/browser-ownership.mjs";
const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
function dependencies(file,types){const ast=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);return ast.statements.flatMap(n=>{if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];const named=n.importClause?.namedBindings,e=named&&ts.isNamedImports(named)?named.elements:undefined,erased=n.isTypeOnly||n.importClause?.isTypeOnly||(e?.length&&!n.importClause.name&&e.every(x=>x.isTypeOnly));if(!types&&erased)return [];const resolved=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName,path=resolved&&relative(process.cwd(),resolved).replaceAll("\\","/");return path?.startsWith("src/")&&/\.tsx?$/.test(path)?[path]:[];});}
for(const types of [false,true])test(`Sales leaves and all three module graphs are acyclic; existing browser/ownership isolation remains (${types?"runtime plus types":"runtime"})`,()=>{
 const active=[],seen=new Set(),edges=new Set();function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/(orders|shipments|sales)\//.exec(file)?.[1]??from;if(from&&owner!==from)edges.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);dependencies(file,types).forEach(dep=>visit(dep,owner));active.pop();seen.add(key);}
 const roots=Object.keys(salesWorksheetsBefore.productionHashes).filter(f=>/^src\/modules\//.test(f)&&/\.tsx?$/.test(f));[...roots,...salesWorksheetDestinations].forEach(f=>visit(f));assert.deepEqual([...edges].sort(),["shipments->orders"]);
 for(const file of salesWorksheetDestinations)for(const dep of dependencies(file,types))assert.ok(dep.startsWith("src/infrastructure/persistence/google-sheets/")||dep===file.replace(/[^/]+$/,"const.ts"),`${file} -> ${dep}`);
 // Registry and unchanged legacy Sales services remain server composition/legacy consumers.
 for(const file of ["src/externals/google/sheet/index.ts",...Object.keys(salesWorksheetsBefore.productionHashes).filter(p=>p.startsWith("src/services/sales/")&&p.endsWith(".ts"))])visit(file);
 const browser=new Set();function safe(file){if(browser.has(file))return;browser.add(file);assert.ok(!/\/infrastructure\/|\/application\/|\/server\.ts$|^src\/(services|externals|config)\//.test(file),file);dependencies(file,types).forEach(safe);}
 roots.filter(f=>/\/ui\/|\/contracts\.ts$/.test(f)).concat("src/app/loyverse/daily-sales/LoyverseDailySalesPage.tsx").forEach(safe);assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
});

test("all existing client graphs gain no Sales runtime reachability; legacy erased mixed-barrel debt retains its exact baseline except the two reviewed movement type-import removals",()=>{
 const reverse=new Map(Object.entries(salesWorksheetsBefore.moves).map(([old,e])=>[e.to,old]));const actual=[];
 for(const root of Object.keys(salesWorksheetsBefore.productionHashes).filter(p=>/\.tsx?$/.test(p)&&/^\s*["']use client["']/.test(readFileSync(p,"utf8"))))for(const types of [false,true]){
  const seen=new Set(),found=new Set();function visit(file){if(seen.has(file))return;seen.add(file);const original=reverse.get(file)??file;if(salesWorksheetsBefore.moves[original])found.add(original);dependencies(file,types).forEach(visit);}visit(root);
  if(found.size)actual.push({root,types,leaves:[...found].sort()});
 }
 const removed=new Set(["src/app/movements/MovementListPage.tsx","src/app/movements/[id]/MovementDetailPage.tsx"]);
 assertDirectoryHistory("src/services/movements/manageMovements.ts",directoryBefore.files["src/services/movements/manageMovements.ts"].sha256);
 assert.equal(salesWorksheetsBefore.browserBaseline.filter(e=>removed.has(e.root)).length,2);
 const expected=expectedExpensesDebts(salesWorksheetsBefore.browserBaseline).filter(e=>!removed.has(e.root)).map(e=>({root:e.root,types:e.types,leaves:e.found.map(x=>x.file).sort()}));assert.deepEqual(actual,expected);assert.ok(actual.every(x=>x.types));
});

test("exact Sales import rules reject bypasses and the complete pre-move consumer/script audit still resolves unchanged legacy imports",async()=>{
 const eslint=new ESLint();for(const file of salesWorksheetDestinations){const [r]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(r.errorCount,0,JSON.stringify(r.messages));}
 for(const file of salesWorksheetDestinations.filter(f=>!f.endsWith("const.ts")))for(const source of [
 'import type { IGoogleSheetsService } from "@/externals/google/sheet"; export type X=IGoogleSheetsService;',
 'import { Other } from "../../../../orders/server"; export { Other };',
 'export { GoogleSheetsService } from "@/externals/google/sheet";',
 'const x=import("@/config"); export {x};',
 'const x=require("node:fs"); export {x};',
 'export type X=import("@/externals/google/sheet/types").GoogleSheetRow;',
 'import { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types"; export const x=GoogleSheetRow;',
 ]){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,source);}
 assert.ok(salesWorksheetsBefore.audit.length>50);for(const entry of salesWorksheetsBefore.audit){const target=ts.resolveModuleName(entry.specifier,resolve(entry.file),options,ts.sys).resolvedModule?.resolvedFileName;assert.equal(relative(process.cwd(),target),entry.target);}
 assert.ok(salesWorksheetsBefore.audit.some(x=>x.file==="src/services/sales/syncLoyverseDailySales.ts"));assert.equal(salesWorksheetsBefore.operationalScripts.length,3);
});
