import assert from "node:assert/strict";
import test from "node:test";
import { shipmentServices, shipmentRow } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
const { services } = shipmentServices();
const names = ["shipments", "shipmentOrders", "orders", "orderItems"];

test("read characterization: all four reads start concurrently in exact order and await the last result", async () => {
  const events = [], gates = names.map(() => deferred()); let done = false;
  const sheets = Object.fromEntries(names.map((name, i) => [name, { readRows: (...args) => { events.push([name, ...args]); return gates[i].promise; } }]));
  const result = services.listShipments({ googleSheetsService: sheets }); result.then(() => { done = true; });
  assert.deepEqual(events, [["shipments"], ["shipmentOrders"], ["orders", "A:I"], ["orderItems"]]);
  gates.slice(0, 3).forEach(g => g.resolve([])); await flush(); assert.equal(done, false);
  gates[3].resolve([]); assert.deepEqual(plain(await result), []);
});

test("read characterization: relation grouping preserves cross-shipment links, duplicate images and last valid Order", async () => {
  const data = {
    shipments: [shipmentRow({ id: "same", poNumber: "first", shippingFee: 0 }), shipmentRow({ id: "other", shippingFee: 0 }), shipmentRow({ id: "same", poNumber: "last", shippingFee: 0 })],
    shipmentOrders: [["", "same", "b"], ["l", "same", "a"], ["duplicate", "same", "b"], ["cross", "other", "b"], ["deleted", "same", "ignored", "", "", "deleted"]],
    orders: [["a", "complete", "A", 0], ["b", "complete", "old", 1], ["b", "complete", " winner ", "1,000"], ["b", "invalid", "bad", 2], ["b", "complete", "deleted", 3, "", "", "", "deleted"]],
    orderItems: [["i", "b", " url ", " 2 ", true, 5], ["i", "b", "url", 3, 4], ["deleted", "b", "url", 1, 1, "", "", "", "deleted"]],
  };
  const events = [], sheets = Object.fromEntries(names.map(name => [name, { readRows: async (...args) => { events.push([name, ...args]); return data[name]; } }]));
  const list = plain(await services.listShipments({ googleSheetsService: sheets }));
  assert.deepEqual(list.map(s => [s.id, s.poNumber]), [["same", "last"], ["other", "PO-1"], ["same", "first"]]);
  assert.deepEqual(list[0].orders.map(o => o.id), ["b", "a"]);
  assert.equal(list[0].orders[0].seller, "winner"); assert.equal(list[0].orders[0].totalPrice, 1000);
  assert.deepEqual(list[0].orders[0].productImages, [{ id: "i", imageUrl: "url", quoteQuantity: "2", deliveredQuantity: "true", productCode: "5" }, { id: "i", imageUrl: "url", quoteQuantity: "3", deliveredQuantity: "4", productCode: "" }]);
  assert.equal(list[1].orders[0].id, "b");
  events.length = 0;
  assert.equal((await services.getShipmentDetail({ googleSheetsService: sheets, shipmentId: "same" })).poNumber, "last");
  assert.equal(events.length, 4);
});

test("read characterization: disabled relations access no other worksheet getters, even when all statuses excluded", async () => {
  let count = 0;
  const sheets = { shipments: { readRows: async () => { count++; return [shipmentRow()]; } } };
  for (const key of names.slice(1)) Object.defineProperty(sheets, key, { get() { assert.fail(`Unexpected ${key} access`); } });
  assert.deepEqual(plain(await services.listShipments({ googleSheetsService: sheets, includeOrders: false, excludeStatuses: ["draft"] })), []); assert.equal(count, 1);
});

test("read characterization: each rejection keeps error identity and there is no retry", async () => {
  for (const failing of names) {
    const error = new Error(failing), events = [];
    const sheets = Object.fromEntries(names.map(name => [name, { readRows: async () => { events.push(name); if (name === failing) throw error; return []; } }]));
    await assert.rejects(services.listShipments({ googleSheetsService: sheets }), e => e === error);
    assert.deepEqual(events, names);
  }
});

test("read characterization: malformed worksheet collections and rows reject in original mapping order", async () => {
  for (const invalid of [null, {}, [null]]) for (const failing of names) {
    const data = Object.fromEntries(names.map(name => [name, name === failing ? invalid : []]));
    const sheets = Object.fromEntries(names.map(name => [name, { readRows: async () => data[name] }]));
    await assert.rejects(services.listShipments({ googleSheetsService: sheets }));
  }
  const events = [], bad = name => ({ [Symbol.iterator]() { events.push(name); throw new Error(name); } });
  const data = { shipments: [bad("shipments")], shipmentOrders: [bad("links")], orderItems: [bad("images")], orders: [bad("orders")] };
  const sheets = Object.fromEntries(names.map(name => [name, { readRows: async () => data[name] }]));
  await assert.rejects(services.listShipments({ googleSheetsService: sheets }), /links/); assert.deepEqual(events, ["links"]);
  data.shipmentOrders = []; events.length = 0;
  await assert.rejects(services.listShipments({ googleSheetsService: sheets }), /images/); assert.deepEqual(events, ["images"]);
  data.orderItems = []; events.length = 0;
  await assert.rejects(services.listShipments({ googleSheetsService: sheets }), /orders/); assert.deepEqual(events, ["orders"]);
  data.orders = []; events.length = 0;
  await assert.rejects(services.listShipments({ googleSheetsService: sheets }), /shipments/); assert.deepEqual(events, ["shipments"]);
});
