import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {resolve,relative} from "node:path";
import ts from "typescript";
import {ESLint} from "eslint";
import {worksheetBefore,worksheetDestinations} from "./helpers/worksheet-history.mjs";
import {browserOwnership,ownershipEdges} from "./helpers/browser-ownership.mjs";
const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
function dependencies(file,types){const ast=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);return ast.statements.flatMap(n=>{
 if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier||(!types&&(n.isTypeOnly||n.importClause?.isTypeOnly)))return [];
 const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;const path=target&&relative(process.cwd(),target).replaceAll("\\","/");return path?.startsWith("src/")?[path]:[];
});}
for(const types of [false,true])test(`worksheet, registry and feature ownership graphs are acyclic and browsers exclude every worksheet (${types?"runtime plus types":"runtime"})`,()=>{
 const active=[],seen=new Set(),edges=new Set();function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/(orders|shipments)\//.exec(file)?.[1]??from;if(from&&owner!==from)edges.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);dependencies(file,types).forEach(dep=>visit(dep,owner));active.pop();seen.add(key);}
 const roots=Object.keys(worksheetBefore.productionHashes).filter(f=>/^src\/modules\/(orders|shipments)\//.test(f)&&/\.tsx?$/.test(f));[...roots,...worksheetDestinations].forEach(f=>visit(f));
 assert.deepEqual([...edges].sort(),["shipments->orders"]);
 // The legacy aggregate is composition, so it may instantiate both feature worksheets.
 visit("src/externals/google/sheet/index.ts");
 for(const file of worksheetDestinations)for(const dep of dependencies(file,types))assert.ok(dep.startsWith("src/infrastructure/persistence/google-sheets/")||dep===file.replace(/[^/]+$/,"const.ts"),`${file} -> ${dep}`);
 const browser=new Set();function safe(file){if(browser.has(file))return;browser.add(file);assert.ok(!/\/infrastructure\/|\/application\/|\/server\.ts$|^src\/(services|externals|config)\//.test(file),file);dependencies(file,types).forEach(safe);}
 roots.filter(f=>/\/ui\/|\/contracts\.ts$/.test(f)).forEach(safe);assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
});
test("exact worksheet scopes preserve existing rules and reject feature/provider/config and all import bypasses",async()=>{
 const eslint=new ESLint();for(const file of worksheetDestinations){const [r]=await eslint.lintText(readFileSync(file,"utf8"),{filePath:file});assert.equal(r.errorCount,0,JSON.stringify(r.messages));}
 for(const file of worksheetDestinations.filter(f=>!f.endsWith("const.ts")))for(const source of [
 'import type { Shipment } from "@/modules/shipments/contracts"; export type X=Shipment;',
 'import { Other } from "../../../../../shipments/server"; export { Other };',
 'export { GoogleSheetsService } from "@/externals/google/sheet";',
 'const x = import("@/config"); export { x };',
 'const x = require("node:fs"); export { x };',
 'export type X = import("@/externals/google/sheet/types").GoogleSheetRow;',
 'import { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types"; export const x=GoogleSheetRow;',
 ]){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,source);}
});
