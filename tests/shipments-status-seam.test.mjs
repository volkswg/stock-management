import {readArchive} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { shipmentServices, fakeShipmentSheets, shipmentRow, shipmentRoutes, shipmentParams, jsonRequest, ShipmentClock, SHIPMENT_TIME } from "./helpers/shipments.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
import { shipmentStatusBefore as before, migratedStatusFunctions, assertShipmentStatusHistory, assertStatusSourceParity } from "./helpers/shipments-status-history.mjs";
const application = "src/modules/shipments/application/update-shipment-status.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-status-store.ts";
const { load, services } = shipmentServices(), app = load(application), { GoogleSheetsShipmentStatusStore } = load(adapter);
const base = { shipmentId: "s/1", status: "ready_to_ship" };
function fakePort({ missing = false, status = "draft" } = {}) {
  const events = [], updates = [];
  const target = Object.fromEntries(Object.entries({ readCurrentStatus: status, readPoNumber: "PO", readShippingFee: 1234.5, readShippedAt: "shipped", readDeliveredAt: "delivered", readShippingBillUrl: "stored" }).map(([key, value]) => [key, () => { events.push(key); return value; }]));
  target.saveStatusUpdate = async update => { events.push("save"); updates.push(update); };
  const store = { prepareStatusUpdate: async id => { events.push(["prepare", id]); return missing ? undefined : target; } };
  return { events, updates, store, target, dependencies: { store, now: () => { events.push("clock"); return SHIPMENT_TIME; } } };
}

test("pure status application: fee precheck prevents port/time access; other rejected outcomes preserve lookup/validation order", async () => {
  for (const fee of [undefined, NaN, Infinity, -Infinity, -1, 1_000_000_001]) {
    const h = fakePort(); assert.deepEqual(plain(await app.updateShipmentStatus({ ...base, status: "delivered", deliveryFee: fee }, h.dependencies)), { outcome: "invalid_delivery_fee" }); assert.deepEqual(h.events, []);
  }
  for (const [config, input, outcome, events] of [
    [{ missing: true }, base, "not_found", [["prepare", "s/1"]]],
    [{ status: "delivered" }, base, "invalid_transition", [["prepare", "s/1"], "readCurrentStatus"]],
    [{ status: "ready_to_ship" }, { ...base, status: "shipping", poNumber: " " }, "invalid_po_number", [["prepare", "s/1"], "readCurrentStatus"]],
  ]) { const h = fakePort(config); assert.equal((await app.updateShipmentStatus(input, h.dependencies)).outcome, outcome); assert.deepEqual(h.events, events); assert.deepEqual(h.updates, []); }
});

test("pure status application: all transitions and original conditional reads/timestamps/DTOs with only business fake port", async () => {
  const allowed = new Set(["draft:ready_to_ship", "ready_to_ship:shipping", "shipping:delivered"]);
  for (const current of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "invalid"]) for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled"]) {
    const h = fakePort({ status: current }), result = await app.updateShipmentStatus({ ...base, status, deliveryFee: 0, poNumber: " PO ", shippingBillUrl: " new " }, h.dependencies);
    if (!allowed.has(`${current}:${status}`)) { assert.equal(result.outcome, "invalid_transition"); assert.deepEqual(h.events, [["prepare", "s/1"], "readCurrentStatus"]); continue; }
    assert.deepEqual(plain(result), { outcome: "updated", shipment: { status, poNumber: "PO", shippingFee: status === "delivered" ? 0 : 1234.5, shippedAt: status === "shipping" ? SHIPMENT_TIME : "shipped", deliveredAt: status === "delivered" ? SHIPMENT_TIME : "delivered", updatedAt: SHIPMENT_TIME, shippingBillUrl: status === "shipping" ? "new" : "stored" } });
    assert.deepEqual(h.events, [["prepare", "s/1"], "readCurrentStatus", "clock", ...(status === "shipping" ? [] : ["readPoNumber"]), ...(status === "delivered" ? [] : ["readShippingFee"]), ...(status === "shipping" ? [] : ["readShippedAt"]), ...(status === "delivered" ? [] : ["readDeliveredAt"]), ...(status === "shipping" ? [] : ["readShippingBillUrl"]), "save"]);
  }
});

test("pure status application: every accessor/clock/write failure keeps error identity and invokes no retries", async () => {
  for (const phase of ["prepare", "readCurrentStatus", "clock", "readPoNumber", "readShippingFee", "readShippedAt", "readDeliveredAt", "readShippingBillUrl", "save"]) {
    const h = fakePort(), error = new Error(phase);
    const throwError = () => { h.events.push(phase); throw error; };
    if (phase === "prepare") h.store.prepareStatusUpdate = throwError;
    else if (phase === "clock") h.dependencies.now = throwError;
    else if (phase === "save") h.target.saveStatusUpdate = throwError;
    else h.target[phase] = throwError;
    await assert.rejects(app.updateShipmentStatus(base, h.dependencies), e => e === error);
    assert.equal(h.events.filter(e => e === phase).length, 1); assert.equal(h.events.at(-1), phase);
  }
});

