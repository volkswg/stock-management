import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { detailService, detailSheets, detailSheetNames } from "./helpers/orders-detail.mjs";
import { plain } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
const service = detailService(), before = JSON.parse(readFileSync("tests/fixtures/orders-detail-before.json", "utf8"));
const order = ["o", "complete", " Seller ", "1,234.50", " note ", " c ", " u ", "", " actor "];
const shipment = (id = "s", status = "draft") => [id, status, " carrier ", " PO ", "1,234.5", " remark ", " shipped ", " delivered ", " created ", " updated ", "", " actor ", " bill "];
const rows = () => ({ orders: [order], orderItems: [["p", "o", "url", " 2 ", true, " code ", " c "]], orderBills: [["b", "o", "bill", " c "]], shipmentOrders: [["l", "s", "o"]], shipments: [shipment()] });
const call = async data => service.getOrderDetail({ googleSheetsService: detailSheets(data).sheets, orderId: "o" });

test("original Orders detail: golden complete JSON and exact five-read/default ranges including missing Order", async () => {
  for (const example of before.examples) { const h = detailSheets(example.rows), result = await service.getOrderDetail({ googleSheetsService: h.sheets, orderId: example.orderId }); if (example.missing) assert.equal(result, undefined); else assert.deepEqual(plain(result), example.result); assert.deepEqual(h.events, example.events); }
});

test("original Orders detail: five reads launch in order concurrently; no mapping or response before all results", async () => {
  const gates = detailSheetNames.map(() => deferred()), events = [], sheets = Object.fromEntries(detailSheetNames.map((name, i) => [name, { readRows: (...args) => { events.push([name, ...args]); return gates[i].promise; } }]));
  let settled = false; const pending = service.getOrderDetail({ googleSheetsService: sheets, orderId: "o" }); pending.then(() => { settled = true; });
  assert.deepEqual(events, [["orders", "A:I"], ["orderItems"], ["orderBills"], ["shipmentOrders"], ["shipments"]]);
  gates.slice(0, 4).forEach(g => g.resolve([])); await flush(); assert.equal(settled, false); gates[4].resolve([]); assert.equal(await pending, undefined); assert.equal(events.length, 5);
});

test("original Orders detail: synchronous getter/call failure stops later reads, each asynchronous rejection retains identity", async () => {
  for (const failing of detailSheetNames) for (const kind of ["getter", "call", "async"]) {
    const events = [], error = new Error(failing), sheets = {};
    for (const name of detailSheetNames) Object.defineProperty(sheets, name, { get() { events.push(`get:${name}`); if (name === failing && kind === "getter") throw error; return { readRows() { events.push(`read:${name}`); if (name === failing) { if (kind === "call") throw error; return Promise.reject(error); } return Promise.resolve([]); } }; } });
    await assert.rejects(service.getOrderDetail({ googleSheetsService: sheets, orderId: "o" }), e => e === error);
    const limit = kind === "async" ? detailSheetNames.length : detailSheetNames.indexOf(failing) + 1;
    assert.deepEqual(events, detailSheetNames.slice(0, limit).flatMap(n => n === failing && kind === "getter" ? [`get:${n}`] : [`get:${n}`, `read:${n}`]));
  }
});

test("original Orders detail: latest active link wins, blank newest ID suppresses older link and unresolved IDs stay non-null", async () => {
  for (const [links, id] of [
    [[["a", "old", "o"], ["b", "s", " o "]], "s"],
    [[["a", "s", "o"], ["b", "other", "o", "", "", "deleted"]], "s"],
    [[["a", "s", "o"], ["b", " ", "o"]], null],
    [[["a", "unknown", "o"]], "unknown"],
    [[["a", 42, "o"]], "42"], [[["a", true, "o"]], "true"],
  ]) { const data = rows(); data.shipmentOrders = links; const result = await call(data); assert.equal(result.shipmentId, id); assert.equal(result.shipment?.id ?? null, id === "s" ? "s" : null); }
  const data = rows(); data.shipmentOrders = [["a", "s", "o"], ["b", "other", "unrelated"]]; assert.equal((await call(data)).shipmentId, "s");
});

