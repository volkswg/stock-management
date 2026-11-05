import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";
const eslint = new ESLint();
const application = "src/modules/shipments/application/update-shipment-status.ts", port = "src/modules/shipments/application/ports/shipment-status-store.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts", server = "src/modules/shipments/server.ts";
const restricted = result => result.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId));
async function check(filePath, code, expected) {
  const [result] = await eslint.lintText(code, { filePath }); assert.equal(restricted(result), expected, `${filePath}: ${code}\n${JSON.stringify(result.messages)}`);
}
test("status scopes permit actual application/port/adapter/composition and only their exact owned imports", async () => {
  for (const file of [application, port, adapter, server]) { const [result] = await eslint.lintFiles(file); assert.equal(result.errorCount, 0, JSON.stringify(result.messages)); }
  for (const [file, code] of [
    [application, 'import { ShipmentStatus } from "../contracts"; import type { ShipmentStatusStore } from "./ports/shipment-status-store"; export type Store = ShipmentStatusStore; export const draft = ShipmentStatus.Draft;'],
    [port, 'import type { ShipmentStatusUpdate } from "../../contracts"; export interface Target { saveStatusUpdate(update: ShipmentStatusUpdate): Promise<void> }'],
    [adapter, 'import "server-only"; import type { IGoogleSheetsService } from "@/externals/google/sheet/types"; import type { ShipmentStatusStore } from "../../application/ports/shipment-status-store"; export type Types = [IGoogleSheetsService, ShipmentStatusStore];'],
    [server, 'import "server-only"; import { updateShipmentStatus } from "./application/update-shipment-status"; import { GoogleSheetsShipmentStatusStore } from "./infrastructure/google-sheets/shipment-status-store"; export const operations = [updateShipmentStatus, GoogleSheetsShipmentStatusStore];'],
  ]) await check(file, code, false);
});

test("status application/port reject concrete storage, Drive, legacy, app/frameworks, clock/env/IO and every import bypass", async () => {
  for (const file of [application, port]) for (const code of [
    'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { updateShipmentStatus } from "@/services/shipments";', 'import { createSortableId } from "@/services/utils/createSortableId";',
    'import type { GoogleSheetRow } from "@/externals/google/sheet/types";', 'import { Drive } from "@/externals/google/drive";',
    'import { Store } from "../infrastructure/google-sheets/shipment-status-store";', 'import { update } from "../server";',
    'import type { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";', 'import { OrderStatus } from "@/modules/orders/contracts";',
    'import { Page } from "../ui/ShipmentListPage";', 'import { PATCH } from "@/app/api/shipments/[id]/route";',
    'import type { Request } from "next/server";', 'import React from "react";', 'import fs from "node:fs";', 'import { google } from "googleapis";',
    'const now = new Date();', 'const now = Date.now();', 'const value = Math.random();', 'const value = crypto.randomUUID();',
    'const secret = process.env.SECRET;', 'const value = Buffer.from("secret");', 'fetch("https://example.test");',
    'export { ShipmentStatus } from "../contracts";', 'export * from "../contracts";',
    'const store = import("../infrastructure/google-sheets/shipment-status-store");', 'const store = require("../server");',
    'type Store = import("../infrastructure/google-sheets/shipment-status-store").Store;',
  ]) await check(file, code, true);
});

test("status adapter/server reject mixed providers, config/HTTP/UI/private Orders and runtime interface/type/re-export bypasses", async () => {
  for (const file of [adapter, server]) for (const code of [
    'import { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";', 'import type { Mapper } from "../../../orders/infrastructure/google-sheets/order-row-mapping";',
    'import { updateShipmentStatus } from "@/services/shipments";', 'import { Status } from "../../../../services/shipments/updateShipmentStatus";',
    'import { Client } from "@/externals/google/sheet";', 'import { Client } from "@/externals/google/sheet/client/GoogleSheetsClient";',
    'import { Drive } from "@/externals/google/drive";', 'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { PATCH } from "@/app/api/shipments/[id]/route";', 'import fs from "node:fs";', 'import { Page } from "../ui/Page";',
    'import { IGoogleSheetsService } from "@/externals/google/sheet/types";',
    'export * from "../../contracts";', 'export { ShipmentStatus } from "../../contracts";',
    'const module = import("@/modules/orders/server");', 'const module = require("@/config");', 'type Service = import("@/externals/google/sheet/types").IGoogleSheetsService;',
  ]) await check(file, code, true);
  await check(adapter, 'import { OrderStatus } from "@/modules/orders/contracts";', true);
});

test("status allowances leave earlier creation/read/link scopes unchanged and port exposes only business capabilities", async () => {
  for (const file of ["create-shipment", "list-shipments", "link-order-to-shipment"]) await check(`src/modules/shipments/application/${file}.ts`, 'import type { ShipmentStatusStore } from "./ports/shipment-status-store";', true);
  for (const file of ["shipment-writer", "shipment-list-reader", "shipment-order-link-store"]) await check(`src/modules/shipments/infrastructure/google-sheets/${file}.ts`, 'import type { Store } from "../../application/ports/shipment-status-store";', true);
  const source = ts.createSourceFile(port, readFileSync(port, "utf8"), ts.ScriptTarget.Latest, true);
  assert.ok(source.statements.filter(ts.isImportDeclaration).every(n => n.importClause.isTypeOnly && n.moduleSpecifier.text === "../../contracts"));
  assert.doesNotMatch(readFileSync(port, "utf8"), /GoogleSheet|readRows|updateRows|rowIndex|sheetRowNumber|config|process|Date/);
  for (const file of [adapter, server]) assert.ok(readFileSync(file, "utf8").startsWith('import "server-only";'));
});

test("browser scopes reject status application/port/adapter and runtime/type ownership remains only Shipments to Orders", async () => {
  for (const file of ["src/modules/orders/ui/[id]/OrderDetailPage.tsx", "src/modules/shipments/ui/ShipmentListPage.tsx"]) for (const code of [
    'import { updateShipmentStatus } from "@/modules/shipments/server";',
    'import { updateShipmentStatus } from "@/modules/shipments/application/update-shipment-status";',
    'import type { Store } from "@/modules/shipments/application/ports/shipment-status-store";',
    'import { Store } from "../infrastructure/google-sheets/shipment-status-store";',
  ]) await check(file, code, true);
  for (const types of [false, true]) assert.deepEqual(ownershipEdges(browserOwnership({ types })), ["shipments->orders"]);
});
