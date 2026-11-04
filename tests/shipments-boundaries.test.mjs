import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { builtinModules } from "node:module";
import test from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";

const eslint = new ESLint(), contract = "src/modules/shipments/contracts.ts", leaf = "src/services/shipments/types.ts";
const files = ["ShipmentListPage.tsx", "ShipmentMobileCard.tsx", "[id]/ShipmentDetailPage.tsx", "shipmentListFormat.ts", "api.ts"].map(f => f === "api.ts" ? "src/app/shipments/api.ts" : `src/modules/shipments/ui/${f}`);
const restricted = result => result.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals"].includes(m.ruleId));

test("Shipment lint permits the public contract/gallery/client and only the documented pure leaf exception", async () => {
  for (const filePath of files) {
    const code = filePath === "src/app/shipments/api.ts" ? 'import type { Shipment } from "@/modules/shipments/contracts"; export type Result = Shipment;' : 'import { ShipmentStatus } from "@/modules/shipments/contracts"; import type { OrderStatus } from "@/modules/orders/contracts"; import { OrderImageGallery } from "@/modules/orders/ui/OrderImageGallery"; export const allowed = [ShipmentStatus, OrderImageGallery]; export type Order = OrderStatus;';
    const [result] = await eslint.lintText(code, { filePath });
    assert.equal(restricted(result), false, filePath);
    const [actual] = await eslint.lintFiles(filePath); assert.equal(restricted(actual), false, filePath);
  }
  const [forward] = await eslint.lintText('export { ShipmentStatus } from "@/services/shipments/types";', { filePath: contract });
  assert.equal(restricted(forward), false);
  const [pure] = await eslint.lintText('import type { OrderStatus } from "@/modules/orders/contracts"; export type Status = OrderStatus;', { filePath: leaf });
  assert.equal(restricted(pure), false);
  const [route] = await eslint.lintText('import { listShipments } from "@/services/shipments"; export const read = listShipments;', { filePath: "src/app/api/shipments/route.ts" });
  assert.equal(restricted(route), false, "HTTP server composition is deliberately outside browser restrictions");
});

test("all five Shipment frontend files reject server/type-only/relative/Node/dynamic/env bypasses", async () => {
  for (const filePath of files) {
    for (const code of [
      'import { ShipmentStatus } from "@/services/shipments";',
      'import type { Shipment } from "../../services/shipments/types";',
      'export { ShipmentStatus } from "@/services/shipments/types";',
      'export * from "../../services/orders";',
      'import { getConfig } from "@/config";',
      'import { getConfig } from "../../config/index";',
      'import type { GoogleSheetRow } from "@/externals/google/sheet";',
      'import { Drive } from "@/infrastructure/files/google-drive";',
      'import { query } from "@/modules/orders/server";',
      'import { query } from "@/modules/shipments/application/query";',
      'import { query } from "@/modules/shipments/infrastructure/query";',
      'import { GET } from "@/app/api/shipments/route";',
      'import fs from "node:fs/promises";', 'import fs from "fs";',
      'import { cookies } from "next/headers";', 'import "server-only";',
      'import { google } from "googleapis";',
      'const query = import("@/services/shipments");',
      'const query = require("@/services/shipments");',
      'type Shipment = import("@/services/shipments").Shipment;',
      'const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;',
    ]) {
      const [result] = await eslint.lintText(code, { filePath });
      assert.ok(restricted(result), `${filePath}: ${code}`);
    }
  }
});

test("Shipment contract and legacy pure leaf reject broad/recursive/server forwarding and IO", async () => {
  for (const filePath of [contract, leaf]) {
    for (const code of [
      'export * from "@/services/shipments";',
      'export { createShipment } from "@/services/shipments/createShipment";',
      'import { getConfig } from "@/config";',
      'import { status } from "@/modules/shipments/contracts";',
      'import type { Row } from "@/externals/google/sheet";',
      'const token = process.env.GOOGLE_PRIVATE_KEY;',
      'fetch("https://example.test");', 'const x = import("./server");',
    ]) {
      const [result] = await eslint.lintText(code, { filePath }); assert.ok(restricted(result), `${filePath}: ${code}`);
    }
  }
  const [broad] = await eslint.lintText('export * from "@/services/shipments/types";', { filePath: contract });
  assert.ok(restricted(broad));
});

