import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ESLint } from "eslint";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";
const eslint = new ESLint(), application = "src/modules/shipments/application/advance-shipment-status-with-bill.ts", port = "src/modules/shipments/application/ports/shipment-bill-storage.ts", adapter = "src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts", server = "src/modules/shipments/server.ts";
async function check(filePath, code, expected) { const [r] = await eslint.lintText(code, { filePath }); const restricted = r.messages.some(m => ["no-restricted-imports", "no-restricted-syntax", "no-restricted-globals", "no-restricted-properties"].includes(m.ruleId)); assert.equal(restricted, expected, `${filePath}: ${code}\n${JSON.stringify(r.messages)}`); }
test("bill application, import-free port, adapter and composition pass exact scopes with erased provider interfaces", async () => {
  for (const file of [application, port, adapter, server]) { const [r] = await eslint.lintFiles(file); assert.equal(r.errorCount, 0, JSON.stringify(r.messages)); }
  await check(application, 'import type { UpdateShipmentStatusResult } from "./update-shipment-status"; import type { ShipmentBillStorage } from "./ports/shipment-bill-storage"; export type Types = [UpdateShipmentStatusResult, ShipmentBillStorage];', false);
  await check(adapter, 'import "server-only"; import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types"; export type Drive = IGoogleDriveService; export const bytes = () => Buffer.from("x"); export const clock = () => Date.now();', false);
});
test("bill application/port reject File/Buffer/providers/config/frameworks/IO and alias/relative/type/export/dynamic bypasses", async () => {
  for (const file of [application, port]) for (const code of [
    'import { getConfig } from "@/config";', 'import type { Config } from "../../../../config";', 'import type { IGoogleDriveService } from "@/externals/google/drive/types";',
    'import type { IGoogleSheetsService } from "@/externals/google/sheet/types";', 'import { Client } from "@/externals/google/drive";',
    'import { PATCH } from "@/app/api/shipments/[id]/route";', 'import { Store } from "../infrastructure/google-drive/shipment-bill-storage";', 'import { updateShipmentStatus } from "./update-shipment-status";',
    'import React from "react";', 'import type { Request } from "next/server";', 'import fs from "node:fs";', 'import type { Private } from "@/modules/orders/infrastructure/google-sheets/order-row-mapping";',
    'const x = new File([], "bill");', 'type X = File;', 'const x = new Date();', 'const x = Math.random();', 'const x = process.env.SECRET;', 'const x = Buffer.from("secret");', 'fetch("https://example.test");',
    'export * from "../contracts";', 'export { ShipmentStatus } from "../contracts";', 'const x = import("../server");', 'const x = require("@/config");', 'type X = import("@/externals/google/drive/types").IGoogleDriveService;',
  ]) await check(file, code, true);
  assert.doesNotMatch(readFileSync(port, "utf8"), /\b(File|Buffer|IGoogle|HTTP|token|tenant|readRows|Request|Response)\b/);
});
test("bill adapter/server reject real providers/config/route/UI and value-interface/dynamic/type forwarding", async () => {
  for (const file of [adapter, server]) for (const code of [
    'import { Drive } from "@/externals/google/drive";', 'import { Drive } from "@/externals/google/drive/GoogleDriveService";', 'import { Config } from "@/config";', 'import type { Config } from "../../../../config";',
    'import { PATCH } from "@/app/api/shipments/[id]/route";', 'import { Services } from "@/services/shipments";', 'import { UI } from "../ui/Page";', 'import fs from "node:fs";',
    'import { IGoogleDriveService } from "@/externals/google/drive/types";', 'export * from "../../contracts";', 'export { Drive } from "@/externals/google/drive";',
    'const x = import("@/config");', 'const x = require("@/externals/google/drive");', 'type X = import("@/externals/google/drive/types").IGoogleDriveService;',
  ]) await check(file, code, true);
  assert.ok(readFileSync(adapter, "utf8").startsWith('import "server-only";'));
});
test("earlier application/adapters keep their import scopes and browsers reject every new bill implementation", async () => {
  for (const name of ["create-shipment", "list-shipments", "link-order-to-shipment", "update-shipment-status"]) await check(`src/modules/shipments/application/${name}.ts`, 'import type { ShipmentBillStorage } from "./ports/shipment-bill-storage";', true);
  for (const name of ["shipment-writer", "shipment-list-reader", "shipment-order-link-store", "shipment-status-store"]) await check(`src/modules/shipments/infrastructure/google-sheets/${name}.ts`, 'import type { Storage } from "../../application/ports/shipment-bill-storage";', true);
  for (const file of ["src/modules/shipments/ui/ShipmentListPage.tsx", "src/modules/orders/ui/[id]/OrderDetailPage.tsx"]) for (const code of ['import { advanceShipmentStatusWithBill } from "@/modules/shipments/server";', 'import type { Storage } from "@/modules/shipments/application/ports/shipment-bill-storage";', 'import { Storage } from "../infrastructure/google-drive/shipment-bill-storage";']) await check(file, code, true);
  for (const types of [false, true]) assert.deepEqual(ownershipEdges(browserOwnership({ types })), ["shipments->orders"]);
});
