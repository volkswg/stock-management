import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
export const shipmentReadBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-list-before.json", import.meta.url), "utf8"));
const adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts", application = "src/modules/shipments/application/list-shipments.ts";
// Explicit reviewed destinations; do not exempt other Shipment functions/files.
export const readFunctionDestinations = {
  listShipments: application, getShipmentDetail: application,
  mapShipmentRow: adapter, groupOrderIdsByShipmentId: adapter,
  calculateShipmentCostSummary: application, calculateQuantityCost: application,
  mapRelatedOrderRow: adapter, groupProductImagesByOrderId: adapter,
  toStringValue: adapter, toNumber: adapter, toPositiveNumber: application,
  isShipmentStatus: adapter, isOrderStatus: adapter,
};
export const migratedReadFunctions = new Set(Object.keys(readFunctionDestinations).map(name => `${shipmentReadBefore.file}:${name}`));
const hash = value => createHash("sha256").update(value).digest("hex"), printer = ts.createPrinter();
const parse = (file, text = readFileSync(file, "utf8")) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
export function assertShipmentReadHistory(key, expected) {
  assert.ok(migratedReadFunctions.has(key), key);
  assert.equal(hash(shipmentReadBefore.source), shipmentReadBefore.rawHash);
  const original = parse(shipmentReadBefore.file, shipmentReadBefore.source), name = key.slice(key.lastIndexOf(":") + 1);
  const fn = file => file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const print = (n, file) => printer.printNode(ts.EmitHint.Unspecified, n, file);
  assert.equal(hash(print(fn(original), original)), expected, key);
  assert.equal(shipmentReadBefore.functions[name], expected);
  assert.equal(readFileSync(shipmentReadBefore.file, "utf8"), 'export { listShipments, getShipmentDetail } from "@/modules/shipments/server";\n');
  if (!["listShipments", "getShipmentDetail"].includes(name)) {
    const moved = parse(readFunctionDestinations[name]);
    assert.equal(hash(print(fn(moved), moved)), expected, `${name}: original full helper declaration/body`);
  }
}
