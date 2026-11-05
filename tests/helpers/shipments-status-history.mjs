import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
export const shipmentStatusBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-status-before.json", import.meta.url), "utf8"));
const application = "src/modules/shipments/application/update-shipment-status.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts";
export const statusFunctionDestinations = { updateShipmentStatus: application, isValidTransition: application, toNumber: adapter };
export const migratedStatusFunctions = new Set(Object.keys(statusFunctionDestinations).map(name => `${shipmentStatusBefore.file}:${name}`));
const hash = text => createHash("sha256").update(text).digest("hex"), printer = ts.createPrinter();
const parse = (file, source = readFileSync(file, "utf8")) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
export const statusFacade = `export { updateShipmentStatus } from "@/modules/shipments/server";
export type { UpdateShipmentStatusResult } from "@/modules/shipments/application/update-shipment-status";
export type { ShipmentStatusUpdate } from "@/modules/shipments/contracts";
`;
export function assertShipmentStatusHistory(key, expected) {
  assert.ok(migratedStatusFunctions.has(key), key);
  assert.equal(hash(shipmentStatusBefore.source), shipmentStatusBefore.rawHash);
  const original = parse(shipmentStatusBefore.file, shipmentStatusBefore.source), name = key.slice(key.lastIndexOf(":") + 1);
  const declaration = source => source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  assert.equal(hash(print(declaration(original), original)), expected, key); assert.equal(shipmentStatusBefore.functions[name], expected);
  assert.equal(readFileSync(shipmentStatusBefore.file, "utf8"), statusFacade);
  if (name !== "updateShipmentStatus") {
    const moved = parse(statusFunctionDestinations[name]); assert.equal(hash(print(declaration(moved), moved)), expected, `${name}: unchanged full helper`);
  }
}
export function assertStatusSourceParity() {
  const original = parse(shipmentStatusBefore.file, shipmentStatusBefore.source), app = parse(application), store = parse(adapter), server = parse("src/modules/shipments/server.ts");
  const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const oldFn = original.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "updateShipmentStatus"), appFn = app.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "updateShipmentStatus");
  assert.equal(print(oldFn.body.statements[0], original), print(appFn.body.statements[0], app), "Delivery fee precheck exact");
  assert.equal(print(oldFn.body.statements.at(-1), original), print(appFn.body.statements.at(-1), app), "Original successful result literal exact");
  const oldUnion = original.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === "UpdateShipmentStatusResult"), newUnion = app.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === "UpdateShipmentStatusResult");
  assert.equal(print(newUnion, app), print(oldUnion, original));
  function collect(root, predicate) { const nodes = []; function walk(n) { if (predicate(n)) nodes.push(n); ts.forEachChild(n, walk); } walk(root); return nodes; }
  const findIndex = source => collect(source, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "findIndex")[0];
  assert.equal(print(findIndex(store), store), print(findIndex(original), original), "Original findIndex/callback and iterable inspection exact");
  const selected = source => collect(source, n => ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.name.elements.some(e => e.name?.text === "currentStatus"))[0];
  assert.equal(print(selected(store), store), print(selected(original), original), "Original selected-row destructuring exact");
  const updates = source => collect(source, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "updateRows");
  assert.equal(print(updates(store)[0].arguments[0], store), print(updates(original)[0].arguments[0], original));
  assert.equal(print(updates(store)[0].arguments[1], store), print(updates(original)[0].arguments[1], original), "M1 header payload exact");
  const originalCells = updates(original)[1].arguments[1].elements[0].elements, newCells = updates(store)[1].arguments[1].elements[0].elements;
  assert.equal(newCells.length, 12);
  for (const index of [1, 4, 7, 9, 10]) assert.equal(print(newCells[index], store), print(originalCells[index], original), "Untouched cell defaults retain raw values");
  for (const [name, source] of Object.entries(shipmentStatusBefore.serverFunctions)) assert.equal(server.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(server), source, `${name}: unchanged original server composition`);
}
