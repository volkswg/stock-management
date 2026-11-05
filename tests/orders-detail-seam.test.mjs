import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ordersServer } from "./helpers/orders-server.mjs";
import { detailService, detailSheets, detailSheetNames, detailHttp } from "./helpers/orders-detail.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
import { assertOrderDetailHistory, orderDetailBefore as before } from "./helpers/orders-detail-history.mjs";
const load = ordersServer(), app = load("src/modules/orders/application/get-order-detail.ts"), original = detailService({ original: true }), current = detailService();
const fixture = JSON.parse(readFileSync("tests/fixtures/orders-read-model.json", "utf8"));
const order = ["o", "complete", "Seller", 0], shipment = ["s", "draft", "Carrier", "PO", 0];
const valid = () => ({ orders: [order], orderItems: [], orderBills: [], shipmentOrders: [["l", "s", "o"]], shipments: [shipment] });

test("pure Orders detail application invokes five business reads then deferred lookups in exact order", async () => {
  const events = [], record = { id: "o", totalPrice: 0 }, nested = { id: "s" };
  const reader = { readOrders: () => { events.push("read orders"); return Promise.resolve({ findOrder: id => { events.push(["find order", id]); return record; } }); }, readProductImages: () => { events.push("read products"); return Promise.resolve({ forOrder: id => { events.push(["products", id]); return []; } }); }, readBillImages: () => { events.push("read bills"); return Promise.resolve({ forOrder: id => { events.push(["bills", id]); return []; } }); } };
  const projection = { readLinks: () => { events.push("read links"); return Promise.resolve({ findShipmentIdForOrder: id => { events.push(["link", id]); return "s"; } }); }, readShipments: () => { events.push("read shipments"); return Promise.resolve({ findShipmentById: id => { events.push(["shipment", id]); return nested; } }); } };
  assert.deepEqual(plain(await app.getOrderDetail(reader, projection, "o")), { ...record, productImages: [], billImages: [], shipmentId: "s", shipment: nested });
  assert.deepEqual(events, ["read orders", "read products", "read bills", "read links", "read shipments", ["find order", "o"], ["link", "o"], ["products", "o"], ["bills", "o"], ["shipment", "s"]]);
});

test("actual readers are constructor-lazy and snapshots defer malformed rows until exact consumer lookup phase", async () => {
  const { GoogleSheetsOrderDetailReader } = load("src/modules/orders/infrastructure/google-sheets/order-detail-reader.ts"), { GoogleSheetsOrderDetailShipmentProjection } = load("src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts");
  const noAccess = new Proxy({}, { get() { assert.fail("Constructor worksheet access"); } }); new GoogleSheetsOrderDetailReader(noAccess); new GoogleSheetsOrderDetailShipmentProjection(noAccess);
  const h = detailSheets({ orders: [], orderItems: null, orderBills: null, shipmentOrders: null, shipments: null }), reader = new GoogleSheetsOrderDetailReader(h.sheets), projection = new GoogleSheetsOrderDetailShipmentProjection(h.sheets);
  const snapshots = await Promise.all([reader.readOrders(), reader.readProductImages(), reader.readBillImages(), projection.readLinks(), projection.readShipments()]);
  assert.equal(snapshots[0].findOrder("o"), undefined); assert.throws(() => snapshots[1].forOrder("o")); assert.throws(() => snapshots[3].findShipmentIdForOrder("o"));
  assert.equal(await app.getOrderDetail(reader, projection, "o"), undefined); assert.equal(h.events.length, 10);
});

