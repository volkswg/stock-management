import {restoreProductSource} from "./product-master-history.mjs";
import {retirement,canonicalExports,registryProjection,worksheetProjection,archivedRelative,readEvidence} from "./retirement-history.mjs";
import {cleanupHistory} from "./cleanup-history.mjs";
import { remainingBefore, expenseRecords } from "./remaining-worksheet-history.mjs";
import { userStateBefore } from "./user-state-worksheet-history.mjs";
import { inventoryWorksheetsBefore } from "./inventory-worksheet-history.mjs";
import { hrWorksheetsBefore } from "./hr-worksheet-history.mjs";
import { salesWorksheetsBefore } from "./sales-worksheet-history.mjs";
import { worksheetBefore } from "./worksheet-history.mjs";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, posix } from "node:path";
import vm from "node:vm";
import ts from "typescript";
export const googleBefore=JSON.parse(readFileSync("tests/fixtures/google-infrastructure-before.json","utf8"));
export const googleFiles=new Set([...Object.keys(googleBefore.moves),googleBefore.types.path]);
export const googleDestinations=Object.values(googleBefore.moves).map(x=>x.to).concat("src/infrastructure/persistence/google-sheets/types.ts");
export const hash=value=>createHash("sha256").update(value).digest("hex");
export const parse=(file,source=readEvidence(file,"utf8"))=>ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
export const declarations=source=>{const ast=parse("witness.ts",source);const printer=ts.createPrinter();return ast.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n)).map(n=>printer.printNode(ts.EmitHint.Unspecified,n,ast));};
export function assertGoogleHistory(file,expected) {
 const entry=googleBefore.moves[file];
 if(entry){
  assert.equal(entry.sha256,hash(entry.source));assert.equal(expected,entry.sha256);
  let restored=restoreProductSource(entry.to);for(const [from,to] of Object.entries(entry.imports))restored=restored.replaceAll(`"${to}"`,`"${from}"`);
  assert.equal(restored,entry.source,`${file}: only reviewed imports may change`);
  const ast=parse(file,readEvidence(file,"utf8"));assert.ok(ast.statements.length>0);
  for(const statement of ast.statements){assert.ok(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause),file);assert.ok(statement.moduleSpecifier.text.startsWith("@/infrastructure/"),file);}
 }else{
  assert.equal(file,googleBefore.types.path);assert.equal(expected,googleBefore.types.sha256);assert.equal(hash(googleBefore.types.source),expected);
  const original=declarations(googleBefore.types.source), retained=declarations(readEvidence(file,"utf8")), generic=declarations(readFileSync(googleDestinations.at(-1),"utf8"));
  assert.equal(retained.length+generic.length,original.length);for(const declaration of original)assert.equal([...retained,...generic].filter(d=>d===declaration).length,1);
 }
}
// Closed provider graph. No configuration/authentication modules or ambient network.
// Historical mode evaluates the saved original provider sources, not rewritten expectations.
export function googleGraph({historical=false,globals={},crypto={}}={}) {
 const cache=new Map(),reverse=new Map(Object.entries({...cleanupHistory.moves,...googleBefore.moves,...worksheetBefore.moves,...salesWorksheetsBefore.moves,...hrWorksheetsBefore.moves,...inventoryWorksheetsBefore.moves,...userStateBefore.moves,...remainingBefore.moves}).map(([a,b])=>[b.to,a]));
 reverse.set(retirement.contract,retirement.prefix+"google/sheet/types.ts");
 function load(file){
  if(file===registryProjection)return registryView??=historical?load(retirement.prefix+"google/sheet/index.ts"):canonicalExports(retirement.prefix+"google/sheet/index.ts",load);
  if(file===worksheetProjection)return worksheetView??=historical?load(retirement.prefix+"google/sheet/sheets/index.ts"):canonicalExports(retirement.prefix+"google/sheet/sheets/index.ts",load);
  if(!historical)assert.ok(!retirement.files[file],`Retired current provider path: ${file}`);
  const canonical=file===expenseRecords?"src/externals/google/sheet/sheets/expenses/RecordsSheet.ts":reverse.get(file)??file;
  const key=historical?canonical:file;
  if(cache.has(key))return cache.get(key);
  const entry=remainingBefore.moves[canonical] ?? userStateBefore.moves[canonical] ?? googleBefore.moves[canonical] ?? worksheetBefore.moves[canonical] ?? salesWorksheetsBefore.moves[canonical] ?? hrWorksheetsBefore.moves[canonical] ?? inventoryWorksheetsBefore.moves[canonical];
  const registry = canonical.startsWith(retirement.prefix+"google/sheet/") && Object.hasOwn(googleBefore.productionHashes, canonical);
  assert.ok(entry || registry || file==="src/composition/google-sheets/index.ts",`Unapproved provider dependency: ${file}`);
  const physical=historical?canonical:file;
  const source=historical&&cleanupHistory.files[canonical]?cleanupHistory.files[canonical].source:historical&&entry?entry.source:historical&&retirement.files[canonical]?retirement.files[canonical].source:readFileSync(physical,"utf8"),exports={};cache.set(key,exports);
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({exports,Buffer,URL,URLSearchParams,Error,Date,console,fetch:()=>assert.fail("Live provider IO forbidden"),...globals,require(specifier){
   if(specifier==="node:crypto")return { default: crypto };
   let target=specifier.startsWith("@/")?`src/${specifier.slice(2)}`:posix.normalize(`${dirname(physical)}/${specifier}`);
   if(historical)target=archivedRelative(physical,specifier);else if(!target.endsWith(".ts"))target+=existsSync(`${target}.ts`)?".ts":"/index.ts";
   return load(target);
  }});
  new vm.Script(code,{filename:physical}).runInContext(context);return exports;
 }
 let registryView,worksheetView;
 return {load,cache,
  registry:()=>registryView??=historical?load(retirement.prefix+'google/sheet/index.ts'):canonicalExports(retirement.prefix+'google/sheet/index.ts',load),
  worksheets:()=>worksheetView??=historical?load(retirement.prefix+'google/sheet/sheets/index.ts'):canonicalExports(retirement.prefix+'google/sheet/sheets/index.ts',load),
 };

}
