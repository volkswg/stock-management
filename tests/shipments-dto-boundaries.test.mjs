import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ESLint } from "eslint";
import {dtoBefore,dtoParse,dtoPrint,dtoContract,dtoLegacy} from "./helpers/shipments-dto-history.mjs";
const eslint=new ESLint(),status="src/modules/shipments/status.ts";
const restricted=result=>result.messages.some(m=>["shipment-contracts/shape","no-restricted-imports","no-restricted-syntax","no-restricted-globals","no-restricted-properties"].includes(m.ruleId));
async function reject(filePath,code){const [result]=await eslint.lintText(code,{filePath});assert.ok(restricted(result),`${filePath}: ${code}\n${JSON.stringify(result.messages)}`);}

test("new DTO shapes pass exact scopes while pure enum, Orders/server scopes and both Shipment UI scopes retain previous enforcement",async()=>{
  for(const file of [dtoContract,dtoLegacy,status]){const [r]=await eslint.lintFiles(file);assert.equal(r.errorCount,0,JSON.stringify(r.messages));assert.equal(r.warningCount,0);}
  for(const [file,saved]of Object.entries(dtoBefore.boundaries))if(file!=="eslint/shipments-boundaries.mjs")assert.equal(readFileSync(file,"utf8"),saved.source,file);
  const file="eslint/shipments-boundaries.mjs",before=dtoBefore.boundaries[file].source,current=readFileSync(file,"utf8");
  assert.equal(current.slice(0,current.indexOf("const dtoNames")),before.slice(0,before.indexOf("const dtoNames")),"Original browser/client helper rules unchanged");
  const branch=s=>{let found;function visit(n){if(ts.isIfStatement(n)&&n.expression.getText(s)==='file.endsWith("/modules/shipments/status.ts")')found=n.thenStatement;ts.forEachChild(n,visit);}visit(s);assert.ok(found);return dtoPrint(found,s);};
  assert.equal(branch(dtoParse(file)),branch(dtoParse(file,before)),"Physical enum rule unchanged");
  for(const filePath of ["src/modules/orders/application/get-order-detail.ts","src/modules/orders/ui/[id]/OrderDetailPage.tsx","src/modules/orders/server.ts"]){await reject(filePath,'import type { Shipment } from "@/modules/shipments/contracts";');await reject(filePath,'import type { Shipment } from "@/services/shipments/types";');}
  await reject("src/modules/shipments/application/create-shipment.ts",'import type { Shipment } from "@/services/shipments/types";');
});

test("physical public DTO contract rejects legacy reverse edges, alias/relative/provider/type-value/import-type/dynamic and duplicate-definition bypasses",async()=>{
  const code=readFileSync(dtoContract,"utf8");
  for(const bad of [dtoBefore.sources[dtoContract].source,
    code.replace('"./status"','"@/modules/shipments/status"'),code.replace('"./status"','"@/services/shipments/types"'),
    code.replace('"@/modules/orders/contracts"','"../../orders/contracts"'),code.replace('import type { OrderStatus }','import { OrderStatus }'),
    code.replace('import { ShipmentStatus }','import type { ShipmentStatus }'),code.replace('import { ShipmentStatus }','import { type ShipmentStatus }'),
    code.replace('export { ShipmentStatus }','export type { ShipmentStatus }'),code.replace('export { ShipmentStatus }','export { type ShipmentStatus }'),
    code.replace('export type ShipmentOrder =','export type Duplicate ='),code.replace('export type ShipmentOrder =','type ShipmentOrder ='),
    code+'\nexport type Extra = string;',code+'\nexport const Extra = 1;',code+'\nexport * from "./status";',
    code+'\nexport type { Shipment } from "@/services/shipments/types";',code+'\nimport type { Row } from "@/externals/google/sheet/types";',
    code+'\nimport { getConfig } from "@/config";',code+'\nimport "server-only";',code+'\nimport React from "react";',
    code+'\nimport fs from "node:fs";',code+'\nconst x = require("./status");',code+'\nconst x = import("./status");',
    code+'\ntype X = import("@/modules/orders/contracts").OrderStatus;',code+'\nimport X = require("./status");',
    code+'\nconst x = process.env.SECRET;',code+'\nfetch("/api/shipments");',code+'\nconst x = Date.now();',code+'\nconst x = Math.random();',
  ])await reject(dtoContract,bad);
});

test("legacy leaf forwards only the public enum and eight erased named DTOs, rejecting alternate/relative/extra/runtime and dynamic dependencies",async()=>{
  const code=readFileSync(dtoLegacy,"utf8");
  for(const bad of [dtoBefore.sources[dtoLegacy].source,
    code.replaceAll('"@/modules/shipments/contracts"','"../../modules/shipments/contracts"'),code.replaceAll('"@/modules/shipments/contracts"','"@/services/shipments"'),
    code.replaceAll('"@/modules/shipments/contracts"','"@/modules/shipments/status"'),code.replace('export type {','export {'),
    code.replace('export { ShipmentStatus }','export { type ShipmentStatus }'),code.replace('export { ShipmentStatus }','export type { ShipmentStatus }'),
    code.replace('ShipmentOrder,','ShipmentOrder, Extra,'),code.replace('ShipmentOrder,','Shipment,'),
    code+'\nexport type Shipment = {};',code+'\nexport * from "@/modules/shipments/contracts";',code+'\nimport { ShipmentStatus } from "@/modules/shipments/contracts";',
    code+'\nexport { createShipment } from "@/modules/shipments/server";',code+'\nimport type { Row } from "@/externals/google/sheet/types";',
    code+'\nconst x = import("@/modules/shipments/contracts");',code+'\nconst x = require("@/config");',code+'\ntype X = import("@/modules/shipments/contracts").Shipment;',
    code+'\nimport X = require("@/modules/shipments/contracts");',code+'\nconst x = Buffer.from("x");',code+'\nconst x = process.env.SECRET;',
  ])await reject(dtoLegacy,bad);
});
