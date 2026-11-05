import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve,relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { ESLint } from "eslint";
import { googleBefore,googleDestinations,parse } from "./helpers/google-infrastructure.mjs";
import { browserOwnership,ownershipEdges } from "./helpers/browser-ownership.mjs";
const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
function dependencies(file,types){
 return parse(file).statements.flatMap(n=>{
  if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];
  const erased=n.isTypeOnly||n.importClause?.isTypeOnly;
  if(!types&&erased)return [];
  const specifier=n.moduleSpecifier.text,target=ts.resolveModuleName(specifier,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;
  if(!target)return [];
  const path=relative(process.cwd(),target).replaceAll("\\","/");return path.startsWith("src/")?[path]:[];
 });
}
for(const types of [false,true])test(`resolved shared infrastructure and feature graphs remain acyclic (${types?"runtime and types":"runtime"})`,()=>{
 const active=[],seen=new Set();
 function visit(file){assert.ok(!active.includes(file),[...active,file].join(" -> "));if(seen.has(file))return;active.push(file);for(const dep of dependencies(file,types))visit(dep);active.pop();seen.add(file);}
 for(const file of [...googleDestinations,...Object.keys(googleBefore.productionHashes).filter(f=>f.startsWith("src/modules/")&&/\.tsx?$/.test(f))])visit(file);
 for(const file of googleDestinations)for(const dep of dependencies(file,types))assert.ok(dep.startsWith("src/infrastructure/")||(types&&file.endsWith("createGoogleDriveServiceFromConfig.ts")&&dep==="src/config/index.ts"),`${file} -> ${dep}`);
 assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
 const safe=new Set();function browser(file){if(safe.has(file))return;safe.add(file);assert.ok(!/^src\/(infrastructure|externals|config|services)\//.test(file),file);assert.ok(!/\/application\/|\/server\.ts$|\/infrastructure\//.test(file),file);dependencies(file,types).forEach(browser);}
 Object.keys(googleBefore.productionHashes).filter(f=>/^src\/modules\/(orders|shipments)\/(ui\/.*\.tsx?$|contracts\.ts$)/.test(f)).forEach(browser);
});

test("exact root scopes permit real files and reject alias/relative/type/export/dynamic/require/import-type bypasses",async()=>{
 const eslint=new ESLint();for(const file of googleDestinations){const [result]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(result.errorCount,0,JSON.stringify(result.messages));}
 const file="src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts";
 for(const source of [
 'import { x } from "@/externals/google/sheet"; export { x };',
 'import type { X } from "../../../../modules/orders/contracts"; export type Y = X;',
 'export { X } from "@/modules/orders/server";',
 'const x = import("@/config"); export { x };',
 'const x = require("@/externals/google/drive"); export { x };',
 'export type X = import("@/modules/shipments/contracts").Shipment;',
 ]){const [result]=await eslint.lintText(source,{filePath:file});assert.ok(result.errorCount>0,source);}
 const [config]=await eslint.lintText('import { AppConfig } from "../../../config"; export const value = AppConfig;',{filePath:"src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts"});assert.ok(config.errorCount>0);
});

test("baseline consumer inventory resolves aliases, relative imports, erased edges and scripts without executing them",()=>{
 const audit=JSON.parse(readFileSync("tests/fixtures/google-infrastructure-consumers.json","utf8"));assert.equal(audit.base,googleBefore.base);assert.ok(audit.consumers.length>40);
 for(const entry of audit.consumers){const resolved=ts.resolveModuleName(entry.specifier,resolve(entry.file),options,ts.sys).resolvedModule?.resolvedFileName;assert.equal(relative(process.cwd(),resolved),entry.target);}
 assert.ok(audit.consumers.some(x=>x.typeOnly));assert.deepEqual(audit.operationalScripts,["src/scripts/line-rich-menu-client.ts","src/scripts/rich-menu.ts","src/scripts/setup-rich-menu.ts"]);
});
