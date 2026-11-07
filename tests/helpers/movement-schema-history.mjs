import {canonicalPath} from "./retirement-history.mjs";
import {ordersLineGraph} from "./orders-line-source.mjs";
import {restoreInventoryApplicationSource}from "./inventory-application-history.mjs";
import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
export const movementSchemaBefore=JSON.parse(readFileSync("tests/fixtures/movement-schema-before.json","utf8"));
export const movementSchemaFiles=new Set(Object.keys(movementSchemaBefore.files));
export const movementSchemaNewFiles=[movementSchemaBefore.newFile];
export const movementSchemaHash=x=>createHash("sha256").update(x).digest("hex");
export function restoreMovementSchemaSource(file,source){
 source=restoreInventoryApplicationSource(file,source);
 for(const change of (movementSchemaBefore.files[file]?.changes??[]).toReversed()){assert.equal(source.split(change.to).length-1,1,file);source=source.replace(change.to,change.from);}return source;
}
export function assertMovementSchemaHistory(file,expected){
 const saved=movementSchemaBefore.files[file];assert.ok(saved,file);assert.equal(movementSchemaHash(saved.source),saved.sha256);
 let restored=restoreMovementSchemaSource(file,readFileSync(file,"utf8"));assert.equal(restored,saved.source,file);
 if(expected!==saved.sha256){assert.equal(file,"src/services/movements/manageMovements.ts");const earlier=JSON.parse(readFileSync("tests/fixtures/inventory-employee-directory-before.json","utf8")).files[file];assert.equal(expected,earlier.sha256);for(const c of earlier.changes.toReversed()){assert.equal(restored.split(c.to).length-1,1);restored=restored.replace(c.to,c.from);}assert.equal(restored,earlier.source);}
 assert.equal(movementSchemaHash(restored),expected,file);
}
// Closed original/current state graph; no config/provider implementations or network.
export function movementSchemaGraph({original=false,globals={}}={}){
 if(!original){const graph=ordersLineGraph({globals,createId:()=>"synthetic-id"});return {...graph,load:file=>{assert.ok(file!=="src/config/index.ts",`Unapproved schema dependency: ${file}`);return graph.load(canonicalPath(file));},state:()=>graph.load("src/services/movements/state.ts")};}
 const owner="src/modules/line-workflows/infrastructure/google-sheets/user-state/const.ts";
 const state="src/services/movements/state.ts",header="src/externals/google/sheet/sheets/user-state/const.ts",leaf=movementSchemaBefore.newFile,cache=new Map();
 function load(file){assert.ok([state,header,leaf,owner,"src/modules/inventory/infrastructure/google-sheets/movement-schema.ts"].includes(file),`Unapproved schema dependency: ${file}`);if(cache.has(file))return cache.get(file);const source=original&&file===state?movementSchemaBefore.files[state].source:readFileSync(file,"utf8"),exports={};cache.set(file,exports);
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({exports,Error,Date,JSON,fetch:()=>assert.fail("Live network forbidden"),...globals,require(specifier){if(file===leaf&&specifier==="@/modules/inventory/infrastructure/google-sheets/movement-schema")return load("src/modules/inventory/infrastructure/google-sheets/movement-schema.ts");if(file===header&&specifier==="@/modules/line-workflows/infrastructure/google-sheets/user-state/const")return load(owner);if(file===state&&specifier==="./worksheet-schema")return load(leaf);if(file===state&&specifier==="@/externals/google/sheet/sheets/user-state/const")return load(header);if(file===state&&specifier==="@/services/utils/createSortableId")return {createSortableId:()=>"synthetic-id"};throw Error(`Unapproved schema import: ${file}: ${specifier}`);}});
  new vm.Script(code,{filename:file}).runInContext(context);return exports;
 }return {load,state:()=>load(state),cache};
}
