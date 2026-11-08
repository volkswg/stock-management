import {readArchive} from "./helpers/retirement-history.mjs";
import {canonicalPath} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { shipmentServices, fakeShipmentSheets, shipmentRow, shipmentRoutes, shipmentParams, jsonRequest, ShipmentClock, SHIPMENT_TIME } from "./helpers/shipments.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
import { shipmentLinkBefore as before, migratedLinkFunctions, assertShipmentLinkHistory, assertLinkClassTypesAndMapping } from "./helpers/shipments-link-history.mjs";
const application = "src/modules/shipments/application/link-order-to-shipment.ts", adapter = "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts";
const { load, services } = shipmentServices(), app = load(application), { GoogleSheetsShipmentOrderLinkStore } = load(adapter);
const input = { shipmentId: "s/1", orderId: "o/1", createdBy: " actor " };
const valid = () => ({ shipments: [shipmentRow()], orders: [["o/1", "unknown"]], shipmentOrders: [] });
function fakePort({ shipment = true, order = true, link, status = "draft", failure } = {}) {
  const events = [], records = [];
  const store = {
    readLinkSnapshot: async () => { events.push("read"); return {
      findActiveShipment: id => { events.push(["shipment", id]); return shipment ? { readStatus: () => { events.push("status"); return status; } } : undefined; },
      hasActiveOrder: id => { events.push(["order", id]); return order; },
      findLatestActiveLink: id => { events.push(["link", id]); return link; },
    }; },
    appendShipmentOrder: async record => { events.push("append"); records.push(record); if (failure) throw failure; },
  };
  return { store, events, records, dependencies: { store, now: () => { events.push("clock"); return SHIPMENT_TIME; }, createId: () => { events.push("id"); return "synthetic-shipment-id"; } } };
}

test("pure linking: all four original errors preserve code/class/message and exact lazy business-check order", async () => {
  for (const [config, code, message, expected] of [
    [{ shipment: false }, "shipment_not_found", "Shipment not found.", ["read", ["shipment", "s/1"]]],
    [{ order: false }, "order_not_found", "Order not found.", ["read", ["shipment", "s/1"], ["order", "o/1"]]],
    [{ link: { shipmentId: "other" }, status: "shipping" }, "order_already_linked", "Order is already linked to another shipment.", ["read", ["shipment", "s/1"], ["order", "o/1"], ["link", "o/1"]]],
    [{ status: "canceled" }, "shipment_not_linkable", "Orders can only be linked to draft or ready-to-ship shipments.", ["read", ["shipment", "s/1"], ["order", "o/1"], ["link", "o/1"], "status"]],
  ]) {
    const h = fakePort(config);
    await assert.rejects(app.linkOrderToShipment(input, h.dependencies), e => e instanceof app.LinkOrderToShipmentError && e.name === "LinkOrderToShipmentError" && e.code === code && e.message === message);
    assert.deepEqual(h.events, expected); assert.deepEqual(h.records, []);
  }
});

test("pure linking: same-link record identity bypasses status/clock/ID/write and is not cached", async () => {
  const link = { id: "l", shipmentId: "s/1", orderId: "o/1", createdAt: "c", updatedAt: "u", deletedAt: "", createdBy: "actor" }, h = fakePort({ link, status: "delivered" });
  for (let i = 0; i < 2; i++) { const result = await app.linkOrderToShipment(input, h.dependencies); assert.equal(result.shipmentOrder, link); assert.equal(result.created, false); }
  assert.deepEqual(h.events, Array(2).fill(["read", ["shipment", "s/1"], ["order", "o/1"], ["link", "o/1"]]).flat());
});

