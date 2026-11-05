import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { shipmentServices, fakeShipmentSheets, shipmentRow, ShipmentClock, SHIPMENT_TIME } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
const before = JSON.parse(readFileSync("tests/fixtures/shipments-link-before.json", "utf8"));
const input = { shipmentId: "s/1", orderId: "o/1", createdBy: " actor " };
const valid = () => ({ shipments: [shipmentRow()], orders: [["o/1", "unknown"]], shipmentOrders: [] });
const names = ["shipments", "orders", "shipmentOrders"];
const { services } = shipmentServices();

test("original linking: captured successful and idempotent outputs, ranges and seven-column row", async () => {
  for (const example of before.examples) {
    const h = fakeShipmentSheets(example.rows);
    assert.deepEqual(plain(await services.linkOrderToShipment({ googleSheetsService: h.sheets, ...example.input })), example.result);
    assert.deepEqual(h.events, example.events);
  }
});

test("original linking: all three reads begin in order concurrently, checks wait for last result", async () => {
  const gates = names.map(() => deferred()), events = [];
  const sheets = Object.fromEntries(names.map((name, i) => [name, { readRows: (...args) => { events.push([name, ...args]); return gates[i].promise; } }]));
  let settled = false; const pending = services.linkOrderToShipment({ googleSheetsService: sheets, ...input }); pending.catch(() => { settled = true; });
  assert.deepEqual(events, [["shipments"], ["orders", "A:I"], ["shipmentOrders"]]);
  gates[0].resolve([]); gates[1].resolve([]); await flush(); assert.equal(settled, false);
  gates[2].resolve([]); await assert.rejects(pending, e => e.code === "shipment_not_found");
});

test("original linking: synchronous getter/read errors short-circuit, async errors propagate unchanged without retry", async () => {
  for (const fail of names) for (const kind of ["getter", "sync", "async"]) {
    const events = [], error = new Error("failure"), sheets = {};
    for (const name of names) Object.defineProperty(sheets, name, { get() {
      events.push(`get:${name}`); if (name === fail && kind === "getter") throw error;
      return { readRows() { events.push(`read:${name}`); if (name === fail) { if (kind === "sync") throw error; return Promise.reject(error); } return Promise.resolve([]); } };
    } });
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: sheets, ...input }), e => e === error);
    const end = kind === "async" ? names.length : names.indexOf(fail) + 1;
    assert.deepEqual(events, names.slice(0, end).flatMap(n => n === fail && kind === "getter" ? [`get:${n}`] : [`get:${n}`, `read:${n}`]));
  }
});

test("original linking: missing/deleted Shipment precedes malformed Orders/links and missing/deleted Order precedes link inspection", async () => {
  for (const shipments of [[], [shipmentRow({ deletedAt: "deleted" })]]) {
    const h = fakeShipmentSheets({ shipments, orders: [null], shipmentOrders: [null] });
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }), e => e.code === "shipment_not_found" && e.message === "Shipment not found.");
  }
  for (const orders of [[], [["o/1", "complete", "", "", "", "", "", "deleted"]]]) {
    const h = fakeShipmentSheets({ ...valid(), orders, shipmentOrders: [null] });
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }), e => e.code === "order_not_found" && e.message === "Order not found.");
  }
});

test("original linking: existing link bypasses status getter, conflict precedes status, and first active Shipment wins", async () => {
  for (const target of ["s/1", "other"]) {
    const row = shipmentRow(); Object.defineProperty(row, 1, { get() { assert.fail("Status must remain deferred"); } });
    const sheets = { shipments: { readRows: async () => [row] }, orders: { readRows: async () => [["o/1", "bad-status"]] }, shipmentOrders: { readRows: async () => [["l", target, "o/1"]] } };
    if (target === "s/1") assert.equal((await services.linkOrderToShipment({ googleSheetsService: sheets, ...input })).created, false);
    else await assert.rejects(services.linkOrderToShipment({ googleSheetsService: sheets, ...input }), e => e.code === "order_already_linked");
  }
  const h = fakeShipmentSheets({ ...valid(), shipments: [shipmentRow({ deletedAt: "deleted" }), shipmentRow({ status: "shipping" }), shipmentRow()] });
  await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }), e => e.code === "shipment_not_linkable");
});

test("original linking: reverse lookup skips invalid/deleted links, preserves normalized historical values", async () => {
  const h = fakeShipmentSheets({ ...valid(), shipments: [shipmentRow({ status: "delivered" })], shipmentOrders: [["old", "other", "o/1"], [42, " s/1 ", " o/1 ", true, 123, "", " actor "], ["", "other", "o/1"], ["x", "", "o/1"], ["x", "other", ""], ["deleted", "other", "o/1", "", "", "yes"]] });
  assert.deepEqual(plain(await services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input })), { shipmentOrder: { id: "42", shipmentId: "s/1", orderId: "o/1", createdAt: "true", updatedAt: "123", deletedAt: "", createdBy: "actor" }, created: false });
  assert.equal(h.events.length, 3);
});

