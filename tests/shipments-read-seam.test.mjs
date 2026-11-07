import {readArchive} from "./helpers/retirement-history.mjs";
import {canonicalPath} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { shipmentServices, fakeShipmentSheets, shipmentRow, shipmentRoutes, shipmentParams } from "./helpers/shipments.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred } from "./helpers/component-harness.mjs";
import { shipmentReadBefore as before, migratedReadFunctions, assertShipmentReadHistory } from "./helpers/shipments-read-history.mjs";
const appPath = "src/modules/shipments/application/list-shipments.ts", adapterPath = "src/modules/shipments/infrastructure/google-sheets/shipment-list-reader.ts";
const { load, services } = shipmentServices(), app = load(appPath), { GoogleSheetsShipmentListReader } = load(adapterPath);
const fixture = JSON.parse(readArchive(new URL("./fixtures/shipments-read.json", import.meta.url), "utf8"));
function originalRead() {
  const exports = {}, output = ts.transpileModule(before.source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(output).runInNewContext({ exports, require: name => {
    if (name === "../orders/createDraftOrder") return load("src/modules/orders/contracts.ts");
    if (name === "./types") return load("src/services/shipments/types.ts");
    throw new Error(`Unexpected original dependency: ${name}`);
  } });
  return exports;
}
const original = originalRead();
const snapshot = (shipments = []) => ({ shipments, orderIdsByShipmentId: new Map(), ordersById: new Map() });
const record = (id, status = "draft") => ({ id, status, carrier: "C", poNumber: id, shippingFee: null, remark: "", shippedAt: "", deliveredAt: "", createdAt: "", updatedAt: "", createdBy: "web", shippingBillUrl: "" });

test("business-only application defaults, exclusions and reversal leave snapshot order intact and do not cache", async () => {
  const input = snapshot([record("a"), record("b", "shipping"), record("c", "delivered")]), calls = [];
  const reader = { readShipmentList: async options => { calls.push(options); return input; } };
  assert.deepEqual(plain(await app.listShipments(reader)).map(s => s.id), ["c", "b", "a"]);
  assert.deepEqual(plain(await app.listShipments(reader, { includeOrders: false, excludeStatuses: ["shipping", "delivered"] })).map(s => s.id), ["a"]);
  assert.deepEqual(plain(calls), [{ includeOrders: true }, { includeOrders: false }]);
  assert.deepEqual(input.shipments.map(s => s.id), ["a", "b", "c"]);
});

test("application assembles ordered relations and owns original floating-point costs with fake business data", async () => {
  const s = record("s"); s.shippingFee = 0.3;
  const data = snapshot([s]); data.orderIdsByShipmentId.set("s", ["b", "missing", "a"]);
  const order = (id, price) => ({ id, status: "complete", seller: id, totalPrice: price, createdAt: "", productImages: [{ id, imageUrl: "url", quoteQuantity: "1.5", deliveredQuantity: "3", productCode: "" }] });
  data.ordersById.set("a", order("a", 0.2)); data.ordersById.set("b", order("b", 0.1));
  const reader = { readShipmentList: async () => data }, [result] = await app.listShipments(reader);
  assert.deepEqual(plain(result.orders).map(o => o.id), ["b", "a"]);
  assert.deepEqual(plain(result.costSummary), { totalOrderPrice: 0.1 + 0.2, shippingFee: 0.3, quote: { totalQuantity: 3, averageLandedCostPerUnit: (0.1 + 0.2 + 0.3) / 3 }, delivered: { totalQuantity: 6, averageLandedCostPerUnit: (0.1 + 0.2 + 0.3) / 6 } });
  data.ordersById.get("a").totalPrice = null; assert.equal((await app.listShipments(reader))[0].costSummary, null);
  data.ordersById.get("a").totalPrice = 0; s.shippingFee = null; assert.equal((await app.listShipments(reader))[0].costSummary, null);
  data.orderIdsByShipmentId.clear(); s.shippingFee = 0; assert.equal((await app.listShipments(reader))[0].costSummary, null);
});

test("application detail executes one full default read and finds the last worksheet duplicate after reversal", async () => {
  let calls = 0; const a = record("duplicate"), b = { ...a, poNumber: "last" };
  const reader = { readShipmentList: async options => { calls++; assert.deepEqual(plain(options), { includeOrders: true }); return snapshot([a, b]); } };
  assert.equal((await app.getShipmentDetail(reader, "duplicate")).poNumber, "last"); assert.equal(calls, 1);
  assert.equal(await app.getShipmentDetail(reader, " duplicate "), undefined); assert.equal(calls, 2);
});

test("application propagates reader rejection identity once and waits for the actual business snapshot", async () => {
  const error = new Error("read failed"), gate = deferred(); let calls = 0;
  const reader = { readShipmentList: () => { calls++; return gate.promise; } };
  const pending = app.listShipments(reader); assert.equal(calls, 1); gate.reject(error);
  await assert.rejects(pending, e => e === error); assert.equal(calls, 1);
});

test("reader constructor is lazy, returns business-only normalized data and excludes final association/cost work", async () => {
  new GoogleSheetsShipmentListReader({ get shipments() { assert.fail("Constructor accessed sheets"); } });
  const h = fakeShipmentSheets(fixture.rows), reader = new GoogleSheetsShipmentListReader(h.sheets), model = await reader.readShipmentList({ includeOrders: true });
  assert.deepEqual(Object.keys(model), ["shipments", "orderIdsByShipmentId", "ordersById"]);
  assert.ok(model.shipments.every(s => !("orders" in s) && !("costSummary" in s) && !("deletedAt" in s)));
  assert.deepEqual(plain(model.shipments.map(s => s.id)), [...fixture.expected].reverse().map(s => s.id));
  for (const shipment of fixture.expected) {
    const linked = model.orderIdsByShipmentId.get(shipment.id) ?? [];
    assert.deepEqual(plain(linked.filter(id => model.ordersById.has(id))), shipment.orders.map(o => o.id));
    for (const order of shipment.orders) assert.deepEqual(plain(model.ordersById.get(order.id)), order);
  }
  assert.deepEqual(h.events, [["read", "shipments"], ["read", "shipmentOrders"], ["read", "orders", "A:I"], ["read", "orderItems"]]);
});

test("application plus actual reader equals original captured JSON/events across default, exclusions and disabled relations", async () => {
  for (const options of [{}, { includeOrders: false }, { excludeStatuses: [] }, { excludeStatuses: ["draft", "canceled", "draft"] }, { includeOrders: false, excludeStatuses: ["delivered"] }]) {
    const old = fakeShipmentSheets(fixture.rows), current = fakeShipmentSheets(fixture.rows);
    const expected = await original.listShipments({ googleSheetsService: old.sheets, ...options });
    const actual = await app.listShipments(new GoogleSheetsShipmentListReader(current.sheets), options);
    assert.deepEqual(plain(actual), plain(expected)); assert.deepEqual(current.events, old.events);
    if (!Object.keys(options).length) assert.deepEqual(plain(actual), fixture.expected);
  }
});

test("malformed worksheet and mixed failure precedence matches original executing historical source", async () => {
  const names = ["shipments", "shipmentOrders", "orders", "orderItems"];
  const outcome = async (fn, data) => { try { return { value: plain(await fn({ googleSheetsService: Object.fromEntries(names.map(name => [name, { readRows: async () => data[name] }])) })) }; } catch (e) { return { name: e.name, message: e.message }; } };
  for (const value of [null, {}, [null], [42], [true]]) for (const key of names) {
    const data = Object.fromEntries(names.map(name => [name, name === key ? value : []]));
    assert.deepEqual(await outcome(services.listShipments, data), await outcome(original.listShipments, data));
  }
  const data = Object.fromEntries(names.map(name => [name, [null]]));
  assert.deepEqual(await outcome(services.listShipments, data), await outcome(original.listShipments, data));
});

test("original eleven helper declarations retain their exact AST hashes; only two read orchestrations change", () => {
  const baseline = JSON.parse(readArchive("tests/fixtures/shipments-structure.json", "utf8"));
  assert.equal(migratedReadFunctions.size, 13);
  for (const key of migratedReadFunctions) assertShipmentReadHistory(key, baseline.functions[key]);
});

test("legacy direct/barrel and server list/detail exports have identical callable identity and enum remains singular", () => {
  const direct = load("src/services/shipments/listShipments.ts"), server = load("src/modules/shipments/server.ts");
  assert.deepEqual(Object.keys(direct).sort(), ["getShipmentDetail", "listShipments"]);
  for (const name of ["listShipments", "getShipmentDetail"]) { assert.equal(direct[name], services[name]); assert.equal(server[name], direct[name]); }
  assert.equal(services.ShipmentStatus, load("src/modules/shipments/contracts.ts").ShipmentStatus);
});

test("actual existing GET handlers execute new reads, preserving wrappers, queries, decoded IDs and storage failures", async () => {
  const h = fakeShipmentSheets(fixture.rows), http = shipmentRoutes(h.sheets);
  const response = await http.collection.GET(new Request("https://example.test/api/shipments?excludeStatuses=shipping,shipping&includeOrders=false"));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.total, body.shipments.length); assert.ok(body.shipments.every(s => s.orders.length === 0 && s.costSummary === null && s.status !== "shipping"));
  assert.deepEqual(h.events, [["read", "shipments"]]);
  const invalid = await http.collection.GET(new Request("https://example.test/api/shipments?excludeStatuses=invalid"));
  assert.equal(invalid.status, 400); assert.deepEqual(await invalid.json(), { error: "excludeStatuses contains an invalid shipment status." }); assert.equal(h.events.length, 1);
  const detail = await http.detail.GET(new Request("https://example.test/api/shipments/s%2F1"), shipmentParams(" s/1 "));
  assert.equal(detail.status, 200); assert.deepEqual(await detail.json(), { shipment: fixture.expected.find(s => s.id === "s/1") });
  const failed = fakeShipmentSheets({}, { failRead: "orderItems" }), broken = shipmentRoutes(failed.sheets);
  const error = await broken.detail.GET(new Request("https://example.test/api/shipments/s"), shipmentParams("s"));
  assert.equal(error.status, 500); assert.equal(broken.errors.length, 1); assert.equal(failed.events.length, 4);
});

