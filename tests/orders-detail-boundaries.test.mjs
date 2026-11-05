import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { ESLint } from "eslint";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";
const eslint = new ESLint();
const application = "src/modules/orders/application/get-order-detail.ts", port = "src/modules/orders/application/ports/order-detail-shipment-projection.ts", orderPort = "src/modules/orders/application/ports/order-detail-reader.ts", reader = "src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts", projection = "src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts", server = "src/modules/orders/server.ts";
async function check(filePath, code, expected) { const [r] = await eslint.lintText(code, { filePath }); assert.equal(r.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId)), expected, `${filePath}: ${code}\n${JSON.stringify(r.messages)}`); }
test("detail files pass exact scopes, allowing only documented business contracts and erased Sheets interfaces", async () => {
  for (const file of [application, port, orderPort, reader, projection, server]) { const [r] = await eslint.lintFiles(file); assert.equal(r.errorCount, 0, JSON.stringify(r.messages)); }
  await check(projection, 'import "server-only"; import type { OrderShipment } from "@/modules/orders/contracts"; import type { OrderDetailShipmentProjectionReader } from "@/modules/orders/application/ports/order-detail-shipment-projection"; import { ShipmentStatus } from "../../contracts"; export type Types = [OrderShipment, OrderDetailShipmentProjectionReader]; export const status = ShipmentStatus.Draft;', false);
});
test("Orders detail application/ports reject every Shipment dependency, concrete IO/config/framework/Node and type/dynamic bypass", async () => {
  for (const file of [application, port, orderPort]) for (const code of [
    'import type { Shipment } from "@/modules/shipments/contracts";', 'import { ShipmentStatus } from "../../../shipments/contracts";',
    'import { ShipmentStatus } from "@/services/shipments";', 'import type { Shipment } from "../../../../services/shipments/types";',
    'import type { GoogleSheetRow } from "@/externals/google/sheet/types";', 'import { Reader } from "../infrastructure/google-sheets/order-detail-reader";',
    'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";', 'import { GET } from "@/app/api/orders/[id]/route";',
    'import React from "react";', 'import type { Request } from "next/server";', 'import fs from "node:fs";',
    'export * from "../contracts";', 'export { X } from "@/modules/shipments/contracts";', 'const x = import("@/modules/shipments/server");', 'const x = require("@/config");', 'type X = import("@/modules/shipments/contracts").Shipment;',
    'const x = new Date();', 'const x = process.env.SECRET;', 'fetch("https://example.test");',
  ]) await check(file, code, true);
});
test("detail adapters reject private cross-feature mappers/providers/config/routes and require erased interface imports", async () => {
  for (const file of [reader, projection]) for (const code of [
    'import { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";', 'import { getOrderDetail } from "@/services/orders";', 'import { Client } from "@/externals/google/sheet";',
    'import { Drive } from "@/externals/google/drive";', 'import { getConfig } from "@/config";', 'import type { Private } from "../../../orders/application/get-order-detail";',
    'import { IGoogleSheetsService } from "@/externals/google/sheet/types";', 'export * from "../../contracts";', 'const x = require("@/config");', 'type X = import("@/externals/google/sheet/types").GoogleSheetRow;',
  ]) await check(file, code, true);
  for (const file of [server, reader]) await check(file, 'import type { Shipment } from "@/modules/shipments/contracts";', true);
  for (const file of [reader, projection, server]) assert.ok(readFileSync(file, "utf8").startsWith('import "server-only";'));
  for (const file of [port, orderPort]) assert.doesNotMatch(readFileSync(file, "utf8"), /GoogleSheet|readRows|worksheet|config|shipment[s]?\/contracts/);
});

const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
for (const types of [false, true]) test(`resolved detail and feature ownership graphs are acyclic and one-way (${types ? "including types" : "runtime"})`, () => {
  const edges = new Set(), visited = new Set(), active = [];
  function visit(file, inheritedOwner) {
    assert.ok(!active.includes(file), `Cycle ${[...active, file].join(" -> ")}`);
    const owner = /^src\/modules\/(orders|shipments)\//.exec(file)?.[1] ?? inheritedOwner;
    if (inheritedOwner && owner && inheritedOwner !== owner) edges.add(`${inheritedOwner}->${owner}`);
    const key = `${owner}:${file}`; if (visited.has(key)) return; active.push(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const n of source.statements) {
      if (!(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) || !n.moduleSpecifier) continue;
      const c = n.importClause, elements = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : undefined;
      if (!types && (n.isTypeOnly || c?.isTypeOnly || (elements?.length && !c.name && elements.every(e => e.isTypeOnly)))) continue;
      const target = ts.resolveModuleName(n.moduleSpecifier.text, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
      if (target) { const path = relative(process.cwd(), target).replaceAll("\\", "/"); if (path.startsWith("src/")) visit(path, owner); }
    }
    active.pop(); visited.add(key);
  }
  [...walk("src/modules/orders"), ...walk("src/modules/shipments")].forEach(file => visit(file));
  assert.ok(!edges.has("orders->shipments")); assert.ok(edges.has("shipments->orders"));
  assert.deepEqual(ownershipEdges(browserOwnership({ types })), ["shipments->orders"]);
});
