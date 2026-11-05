import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shipmentServices } from "./helpers/shipments.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
import { shipmentCreationBefore as before, assertShipmentCreationMapping } from "./helpers/shipments-create-history.mjs";

const application = "src/modules/shipments/application/create-shipment.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts";

test("pure creation uses only a fake business writer and reproduces all captured legacy records", async () => {
  const { load } = shipmentServices(), { createShipment } = load(application);
  for (const fixture of before.cases) {
    const events = [], records = [];
    const result = await createShipment(fixture.input, { now: () => { events.push("clock"); return before.time; }, createId: () => { events.push("id"); return before.id; }, writer: { appendCreatedShipment: async record => { events.push("write"); records.push(record); } } });
    assert.deepEqual(events, ["clock", "id", "write"]); assert.deepEqual(plain(result), fixture.shipment);
    assert.deepEqual(Object.keys(result), fixture.keys); assert.equal(result, records[0]);
  }
});

test("application validation is independent of all IO and append must finish before returning the same record", async () => {
  const { createShipment } = shipmentServices().load(application), pendingWrite = deferred(), events = []; let received, success = false;
  const deps = { now: () => { events.push("clock"); return before.time; }, createId: () => { events.push("id"); return before.id; }, writer: { appendCreatedShipment: async record => { events.push("append"); received = record; await pendingWrite.promise; } } };
  await assert.rejects(createShipment({ poNumber: "  ", createdBy: "web" }, deps), error => error.message === "Shipment PO number is required."); assert.deepEqual(events, []);
  const pending = createShipment({ poNumber: " PO ", createdBy: " actor " }, deps); pending.then(() => { success = true; }); await flush(); assert.equal(success, false);
  pendingWrite.resolve(); const result = await pending; assert.equal(result, received); assert.deepEqual(events, ["clock", "id", "append"]);
  const failure = new Error("fake writer failure"); let count = 0;
  await assert.rejects(createShipment({ poNumber: "PO", createdBy: "web" }, { ...deps, writer: { appendCreatedShipment: async () => { count++; throw failure; } } }), error => error === failure); assert.equal(count, 1);
});

test("actual adapter is lazy and writes each captured thirteen-field A:M payload once", async () => {
  const { GoogleSheetsShipmentWriter } = shipmentServices().load(adapter);
  const noAccess = { get shipments() { assert.fail("Adapter construction must not read a worksheet property"); } };
  new GoogleSheetsShipmentWriter(noAccess);
  for (const fixture of before.cases) {
    const appends = [], writer = new GoogleSheetsShipmentWriter({ shipments: { appendRows: async (...args) => appends.push(plain(args)), readRows: () => assert.fail("No reads"), updateRows: () => assert.fail("No updates") } });
    await writer.appendCreatedShipment(fixture.shipment); assert.deepEqual(appends, fixture.appends); assert.equal(appends[0][1][0].length, 13);
  }
});

test("direct legacy and unchanged barrel export the same named server-only composition, preserving validation laziness", async () => {
  const { load, services } = shipmentServices();
  const direct = load("src/services/shipments/createShipment.ts"), server = load("src/modules/shipments/server.ts");
  assert.deepEqual(Object.keys(server), ["createShipment"]); assert.deepEqual(Object.keys(direct), ["createShipment"]);
  assert.equal(services.createShipment, direct.createShipment); assert.equal(direct.createShipment, server.createShipment);
  for (const f of [adapter, "src/modules/shipments/server.ts"]) assert.ok(readFileSync(f, "utf8").startsWith('import "server-only";'));
  await assert.rejects(server.createShipment({ poNumber: " ", createdBy: "web", googleSheetsService: { get shipments() { assert.fail("Validation must precede worksheet access"); } } }), error => error.message === "Shipment PO number is required.");
  assert.equal(services.ShipmentStatus, load("src/modules/shipments/contracts.ts").ShipmentStatus);
});

test("reviewed extraction preserves original validation, object construction, row mapping and range expression", () => assertShipmentCreationMapping());

test("offline loader stays closed to config/auth/Drive/provider implementations", () => {
  const { load } = shipmentServices();
  for (const file of ["src/config/index.ts", "src/externals/google/sheet/client/GoogleSheetsClient.ts", "src/externals/google/drive/index.ts", "src/externals/google/sheet/GoogleSheetsService.ts", "src/modules/shipments/application/unapproved.ts"]) assert.throws(() => load(file), /Unapproved shipment test dependency/);
});

test("actual writer through ShipmentsSheet/BaseGoogleSheet/GoogleSheetsClient retains one USER_ENTERED transport append", async () => {
  const { load } = shipmentServices(), { GoogleSheetsShipmentWriter } = load(adapter), requests = [];
  const { GoogleSheetsClient } = loadSource("src/externals/google/sheet/client/GoogleSheetsClient.ts", { imports: { "../const": load("src/externals/google/sheet/const.ts") }, globals: { fetch: async (url, init) => { requests.push({ url, init }); return Response.json({}); } } });
  const { BaseGoogleSheet } = loadSource("src/externals/google/sheet/sheets/BaseGoogleSheet.ts");
  const { ShipmentsSheet } = loadSource("src/externals/google/sheet/sheets/shipments/ShipmentsSheet.ts", { imports: { "../../const": load("src/externals/google/sheet/const.ts"), "../BaseGoogleSheet": { BaseGoogleSheet }, "./const": load("src/externals/google/sheet/sheets/shipments/const.ts") } });
  const client = new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake-sheet");
  const writer = new GoogleSheetsShipmentWriter({ shipments: new ShipmentsSheet(client, "Synthetic Shipments") });
  assert.equal(requests.length, 0); await writer.appendCreatedShipment(before.cases[0].shipment);
  assert.equal(requests.length, 1); const request = requests[0], url = new URL(request.url);
  assert.equal(request.init.method, "POST"); assert.equal(url.searchParams.get("valueInputOption"), "USER_ENTERED"); assert.equal(url.searchParams.get("insertDataOption"), "INSERT_ROWS");
  assert.ok(decodeURIComponent(url.pathname).includes("'Synthetic Shipments'!A:M:append")); assert.deepEqual(JSON.parse(request.init.body), { values: before.cases[0].appends[0][1] });
});
