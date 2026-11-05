import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ESLint } from "eslint";
import ts from "typescript";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";
const eslint = new ESLint();
const application = "src/modules/shipments/application/list-shipments.ts", port = "src/modules/shipments/application/ports/shipment-list-reader.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts", server = "src/modules/shipments/server.ts";
const restricted = result => result.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId));
async function check(filePath, code, expected) {
  const [result] = await eslint.lintText(code, { filePath }); assert.equal(restricted(result), expected, `${filePath}: ${code}\n${JSON.stringify(result.messages)}`);
}
test("real read application/port/reader/composition pass strict scopes and exact imports remain permitted", async () => {
  for (const file of [application, port, adapter, server]) {
    const [result] = await eslint.lintFiles(file); assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  }
  for (const [file, code] of [
    [application, 'import type { ShipmentListItem } from "../contracts"; import type { ShipmentListReader } from "./ports/shipment-list-reader"; export type Output = [ShipmentListItem, ShipmentListReader];'],
    [port, 'import type { ShipmentRelatedOrder } from "../../contracts"; export type Orders = ReadonlyMap<string, ShipmentRelatedOrder>;'],
    [adapter, 'import "server-only"; import type { IGoogleSheetsService, GoogleSheetRow } from "@/externals/google/sheet/types"; import { OrderStatus } from "@/modules/orders/contracts"; export type Row = GoogleSheetRow; export type Sheets = IGoogleSheetsService; export const status = OrderStatus.Complete;'],
    [server, 'import "server-only"; import { listShipments, getShipmentDetail } from "./application/list-shipments"; import { GoogleSheetsShipmentListReader } from "./infrastructure/google-sheets/shipment-list-reader"; export const operations = [listShipments, getShipmentDetail, GoogleSheetsShipmentListReader];'],
  ]) await check(file, code, false);
});

test("read application/port reject framework, concrete provider, legacy, time/env and relative/type/dynamic bypasses", async () => {
  for (const file of [application, port]) for (const code of [
    'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { Shipment } from "../server";', 'import { Shipment } from "@/services/shipments";',
    'import type { GoogleSheetRow } from "@/externals/google/sheet/types";',
    'import { Reader } from "../infrastructure/google-sheets/shipment-list-reader";',
    'import { OrderStatus } from "@/modules/orders/contracts";', 'import { Reader } from "@/modules/orders/infrastructure/google-sheets/order-list-reader";',
    'import { Drive } from "@/externals/google/drive";', 'import type { Request } from "next/server";', 'import React from "react";',
    'import { google } from "googleapis";', 'import fs from "node:fs";',
    'const value = new Date();', 'const value = Date.now();', 'const value = Math.random();',
    'const value = process.env.SECRET;', 'const value = Buffer.from("secret");', 'fetch("https://example.test");',
    'export { ShipmentStatus } from "../contracts";', 'export * from "../contracts";',
    'const adapter = import("../infrastructure/google-sheets/shipment-list-reader");',
    'const adapter = require("../infrastructure/google-sheets/shipment-list-reader");',
    'type Reader = import("../infrastructure/google-sheets/shipment-list-reader").Reader;',
  ]) await check(file, code, true);
});

test("reader rejects Orders private mappers, providers/app/config, non-erased interfaces and forwarding exports", async () => {
  for (const code of [
    'import { Mapper } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";',
    'import type { Mapper } from "../../../orders/infrastructure/google-sheets/order-row-mapping";',
    'import { getOrderDetail } from "@/services/orders";', 'import { listShipments } from "@/services/shipments";',
    'import { listOrders } from "@/modules/orders/server";', 'import { Client } from "@/externals/google/sheet";',
    'import { Client } from "@/externals/google/sheet/client/GoogleSheetsClient";', 'import { Drive } from "@/externals/google/drive";',
    'import { GET } from "@/app/api/shipments/route";', 'import { getConfig } from "@/config";',
    'import { IGoogleSheetsService } from "@/externals/google/sheet/types";',
    'import type { Config } from "../../../../config";', 'import fs from "node:fs";',
    'export * from "../../contracts";', 'export { ShipmentStatus } from "../../contracts";',
    'const x = import("@/modules/orders/server");', 'const x = require("@/config");',
    'type Rows = import("@/externals/google/sheet/types").GoogleSheetRow;',
  ]) await check(adapter, code, true);
});

test("read-specific allowances do not expand creation imports and composition remains exact", async () => {
  await check("src/modules/shipments/application/create-shipment.ts", 'import type { ShipmentListReader } from "./ports/shipment-list-reader";', true);
  await check("src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts", 'import { OrderStatus } from "@/modules/orders/contracts";', true);
  for (const code of [
    'export * from "./application/list-shipments";', 'export { listShipments } from "./application/list-shipments";',
    'import { listOrders } from "@/modules/orders/server";', 'import { getConfig } from "@/config";',
    'import { Reader } from "@/externals/google/sheet";', 'import { Link } from "@/services/shipments/linkOrderToShipment";',
    'const x = import("./application/list-shipments");', 'type Reader = import("./infrastructure/google-sheets/shipment-list-reader").Reader;',
  ]) await check(server, code, true);
});

test("both browser graphs reject all new read implementation entrypoints and retain one-way ownership", async () => {
  for (const file of ["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/orders/ui/[id]/OrderDetailPage.tsx"]) for (const code of [
    'import { listShipments } from "@/modules/shipments/server";',
    'import type { ShipmentReadModel } from "@/modules/shipments/application/ports/shipment-list-reader";',
    'import { listShipments } from "@/modules/shipments/application/list-shipments";',
    'import { Reader } from "../infrastructure/google-sheets/shipment-list-reader";',
  ]) await check(file, code, true);
  for (const types of [false, true]) assert.deepEqual(ownershipEdges(browserOwnership({ types })), ["shipments->orders"]);
  for (const file of [adapter, server]) assert.ok(readFileSync(file, "utf8").startsWith('import "server-only";'));
  const source = ts.createSourceFile(port, readFileSync(port, "utf8"), ts.ScriptTarget.Latest, true);
  assert.ok(source.statements.filter(ts.isImportDeclaration).every(n => n.importClause.isTypeOnly && n.moduleSpecifier.text === "../../contracts"));
});
