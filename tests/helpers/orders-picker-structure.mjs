import {restoreProductSource} from "./product-master-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const baseline = JSON.parse(readFileSync(new URL("../fixtures/orders-picker-seam.json", import.meta.url), "utf8"));
const hash = text => createHash("sha256").update(text).digest("hex");
const printer = ts.createPrinter();
const parse = file => ts.createSourceFile(file, restoreProductSource(file), ts.ScriptTarget.Latest, true);
const statements = source => source.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n));
const name = n => n.name?.text ?? (ts.isVariableStatement(n) ? n.declarationList.declarations.map(d => d.name.getText()).join(",") : n.kind.toString());

// Invert only the reviewed dependency plumbing in the three affected functions.
// Original golden hashes remain authoritative; unrelated statements stay exact.
export function withoutPickerPlumbing(source) {
  const f = ts.factory;
  return ts.transform(source, [context => {
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && ["OrderDetailPage", "OrderContent", "ShipmentLinkCard"].includes(node.name?.text)) {
        const parameters = node.parameters.map(p => f.updateParameterDeclaration(p, p.modifiers, p.dotDotDotToken,
          ts.isObjectBindingPattern(p.name) ? f.updateObjectBindingPattern(p.name, f.createNodeArray(p.name.elements.filter(e => e.name.getText(source) !== "shipmentPicker"), p.name.elements.hasTrailingComma)) : p.name,
          p.questionToken, p.type && ts.isTypeLiteralNode(p.type) ? f.updateTypeLiteralNode(p.type, p.type.members.filter(m => m.name?.getText(source) !== "shipmentPicker")) : p.type, p.initializer));
        node = f.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, parameters, node.type, node.body);
      }
      if (ts.isJsxSelfClosingElement(node) && ["OrderContent", "ShipmentLinkCard"].includes(node.tagName.getText(source))) {
        node = f.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, f.updateJsxAttributes(node.attributes, node.attributes.properties.filter(p => p.name?.text !== "shipmentPicker")));
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "shipmentPicker") {
        const method = node.expression.name.text;
        if (method === "listLinkableShipments") {
          const statuses = ["Shipping", "Delivered", "Canceled"].map(key => f.createPropertyAccessExpression(f.createIdentifier("ShipmentStatus"), key));
          return f.updateCallExpression(node, f.createIdentifier("getShipments"), node.typeArguments, [f.updateObjectLiteralExpression(node.arguments[0], f.createNodeArray([
            f.createPropertyAssignment("excludeStatuses", f.createArrayLiteralExpression(f.createNodeArray(statuses, true), true)),
            f.createPropertyAssignment("includeOrders", f.createFalse()), ...node.arguments[0].properties,
          ], node.arguments[0].properties.hasTrailingComma))]);
        }
        if (["createShipmentMaster", "linkOrderToShipment"].includes(method)) return f.updateCallExpression(node, f.createIdentifier(method), node.typeArguments, node.arguments);
      }
      if (ts.isArrayLiteralExpression(node) && node.elements.map(e => e.getText(source)).join(",") === "currentShipment,shipmentPicker,shipmentsRequestId") return f.updateArrayLiteralExpression(node, node.elements.filter(e => e.getText(source) !== "shipmentPicker"));
      return ts.visitEachChild(node, visit, context);
    }
    return root => ts.visitNode(root, visit);
  }]).transformed[0];
}
export function detailBodyHash() {
  const source = parse("src/modules/orders/ui/[id]/OrderDetailPage.tsx"), restored = withoutPickerPlumbing(source);
  return hash(statements(restored).map(n => printer.printNode(ts.EmitHint.Unspecified, n, source)).join("\n"));
}
export function assertPickerDetailParity() {
  const file = "src/modules/orders/ui/[id]/OrderDetailPage.tsx", source = parse(file), restored = withoutPickerPlumbing(source);
  const actual = statements(restored).map(n => ({ name: name(n), hash: hash(printer.printNode(ts.EmitHint.Unspecified, n, source)) }));
  assert.deepEqual(actual, baseline.statements[file], "Only the reviewed three-function picker plumbing may change");
}
export function pickerPageBodyHash() {
  const source = parse("src/app/orders/[id]/page.tsx");
  const changed = ts.transform(source, [context => {
    function visit(n) {
      if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(source) === "OrderDetailClient") return ts.factory.updateJsxSelfClosingElement(n, ts.factory.createIdentifier("OrderDetailPage"), n.typeArguments, n.attributes);
      return ts.visitEachChild(n, visit, context);
    }
    return root => ts.visitNode(root, visit);
  }]).transformed[0];
  return hash(statements(changed).map(n => printer.printNode(ts.EmitHint.Unspecified, n, source)).join("\n"));
}
export function assertPickerStaticLintParity() {
  const file = "eslint/orders-boundaries.mjs", source = parse(file);
  const selectors = statements(source).find(n => name(n) === "noDynamicServerBypass");
  assert.equal(hash(printer.printNode(ts.EmitHint.Unspecified, selectors, source)), baseline.statements[file].find(n => n.name === "noDynamicServerBypass").hash);
  const text = readFileSync(file, "utf8");
  assert.ok(!text.includes("(?!shipments/types")); assert.ok(!text.includes("(?!shipments/api"));
}
