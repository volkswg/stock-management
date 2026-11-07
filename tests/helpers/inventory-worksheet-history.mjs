import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import ts from "typescript";
export const inventoryWorksheetsBefore=JSON.parse(readFileSync("tests/fixtures/inventory-worksheets-before.json","utf8"));
export const inventoryWorksheetFiles=new Set(Object.keys(inventoryWorksheetsBefore.moves));
export const inventoryWorksheetDestinations=Object.values(inventoryWorksheetsBefore.moves).map(e=>e.to);
export const inventoryWorksheetHash=x=>createHash("sha256").update(x).digest("hex");
export function assertInventoryWorksheetHistory(file,expected){
 const entry=inventoryWorksheetsBefore.moves[file];assert.ok(entry,file);assert.equal(entry.sha256,expected);assert.equal(inventoryWorksheetHash(entry.source),expected);
 let source=readFileSync(entry.to,"utf8");for(const [old,current]of Object.entries(entry.imports)){assert.equal(source.split(`"${current}"`).length-1,1,file);source=source.replaceAll(`"${current}"`,`"${old}"`);}
 assert.equal(source,entry.source,file);
 const original=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
 assert.deepEqual(original.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>{const ast=printer.printNode(ts.EmitHint.Unspecified,n,original);return {ast,sha256:inventoryWorksheetHash(ast)};}),entry.declarations);
 assert.equal(readFileSync(file,"utf8"),`export { ${entry.export} } from "@/${entry.to.slice(4,-3)}";\n`);
}