test("pure linking: exact seven business fields, untouched IDs/actor, clock then ID, awaited same-record append", async () => {
  const h = fakePort({ status: "ready_to_ship" }), gate = deferred(); let settled = false;
  h.store.appendShipmentOrder = async record => { h.events.push("append"); h.records.push(record); await gate.promise; };
  const spaced = { shipmentId: " s/1 ", orderId: " o/1 ", createdBy: " actor " };
  const pending = app.linkOrderToShipment(spaced, h.dependencies); pending.then(() => { settled = true; }); await flush();
  assert.equal(settled, false); assert.deepEqual(h.events.slice(-4), ["status", "clock", "id", "append"]); gate.resolve();
  const result = await pending; assert.equal(result.shipmentOrder, h.records[0]); assert.equal(result.created, true);
  assert.deepEqual(plain(result.shipmentOrder), { id: "synthetic-shipment-id", ...spaced, createdAt: SHIPMENT_TIME, updatedAt: SHIPMENT_TIME, deletedAt: "" });
  assert.deepEqual(Object.keys(result.shipmentOrder), ["id", "shipmentId", "orderId", "createdAt", "updatedAt", "deletedAt", "createdBy"]);
});

test("pure linking: rejection identity at every business lookup/clock/ID/write without retries or compensation", async () => {
  for (const phase of ["read", "shipment", "order", "link", "status", "clock", "id", "append"]) {
    const error = new Error(phase), events = [], fail = name => { events.push(name); if (name === phase) throw error; };
    const snapshot = { findActiveShipment: () => { fail("shipment"); return { readStatus: () => { fail("status"); return "draft"; } }; }, hasActiveOrder: () => { fail("order"); return true; }, findLatestActiveLink: () => { fail("link"); return undefined; } };
    const deps = { store: { readLinkSnapshot: async () => { fail("read"); return snapshot; }, appendShipmentOrder: async () => fail("append") }, now: () => { fail("clock"); return "now"; }, createId: () => { fail("id"); return "id"; } };
    await assert.rejects(app.linkOrderToShipment(input, deps), e => e === error);
    assert.deepEqual(events, ["read", "shipment", "order", "link", "status", "clock", "id", "append"].slice(0, ["read", "shipment", "order", "link", "status", "clock", "id", "append"].indexOf(phase) + 1));
  }
});

test("actual link adapter is lazy at construction and snapshot creation, including malformed uninspected collections", async () => {
  const untouched = new GoogleSheetsShipmentOrderLinkStore({ get shipments() { assert.fail("Eager constructor"); } }); assert.ok(untouched);
  const calls = [], rows = { shipments: [], orders: null, shipmentOrders: null };
  const sheets = Object.fromEntries(Object.keys(rows).map(name => [name, { readRows: async (...args) => { calls.push([name, ...args]); return rows[name]; } }]));
  const store = new GoogleSheetsShipmentOrderLinkStore(sheets), snapshot = await store.readLinkSnapshot();
  assert.equal(snapshot.findActiveShipment("s/1"), undefined); assert.deepEqual(calls, [["shipments"], ["orders", "A:I"], ["shipmentOrders"]]);
  assert.throws(() => snapshot.hasActiveOrder("o/1")); assert.throws(() => snapshot.findLatestActiveLink("o/1"));
  await assert.rejects(app.linkOrderToShipment(input, { store, now: () => assert.fail("clock"), createId: () => assert.fail("id") }), e => e.code === "shipment_not_found");
});

