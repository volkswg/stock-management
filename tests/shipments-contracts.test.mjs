import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { shipmentServices } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/shipments-structure.json", import.meta.url), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const parse = file => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const printer = ts.createPrinter();

test("Shipment public and legacy runtime exports share the original enum object and strings", () => {
  const { load, services } = shipmentServices();
  const contract = load("src/modules/shipments/contracts.ts"), leaf = load("src/services/shipments/types.ts");
  assert.equal(contract.ShipmentStatus, leaf.ShipmentStatus);
  assert.equal(contract.ShipmentStatus, services.ShipmentStatus);
  assert.deepEqual(Object.keys(contract), ["ShipmentStatus"]);
  assert.deepEqual(plain(contract.ShipmentStatus), { Draft: "draft", ReadyToShip: "ready_to_ship", Shipping: "shipping", Delivered: "delivered", Canceled: "canceled" });
  const source = parse("src/modules/shipments/contracts.ts");
  const names = source.statements.filter(ts.isExportDeclaration).flatMap(n => n.exportClause?.elements.map(e => e.name.text) ?? []);
  assert.deepEqual(names.sort(), ["ShipmentStatus", ...Object.keys(baseline.types)].sort());
});

test("all eight Shipment DTO declarations preserve original fields, optionality and nullability", () => {
  const source = parse("src/services/shipments/types.ts");
  for (const [name, expected] of Object.entries(baseline.types)) {
    const node = source.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === name);
    assert.ok(node, name);
    assert.equal(printer.printNode(ts.EmitHint.Unspecified, node.type, source), expected, name);
  }
});

test("Shipment frontend changes imports only; routes, CSS, Orders code and server algorithms remain intact", () => {
  for (const [file, expected] of Object.entries(baseline.bodies)) {
    const source = parse(file);
    const body = source.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, source)).join("\n");
    assert.equal(hash(body), expected, file);
  }
  for (const [key, expected] of Object.entries(baseline.functions)) {
    const split = key.lastIndexOf(":"), file = key.slice(0, split), name = key.slice(split + 1), source = parse(file);
    const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.equal(hash(printer.printNode(ts.EmitHint.Unspecified, node, source)), expected, key);
  }
  for (const [file, expected] of Object.entries(baseline.preserved)) assert.equal(hash(readFileSync(file)), expected, file);
});
