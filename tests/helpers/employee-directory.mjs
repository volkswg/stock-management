import {readFileSync} from "node:fs";
import {resolve,relative} from "node:path";
import vm from "node:vm";
import ts from "typescript";
import {loadSource,plain} from "./load-source.mjs";
export const directoryBefore=JSON.parse(readFileSync("tests/fixtures/inventory-employee-directory-before.json","utf8"));
export const directoryLegacy="src/services/stock-adjustments/manageStockAdjustments.ts";
export const directoryNewFiles=["src/modules/inventory/contracts.ts","src/modules/inventory/application/ports/employee-directory.ts","src/modules/inventory/application/list-adjustment-employees.ts","src/modules/hr/contracts.ts","src/modules/hr/server.ts","src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts","src/services/stock-adjustments/employee-directory.ts"];
export class DirectoryClock extends Date{constructor(...args){super(args.length?args[0]:"2026-11-06T12:00:00.000Z");}}
export function directoryGraph({original=false,service,events=[],globals={}}={}){
 const cache=new Map(),options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
 const allowed=new Set(["src/modules/inventory/infrastructure/google-sheets/stock-adjustments/const.ts",directoryLegacy,"src/services/stock-adjustments/types.ts","src/app/api/stock-adjustments/route.ts",...directoryNewFiles]);
 const headers=loadSource("src/externals/google/sheet/sheets/employees/const.ts");
 function load(file){if(cache.has(file))return cache.get(file);if(!allowed.has(file))throw Error(`Unapproved directory dependency ${file}`);
  const source=original?(directoryBefore.files[file]?.source??(file==="src/app/api/stock-adjustments/route.ts"?directoryBefore.routeSource:readFileSync(file,"utf8"))):readFileSync(file,"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};cache.set(file,exports);
  const context=vm.createContext({exports,URL,Error,Date:DirectoryClock,Request,Response,console:{error(){}},fetch:()=>{throw Error("Live IO forbidden");},...globals,require(specifier){
   if(specifier==="server-only")return {};
   if(specifier==="next/server")return {NextResponse:Response};
   if(specifier==="@/config")return {getConfig:()=>{events.push(["config"]);return {loyverse:{accounts:[{id:"shop",shopName:"Shop"}]}};}};
   if(specifier==="@/externals/google/sheet")return {...headers,createGoogleSheetsServiceFromConfig:()=>{events.push(["factory"]);return service;}};
   if(specifier==="@/externals/google/sheet/sheets/employees/const")return headers;
   const target=ts.resolveModuleName(specifier,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;if(!target)throw Error(`Unresolved directory dependency ${specifier}`);return load(relative(process.cwd(),target).replaceAll("\\","/"));
  }});new vm.Script(code,{filename:file}).runInContext(context);return exports;
 }
 return {load,legacy:()=>load(directoryLegacy),headers:headers.EMPLOYEE_HEADERS,events};
}
export function directorySheets({employees,stock=[],employeeRead,stockRead,events=[]}={}){return {employees:{readRows:()=>{events.push(["employees.read"]);return employeeRead?employeeRead():Promise.resolve(employees===undefined?[]:employees);}},stockAdjustments:{readRows:(...args)=>{events.push(["stock.read",...args]);return stockRead?stockRead():Promise.resolve(stock);},ensureExists:async()=>{events.push(["stock.ensure"]);},updateRows:async(...args)=>{events.push(["stock.update",...plain(args)]);},appendRows:async(...args)=>{events.push(["stock.append",...plain(args)]);}}};}
