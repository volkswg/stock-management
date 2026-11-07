import {readArchive} from "./helpers/retirement-history.mjs";
import test from 'node:test';import assert from 'node:assert/strict';import{ESLint}from'eslint';
import{salesOwners}from'./helpers/sales-source.mjs';import{inventoryOwners}from'./helpers/inventory-source.mjs';import{userStateGraph}from'./helpers/user-state-worksheet-graph.mjs';import{salesQueryGraph}from'./helpers/inventory-sales-query.mjs';import{directoryGraph}from'./helpers/employee-directory.mjs';
const owners=[...salesOwners,...inventoryOwners],publicPath=/^src\/modules\/[^/]+\/(contracts|server|quantity)\.ts$/;
test('Sales and Inventory full runtime/type graphs remain acyclic, use public cross-feature composition and keep all browsers provider-free',()=>{
 const graph=userStateGraph();for(const types of [false,true]){graph.modules(types);const seen=new Set(),active=[];function visit(file){assert.ok(!active.includes(file),[...active,file].join(' -> '));if(seen.has(file))return;active.push(file);graph.deps(file,types).forEach(visit);active.pop();seen.add(file);}graph.all.forEach(visit);
 for(const file of owners.filter(f=>/\/(application|domain)\//.test(f))){const own=/^src\/modules\/([^/]+)\//.exec(file)[1];assert.equal(graph.trace(file,types,p=>p.startsWith('src/services/')||p.startsWith('src/externals/')||p.startsWith('src/config/')||p.startsWith('src/infrastructure/')||p.startsWith('src/app/')||(p.startsWith('src/modules/')&&!p.startsWith(`src/modules/${own}/`)&&p!=='src/modules/expenses/contracts.ts')),null,file);}
 for(const file of owners)for(const dep of graph.deps(file,types)){const from=/^src\/modules\/([^/]+)/.exec(file)?.[1],to=/^src\/modules\/([^/]+)/.exec(dep)?.[1];if(from&&to&&from!==to)assert.match(dep,publicPath,`${file} -> ${dep}`);}
 for(const root of graph.all.filter(f=>/^\s*['"]use client['"]/.test(readArchive(f,'utf8'))))assert.equal(graph.trace(root,types,p=>p.startsWith('src/services/')||p.startsWith('src/externals/')||p.startsWith('src/infrastructure/')||p.startsWith('src/config/')||/^src\/modules\/[^/]+\/(application|infrastructure|.*server\.ts)/.test(p)),null,root);
 }
 for(const file of owners.filter(f=>f.includes('/ports/')))assert.doesNotMatch(readArchive(file,'utf8'),/GoogleSheet|rowIndex|rowNumber|range:/,file);
});
test('legacy direct/barrel functions retain named public identities and runtime errors remain single definitions',()=>{
 const sales=salesQueryGraph(),index=sales.load("src/services/sales/index.ts"),server=sales.load("src/modules/sales/server.ts");for(const [name,value]of Object.entries(index))assert.equal(value,server[name],name);
 const inventory=directoryGraph(),legacy=inventory.legacy(),owned=inventory.load("src/modules/inventory/server.ts");for(const [name,value]of Object.entries(legacy))assert.equal(value,owned[name],name);
 assert.equal(owned.StockAdjustmentError,inventory.load("src/modules/inventory/domain/adjustment-rules.ts").StockAdjustmentError);assert.equal(owned.MovementQuantityRequiredError,inventory.load("src/modules/inventory/quantity.ts").MovementQuantityRequiredError);
});
test('literal original quantity, movement mapping and financial report calculations remain preserved in their physical owners',()=>{
 const original=JSON.parse(readArchive('tests/fixtures/inventory-application-before.json','utf8')).files,movement=original['src/services/movements/manageMovements.ts'].source;
 assert.ok(readArchive('src/modules/inventory/quantity.ts','utf8').startsWith(original['src/features/backend/line/services/movements/utils.ts'].source));
 const mapper=readArchive('src/modules/inventory/infrastructure/google-sheets/movements.ts','utf8');assert.ok(mapper.includes(movement.slice(movement.indexOf('function rowToMovement('),movement.indexOf('function matchesDateFilter'))));
 const sales=JSON.parse(readArchive('tests/fixtures/sales-application-before.json','utf8')).files['src/services/sales/getGoogleSheetsDailySales.ts'].source;assert.ok(readArchive('src/modules/sales/application/reports.ts','utf8').endsWith(sales.slice(sales.indexOf('function aggregateItems')).replaceAll('GoogleSheetCellValue','SalesValue')));
});
test('exact real lint scopes reject legacy/provider/private/dynamic dependencies and implicit financial clocks',async()=>{
 const eslint=new ESLint();const files=owners.filter(f=>/\/(application|domain)\//.test(f)||f.endsWith('/quantity.ts'));
 for(const file of files){const [ok]=await eslint.lintText(readArchive(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));for(const source of ['export {x} from "@/services/sales";','import type {X} from "@/externals/google/sheet";export type T=X;','export {PayrollRecordsSheet} from "@/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet";','export type X=import("@/config").AppConfig;','export const x=import("@/config");','export const x=require("node:fs");','export const x=Date.now();','export const x=new Date();']){const [bad]=await eslint.lintText(source,{filePath:file});assert.ok(bad.errorCount>0,file+source);}}
});
