import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ESLint } from "eslint";
import { enumBefore } from "./helpers/shipments-enum-history.mjs";
const eslint=new ESLint(), physical="src/modules/shipments/status.ts", contract="src/modules/shipments/contracts.ts", legacy="src/services/shipments/types.ts";
const restricted=r=>r.messages.some(m=>["shipment-contracts/shape","no-restricted-imports","no-restricted-syntax","no-restricted-globals","no-restricted-properties"].includes(m.ruleId));
async function reject(filePath,code) {const [r]=await eslint.lintText(code,{filePath});assert.ok(restricted(r),`${filePath}: ${code}\n${JSON.stringify(r.messages)}`);}

test("enum ownership exact scopes accept real pure leaf/forwarders without changing server or Orders application allowances",async()=>{
  for(const file of [physical,contract,legacy]) {const [r]=await eslint.lintFiles(file);assert.equal(r.errorCount,0,JSON.stringify(r.messages));assert.equal(r.warningCount,0);}
  for(const filePath of ["src/modules/orders/contracts.ts","src/modules/orders/application/get-order-detail.ts","src/modules/orders/ui/[id]/OrderDetailPage.tsx","src/modules/orders/server.ts","src/modules/shipments/application/create-shipment.ts"]) {
    for(const code of ['import { ShipmentStatus } from "@/modules/shipments/status";', 'import type { ShipmentStatus } from "../../../shipments/status";', 'export { ShipmentStatus } from "@/modules/shipments/status";']) await reject(filePath,code);
  }
});

test("physical status leaf accepts only the original exact enum; aliases, type imports, IO and dynamic/require/import-type bypasses fail",async()=>{
  for(const code of [
    'import { ShipmentStatus } from "@/services/shipments/types";', 'export { ShipmentStatus } from "./contracts";',
    'import type { OrderStatus } from "@/modules/orders/contracts";', 'export type { Shipment } from "../../../services/shipments/types";',
    'import "server-only";', 'import React from "react";', 'import { cookies } from "next/headers";',
    'import type { Row } from "@/externals/google/sheet/types";', 'import fs from "node:fs";', 'import { getConfig } from "@/config";',
    'const x = import("./server");', 'const x = require("@/services/shipments");', 'type X = import("./contracts").Shipment;',
    'import X = require("./contracts");', 'const x = Date.now();', 'const x = Math.random();', 'fetch("/api/shipments");', 'const x = Buffer.from("x");', 'const x = process.env.SECRET;',
    enumBefore.enum.source+'\nexport const extra = 1;', enumBefore.enum.source.replace('"draft"','"changed"'), enumBefore.enum.source.replace('enum ShipmentStatus','const enum ShipmentStatus'),
    'export const ShipmentStatus = { Draft: "draft" } as const;',
  ]) await reject(physical,code);
});

test("public contract owns exactly eight DTOs and rejects reverse/relative forwarding and erased/runtime swaps",async()=>{
  const code=readFileSync(contract,"utf8");
  for(const bad of [
    code.replace('"./status"','"@/services/shipments/types"'), code.replace('"./status"','"@/modules/shipments/status"'),
    code.replace('import type { OrderStatus }','import { OrderStatus }'), code.replace('export { ShipmentStatus }','export { type ShipmentStatus }'),
    code.replace('export type ShipmentOrder =','export type Extra ='), code+'\nexport * from "./status";',
    code+'\nimport { ShipmentStatus } from "./status";', code+'\nexport { createShipment } from "@/services/shipments";',
    'export * from "../../services/shipments";', 'const x = import("./status");', 'type X = import("./status").ShipmentStatus;',
    code+'\nconst x = require("./status");', code+'\nfetch("/api/shipments");',
  ]) await reject(contract,bad);
});

test("legacy DTO leaf permits only public named forwards; reverse/type/value/re-export bypasses fail",async()=>{
  const code=readFileSync(legacy,"utf8");
  for(const bad of [
    code.replaceAll('"@/modules/shipments/contracts"','"@/modules/shipments/status"'),
    code.replaceAll('"@/modules/shipments/contracts"','"../../modules/shipments/contracts"'),
    code.replace('export type {','export {'), code.replace('export { ShipmentStatus }','export type { ShipmentStatus }'), code.replace('export { ShipmentStatus }','export { type ShipmentStatus }'),
    code+'\nimport type { OrderStatus } from "@/modules/orders/contracts";',
    code+'\nexport * from "@/modules/shipments/status";', code+'\nexport { createShipment } from "./index";',
    code+'\nimport type { Private } from "@/modules/shipments/application/list-shipments";',
    code+'\nconst x = import("./index");', code+'\nconst x = require("@/config");', code+'\ntype X = import("@/modules/shipments/contracts").Shipment;',
    code+'\nexport const now = Date.now();', code+'\nconst x = process.env.SECRET;',
  ]) await reject(legacy,bad);
});