test("pure status application: waits for save and constructs original success after persistence, without normalizing supplied ID", async () => {
  const h = fakePort(), gate = deferred(); let saved, success = false;
  h.target.saveStatusUpdate = async update => { saved = update; await gate.promise; update.updatedAt = "mutated fake argument"; };
  const pending = app.updateShipmentStatus({ ...base, shipmentId: " s/1 " }, h.dependencies); pending.then(() => { success = true; }); await flush();
  assert.equal(success, false); assert.deepEqual(h.events[0], ["prepare", " s/1 "]); gate.resolve();
  const result = await pending; assert.notEqual(result.shipment, saved); assert.equal(result.shipment.updatedAt, SHIPMENT_TIME);
});

test("actual status adapter constructor is lazy and normalized fields remain deferred beyond exact row capture", async () => {
  new GoogleSheetsShipmentStatusStore({ get shipments() { assert.fail("Constructor accesses worksheet"); } });
  const trace = [], row = shipmentRow({ status: { toString() { trace.push("status"); return "draft"; } }, poNumber: { toString() { trace.push("po"); return "PO"; } } });
  const sheets = { shipments: { updateRows: async range => trace.push(range), readRows: async range => { trace.push(range); return [row]; } } };
  const target = await new GoogleSheetsShipmentStatusStore(sheets).prepareStatusUpdate("s/1");
  assert.deepEqual(trace, ["M1", "A2:M"]); assert.equal(target.readCurrentStatus(), "draft"); assert.deepEqual(trace, ["M1", "A2:M", "status"]);
  assert.equal(target.readPoNumber(), "PO"); assert.deepEqual(trace, ["M1", "A2:M", "status", "po"]);
  assert.equal((await services.updateShipmentStatus({ ...base, status: "delivered", googleSheetsService: { get shipments() { assert.fail("Invalid fee accesses sheet"); } } })).outcome, "invalid_delivery_fee");
});

function originalService() {
  const exports = {}, output = ts.transpileModule(before.source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(output).runInNewContext({ exports, Date: ShipmentClock, Error, require: name => {
    if (name === "./types") return load("src/services/shipments/types.ts");
    throw new Error(`Unapproved original status dependency: ${name}`);
  } }); return exports;
}
const original = originalService();
test("actual status composition matches saved original for golden outcomes/errors/events and malformed collections/rows", async () => {
  const compare = async (rows, input = base, options = {}) => {
    const run = async service => {
      const h = fakeShipmentSheets({ shipments: rows }, options);
      try { return { result: plain(await service.updateShipmentStatus({ googleSheetsService: h.sheets, ...input })), events: h.events }; }
      catch (e) { return { error: { name: e.name, message: e.message }, events: h.events }; }
    };
    assert.deepEqual(await run(services), await run(original));
  };
  for (const example of before.examples) await compare(example.rows.shipments, example.input, example.options);
  for (const rows of [null, {}, [null], [42], [true], [], ["text"], [[], shipmentRow()], [shipmentRow({ deletedAt: "deleted" }), shipmentRow()]]) await compare(rows);
  for (const shippingFee of [undefined, null, NaN, Infinity, -Infinity, true, 0, "", " ", "bad", "1,234", "-2", "Infinity"]) await compare([shipmentRow({ shippingFee })]);
  for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "unknown"]) await compare([shipmentRow({ status })], { ...base, status: "shipping", poNumber: " PO ", shippingBillUrl: " url " });
});

test("actual status target keeps original untouched raw values/defaults and correct first-active duplicate row index", async () => {
  const carrier = { untouched: true }, values = shipmentRow({ carrier, remark: NaN, createdAt: false, deletedAt: null, createdBy: 0 }), writes = [];
  const rows = [shipmentRow({ deletedAt: "deleted" }), values, shipmentRow({ status: "shipping" })];
  const sheets = { shipments: { updateRows: async (...args) => writes.push(args), readRows: async () => rows } };
  const result = await services.updateShipmentStatus({ googleSheetsService: sheets, ...base }); assert.equal(result.outcome, "updated");
  assert.equal(writes.length, 2); assert.equal(writes[1][0], "B3:M3"); const row = writes[1][1][0];
  assert.equal(row.length, 12); assert.equal(row[1], carrier); assert.ok(Number.isNaN(row[4])); assert.equal(row[7], false); assert.equal(row[9], ""); assert.equal(row[10], 0);
});

