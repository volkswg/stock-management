import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { builtinModules } from "node:module";
import test from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";

const eslint = new ESLint();
const browserFile = "src/modules/orders/ui/[id]/OrderDetailPage.tsx";
const restricted = (messages) => messages.some(({ ruleId }) => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals"].includes(ruleId));

test("actual ESLint config allows public Orders contracts and the explicit pure shipment bridge", async () => {
  const code = 'import { OrderStatus } from "@/modules/orders/contracts"; import { ShipmentStatus } from "@/services/shipments/types"; import { getShipments } from "@/app/shipments/api"; export const statuses = [OrderStatus.Complete, ShipmentStatus.Draft, getShipments];';
  const [result] = await eslint.lintText(code, { filePath: browserFile });
  assert.equal(restricted(result.messages), false, JSON.stringify(result.messages));
  const [serverPage] = await eslint.lintText('import { getOrderDetail } from "@/services/orders"; export const query = getOrderDetail;', { filePath: "src/app/orders/page.tsx" });
  assert.equal(restricted(serverPage.messages), false, "Server routing/composition is outside the browser-only restriction");
  for (const filePath of walk("src/modules/orders/ui").filter((file) => /\.tsx?$/.test(file))) {
    const [allowed] = await eslint.lintText(code, { filePath });
    assert.equal(restricted(allowed.messages), false, filePath);
    const [blocked] = await eslint.lintText('import { getConfig } from "@/config";', { filePath });
    assert.ok(restricted(blocked.messages), filePath);
  }
});

test("Orders lint boundaries reject aliases, relatives, type imports, re-exports, Node and dynamic bypasses", async () => {
  const sources = [
    'import { OrderStatus } from "@/services/orders";',
    'import type { OrderDetail } from "../../../services/orders/listOrders";',
    'export { OrderStatus } from "@/services/orders/createDraftOrder";',
    'export * from "../../../services/orders";',
    'import { getConfig } from "@/config";',
    'import { getConfig } from "../../../config/index";',
    'import type { GoogleSheetRow } from "@/externals/google/sheet";',
    'import { query } from "@/modules/orders/infrastructure/query";',
    'import { query } from "@/modules/orders/application/query";',
    'import { query } from "@/modules/orders/server";',
    'import { ShipmentStatus } from "@/services/shipments";',
    'import fs from "fs";',
    'import fs from "node:fs/promises";',
    'import { cookies } from "next/headers";',
    'const dependency = import("@/services/orders");',
    'const dependency = require("@/services/orders");',
    'type Detail = import("@/services/orders").OrderDetail;',
    'const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;',
    'import { getOrders } from "@/app/orders/api";',
    'import { Gallery } from "@/features/frontend/orders/components/OrderImageGallery";',
    'import { getOrders } from "../../../../app/orders/api";',
    'import { GET } from "@/app/api/orders/route";',
  ];
  for (const source of sources) {
    const [result] = await eslint.lintText(source, { filePath: browserFile });
    assert.ok(restricted(result.messages), `Boundary did not reject: ${source}`);
  }
});

test("public contract leaf rejects dependencies and IO; shipment consumers reject order service imports", async () => {
  for (const code of ['import type { Shipment } from "@/services/shipments/types";', 'export * from "./server";', 'fetch("https://example.test");']) {
    const [result] = await eslint.lintText(code, { filePath: "src/modules/orders/contracts.ts" });
    assert.ok(restricted(result.messages), code);
  }
  for (const filePath of ["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx", "src/modules/shipments/ui/shipmentListFormat.ts"]) {
    const [result] = await eslint.lintText('import { OrderStatus } from "@/services/orders";', { filePath });
    assert.ok(restricted(result.messages), filePath);
  }
});

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
}

test("resolved Orders browser runtime graph reaches no server services, config or adapter modules", () => {
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const roots = walk("src/modules/orders/ui").filter((file) => /\.tsx?$/.test(file));
  const serverPackages = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name.replace(/^node:/, "")}`), "server-only", "next/server", "next/headers", "next/cache", "next/after"]);
  const visited = new Set(), active = new Set();
  function visit(file) {
    if (active.has(file)) assert.fail(`Browser import cycle at ${file}`);
    if (visited.has(file)) return;
    assert.ok(!/^src\/(config|externals|infrastructure)\//.test(file), file);
    assert.ok(!file.startsWith("src/services/") || file === "src/services/shipments/types.ts", file);
    assert.ok(!/\/features\/backend\//.test(file), file);
    assert.ok(!/\/modules\/[^/]+\/(application|infrastructure)\//.test(file), file);
    assert.ok(!/\/server\.[^/]+$/.test(file), file);
    assert.ok(!file.startsWith("src/app/") || file === "src/app/shipments/api.ts", file);
    active.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function check(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const elements = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
        const typeOnly = node.isTypeOnly || clause?.isTypeOnly || (elements?.length && !clause.name && elements.every((element) => element.isTypeOnly));
        if (typeOnly) return;
        const specifier = node.moduleSpecifier.text;
        assert.ok(!serverPackages.has(specifier), `${specifier} in ${file}`);
        const resolved = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
        if (resolved) {
          const target = relative(process.cwd(), resolved).replaceAll("\\", "/");
          if (target.startsWith("src/")) visit(target);
        } else if ((specifier.startsWith(".") || specifier.startsWith("@/")) && !specifier.endsWith(".css")) {
          assert.fail(`Unresolved project import ${specifier} in ${file}`);
        }
      }
      ts.forEachChild(node, check);
    }
    check(source);
    active.delete(file);
    visited.add(file);
  }
  for (const root of roots) visit(root);
  assert.ok(visited.has("src/modules/orders/contracts.ts"));
  assert.ok(visited.has("src/services/shipments/types.ts"));
});
