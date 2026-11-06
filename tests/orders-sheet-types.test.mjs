import { inventoryWorksheetFiles, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import { hrWorksheetFiles, assertHrWorksheetHistory } from "./helpers/hr-worksheet-history.mjs";
import { directoryFiles, assertDirectoryHistory } from "./helpers/employee-directory-history.mjs";
import { salesWorksheetFiles, assertSalesWorksheetHistory } from "./helpers/sales-worksheet-history.mjs";
import { worksheetFiles, worksheetDestinations, assertWorksheetHistory } from "./helpers/worksheet-history.mjs";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import {sheetTypesBefore,sheetTypeHash} from "./helpers/orders-sheet-type-history.mjs";
test("four Orders Sheet type imports retain original complete declarations and identical emitted runtime code",()=>{
 const printer=ts.createPrinter();const emit=(file,text)=>ts.transpileModule(text,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const body=(file,text)=>{const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);return ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>printer.printNode(ts.EmitHint.Unspecified,n,ast));};
 for(const [file,saved]of Object.entries(sheetTypesBefore.files)){assert.equal(sheetTypeHash(saved.source),saved.sha256);const current=readFileSync(file,"utf8");assert.deepEqual(body(file,current),body(file,saved.source));assert.equal(emit(file,current),emit(file,saved.source));}
});

test("exact import reversal preserves original hashes and every other production file remains byte-identical",async()=>{
 const {sheetTypeFiles,assertOrdersSheetTypeHistory}=await import("./helpers/orders-sheet-type-history.mjs");
 for(const [file,hash]of Object.entries(sheetTypesBefore.productionHashes)){if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,hash);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,hash);else if(directoryFiles.has(file))assertDirectoryHistory(file,hash);else if(salesWorksheetFiles.has(file))assertSalesWorksheetHistory(file,hash);else if(worksheetFiles.has(file))assertWorksheetHistory(file,hash);else if(sheetTypeFiles.has(file))assertOrdersSheetTypeHistory(file,hash);else assert.equal(sheetTypeHash(readFileSync(file)),hash,file);}
});

test("the four exact lint scopes require erased pure types and reject aggregate, relative, value, re-export and dynamic bypasses",async()=>{
 const {ESLint}=await import("eslint");const eslint=new ESLint();
 for(const file of Object.keys(sheetTypesBefore.files)){
  const [actual]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(actual.errorCount,0,JSON.stringify(actual.messages));
  const [valid]=await eslint.lintText('import type { IGoogleSheetsService } from "@/externals/google/sheet/types"; export type T = IGoogleSheetsService;',{filePath:file});assert.equal(valid.errorCount,0,JSON.stringify(valid.messages));
  for(const source of [
   'import type { IGoogleSheetsService } from "@/externals/google/sheet"; export type T=IGoogleSheetsService;',
   'import type { IGoogleSheetsService } from "../../../../externals/google/sheet"; export type T=IGoogleSheetsService;',
   'import { IGoogleSheetsService } from "@/externals/google/sheet/types"; export const T=IGoogleSheetsService;',
   'export type { IGoogleSheetsService } from "@/externals/google/sheet";',
   'const x=import("@/externals/google/sheet"); export {x};',
   'const x=require("@/externals/google/sheet"); export {x};',
   'export type X=import("@/externals/google/sheet").IGoogleSheetsService;',
  ]){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,source);}
 }
});

test("actual relocated worksheet type graph avoids the mixed index and stays one-way; old import remains a negative regression",async()=>{
 const {resolve,relative}=await import("node:path");
 const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
 function graph(restoreOld=false){
  const source=restoreOld?{"src/modules/orders/server.ts":sheetTypesBefore.files["src/modules/orders/server.ts"].source}:{};
  const host=ts.sys;
  const edges=new Set(),seen=new Set(),active=[],reached=new Set();
  function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/(orders|shipments)\//.exec(file)?.[1]??from;if(owner&&from&&owner!==from)edges.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);reached.add(file);
   const ast=ts.createSourceFile(file,source[file]??readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
   for(const n of ast.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)continue;const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,host).resolvedModule?.resolvedFileName;const dep=target&&relative(process.cwd(),target).replaceAll("\\","/");if(dep?.startsWith("src/"))visit(dep,owner);}
   active.pop();seen.add(key);
  }
  [...Object.keys(sheetTypesBefore.productionHashes),...worksheetDestinations].filter(f=>/^src\/modules\/(orders|shipments)\//.test(f)&&/\.tsx?$/.test(f)).forEach(f=>visit(f));return {edges:[...edges].sort(),reached};
 }
 const result=graph();assert.deepEqual(result.edges,["shipments->orders"]);assert.equal(result.reached.has("src/externals/google/sheet/index.ts"),false);
 for(const file of worksheetDestinations)assert.ok(result.reached.has(file),file);
 assert.deepEqual(graph(true).edges,["orders->shipments","shipments->orders"]);
});
