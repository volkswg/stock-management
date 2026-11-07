import {restoreCleanupSource} from "./helpers/cleanup-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { ESLint } from "eslint";

const eslint = new ESLint();
const application = "src/modules/shipments/application/create-shipment.ts", port = "src/modules/shipments/application/ports/created-shipment-writer.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts", server = "src/modules/shipments/server.ts";
const restricted = result => result.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId));

test("actual creation application/port, adapter and composition pass their narrow ESLint scopes", async () => {
  for (const filePath of [application, port, adapter, server]) {
    const [result] = await eslint.lintFiles(filePath); assert.equal(restricted(result), false, JSON.stringify(result.messages));
  }
  for (const [filePath, code] of [
    [application, 'import { ShipmentStatus } from "../contracts"; import type { CreatedShipmentWriter } from "./ports/created-shipment-writer"; export const status = ShipmentStatus.Draft; export type Writer = CreatedShipmentWriter;'],
    [port, 'import type { Shipment } from "../../contracts"; export interface Writer { append(record: Shipment): Promise<void> }'],
    [adapter, 'import "server-only"; import type { IGoogleSheetsService } from "@/externals/google/sheet/types"; import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const"; export type Sheets = IGoogleSheetsService; export const range = lastColumnLetter(12);'],
    [server, 'import "server-only"; import { createSortableId } from "@/infrastructure/runtime/create-sortable-id"; export const id = createSortableId; export const clock = () => new Date().toISOString();'],
  ]) { const [result] = await eslint.lintText(code, { filePath }); assert.equal(restricted(result), false, JSON.stringify(result.messages)); }
});

test("application rejects concrete IO/frameworks/other modules, direct time/random and every static/dynamic bypass", async () => {
  for (const filePath of [application, port]) {
    for (const code of [
      'import { getConfig } from "@/config";', 'import { getConfig } from "../../../../config/index";',
      'import { createShipment } from "@/services/shipments";', 'export { createShipment } from "../../../../services/shipments/createShipment";',
      'import { Shipment } from "../server";', 'import { Writer } from "../infrastructure/google-sheets/shipment-writer";',
      'import type { IGoogleSheetsService } from "@/externals/google/sheet/types";',
      'import { Client } from "@/externals/google/drive";', 'import { OrderStatus } from "@/modules/orders/contracts";',
      'import { useState } from "react";', 'import type { NextRequest } from "next/server";',
      'import crypto from "node:crypto";', 'import { google } from "googleapis";',
      'const clock = new Date();', 'const random = Math.random();', 'const random = crypto.randomUUID();',
      'const value = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;', 'fetch("https://example.test");',
      'const service = import("../server");', 'const service = require("../server");',
      'type Writer = import("../infrastructure/google-sheets/shipment-writer").Writer;',
      'export * from "../contracts";',
    ]) { const [result] = await eslint.lintText(code, { filePath }); assert.ok(restricted(result), `${filePath}: ${code}`); }
  }
});

test("adapter/server reject broad exports, runtime interface/provider imports, config and unrelated features", async () => {
  for (const filePath of [adapter, server]) {
    for (const code of [
      'import { getConfig } from "@/config";', 'import { getConfig } from "../../../config";',
      'import { listShipments } from "@/services/shipments";', 'import { LinkOrderToShipmentError } from "../../services/shipments/linkOrderToShipment";',
      'import { getOrders } from "@/modules/orders/server";', 'import { Page } from "../ui/Page";',
      'import { Drive } from "@/externals/google/drive";', 'import { GoogleSheetsService } from "@/externals/google/sheet";',
      'import type { Header } from "@/externals/google/sheet/sheets/orders/const";',
      'import { IGoogleSheetsService } from "@/externals/google/sheet/types";',
      'export * from "./contracts";', 'export { createShipment } from "./application/create-shipment";',
      'const module = import("@/config");', 'const module = require("@/config");',
      'type Service = import("@/externals/google/sheet").IGoogleSheetsService;',
      'const secret = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;', 'fetch("https://example.test");',
    ]) { const [result] = await eslint.lintText(code, { filePath }); assert.ok(restricted(result), `${filePath}: ${code}`); }
  }
});

