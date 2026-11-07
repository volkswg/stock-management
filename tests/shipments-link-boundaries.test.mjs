import {readArchive} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";
const eslint = new ESLint();
const application = "src/modules/shipments/application/link-order-to-shipment.ts", port = "src/modules/shipments/application/ports/shipment-order-link-store.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts", server = "src/modules/shipments/server.ts";
const restricted = result => result.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId));
async function check(filePath, code, expected) {
  const [result] = await eslint.lintText(code, { filePath }); assert.equal(restricted(result), expected, `${filePath}: ${code}\n${JSON.stringify(result.messages)}`);
}
test("link scopes permit only actual application/port/adapter/composition imports", async () => {
  for (const file of [application, port, adapter, server]) { const [result] = await eslint.lintFiles(file); assert.equal(result.errorCount, 0, JSON.stringify(result.messages)); }
  for (const [file, code] of [
    [application, 'import { ShipmentStatus } from "../contracts"; import type { ShipmentOrderLinkStore } from "./ports/shipment-order-link-store"; export type Store = ShipmentOrderLinkStore; export const draft = ShipmentStatus.Draft;'],
    [port, 'import type { ShipmentOrder } from "../../contracts"; export interface Store { appendShipmentOrder(record: ShipmentOrder): Promise<void> }'],
    [adapter, 'import "server-only"; import type { IGoogleSheetsService, GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/service-contracts"; import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const"; export type Types = [IGoogleSheetsService, GoogleSheetRow]; export const range = lastColumnLetter(6);'],
    [server, 'import "server-only"; import { linkOrderToShipment } from "./application/link-order-to-shipment"; import { GoogleSheetsShipmentOrderLinkStore } from "./infrastructure/google-sheets/shipment-order-link-store"; export const operations = [linkOrderToShipment, GoogleSheetsShipmentOrderLinkStore];'],
  ]) await check(file, code, false);
});

test("link application/port reject providers, frameworks, legacy, concrete storage, time/random and static/dynamic bypasses", async () => {
  for (const file of [application, port]) for (const code of [
    'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { linkOrderToShipment } from "@/services/shipments";', 'import { createSortableId } from "@/services/utils/createSortableId";',
    'import type { GoogleSheetRow } from "@/externals/google/sheet/types";', 'import { Drive } from "@/externals/google/drive";',
    'import { Store } from "../infrastructure/google-sheets/shipment-order-link-store";', 'import { link } from "../server";',
    'import { OrderStatus } from "@/modules/orders/contracts";', 'import type { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";',
    'import { Page } from "../ui/ShipmentListPage";', 'import type { Request } from "next/server";', 'import React from "react";',
    'import fs from "node:fs";', 'import { google } from "googleapis";',
    'const now = new Date();', 'const now = Date.now();', 'const value = Math.random();', 'const value = crypto.randomUUID();',
    'const secret = process.env.SECRET;', 'const value = Buffer.from("secret");', 'fetch("https://example.test");',
    'export { ShipmentStatus } from "../contracts";', 'export * from "../contracts";',
    'const store = import("../infrastructure/google-sheets/shipment-order-link-store");', 'const store = require("../server");',
    'type Store = import("../infrastructure/google-sheets/shipment-order-link-store").Store;',
  ]) await check(file, code, true);
});

test("link adapter/server reject private Orders, app/config/provider imports, unapproved types and forwarding/dynamic exports", async () => {
  for (const file of [adapter, server]) for (const code of [
    'import { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";', 'import type { Mapper } from "../../../orders/infrastructure/google-sheets/order-row-mapping";',
    'import { Link } from "@/services/shipments";', 'import { Link } from "../../../../services/shipments/linkOrderToShipment";',
    'import { Client } from "@/externals/google/sheet";', 'import { Client } from "@/externals/google/sheet/client/GoogleSheetsClient";',
    'import { Drive } from "@/externals/google/drive";', 'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { GET } from "@/app/api/shipments/route";', 'import fs from "node:fs";', 'import { Page } from "../ui/Page";',
    'import { IGoogleSheetsService } from "@/externals/google/sheet/types";',
    'export * from "../../contracts";', 'export { ShipmentStatus } from "../../contracts";',
    'const module = import("@/modules/orders/server");', 'const module = require("@/config");', 'type Service = import("@/externals/google/sheet/types").IGoogleSheetsService;',
  ]) await check(file, code, true);
  await check(adapter, 'import { OrderStatus } from "@/modules/orders/contracts";', true);
});

test("link allowances do not widen creation/read scopes and the port has no storage dependency", async () => {
  for (const file of ["src/modules/shipments/application/create-shipment.ts", "src/modules/shipments/application/list-shipments.ts"]) await check(file, 'import type { ShipmentOrderLinkStore } from "./ports/shipment-order-link-store";', true);
  for (const file of ["src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts", "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts"]) await check(file, 'import type { Store } from "../../application/ports/shipment-order-link-store";', true);
  const source = ts.createSourceFile(port, readArchive(port, "utf8"), ts.ScriptTarget.Latest, true);
  assert.ok(source.statements.filter(ts.isImportDeclaration).every(n => n.importClause.isTypeOnly && n.moduleSpecifier.text === "../../contracts"));
  assert.doesNotMatch(readArchive(port, "utf8"), /GoogleSheet|readRows|appendRows|config|process|Date/);
  for (const file of [adapter, server]) assert.ok(readArchive(file, "utf8").startsWith('import "server-only";'));
});

test("browser scopes reject new linking application/port/adapter and ownership remains one-way with runtime and type edges", async () => {
  for (const file of ["src/modules/orders/ui/[id]/OrderDetailPage.tsx", "src/modules/shipments/ui/ShipmentListPage.tsx"]) for (const code of [
    'import { linkOrderToShipment } from "@/modules/shipments/server";',
    'import { linkOrderToShipment } from "@/modules/shipments/application/link-order-to-shipment";',
    'import type { Store } from "@/modules/shipments/application/ports/shipment-order-link-store";',
    'import { Store } from "../infrastructure/google-sheets/shipment-order-link-store";',
  ]) await check(file, code, true);
  for (const types of [false, true]) assert.deepEqual(ownershipEdges(browserOwnership({ types })), ["shipments->orders"]);
});