test("original/new detail full output and events match golden models and mapping/duplicate/status/fee edge matrix", async () => {
  const compare = async (data, orderId = "o") => {
    const run = async svc => { const h = detailSheets(data); try { const result = await svc.getOrderDetail({ googleSheetsService: h.sheets, orderId }); return { result: result === undefined ? null : plain(result), events: h.events }; } catch(e) { return { error: { name: e.name, message: e.message }, events: h.events }; } };
    assert.deepEqual(await run(current), await run(original));
  };
  await compare(fixture.rows, "order/1"); await compare({});
  for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "invalid", undefined]) for (const fee of [0, 1.25, "1,234.5", "bad", "", NaN, Infinity, -Infinity, true, null, {}]) { const data = valid(); data.shipments = [["s", status, " C ", " PO ", fee]]; await compare(data); }
  for (const key of detailSheetNames) for (const malformed of [null, {}, [null], [42], [true], ["text"]]) await compare({ ...valid(), [key]: malformed });
  for (const links of [[], [["a", "s", "o"], ["b", "", "o"]], [["l", "missing", "o"]], [["old", "s", "o"], ["new", "other", "o", "", "", "deleted"]]]) await compare({ ...valid(), shipmentOrders: links });
  await compare({ ...valid(), orders: [order, ["o", "complete", "second", 1]], shipments: [shipment, ["s", "canceled", "later", "PO", 4]] });
});

test("original/new simultaneous rejection precedence matches for every worksheet pair and native promise scheduling", async () => {
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (const delayed of [false, true]) {
    const run = async svc => {
      const errors = detailSheetNames.map(name => new Error(name));
      const sheets = Object.fromEntries(detailSheetNames.map((name, i) => [name, { readRows() {
        if (i === a) return delayed ? Promise.resolve().then(() => { throw errors[i]; }) : Promise.reject(errors[i]);
        if (i === b) return Promise.reject(errors[i]); return Promise.resolve([]);
      } }]));
      try { await svc.getOrderDetail({ googleSheetsService: sheets, orderId: "o" }); assert.fail("Expected rejection"); } catch (error) { assert.ok(errors.includes(error)); return error.message; }
    };
    assert.equal(await run(current), await run(original));
  }
});

test("no premature mapping while one of the five reads remains pending; no conditional reads or retries", async () => {
  const gate = deferred(), events = [], mapped = { map() { assert.fail("Mapping before fifth read resolves"); } };
  const sheets = Object.fromEntries(detailSheetNames.map(name => [name, { readRows: (...args) => { events.push([name, ...args]); return name === "shipments" ? gate.promise : Promise.resolve(name === "orders" ? mapped : []); } }]));
  const pending = current.getOrderDetail({ googleSheetsService: sheets, orderId: "o" }); await flush(); assert.equal(events.length, 5); mapped.map = () => []; gate.resolve([]); assert.equal(await pending, undefined); assert.equal(events.length, 5);
});

test("legacy direct and unchanged barrel preserve old input/identity while named server uses explicit consumer port", async () => {
  const server = load("src/modules/orders/server.ts"), direct = load("src/services/orders/listOrders.ts");
  const barrel = loadSource("src/services/orders/index.ts", { imports: new Proxy({}, { getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }), get: (_, name) => name === "./listOrders" ? direct : name === "./createOrder" ? load("src/services/orders/createOrder.ts") : {} }) });
  assert.equal(barrel.getOrderDetail, direct.getOrderDetail); assert.equal(barrel.listOrders, server.listOrders); assert.equal(barrel.createOrder, server.createOrder);
  const { GoogleSheetsOrderDetailShipmentProjection } = load("src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts"), h = detailSheets(fixture.rows);
  const result = await server.getOrderDetail({ googleSheetsService: h.sheets, orderId: "order/1", shipmentProjection: new GoogleSheetsOrderDetailShipmentProjection(h.sheets) });
  assert.deepEqual(plain(result), fixture.expectedDetail); assertOrderDetailHistory(before.bodyHash);
});