test("actual four worksheet classes and Google transport preserve default A:M/A:G/A:J and explicit Orders A:I reads", async () => {
  const constants = load("src/externals/google/sheet/const.ts"), requests = [], auth = [];
  const { GoogleSheetsClient } = loadSource("src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts", { imports: { "../const": constants }, globals: { fetch: async (url, init) => { requests.push({ url, init }); const worksheet = decodeURIComponent(new URL(url).pathname.split("/values/")[1]).split("!")[0].slice(1, -1); return Response.json({ values: fixture.rows[worksheet] }); } } });
  const { BaseGoogleSheet } = loadSource("src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts"), sheets = {};
  for (const [property, folder, name] of [["shipments", "shipments", "ShipmentsSheet"], ["shipmentOrders", "shipment-orders", "ShipmentOrdersSheet"], ["orders", "orders", "OrdersSheet"], ["orderItems", "order-items", "OrderItemsSheet"]]) {
    const imports = { "../BaseGoogleSheet": { BaseGoogleSheet }, "../../const": constants };
    if (folder !== "orders") imports["./const"] = loadSource(canonicalPath(`src/externals/google/sheet/sheets/${folder}/const.ts`));
    const Class = loadSource(canonicalPath(`src/externals/google/sheet/sheets/${folder}/${name}.ts`), { imports })[name];
    const client = new GoogleSheetsClient({ getAccessToken: async () => { auth.push(property); return "fake-token"; } }, "synthetic-sheet");
    sheets[property] = new Class(client, property);
  }
  const result = await app.listShipments(new GoogleSheetsShipmentListReader(sheets));
  assert.deepEqual(plain(result), fixture.expected);
  assert.deepEqual(auth, ["shipments", "shipmentOrders", "orders", "orderItems"]);
  assert.deepEqual(requests.map(r => decodeURIComponent(new URL(r.url).pathname.split("/values/")[1])), ["'shipments'!A:M", "'shipmentOrders'!A:G", "'orders'!A:I", "'orderItems'!A:J"]);
  for (const { url, init } of requests) { assert.equal(init.method, "GET"); assert.equal(new URL(url).search, ""); assert.equal(init.body, undefined); assert.equal(init.headers.Authorization, "Bearer fake-token"); }
  requests.length = 0; auth.length = 0;
  await app.listShipments(new GoogleSheetsShipmentListReader(sheets), { includeOrders: false });
  assert.equal(requests.length, 1); assert.deepEqual(auth, ["shipments"]);
});

test("synchronous worksheet access/read failures preserve original short-circuit evaluation and error identity", async () => {
  const names = ["shipments", "shipmentOrders", "orders", "orderItems"];
  for (const failing of names) for (const getter of [false, true]) {
    const run = async fn => {
      const events = [], error = new Error("synchronous worksheet failure"), sheets = {};
      for (const name of names) Object.defineProperty(sheets, name, { get() {
        events.push(`access:${name}`); if (name === failing && getter) throw error;
        return { readRows() { events.push(`read:${name}`); if (name === failing) throw error; return Promise.resolve([]); } };
      } });
      await assert.rejects(fn({ googleSheetsService: sheets }), e => e === error); return events;
    };
    assert.deepEqual(await run(services.listShipments), await run(original.listShipments));
  }
});

test("existing creation composition function stays byte-identical to merged PR 9", () => {
  const source = ts.createSourceFile("server.ts", readArchive("src/modules/shipments/server.ts", "utf8"), ts.ScriptTarget.Latest, true);
  assert.equal(source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === "createShipment").getText(source), before.creationComposition);
});
