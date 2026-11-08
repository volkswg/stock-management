import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import { createHash } from "node:crypto";
import ts from "typescript";
export const shipmentValidationFile="src/features/backend/shipments/utils.ts";
export const validationBefore=JSON.parse(readFileSync(new URL("../fixtures/shipments-validation-before.json",import.meta.url),"utf8"));
export const validationHash=value=>createHash("sha256").update(value).digest("hex");
export function assertShipmentValidationImportHistory(file,expected){
  assert.equal(file,shipmentValidationFile);assert.equal(expected,"5a7eee8047a280c4c01df65457cd809de71b581ae565d1bbae1034a298e4d4df");
  assert.equal(validationBefore.sha256,expected);assert.equal(validationHash(validationBefore.source),expected);
  const current=restoreCleanupSource(file),oldImport='import { ShipmentStatus } from "@/services/shipments";',newImport='import { ShipmentStatus } from "@/modules/shipments/contracts";';
  assert.equal(current,validationBefore.source.replace(oldImport,newImport));
  assert.equal(current.replace(newImport,oldImport),validationBefore.source);
  const source=ts.createSourceFile(file,current,ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
  const functions=source.statements.filter(ts.isFunctionDeclaration);assert.deepEqual(functions.map(n=>n.name.text),Object.keys(validationBefore.functions));
  for(const node of functions){const printed=printer.printNode(ts.EmitHint.Unspecified,node,source);assert.equal(printed,validationBefore.functions[node.name.text].ast);assert.equal(validationHash(printed),validationBefore.functions[node.name.text].sha256);}
}
