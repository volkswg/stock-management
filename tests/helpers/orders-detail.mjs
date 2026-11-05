import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ordersServer } from "./orders-server.mjs";
import { plain, loadSource } from "./load-source.mjs";
export const detailSheetNames = ["orders", "orderItems", "orderBills", "shipmentOrders", "shipments"];
export function detailSheets(data = {}, { fail } = {}) {
  const events = [], rows = { orders: [], orderItems: [], orderBills: [], shipmentOrders: [], shipments: [], ...data };
  const sheets = Object.fromEntries(detailSheetNames.map(name => [name, { readRows: async (...args) => { events.push([name, ...args]); if (fail === name) throw new Error(`failure ${name}`); return rows[name]; }, appendRows: () => { throw new Error("Unexpected write"); }, updateRows: () => { throw new Error("Unexpected write"); } }]));
  return { sheets, events, rows };
}
export function detailService({ original = false } = {}) {
  const load = ordersServer(); if (!original) return load("src/services/orders/listOrders.ts");
  const before = JSON.parse(readFileSync("tests/fixtures/orders-detail-before.json", "utf8")), exports = {};
  const imports = { "@/modules/orders/contracts": load("src/modules/orders/contracts.ts"), "@/modules/orders/server": load("src/modules/orders/server.ts"), "@/services/shipments": load("src/services/shipments/types.ts"), "@/modules/orders/infrastructure/google-sheets/order-row-mapping": load("src/modules/orders/infrastructure/google-sheets/order-row-mapping.ts") };
  const code = ts.transpileModule(before.source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(code).runInNewContext({ exports, Error, require: name => { if (!Object.hasOwn(imports, name)) throw new Error(`Unknown original detail dependency ${name}`); return imports[name]; } }); return exports;
}
export function detailHttp(h, { original = false, failConfig = false } = {}) {
  const load = ordersServer(), events = [], errors = [];
  const imports = { "next/server": { NextResponse: Response }, "@/config": { getConfig: () => { events.push("config"); if (failConfig) throw new Error("config failure"); return {}; } }, "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: () => { events.push("sheets"); return h.sheets; } }, "@/services/orders": { ...detailService({ original }), ...load("src/services/orders/updateOrderDetails.ts") } };
  const globals = { Error, console: { error: (...args) => errors.push(plain(args)) } }; let route;
  if (original) {
    const before = JSON.parse(readFileSync("tests/fixtures/orders-detail-before.json", "utf8")), exports = {}, code = ts.transpileModule(before.routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new vm.Script(code).runInNewContext({ exports, ...globals, require: name => { if (!Object.hasOwn(imports, name)) throw new Error(`Unknown original HTTP dependency ${name}`); return imports[name]; } }); route = exports;
  } else route = loadSource("src/app/api/orders/[id]/route.ts", { imports: {
    ...imports, "@/modules/orders/server": load("src/modules/orders/server.ts"),
    "@/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection": load("src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts"),
  }, globals });
  return { route, events, errors };
}
