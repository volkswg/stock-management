import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from "node:crypto";
import ts from "typescript";
export const worksheetBefore=JSON.parse(readFileSync("tests/fixtures/worksheet-ownership-before.json","utf8"));
export const worksheetFiles=new Set(Object.keys(worksheetBefore.moves));
export const worksheetDestinations=Object.values(worksheetBefore.moves).map(e=>e.to);
export const worksheetHash=x=>createHash("sha256").update(x).digest("hex");
export function assertWorksheetHistory(file,expected){
 const entry=worksheetBefore.moves[file];assert.ok(entry,file);assert.equal(entry.sha256,expected);assert.equal(worksheetHash(entry.source),expected);
 let source=readFileSync(entry.to,"utf8");for(const [old,current] of Object.entries(entry.imports))source=source.replaceAll(`"${current}"`,`"${old}"`);
 assert.equal(source,entry.source,file);
 const original=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
 assert.deepEqual(original.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>{const ast=printer.printNode(ts.EmitHint.Unspecified,n,original);return {ast,sha256:worksheetHash(ast)};}),entry.declarations);
 assert.equal(readFileSync(file,"utf8"),`export { ${entry.export} } from "@/${entry.to.slice(4,-3)}";\n`);
}