function originalService() {
  const exports = {}, constants = { ...load("src/externals/google/sheet/const.ts"), ...load("src/externals/google/sheet/sheets/shipment-orders/const.ts") };
  const output = ts.transpileModule(before.source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(output).runInNewContext({ exports, Date: ShipmentClock, Error, require(name) {
    if (name === "@/externals/google/sheet") return constants;
    if (name === "../utils/createSortableId") return { createSortableId: () => "synthetic-shipment-id" };
    if (name === "./types") return load("src/services/shipments/types.ts");
    throw new Error(`Unapproved original dependency ${name}`);
  } }); return exports;
}
const original = originalService();
test("actual composed linking equals saved original for malformed rows/collections, precedence, messages and write events", async () => {
  const compare = async rows => {
    const run = async service => { const h = fakeShipmentSheets(rows); try { return { result: plain(await service.linkOrderToShipment({ googleSheetsService: h.sheets, ...input })), events: h.events }; } catch(e) { return { error: { name: e.name, code: e.code, message: e.message }, events: h.events }; } };
    assert.deepEqual(await run(services), await run(original));
  };
  for (const key of ["shipments", "orders", "shipmentOrders"]) for (const malformed of [null, {}, [null], [42], [true], [], ["text"]]) await compare({ ...valid(), [key]: malformed });
  for (const shipments of [[], [shipmentRow({ deletedAt: "deleted" })], [shipmentRow({ status: "unknown" })]]) for (const orders of [null, [null], []]) await compare({ shipments, orders, shipmentOrders: [null] });
  for (const example of before.examples) await compare(example.rows);
});

test("exact five historical declarations preserved, four moved helpers unchanged, class/types/mapping/composition parity", () => {
  const baseline = JSON.parse(readArchive("tests/fixtures/shipments-structure.json", "utf8")); assert.equal(migratedLinkFunctions.size, 5);
  for (const key of migratedLinkFunctions) assertShipmentLinkHistory(key, baseline.functions[key]);
  assertLinkClassTypesAndMapping();
});

test("legacy direct/barrel/server share link function and direct/barrel/application share one error class and enum", async () => {
  const direct = load(before.file), server = load("src/modules/shipments/server.ts");
  assert.deepEqual(Object.keys(direct).sort(), ["LinkOrderToShipmentError", "linkOrderToShipment"]);
  assert.equal(direct.linkOrderToShipment, server.linkOrderToShipment); assert.equal(services.linkOrderToShipment, direct.linkOrderToShipment);
  assert.equal(direct.LinkOrderToShipmentError, app.LinkOrderToShipmentError); assert.equal(services.LinkOrderToShipmentError, app.LinkOrderToShipmentError);
  assert.equal(services.ShipmentStatus, load("src/modules/shipments/contracts.ts").ShipmentStatus);
  await assert.rejects(server.linkOrderToShipment({ googleSheetsService: fakeShipmentSheets().sheets, ...input }), e => e instanceof direct.LinkOrderToShipmentError && e instanceof services.LinkOrderToShipmentError);
});

test("actual unchanged linking HTTP handler preserves all four error mappings through real composition and class identity", async () => {
  for (const [rows, status, message] of [
    [{ ...valid(), shipments: [] }, 404, "Shipment not found."],
    [{ ...valid(), orders: [] }, 404, "Order not found."],
    [{ ...valid(), shipmentOrders: [["l", "other", "o/1"]] }, 409, "Order is already linked to another shipment."],
    [{ ...valid(), shipments: [shipmentRow({ status: "shipping" })] }, 409, "Orders can only be linked to draft or ready-to-ship shipments."],
  ]) {
    const h = fakeShipmentSheets(rows), http = shipmentRoutes(h.sheets), response = await http.links.POST(jsonRequest({ orderId: " o/1 " }), shipmentParams(" s/1 "));
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: message }); assert.equal(http.errors.length, 0); assert.equal(h.events.length, 3);
  }
});

test("actual linking HTTP handler retains 201/200 payloads, web actor, validation/body fallback and unexpected 500 logging", async () => {
  const h = fakeShipmentSheets(valid()), http = shipmentRoutes(h.sheets);
  const created = await http.links.POST(jsonRequest({ orderId: " o/1 " }), shipmentParams(" s/1 ")); assert.equal(created.status, 201);
  const body = await created.json(); assert.equal(body.created, true); assert.equal(body.shipmentOrder.createdBy, "web"); assert.equal(body.shipmentOrder.shipmentId, "s/1"); assert.equal(body.shipmentOrder.orderId, "o/1");
  const existing = await http.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams()); assert.equal(existing.status, 200); assert.deepEqual(await existing.json(), { ...body, created: false });
  assert.equal(h.events.filter(e => e[0] === "append").length, 1);
  for (const [id, payload] of [[" ", { orderId: "o/1" }], ["s/1", {}], ["s/1", { orderId: 1 }], ["s/1", { orderId: " " }], ["s/1", { orderId: "x".repeat(101) }]]) {
    const response = await http.links.POST(jsonRequest(payload), shipmentParams(id)); assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: "Shipment ID and order ID are required." });
  }
  const malformed = await http.links.POST(new Request("https://example.test", { method: "POST", body: "{" }), shipmentParams()); assert.equal(malformed.status, 400);
  const failed = fakeShipmentSheets(valid(), { failAppend: "shipmentOrders" }), broken = shipmentRoutes(failed.sheets);
  const error = await broken.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams()); assert.equal(error.status, 500); assert.deepEqual(await error.json(), { error: "Failed to link order to shipment." });
  assert.deepEqual(plain(broken.errors), [["Failed to link order to shipment", { error: "synthetic append failure" }]]); assert.equal(failed.events.length, 4);
});