test("original linking: Draft/Ready accept unknown Order status; other statuses reject only after lookups", async () => {
  for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "unknown"]) {
    const h = fakeShipmentSheets({ ...valid(), shipments: [shipmentRow({ status })] });
    const pending = services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input });
    if (["draft", "ready_to_ship"].includes(status)) { assert.equal((await pending).created, true); assert.equal(h.events.length, 4); }
    else { await assert.rejects(pending, e => e.code === "shipment_not_linkable" && e.message === "Orders can only be linked to draft or ready-to-ship shipments."); assert.equal(h.events.length, 3); }
  }
});

test("original linking: clock then ID once, unchanged actor/IDs, append completion before success", async () => {
  const events = [], gate = deferred(); let values;
  class Clock extends ShipmentClock { toISOString() { events.push("clock"); return super.toISOString(); } }
  const { services: controlled } = shipmentServices({ globals: { Date: Clock }, createId: () => { events.push("id"); return "synthetic"; } });
  const h = fakeShipmentSheets(valid()); h.sheets.shipmentOrders.appendRows = async (range, rows) => { events.push("append"); assert.equal(range, "A:G"); values = plain(rows); await gate.promise; };
  let settled = false; const pending = controlled.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }); pending.then(() => { settled = true; }); await flush();
  assert.deepEqual(events, ["clock", "id", "append"]); assert.equal(settled, false);
  gate.resolve(); const result = await pending;
  assert.deepEqual(values, [["synthetic", "s/1", "o/1", SHIPMENT_TIME, SHIPMENT_TIME, "", " actor "]]); assert.equal(result.shipmentOrder.createdBy, input.createdBy);
  const spaced = fakeShipmentSheets(valid()); await assert.rejects(controlled.linkOrderToShipment({ googleSheetsService: spaced.sheets, ...input, shipmentId: " s/1 " }), e => e.code === "shipment_not_found");
});

test("original linking: read-only outcomes never invoke clock/ID and clock/ID/append errors retain identity", async () => {
  const error = new Error("original failure");
  for (const kind of ["clock", "id", "append"]) {
    const events = []; class Clock extends ShipmentClock { toISOString() { events.push("clock"); if (kind === "clock") throw error; return super.toISOString(); } }
    const { services: controlled } = shipmentServices({ globals: { Date: Clock }, createId: () => { events.push("id"); if (kind === "id") throw error; return "id"; } });
    const h = fakeShipmentSheets(valid()); h.sheets.shipmentOrders.appendRows = async () => { events.push("append"); throw error; };
    await assert.rejects(controlled.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }), e => e === error);
    assert.deepEqual(events, ["clock", "id", "append"].slice(0, ["clock", "id", "append"].indexOf(kind) + 1));
  }
  const { services: noTime } = shipmentServices({ globals: { Date: class { constructor() { assert.fail("Unexpected clock"); } } }, createId: () => assert.fail("Unexpected ID") });
  for (const rows of [{ ...valid(), shipments: [] }, { ...valid(), orders: [] }, { ...valid(), shipmentOrders: [["l", "s/1", "o/1"]] }, { ...valid(), shipmentOrders: [["l", "other", "o/1"]] }]) {
    try { await noTime.linkOrderToShipment({ googleSheetsService: fakeShipmentSheets(rows).sheets, ...input }); } catch(e) { assert.ok(e instanceof noTime.LinkOrderToShipmentError); }
  }
});

test("original linking: malformed arrays/rows and deferred status access preserve inspection/error order", async () => {
  for (const key of names) for (const malformed of [null, {}, [null]]) {
    const rows = { ...valid(), [key]: malformed }, h = fakeShipmentSheets(rows);
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, ...input }));
  }
  const events = [], row = shipmentRow();
  for (const [index, name, value] of [[0, "shipment-id", "s/1"], [10, "shipment-deleted", ""], [1, "status", "draft"]]) Object.defineProperty(row, index, { get() { events.push(name); return value; } });
  const order = []; Object.defineProperty(order, 0, { get() { events.push("order"); return "o/1"; } });
  const link = ["link", "s/1", "o/1"]; Object.defineProperty(link, Symbol.iterator, { value() { events.push("link"); return Array.prototype[Symbol.iterator].call(this); } });
  const sheets = { shipments: { readRows: async () => [row] }, orders: { readRows: async () => [order] }, shipmentOrders: { readRows: async () => [link] } };
  assert.equal((await services.linkOrderToShipment({ googleSheetsService: sheets, ...input })).created, false);
  assert.deepEqual(events, ["shipment-id", "shipment-deleted", "order", "link"]);
});