for (const runtime of [true, false]) test(`creation project graph is file-acyclic and uses only its exact owned/pure dependencies (${runtime ? "runtime" : "including types"})`, () => {
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const common = ["src/modules/shipments/infrastructure/google-sheets/shipments/const.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-orders/const.ts", "src/infrastructure/persistence/google-sheets/const.ts", "src/infrastructure/persistence/google-sheets/types.ts", "src/infrastructure/persistence/google-sheets/google-auth/types.ts", "src/infrastructure/files/google-drive/types.ts", "src/modules/shipments/status.ts", application, port, adapter, server, "src/modules/shipments/application/advance-shipment-status-with-bill.ts", "src/modules/shipments/application/ports/shipment-bill-storage.ts", "src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts", "src/externals/google/drive/types.ts", "src/externals/google/auth/types.ts", "src/modules/shipments/application/update-shipment-status.ts", "src/modules/shipments/application/ports/shipment-status-store.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts", "src/modules/shipments/application/link-order-to-shipment.ts", "src/modules/shipments/application/ports/shipment-order-link-store.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts", "src/externals/google/sheet/sheets/shipment-orders/const.ts", "src/modules/shipments/application/list-shipments.ts", "src/modules/shipments/application/ports/shipment-list-reader.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts", "src/services/shipments/createShipment.ts", "src/modules/shipments/contracts.ts", "src/services/shipments/types.ts", "src/modules/orders/contracts.ts", "src/services/utils/createSortableId.ts", "src/externals/google/sheet/types.ts", "src/externals/google/sheet/const.ts", "src/externals/google/sheet/sheets/shipments/const.ts"];
  const active = [], visited = new Set(), edges = new Set();
  function visit(file) {
    assert.ok(!active.includes(file), `File cycle: ${[...active, file].join(" -> ")}`); if (visited.has(file)) return;
    assert.ok(common.includes(file), `Unexpected dependency ${file}`); active.push(file);
    const source = ts.createSourceFile(file, restoreCleanupSource(file), ts.ScriptTarget.Latest, true);
    for (const n of source.statements) {
      if (!(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) || !n.moduleSpecifier) continue;
      const clause = n.importClause, elements = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
      if (runtime && (n.isTypeOnly || clause?.isTypeOnly || (elements?.length && !clause.name && elements.every(e => e.isTypeOnly)))) continue;
      const specifier = n.moduleSpecifier.text;
      if (["server-only", "node:crypto"].includes(specifier)) { assert.ok(specifier === "server-only" ? [adapter, server, "src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts"].includes(file) : file === "src/services/utils/createSortableId.ts"); continue; }
      const resolved = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName; assert.ok(resolved, `${file}: ${specifier}`);
      const target = relative(process.cwd(), resolved).replaceAll("\\", "/"); assert.ok(target.startsWith("src/"), target);
      const fromOwner = /^src\/modules\/([^/]+)\//.exec(file)?.[1], toOwner = /^src\/modules\/([^/]+)\//.exec(target)?.[1];
      if (fromOwner && toOwner && fromOwner !== toOwner) edges.add(`${fromOwner}->${toOwner}`);
      visit(target);
    }
    active.pop(); visited.add(file);
  }
  [server, application, port, adapter, "src/services/shipments/createShipment.ts"].forEach(visit);
  assert.ok(visited.has(application)); assert.ok(visited.has(adapter)); assert.ok(![...edges].some(edge => edge === "orders->shipments"));
  assert.ok(![...visited].some(file => /src\/(config|app)\/|\/externals\/google\/drive\/(?!types\.ts$)/.test(file)));
});

test("type-erased Sheets interfaces are pure, server markers are explicit, and browser files cannot import the seam", async () => {
  const source = readFileSync("src/externals/google/sheet/types.ts", "utf8");
  const ast = ts.createSourceFile("types.ts", source, ts.ScriptTarget.Latest, true); assert.equal(ast.statements.filter(ts.isImportDeclaration).length, 1);
  assert.ok(ast.statements.filter(ts.isImportDeclaration).every(n => n.importClause.isTypeOnly && n.moduleSpecifier.text === "@/infrastructure/persistence/google-sheets/types"));
  for (const file of [adapter, server]) assert.ok(restoreCleanupSource(file).startsWith('import "server-only";'));
  for (const filePath of ["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/orders/ui/[id]/OrderDetailPage.tsx"]) {
    for (const code of ['import { createShipment } from "@/modules/shipments/server";', 'import type { CreateShipmentInput } from "@/modules/shipments/application/create-shipment";', 'import { GoogleSheetsShipmentWriter } from "@/modules/shipments/infrastructure/google-sheets/shipment-writer";']) {
      const [result] = await eslint.lintText(code, { filePath }); assert.ok(restricted(result), `${filePath}: ${code}`);
    }
  }
});
