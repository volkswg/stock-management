import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from "node:crypto";
import ts from "typescript";
export const hrWorksheetsBefore=JSON.parse(readFileSync("tests/fixtures/hr-worksheets-before.json","utf8"));
export const hrWorksheetFiles=new Set(Object.keys(hrWorksheetsBefore.moves));
export const hrWorksheetDestinations=Object.values(hrWorksheetsBefore.moves).map(e=>e.to);
export const hrWorksheetHash=x=>createHash("sha256").update(x).digest("hex");
export function assertHrWorksheetHistory(file,expected){
 const entry=hrWorksheetsBefore.moves[file];assert.ok(entry,file);assert.equal(entry.sha256,expected);assert.equal(hrWorksheetHash(entry.source),expected);
 let source=readFileSync(entry.to,"utf8");for(const [old,current]of Object.entries(entry.imports)){assert.equal(source.split(`"${current}"`).length-1,1,file);source=source.replaceAll(`"${current}"`,`"${old}"`);}
 assert.equal(source,entry.source,file);
 const original=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
 assert.deepEqual(original.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>{const ast=printer.printNode(ts.EmitHint.Unspecified,n,original);return {ast,sha256:hrWorksheetHash(ast)};}),entry.declarations);
 assert.equal(readFileSync(file,"utf8"),`export { ${entry.export} } from "@/${entry.to.slice(4,-3)}";\n`);
}