test("actual worksheet/transport path preserves three GET ranges, encoded names and one USER_ENTERED/INSERT_ROWS A:G append", async () => {
  for (const mode of ["new", "same", "conflict", "append-failure"]) {
    const requests = [], rows = valid(); rows.shipmentOrders = mode === "same" ? [["l", "s/1", "o/1"]] : mode === "conflict" ? [["l", "other", "o/1"]] : [];
    const constants = load("src/externals/google/sheet/const.ts");
    const { GoogleSheetsClient } = loadSource("src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts", { imports: { "../const": constants }, globals: { fetch: async (url, init) => {
      requests.push({ url, init }); if (init.method === "POST") return mode === "append-failure" ? new Response("failure", { status: 500 }) : Response.json({});
      const name = decodeURIComponent(new URL(url).pathname.split("/values/")[1]).split("!")[0].slice(1, -1).replaceAll("''", "'");
      return Response.json({ values: rows[name.slice("Synthetic ' ".length)] });
    } } });
    const { BaseGoogleSheet } = loadSource("src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts"), sheets = {};
    for (const [property, folder, name] of [["shipments", "shipments", "ShipmentsSheet"], ["orders", "orders", "OrdersSheet"], ["shipmentOrders", "shipment-orders", "ShipmentOrdersSheet"]]) {
      const imports = { "../BaseGoogleSheet": { BaseGoogleSheet }, "../../const": constants }; if (folder !== "orders") imports["./const"] = loadSource(canonicalPath(`src/externals/google/sheet/sheets/${folder}/const.ts`));
      const Class = loadSource(canonicalPath(`src/externals/google/sheet/sheets/${folder}/${name}.ts`), { imports })[name];
      sheets[property] = new Class(new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake sheet/id"), `Synthetic ' ${property}`);
    }
    const store = new GoogleSheetsShipmentOrderLinkStore(sheets), deps = { store, now: () => SHIPMENT_TIME, createId: () => "synthetic-shipment-id" };
    if (mode === "conflict") await assert.rejects(app.linkOrderToShipment(input, deps), e => e.code === "order_already_linked");
    else if (mode === "append-failure") await assert.rejects(app.linkOrderToShipment(input, deps), /Google Sheets API request failed: 500 failure/);
    else assert.equal((await app.linkOrderToShipment(input, deps)).created, mode === "new");
    assert.deepEqual(requests.slice(0, 3).map(r => decodeURIComponent(new URL(r.url).pathname.split("/values/")[1])), ["'Synthetic '' shipments'!A:M", "'Synthetic '' orders'!A:I", "'Synthetic '' shipmentOrders'!A:G"]);
    assert.ok(requests.slice(0, 3).every(r => r.init.method === "GET" && r.init.body === undefined && r.init.headers.Authorization === "Bearer fake-token"));
    assert.ok(requests.every(r => new URL(r.url).pathname.startsWith("/v4/spreadsheets/fake%20sheet%2Fid/values/")));
    const writes = requests.filter(r => r.init.method === "POST"); assert.equal(writes.length, ["new", "append-failure"].includes(mode) ? 1 : 0); assert.equal(requests.length, 3 + writes.length);
    if (writes.length) {
      const { url, init } = writes[0], parsed = new URL(url); assert.equal(parsed.searchParams.get("valueInputOption"), "USER_ENTERED"); assert.equal(parsed.searchParams.get("insertDataOption"), "INSERT_ROWS");
      assert.equal(decodeURIComponent(parsed.pathname.split("/values/")[1]), "'Synthetic '' shipmentOrders'!A:G:append");
      assert.deepEqual(JSON.parse(init.body), { values: [["synthetic-shipment-id", "s/1", "o/1", SHIPMENT_TIME, SHIPMENT_TIME, "", " actor "]] });
    }
  }
});