test("status history retains original three hashes, helper bodies, precheck, findIndex/destructuring, raw cells and existing compositions", () => {
  const fixture = JSON.parse(readArchive("tests/fixtures/shipments-structure.json", "utf8")); assert.equal(migratedStatusFunctions.size, 3);
  for (const key of migratedStatusFunctions) assertShipmentStatusHistory(key, fixture.functions[key]);
  assertStatusSourceParity();
});

test("legacy direct/barrel/server status exports share identity and the original ShipmentStatus object remains singular", () => {
  const direct = load(before.file), server = load("src/modules/shipments/server.ts");
  assert.deepEqual(Object.keys(direct), ["updateShipmentStatus"]); assert.equal(direct.updateShipmentStatus, server.updateShipmentStatus); assert.equal(direct.updateShipmentStatus, services.updateShipmentStatus);
  assert.equal(services.ShipmentStatus, load("src/modules/shipments/contracts.ts").ShipmentStatus);
});

test("real status transport retains quoted/encoded M1 PUT -> A2:M GET -> B3:M3 PUT with exact bodies and USER_ENTERED", async () => {
  for (const phase of ["success", "M1", "A2:M", "B3:M3"]) {
    const requests = [], constants = load("src/externals/google/sheet/const.ts"), row = shipmentRow({ carrier: " raw ", remark: 42, createdAt: false, createdBy: true });
    const { GoogleSheetsClient } = loadSource("src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts", { imports: { "../const": constants }, globals: { fetch: async (url, init) => {
      requests.push({ url, init }); const range = decodeURIComponent(new URL(url).pathname.split("/values/")[1]).split("!")[1];
      if (range === phase) return new Response("synthetic failure", { status: 500 });
      return Response.json(init.method === "GET" ? { values: [shipmentRow({ id: "other" }), row] } : {});
    } } });
    const { BaseGoogleSheet } = loadSource("src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts");
    const { ShipmentsSheet } = loadSource("src/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet.ts", { imports: { "../BaseGoogleSheet": { BaseGoogleSheet }, "../../const": constants, "./const": load("src/externals/google/sheet/sheets/shipments/const.ts") } });
    const sheets = { shipments: new ShipmentsSheet(new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake sheet/id"), "Synthetic ' Shipments") };
    const pending = services.updateShipmentStatus({ googleSheetsService: sheets, ...base });
    if (phase === "success") assert.equal((await pending).outcome, "updated");
    else await assert.rejects(pending, /Google Sheets API request failed: 500 synthetic failure/);
    const expected = ["M1", "A2:M", "B3:M3"].slice(0, phase === "success" ? 3 : ["M1", "A2:M", "B3:M3"].indexOf(phase) + 1);
    assert.deepEqual(requests.map(r => decodeURIComponent(new URL(r.url).pathname.split("/values/")[1])), expected.map(range => `'Synthetic '' Shipments'!${range}`));
    for (const [index, { url, init }] of requests.entries()) {
      const parsed = new URL(url); assert.ok(parsed.pathname.startsWith("/v4/spreadsheets/fake%20sheet%2Fid/values/")); assert.equal(init.method, index === 1 ? "GET" : "PUT"); assert.equal(init.headers.Authorization, "Bearer fake-token");
      assert.equal(parsed.searchParams.get("valueInputOption"), index === 1 ? null : "USER_ENTERED");
      if (index === 0) assert.deepEqual(JSON.parse(init.body), { values: [["shippingBillUrl"]] });
      else if (index === 1) assert.equal(init.body, undefined);
      else assert.deepEqual(JSON.parse(init.body), { values: [["ready_to_ship", " raw ", "PO-1", null, 42, "", "", false, SHIPMENT_TIME, "", true, ""]] });
    }
  }
});

function billRequest() {
  const form = new FormData(); form.set("status", "shipping"); form.set("poNumber", " PO "); form.set("shippingBill", new File(["fake"], "ignored.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/shipments/s%2F1", { method: "PATCH", body: form });
}

test("unchanged PATCH plus actual status service preserves Drive-before-Sheets and cleanup at all real storage failures/outcomes", async () => {
  for (const mode of ["success", "not_found", "invalid_transition", "M1", "read", "B2:M2"]) for (const cleanupFailure of [false, true]) {
    const rows = mode === "not_found" ? [] : [shipmentRow({ status: mode === "invalid_transition" ? "draft" : "ready_to_ship" })];
    const options = mode === "read" ? { failRead: "shipments" } : ["M1", "B2:M2"].includes(mode) ? { failUpdate: mode } : {};
    const h = fakeShipmentSheets({ shipments: rows }, options), trace = [];
    const oldWrite = h.sheets.shipments.updateRows, oldRead = h.sheets.shipments.readRows;
    h.sheets.shipments.updateRows = (...args) => { trace.push(args[0]); return oldWrite(...args); };
    h.sheets.shipments.readRows = (...args) => { trace.push(args[0]); return oldRead(...args); };
    const http = shipmentRoutes(h.sheets, { drive: {
      uploadImage: async input => { trace.push("upload"); assert.ok(Buffer.isBuffer(input.bytes)); assert.equal(input.fileName, `shipment-bill-s_1-${ShipmentClock.now()}.pdf`); return { id: "fake-file", webViewLink: " url " }; },
      deleteFile: async id => { trace.push(`delete:${id}`); if (cleanupFailure) throw new Error("cleanup failure"); },
    } });
    const response = await http.detail.PATCH(billRequest(), shipmentParams(" s/1 "));
    assert.equal(response.status, mode === "success" ? 200 : mode === "not_found" ? 404 : mode === "invalid_transition" ? 409 : 500);
    const count = mode === "M1" ? 1 : ["not_found", "invalid_transition", "read"].includes(mode) ? 2 : 3;
    assert.deepEqual(trace, ["upload", ...["M1", "A2:M", "B2:M2"].slice(0, count), ...(mode === "success" ? [] : ["delete:fake-file"])]);
    if (mode === "success") { assert.equal((await response.json()).shipment.shippingBillUrl, "url"); assert.equal(http.errors.length, 0); }
    else {
      const expected = mode === "not_found" ? "Shipment was not found." : mode === "invalid_transition" ? "Shipment status has changed or cannot be advanced." : "Failed to update shipment status.";
      assert.deepEqual(await response.json(), { error: expected });
      assert.equal(http.errors.filter(e => e[0] === "Failed to clean up shipment bill upload").length, cleanupFailure ? 1 : 0);
      assert.equal(http.errors.filter(e => e[0] === "Failed to update shipment status").length, ["not_found", "invalid_transition"].includes(mode) ? 0 : 1);
    }
  }
});

test("unchanged JSON PATCH uses real composition for zero delivered fee, PO confirmation and omitted-bill clearing", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship", shippingBillUrl: "old" })] }), http = shipmentRoutes(h.sheets);
  const shipping = await http.detail.PATCH(jsonRequest({ status: "shipping", poNumber: " PO " }, "PATCH"), shipmentParams());
  assert.equal(shipping.status, 200); assert.equal((await shipping.json()).shipment.shippingBillUrl, "");
  const delivered = await http.detail.PATCH(jsonRequest({ status: "delivered", deliveryFee: 0 }, "PATCH"), shipmentParams());
  assert.equal(delivered.status, 200); const dto = (await delivered.json()).shipment;
  assert.equal(dto.shippingFee, 0); assert.equal(dto.deliveredAt, SHIPMENT_TIME); assert.equal(dto.shippedAt, SHIPMENT_TIME);
  assert.deepEqual(h.events.map(e => e[2]), ["M1", "A2:M", "B2:M2", "M1", "A2:M", "B2:M2"]);
});

test("status worksheet getter failures preserve original access count, timing and error identity at all three operations", async () => {
  for (const failureAt of [1, 2, 3, 0]) {
    const run = async service => {
      const trace = [], error = new Error("worksheet getter"), worksheet = { updateRows: async range => trace.push(range), readRows: async range => { trace.push(range); return [shipmentRow()]; } }; let accesses = 0;
      const sheets = { get shipments() { trace.push("worksheet"); if (++accesses === failureAt) throw error; return worksheet; } };
      if (failureAt) await assert.rejects(service.updateShipmentStatus({ googleSheetsService: sheets, ...base }), e => e === error);
      else assert.equal((await service.updateShipmentStatus({ googleSheetsService: sheets, ...base })).outcome, "updated");
      return trace;
    };
    assert.deepEqual(await run(services), await run(original));
  }
});

test("status composition calls no ID generator and forwards clock rejection after setup without a data write", async () => {
  const error = new Error("clock failure"), h = fakeShipmentSheets({ shipments: [shipmentRow()] });
  const controlled = shipmentServices({ createId: () => assert.fail("Status must not generate IDs"), globals: { Date: class { toISOString() { throw error; } } } }).services;
  await assert.rejects(controlled.updateShipmentStatus({ googleSheetsService: h.sheets, ...base }), e => e === error);
  assert.deepEqual(h.events.map(e => e[2]), ["M1", "A2:M"]);
  const successful = shipmentServices({ createId: () => assert.fail("Status must not generate IDs") }).services;
  assert.equal((await successful.updateShipmentStatus({ googleSheetsService: h.sheets, ...base })).outcome, "updated");
});
