import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
export const shipmentLinkBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-link-before.json", import.meta.url), "utf8"));
const application = "src/modules/shipments/application/link-order-to-shipment.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts";
export const migratedLinkFunctions = new Set([
  "linkOrderToShipment", "findLatestShipmentOrder", "mapShipmentOrderRow", "getShipmentOrdersAppendRange", "toStringValue",
].map(name => `${shipmentLinkBefore.file}:${name}`));
const hash = text => createHash("sha256").update(text).digest("hex"), printer = ts.createPrinter();
const parse = (file, source = restoreCleanupSource(file)) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
export const linkFacade = `export { linkOrderToShipment } from "@/modules/shipments/server";
export { LinkOrderToShipmentError } from "@/modules/shipments/application/link-order-to-shipment";
export type {
  LinkOrderToShipmentResult,
  LinkOrderToShipmentErrorCode,
} from "@/modules/shipments/application/link-order-to-shipment";
export type { ShipmentOrder } from "@/modules/shipments/contracts";
`;
export function assertShipmentLinkHistory(key, expected) {
  assert.ok(migratedLinkFunctions.has(key), key);
  assert.equal(hash(shipmentLinkBefore.source), shipmentLinkBefore.rawHash);
  const original = parse(shipmentLinkBefore.file, shipmentLinkBefore.source), name = key.slice(key.lastIndexOf(":") + 1);
  const declaration = source => source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  assert.equal(hash(print(declaration(original), original)), expected, key);
  assert.equal(shipmentLinkBefore.functions[name], expected);
  assert.equal(readFileSync(shipmentLinkBefore.file, "utf8"), linkFacade);
  if (name !== "linkOrderToShipment") {
    const moved = parse(adapter); assert.equal(hash(print(declaration(moved), moved)), expected, `${name}: exact original helper`);
  }
}
export function assertLinkClassTypesAndMapping() {
  const original = parse(shipmentLinkBefore.file, shipmentLinkBefore.source), app = parse(application), store = parse(adapter);
  const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  for (const name of ["LinkOrderToShipmentError", "LinkOrderToShipmentResult", "LinkOrderToShipmentErrorCode"]) {
    const declaration = app.statements.find(n => n.name?.text === name);
    assert.equal(print(declaration, app), shipmentLinkBefore.declarations[name], name);
  }
  let oldAppend, newAppend;
  const visit = (root, capture) => { function walk(n) { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "appendRows") capture(n); ts.forEachChild(n, walk); } walk(root); };
  visit(original, n => { oldAppend = n; }); visit(store, n => { newAppend = n; });
  assert.equal(print(newAppend.arguments[0], store), print(oldAppend.arguments[0], original));
  assert.equal(print(newAppend.arguments[1], store), print(oldAppend.arguments[1], original), "Exact A:G seven values, original order");
  const server = parse("src/modules/shipments/server.ts");
  for (const [name, source] of Object.entries(shipmentLinkBefore.serverFunctions)) assert.equal(server.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(server), source, `${name}: existing composition stays byte-identical`);
}
