import {featureFiles} from "./features-retirement-history.mjs";
import {resolveEvidence} from "./retirement-history.mjs";
import {legacySpecifier} from "./cleanup-history.mjs";
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import{posix}from'node:path';
import vm from'node:vm';import ts from'typescript';
export const inventoryOwners=['server.ts','contracts.ts','quantity.ts','domain/adjustment-rules.ts','domain/movement-rules.ts','application/adjustments.ts','application/stock-counts.ts','application/movements.ts','application/ports/adjustments.ts','application/ports/stock-counts.ts','application/ports/movements.ts','application/list-adjustment-employees.ts','application/ports/employee-directory.ts','infrastructure/google-sheets/adjustments.ts','infrastructure/google-sheets/stock-counts.ts','infrastructure/google-sheets/movements.ts','infrastructure/google-sheets/movement-schema.ts','infrastructure/google-sheets/stock-adjustments/const.ts','infrastructure/google-sheets/stock-counts/const.ts','domain/journey-quantities.ts','application/movement-journeys.ts','application/ports/movement-journeys.ts','infrastructure/google-sheets/movement-journeys.ts'].map(f=>'src/modules/inventory/'+f);
const legacy=['src/services/stock-adjustments/manageStockAdjustments.ts','src/services/stock-counts/manageStockCounts.ts','src/services/movements/manageMovements.ts','src/services/movements/worksheet-schema.ts'];
export function loadInventorySource(entry,{imports={},globals={},originals={}}={}){
 const archivedQuantity=Object.keys(featureFiles).find(file=>featureFiles[file].exports.some(e=>e.name==="parseQuantity"));
 const allowed=new Set(["src/infrastructure/persistence/google-sheets/read-and-repair-rows.ts",...inventoryOwners,...legacy,...(Object.keys(originals).length?[archivedQuantity]:[]),"src/services/stock-adjustments/types.ts"]),cache=new Map();function load(file){assert.ok(allowed.has(file),`Unapproved Inventory source ${file}`);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const source=originals[file]?.source??(Object.keys(originals).length?featureFiles[file]?.source:undefined)??readFileSync(file,'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,URL,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){if(Object.hasOwn(imports,spec))return imports[spec];if(Object.hasOwn(imports,legacySpecifier(spec)))return imports[legacySpecifier(spec)];if(spec==='server-only')return {};
 if(legacySpecifier(spec)==='@/services/movements')return load('src/services/movements/manageMovements.ts');if(spec==='node:crypto')return {randomUUID:()=>assert.fail('Provide an Inventory ID')};
 if(legacySpecifier(spec)==='@/modules/hr/server')return {readEmployeeDirectory:({googleSheetsService,unavailableError})=>{assert.ok(imports['./employee-directory'],'No employee reader injected');return imports['./employee-directory'].createEmployeeDirectory(googleSheetsService,unavailableError).listEmployees();}};
 if(legacySpecifier(spec)==='@/modules/sales/server')return {createSalesDashboardReader:service=>({readSales:input=>{const query=imports['@/services/sales/getGoogleSheetsDailySales'];assert.ok(query,'No Sales reader injected');return query.getGoogleSheetsSalesDashboard({...input,googleSheetsService:service});}})};
 let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target=resolveEvidence(target);
 if(target.endsWith('/stock-counts/const.ts')&&imports['@/externals/google/sheet/sheets/stock-counts/const'])return imports['@/externals/google/sheet/sheets/stock-counts/const'];
 return load(target);
 }});return exports;}return entry===null?{load}:load(entry);
}
