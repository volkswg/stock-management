import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import ts from "typescript";
export const shipmentDriveBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-drive-before.json", import.meta.url), "utf8"));
const printer = ts.createPrinter(), hash = text => createHash("sha256").update(text).digest("hex");
const parse = (file, source = restoreCleanupSource(file)) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
export function assertShipmentDriveRouteHistory(file, expected) {
  assert.equal(file, "src/app/api/shipments/[id]/route.ts"); assert.equal(shipmentDriveBefore.file, file);
  assert.equal(hash(shipmentDriveBefore.source), expected); assert.equal(shipmentDriveBefore.rawHash, expected);
  const old = parse(file, shipmentDriveBefore.source), current = parse(file), adapter = parse("src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts");
  const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  for (const [name, originalHash] of Object.entries(shipmentDriveBefore.functions)) {
    const original = old.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    assert.equal(hash(print(original, old)), originalHash);
    if (name === "PATCH") continue; // Only orchestration changes; executable original/new parity is required.
    const destination = ["createShippingBillFileName", "cleanUpUploadedFile"].includes(name) ? adapter : current;
    const moved = destination.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    assert.equal(hash(print(moved, destination)), originalHash, `${name}: exact original declaration`);
  }
  const patch = source => source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "PATCH");
  const beforeTry = source => patch(source).body.statements.slice(0, 9).map(n => print(n, source));
  assert.deepEqual(beforeTry(current), beforeTry(old), "Original params/parser/validation before workflow state remain exact");
  const constants = current.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ["ALLOWED_SHIPPING_BILL_TYPES", "MAX_SHIPPING_BILL_SIZE_BYTES"].includes(d.name.text))).map(n => print(n, current));
  assert.deepEqual(constants, shipmentDriveBefore.constants);
  assert.match(restoreCleanupSource(file), /export const runtime = "nodejs"/);
  const server = parse("src/modules/shipments/server.ts");
  for (const [name, text] of Object.entries(shipmentDriveBefore.serverFunctions)) assert.equal(server.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(server), text);
}