const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
function graph(runtime) {
  const visited = new Set(), active = [];
  const serverPackages = new Set([...builtinModules, ...builtinModules.map(n => `node:${n}`), "server-only", "next/server", "next/headers", "next/cache", "next/after", "googleapis", "google-auth-library"]);
  function visit(file) {
    assert.ok(!active.includes(file), `Dependency cycle: ${[...active, file].join(" -> ")}`);
    if (visited.has(file)) return;
    assert.ok(!/^src\/(config|externals|infrastructure|features\/backend)\//.test(file), file);
    assert.ok(!file.startsWith("src/services/") || file === leaf, file);
    assert.ok(!/\/modules\/[^/]+\/(application|infrastructure)\/|\/server\.[^/]+$/.test(file), file);
    assert.ok(!file.startsWith("src/app/") || file === "src/app/shipments/api.ts", file);
    active.push(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
      const clause = node.importClause, elements = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
      const onlyType = node.isTypeOnly || clause?.isTypeOnly || (elements?.length && !clause.name && elements.every(e => e.isTypeOnly));
      if (runtime && onlyType) continue;
      const specifier = node.moduleSpecifier.text;
      assert.ok(!serverPackages.has(specifier), `${file}: ${specifier}`);
      const resolved = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved) { const target = relative(process.cwd(), resolved).replaceAll("\\", "/"); if (target.startsWith("src/")) visit(target); }
      else if (/^(\.|@\/)/.test(specifier) && !specifier.endsWith(".css")) assert.fail(`Unresolved import ${specifier} in ${file}`);
    }
    active.pop(); visited.add(file);
  }
  [contract, ...files].forEach(visit);
  assert.ok(visited.has(contract)); assert.ok(visited.has(leaf));
}
test("Shipment runtime graph reaches only browser-safe project code and has no cycles", () => graph(true));
test("Shipment graph including type-only edges has no cycles or server implementations", () => graph(false));
test("Orders retains its old bridges without adding a reverse Shipments module edge", () => {
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
  for (const file of walk("src/modules/orders").filter(f => /\.tsx?$/.test(f))) assert.ok(!readFileSync(file, "utf8").includes("modules/shipments"), file);
  const detail = readFileSync("src/modules/orders/ui/[id]/OrderDetailPage.tsx", "utf8");
  assert.ok(detail.includes('"@/services/shipments/types"')); assert.ok(detail.includes('"@/app/shipments/api"'));
});

test("module UI glob rejects unrelated app imports and limits the retained client exception to two screens", async () => {
  const moduleFiles = files.filter(f => f !== "src/app/shipments/api.ts").concat("src/modules/shipments/ui/nested/Future.tsx");
  for (const filePath of moduleFiles) {
    const [valid] = await eslint.lintText('import { ShipmentStatus } from "@/modules/shipments/contracts"; export const status = ShipmentStatus.Draft;', { filePath });
    assert.equal(restricted(valid), false, filePath);
    for (const code of [
      'import { UI } from "@/app/orders/Other";',
      'import { UI } from "../../../../app/shipments/Other";',
      'import { getShipments } from "../../../../app/shipments/api";',
      'import { GET } from "@/app/api/shipments/route";',
    ]) { const [result] = await eslint.lintText(code, { filePath }); assert.ok(restricted(result), `${filePath}: ${code}`); }
    const [bridge] = await eslint.lintText('import { getShipments } from "@/app/shipments/api"; export const read = getShipments;', { filePath });
    assert.equal(restricted(bridge), !["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx"].includes(filePath), filePath);
  }
});

test("retained browser client rejects forwarding/implementation imports and keeps only erased public contract types", async () => {
  for (const code of [
    'export { getShipments } from "@/modules/shipments/ui/api";',
    'export type { ShipmentsResponse } from "@/modules/shipments/ui/api";',
    'export * from "@/modules/shipments/ui/api";',
    'import { OrderImageGallery } from "@/modules/orders/ui/OrderImageGallery";',
    'import { ShipmentStatus } from "@/modules/shipments/contracts";',
    'import { getShipments } from "../../modules/shipments/ui/api";',
    'export { listShipments } from "@/services/shipments";',
  ]) { const [result] = await eslint.lintText(code, { filePath: "src/app/shipments/api.ts" }); assert.ok(restricted(result), code); }
});
