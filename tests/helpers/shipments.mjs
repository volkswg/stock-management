import {canonicalPath} from "./retirement-history.mjs";
import {legacySpecifier} from "./cleanup-history.mjs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { loadSource, plain } from "./load-source.mjs";

export const SHIPMENT_TIME = "2026-11-04T00:00:00.000Z";
export class ShipmentClock extends Date {
  constructor(...args) { super(...(args.length ? args : [SHIPMENT_TIME])); }
  static now() { return Date.parse(SHIPMENT_TIME); }
}

export function shipmentRow(values = {}) {
  const record = { id: "s/1", status: "draft", carrier: "Carrier", poNumber: "PO-1", shippingFee: null, remark: "", shippedAt: "", deliveredAt: "", createdAt: "created", updatedAt: "updated", deletedAt: "", createdBy: "web", shippingBillUrl: "", ...values };
  return [record.id, record.status, record.carrier, record.poNumber, record.shippingFee, record.remark, record.shippedAt, record.deliveredAt, record.createdAt, record.updatedAt, record.deletedAt, record.createdBy, record.shippingBillUrl];
}

export function fakeShipmentSheets(initial = {}, { failRead, failUpdate, failAppend } = {}) {
  const rows = structuredClone({ shipments: [], orders: [], shipmentOrders: [], orderItems: [], ...initial });
  const events = [];
  const sheets = Object.fromEntries(Object.keys(rows).map((name) => [name, {
    readRows: async (...args) => { events.push(["read", name, ...args]); if (failRead === name) throw new Error("synthetic read failure"); return rows[name]; },
    appendRows: async (range, values) => { events.push(["append", name, range, plain(values)]); if (failAppend === name) throw new Error("synthetic append failure"); rows[name].push(...values); },
    updateRows: async (range, values) => {
      events.push(["update", name, range, plain(values)]);
      if (failUpdate === range || failUpdate === name) throw new Error("synthetic update failure");
      const match = /^B(\d+):M\d+$/.exec(range);
      if (name === "shipments" && match) { const index = Number(match[1]) - 2; rows[name][index] = [rows[name][index][0], ...values[0]]; }
    },
  }]));
  return { sheets, rows, events };
}

// Closed legacy graph plus the exact Shipment creation/read/link/status/bill seams and pure constants.
// Config, transport/auth and Drive implementations are never evaluated.
export function shipmentServices({ globals = {}, createId = () => "synthetic-shipment-id" } = {}) {
  const cache = new Map();
  const seamFiles = new Set(["src/infrastructure/persistence/google-sheets/const.ts","src/modules/shipments/infrastructure/google-sheets/shipments/const.ts","src/modules/shipments/infrastructure/google-sheets/shipment-orders/const.ts",
    "src/modules/shipments/status.ts",
    "src/modules/shipments/application/create-shipment.ts",
    "src/modules/shipments/application/ports/created-shipment-writer.ts",
    "src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts",
    "src/modules/shipments/server.ts",
    "src/modules/shipments/application/advance-shipment-status-with-bill.ts",
    "src/modules/shipments/application/ports/shipment-bill-storage.ts",
    "src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts",
    "src/modules/shipments/application/update-shipment-status.ts",
    "src/modules/shipments/application/ports/shipment-status-store.ts",
    "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts",
    "src/modules/shipments/application/link-order-to-shipment.ts",
    "src/modules/shipments/application/ports/shipment-order-link-store.ts",
    "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts",
    "src/externals/google/sheet/sheets/shipment-orders/const.ts",
    "src/modules/shipments/application/list-shipments.ts",
    "src/modules/shipments/application/ports/shipment-list-reader.ts",
    "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts",
    "src/externals/google/sheet/const.ts",
    "src/externals/google/sheet/sheets/shipments/const.ts",
  ]);
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const constants = { ...loadSource("src/infrastructure/persistence/google-sheets/const.ts"),
    ...loadSource("src/modules/shipments/infrastructure/google-sheets/shipments/const.ts"),
    ...loadSource("src/modules/shipments/infrastructure/google-sheets/shipment-orders/const.ts") };
  function load(path) {
    const file = relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
    if (file === "src/services/orders/createDraftOrder.ts") return load("src/modules/orders/contracts.ts");
    if ((file === "src/services/utils/createSortableId.ts" || file === "src/infrastructure/runtime/create-sortable-id.ts")) return { createSortableId: createId };
    if (cache.has(file)) return cache.get(file);
    if (!["src/shared/lib/is-record.ts","src/modules/shipments/http.ts"].includes(file) && !seamFiles.has(file) && !/^(src\/services\/shipments\/|src\/modules\/(orders|shipments)\/contracts\.ts$|src\/features\/backend\/(shared|shipments)\/utils\.ts$)/.test(file)) throw new Error(`Unapproved shipment test dependency: ${file}`);
    const imports = new Proxy({}, {
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
      get(_, specifier) {
        if (specifier === "server-only") return {};
        if (legacySpecifier(specifier)==="@/externals/google/sheet") return constants;
        const target = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
        if (!target) throw new Error(`Unknown shipment dependency ${specifier}`);
        return load(target);
      },
    });
    const result = loadSource(canonicalPath(file), { imports, globals: { Date: ShipmentClock, Error, ...globals } });
    cache.set(file, result); return result;
  }
  return { load, services: load("src/services/shipments/index.ts") };
}

export function shipmentRoutes(sheets, { drive, services: replacement } = {}) {
  const errors = [], events = [];
  const { load, services } = shipmentServices({ globals: { console: { error: (...args) => errors.push(args) } } });
  const imports = {
    "next/server": { NextResponse: Response }, "@/config": { getConfig: () => ({}) },
    "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: () => { events.push("sheets"); return sheets; } },
    "@/externals/google/drive": { createGoogleDriveServiceFromConfig: () => { events.push("drive"); return drive; } },
    "@/services/shipments": { ...services, ...replacement },
    "@/modules/shipments/server": { ...load("src/modules/shipments/server.ts"), ...replacement },
    "@/modules/shipments/contracts": load("src/modules/shipments/contracts.ts"),
    "@/features/backend/shared/utils": load("src/features/backend/shared/utils.ts"),
    "@/features/backend/shipments/utils": load("src/features/backend/shipments/utils.ts"),
  };
  const globals = { Date: ShipmentClock, Error, File, console: { error: (...args) => errors.push(args) } };
  const route = (file) => loadSource(canonicalPath(file), { imports, globals });
  return { collection: route("src/app/api/shipments/route.ts"), detail: route("src/app/api/shipments/[id]/route.ts"), links: route("src/app/api/shipments/[id]/orders/route.ts"), errors, events };
}
export const shipmentParams = (id = "s/1") => ({ params: Promise.resolve({ id }) });
export const jsonRequest = (body, method = "POST") => new Request("https://example.test/api/shipments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