test("original/new actual Orders GET handlers preserve 200/400/404/500, factory order, trim/logging and unchanged PATCH", async () => {
  for (const id of [" order/1 ", " ", "unknown"]) for (const fail of [undefined, "shipments"]) {
    const run = async original => { const h = detailSheets(fixture.rows, { fail }), http = detailHttp(h, { original }); const response = await http.route.GET(undefined, { params: Promise.resolve({ id }) }); return { status: response.status, json: await response.json(), events: http.events, errors: http.errors, reads: h.events }; };
    assert.deepEqual(await run(false), await run(true));
  }
  for (const original of [false, true]) { const h = detailSheets({ orders: [] }), http = detailHttp(h, { original }); const r = await http.route.PATCH(new Request("https://example.test", { method: "PATCH", body: JSON.stringify({ totalPrice: 0 }) }), { params: Promise.resolve({ id: "o" }) }); assert.equal(r.status, 404); }
});

test("real five-worksheet transport retains original names/quoting/ranges/GET order and exact golden result", async () => {
  const requests = [], constants = loadSource("src/externals/google/sheet/const.ts");
  const { GoogleSheetsClient } = loadSource("src/externals/google/sheet/client/GoogleSheetsClient.ts", { imports: { "../const": constants }, globals: { fetch: async (url, init) => {
    requests.push({ url, init }); const name = decodeURIComponent(new URL(url).pathname.split("/values/")[1]).split("!")[0].slice(1, -1).replaceAll("''", "'").slice("Synthetic ' ".length); return Response.json({ values: fixture.rows[name] });
  } } });
  const { BaseGoogleSheet } = loadSource("src/externals/google/sheet/sheets/BaseGoogleSheet.ts"), sheets = {};
  for (const [property, folder, name] of [["orders", "orders", "OrdersSheet"], ["orderItems", "order-items", "OrderItemsSheet"], ["orderBills", "order-bills", "OrderBillsSheet"], ["shipmentOrders", "shipment-orders", "ShipmentOrdersSheet"], ["shipments", "shipments", "ShipmentsSheet"]]) {
    const imports = { "../BaseGoogleSheet": { BaseGoogleSheet }, "../../const": constants }; if (folder !== "orders") imports["./const"] = loadSource(`src/externals/google/sheet/sheets/${folder}/const.ts`);
    const Class = loadSource(`src/externals/google/sheet/sheets/${folder}/${name}.ts`, { imports })[name]; sheets[property] = new Class(new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake sheet/id"), `Synthetic ' ${property}`);
  }
  assert.deepEqual(plain(await current.getOrderDetail({ googleSheetsService: sheets, orderId: "order/1" })), fixture.expectedDetail);
  assert.deepEqual(requests.map(r => decodeURIComponent(new URL(r.url).pathname.split("/values/")[1])), ["'Synthetic '' orders'!A:I", "'Synthetic '' orderItems'!A:J", "'Synthetic '' orderBills'!A:G", "'Synthetic '' shipmentOrders'!A:G", "'Synthetic '' shipments'!A:M"]);
  assert.equal(requests.length, 5); for (const { url, init } of requests) { assert.equal(init.method, "GET"); assert.equal(init.body, undefined); assert.equal(new URL(url).search, ""); assert.equal(init.headers.Authorization, "Bearer fake-token"); assert.ok(new URL(url).pathname.startsWith("/v4/spreadsheets/fake%20sheet%2Fid/values/")); }
});

test("original/new deferred iterator/getter failure identity and phase inspection traces match across all five row collections", async () => {
  for (const phase of detailSheetNames) {
    const run = async service => {
      const data = { orders: [order], orderItems: [["i", "o", "url"]], orderBills: [["b", "o", "url"]], shipmentOrders: [["l", "s", "o"]], shipments: [shipment] }, events = [], error = new Error(`iterator ${phase}`);
      for (const name of detailSheetNames) data[name] = [new Proxy(data[name][0], { get(target, key, receiver) {
        if (key === Symbol.iterator) { events.push(name); if (name === phase) throw error; }
        return Reflect.get(target, key, receiver);
      } })];
      const h = detailSheets(data); await assert.rejects(service.getOrderDetail({ googleSheetsService: h.sheets, orderId: "o" }), e => e === error); return events;
    };
    assert.deepEqual(await run(current), await run(original));
  }
});
