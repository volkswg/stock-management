import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

export const shipmentCreationBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-create-before.json", import.meta.url), "utf8"));
export const migratedCreationFunctions = new Set([
  "src/services/shipments/createShipment.ts:createShipment",
  "src/services/shipments/createShipment.ts:getShipmentsAppendRange",
]);
const hash = text => createHash("sha256").update(text).digest("hex");
const printer = ts.createPrinter();
const parse = (file, text = readFileSync(file, "utf8")) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

// These TWO historical declarations intentionally split into application/mapping.
// Keep original fixture hashes and source authoritative, not a blanket skip.
export function assertShipmentCreationHistory(key, expected) {
  assert.ok(migratedCreationFunctions.has(key), key);
  assert.equal(hash(shipmentCreationBefore.source), shipmentCreationBefore.rawHash);
  const original = parse(shipmentCreationBefore.file, shipmentCreationBefore.source), name = key.slice(key.lastIndexOf(":") + 1);
  const node = original.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
  assert.equal(hash(printer.printNode(ts.EmitHint.Unspecified, node, original)), expected, key);
  assert.equal(shipmentCreationBefore.functions[name], expected);
  assert.equal(readFileSync(shipmentCreationBefore.file, "utf8"), 'export { createShipment } from "@/modules/shipments/server";\n');
}

export function assertShipmentCreationMapping() {
  const old = parse(shipmentCreationBefore.file, shipmentCreationBefore.source), app = parse("src/modules/shipments/application/create-shipment.ts"), adapter = parse("src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts");
  const oldFunction = old.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "createShipment"), appFunction = app.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "createShipment");
  const print = (n, s) => printer.printNode(ts.EmitHint.Unspecified, n, s);
  for (let i = 0; i < 2; i++) assert.equal(print(appFunction.body.statements[i], app), print(oldFunction.body.statements[i], old), "PO normalization and validation remain exact");
  const record = fn => fn.body.statements.filter(ts.isVariableStatement).flatMap(n => n.declarationList.declarations).find(n => n.name.text === "shipment").initializer;
  const newRecord = ts.transform(record(appFunction), [context => {
    function visit(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "createId") return ts.factory.updateCallExpression(n, ts.factory.createIdentifier("createSortableId"), n.typeArguments, n.arguments);
      return ts.visitEachChild(n, visit, context);
    }
    return root => ts.visitNode(root, visit);
  }]).transformed[0];
  assert.equal(print(newRecord, app), print(record(oldFunction), old), "Original record construction changes only the injected generator name");
  let oldAppend, newAppend;
  function append(root, callback) { function visit(n) { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "appendRows") callback(n); ts.forEachChild(n, visit); } visit(root); }
  append(oldFunction, n => { oldAppend = n; }); append(adapter, n => { newAppend = n; });
  assert.equal(print(newAppend.arguments[1], adapter), print(oldAppend.arguments[1], old), "All original thirteen row values/order are exact");
  const range = old.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "getShipmentsAppendRange").body.statements[0].expression;
  assert.equal(print(newAppend.arguments[0], adapter), print(range, old), "Header-derived append range is exact");
}
