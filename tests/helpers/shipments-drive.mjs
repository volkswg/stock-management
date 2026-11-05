import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { shipmentServices, ShipmentClock, shipmentRow } from "./shipments.mjs";
import { loadSource, plain } from "./load-source.mjs";
export const driveRouteFile = "src/app/api/shipments/[id]/route.ts";

// Explicit offline route wiring: factories never evaluate real config/auth.
export function driveRoute({ rows = [shipmentRow({ status: "ready_to_ship" })], fail, drive, updateStatus, original = false, globals = {}, configFactory, sheetsFactory, driveFactory, response = Response } = {}) {
  const trace = [], errors = [], logger = { error: (...args) => errors.push(plain(args)) };
  const contextGlobals = { Date: ShipmentClock, Error, File, console: logger, ...globals };
  const { load, services } = shipmentServices({ globals: contextGlobals });
  const sheets = { shipments: {
    updateRows: async (range, values) => { trace.push(["write", range, plain(values)]); if (fail === range) throw new Error(`failure ${range}`); },
    readRows: async range => { trace.push(["read", range]); if (fail === range) throw new Error(`failure ${range}`); return rows; },
  } };
  const provider = drive ?? {
    uploadImage: async input => { trace.push(["upload", input.fileName, input.contentType, input.bytes.length]); if (fail === "upload") throw new Error("failure upload"); return { id: "fake-id", webViewLink: " url " }; },
    deleteFile: async id => { trace.push(["delete", id]); if (fail === "delete") throw new Error("failure delete"); },
  };
  const imports = {
    "next/server": { NextResponse: response },
    "@/config": { getConfig: () => { trace.push(["config"]); if (fail === "config") throw new Error("failure config"); return configFactory ? configFactory() : {}; } },
    "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: config => { trace.push(["sheets"]); if (fail === "sheets") throw new Error("failure sheets"); return sheetsFactory ? sheetsFactory(config) : sheets; } },
    "@/externals/google/drive": { createGoogleDriveServiceFromConfig: config => { trace.push(["drive"]); if (fail === "drive") throw new Error("failure drive"); return driveFactory ? driveFactory(config) : fail === "unavailable" ? undefined : provider; } },
    "@/services/shipments": { ...services, ...(updateStatus ? { updateShipmentStatus: updateStatus } : {}) },
    "@/modules/shipments/server": load("src/modules/shipments/server.ts"),
    "@/features/backend/shared/utils": load("src/features/backend/shared/utils.ts"),
    "@/features/backend/shipments/utils": load("src/features/backend/shipments/utils.ts"),
  };
  let route;
  if (original) {
    const before = JSON.parse(readFileSync("tests/fixtures/shipments-drive-before.json", "utf8"));
    const output = ts.transpileModule(before.source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, exports = {};
    new vm.Script(output).runInNewContext({ exports, Buffer, URL, URLSearchParams, ...contextGlobals, require: name => { if (!Object.hasOwn(imports, name)) throw new Error(`Unapproved original route dependency ${name}`); return imports[name]; } }); route = exports;
  } else route = loadSource(driveRouteFile, { imports, globals: contextGlobals });
  return { route, trace, errors, sheets, services, provider };
}
export function shippingBillRequest({ type = "application/pdf", size = 4, status = "shipping" } = {}) {
  const form = new FormData(); form.set("status", status); form.set("poNumber", " PO "); form.set("shippingBill", new File([new Uint8Array(size)], "ignored", { type }));
  return new Request("https://example.test/api/shipments/s%2F1", { method: "PATCH", body: form });
}
export const requestBody = body => ({ headers: new Headers({ "Content-Type": "application/json" }), json: async () => body });