test("original Orders detail: all statuses/PO/deletion/fee conversions and nested field/key representation", async () => {
  for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled"]) {
    const data = rows(); data.shipments = [shipment("s", status)]; const result = await call(data);
    assert.deepEqual(plain(result.shipment), { id: "s", status, carrier: "carrier", poNumber: "PO", shippingFee: 1234.5, remark: "remark", shippedAt: "shipped", deliveredAt: "delivered", deletedAt: "", createdAt: "created", updatedAt: "updated", createdBy: "actor", shippingBillUrl: "bill" });
    assert.equal(result.totalPrice, 1234.5);
  }
  for (const [fee, expected] of [[0, 0], [1.25, 1.25], ["1,234.5", 1234.5], ["", null], ["bad", null], [NaN, null], [Infinity, null], [true, null], [null, null], [{}, null]]) {
    const data = rows(); data.shipments[0][4] = fee; assert.equal((await call(data)).shipment.shippingFee, expected);
  }
  for (const [column, value] of [[0, " "], [1, "unknown"], [1, ""], [3, " "], [10, "deleted"]]) { const data = rows(); data.shipments[0][column] = value; const result = await call(data); assert.equal(result.shipmentId, "s"); assert.equal(result.shipment, null); }
});

test("original Orders detail: first valid duplicate Order/Shipment wins but entire arrays map before find", async () => {
  const data = rows(); data.orders.push(["o", "complete", "second", 0]); data.shipments.push(shipment("s", "canceled"));
  assert.equal((await call(data)).seller, "Seller"); assert.equal((await call(data)).shipment.status, "draft");
  data.orders.push(null); await assert.rejects(call(data)); data.orders.pop(); data.shipments.push(null); await assert.rejects(call(data));
  for (const orderRows of [[], [["o", "invalid"]], [["o", "complete", "", 1, "", "", "", "deleted"]]]) {
    const result = await call({ orders: orderRows, orderItems: null, orderBills: null, shipmentOrders: null, shipments: null }); assert.equal(result, undefined);
  }
});

test("original Orders detail: link, product, bill, Shipment mapping failures retain exact phase precedence", async () => {
  const data = rows(); data.shipmentOrders = [null]; data.orderItems = [null]; data.orderBills = [null]; data.shipments = [null];
  const error = async () => { try { await call(data); assert.fail("Expected error"); } catch (e) { return e.message; } };
  assert.match(await error(), /iterable/); data.shipmentOrders = [["l", "s", "o"]]; assert.match(await error(), /iterable/);
  data.orderItems = []; assert.match(await error(), /iterable/); data.orderBills = []; assert.match(await error(), /iterable/);
  data.shipmentOrders = [["l", "", "o"]]; assert.equal((await call(data)).shipment, null);
  const phases = [], instrument = (values, name) => { values.map = function (...args) { phases.push(name); return Array.prototype.map.apply(this, args); }; return values; };
  const normal = rows(); normal.orders = instrument(normal.orders, "orders"); normal.orderItems = instrument(normal.orderItems, "products"); normal.orderBills = instrument(normal.orderBills, "bills"); normal.shipments = instrument(normal.shipments, "shipments");
  normal.shipmentOrders[0] = new Proxy(normal.shipmentOrders[0], { get(target, key, receiver) { if (key === Symbol.iterator) phases.push("links"); return Reflect.get(target, key, receiver); } });
  await call(normal); assert.deepEqual(phases, ["orders", "links", "products", "bills", "shipments"]);
});

test("original Orders detail: product/bill ordering, quantities and codes, invalid/deleted image rules", async () => {
  const data = rows(); data.orderItems.push(["p2", "o", "url2", 0, 5, 42, true], ["deleted", "o", "url", "", "", "", "", "", "deleted"], ["", "o", "url"]);
  data.orderBills.push(["b2", "o", " bill2 ", 123], ["deleted", "o", "url", "", "", "deleted"], ["other", "other", "url"]);
  const detail = await call(data); assert.deepEqual(plain(detail.productImages).map(x => [x.id, x.quoteQuantity, x.deliveredQuantity, x.productCode]), [["p", "2", "true", "code"], ["p2", "0", "5", "42"]]);
  assert.deepEqual(plain(detail.billImages).map(x => [x.id, x.imageUrl, x.createdAt]), [["b", "bill", "c"], ["b2", "bill2", "123"]]);
});
