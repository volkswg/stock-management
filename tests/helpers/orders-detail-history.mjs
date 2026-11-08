import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import { createHash } from "node:crypto";
import ts from "typescript";
export const orderDetailBefore = JSON.parse(readFileSync(new URL("../fixtures/orders-detail-before.json", import.meta.url), "utf8"));
const hash = text => createHash("sha256").update(text).digest("hex"), printer = ts.createPrinter();
const parse = (file, text = restoreCleanupSource(file)) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
const fn = (source, name) => source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
export function assertOrderDetailHistory(expectedBodyHash) {
  const before = orderDetailBefore, original = parse(before.file, before.source);
  assert.equal(hash(before.source), before.rawHash);
  assert.equal(expectedBodyHash, "7a863b4ebdd1220a8e7f250978f5fc644f19656f95a286b2fe88e3abdadff293");
  assert.equal(hash(print(fn(original, "getOrderDetail").body, original)), expectedBodyHash); assert.equal(before.bodyHash, expectedBodyHash);
  for (const [name, expected] of Object.entries(before.functions)) assert.equal(hash(print(fn(original, name), original)), expected);
  const projection = parse("src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts"), reader = parse("src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts");
  for (const [name, dest] of [["findShipmentIdForOrder", projection], ["isShipmentStatus", projection], ["mapOrderBillImageRow", reader]]) assert.equal(hash(print(fn(dest, name), dest)), before.functions[name], name);
  const oldMapper = fn(original, "mapShipmentRow"), newMapper = fn(projection, "mapShipmentRow");
  assert.equal(print(newMapper.body, projection), print(oldMapper.body, original), "Shipment mapper body unchanged; only return type becomes Orders-owned projection");
  for (const name of ["toStringValue", "toPrice"]) {
    const old = parse("original-mapping.ts", before.mapperSource), current = fn(projection, name);
    assert.equal(print(current.body, projection), print(fn(old, name).body, old), `${name}: deliberate feature-local converter retains original body`);
    assert.equal(print(current.parameters[0], projection), print(fn(old, name).parameters[0], old));
  }
  const route = parse("src/app/api/orders/[id]/route.ts");
  for (const [name, expected] of Object.entries(before.routeFunctions)) if (name !== "GET") assert.equal(hash(print(fn(route, name), route)), expected, `${name}: HTTP mutations/helpers unchanged`);
  const server = parse("src/modules/orders/server.ts");
  for (const [name, text] of Object.entries(before.serverFunctions)) assert.equal(fn(server, name).getText(server), text);
}

export function assertOrdersDetailServerHistory(file, expectedRawHash) {
  assert.equal(file, "src/modules/orders/server.ts");
  assert.equal(hash(orderDetailBefore.serverSource), expectedRawHash); assert.equal(orderDetailBefore.serverRawHash, expectedRawHash);
  const original = parse(file, orderDetailBefore.serverSource), current = parse(file);
  for (const name of ["listOrders", "createOrder"]) assert.equal(fn(current, name).getText(current), fn(original, name).getText(original));
  assert.ok(fn(current, "getOrderDetail"));
  assert.doesNotMatch(restoreCleanupSource(file), /from ["'][^"']*(?:modules\/shipments|services\/shipments|\.\.\/shipments)/);
  assertOrderDetailHistory(orderDetailBefore.bodyHash);
}

export function assertOrdersDetailBoundaryHistory(file, expected) {
  assert.equal(file, "eslint/orders-server-boundaries.mjs"); assert.equal(hash(orderDetailBefore.boundarySource), expected); assert.equal(orderDetailBefore.boundaryRawHash, expected);
  const current = parse(file), original = parse(file, orderDetailBefore.boundarySource), detailFiles = new Set([
    "src/modules/orders/application/get-order-detail.ts", "src/modules/orders/application/ports/order-detail-reader.ts",
    "src/modules/orders/application/ports/order-detail-shipment-projection.ts", "src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts",
  ]), addedImports = new Set(["./application/get-order-detail", "./application/ports/order-detail-shipment-projection", "./infrastructure/google-sheets/order-detail-reader"]);
  let scopes = 0, imports = 0;
  const transformed = ts.transform(current, [context => {
    function visit(n) {
      if (ts.isArrayLiteralExpression(n)) {
        const elements = n.elements.filter(element => {
          if (ts.isObjectLiteralExpression(element)) {
            const files = element.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(current) === "files")?.initializer;
            if (files && ts.isArrayLiteralExpression(files) && files.elements.every(e => detailFiles.has(e.text))) { scopes++; return false; }
          }
          if (ts.isStringLiteral(element) && addedImports.has(element.text)) { imports++; return false; }
          return true;
        });
        return ts.visitEachChild(ts.factory.updateArrayLiteralExpression(n, ts.factory.createNodeArray(elements, n.elements.hasTrailingComma)), visit, context);
      }
      return ts.visitEachChild(n, visit, context);
    }
    return root => ts.visitNode(root, visit);
  }]);
  const noComments = ts.createPrinter({ removeComments: true }); assert.equal(scopes, 3); assert.equal(imports, 3);
  assert.equal(noComments.printFile(transformed.transformed[0]), noComments.printFile(original), "Only exact detail scopes/server imports added; every earlier Orders boundary retained"); transformed.dispose();
}
