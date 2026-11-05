import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shipmentServices, fakeShipmentSheets, shipmentRow, ShipmentClock, SHIPMENT_TIME } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
const before = JSON.parse(readFileSync("tests/fixtures/shipments-status-before.json", "utf8"));
const { services } = shipmentServices();
const base = { shipmentId: "s/1", status: "ready_to_ship" };

test("original status: captured successful/rejected DTOs and failure side effects remain exact", async () => {
  for (const example of before.examples) {
    const h = fakeShipmentSheets(example.rows, example.options);
    if (example.error) await assert.rejects(services.updateShipmentStatus({ googleSheetsService: h.sheets, ...example.input }), e => e.name === example.error.name && e.message === example.error.message);
    else assert.deepEqual(plain(await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...example.input })), example.result);
    assert.deepEqual(h.events, example.events);
  }
});

test("original status: invalid delivered fee short-circuits every worksheet getter and clock; zero/max remain valid", async () => {
  const controlled = shipmentServices({ globals: { Date: class { constructor() { assert.fail("Clock on invalid fee"); } } } }).services;
  for (const deliveryFee of [undefined, NaN, Infinity, -Infinity, -1, 1_000_000_001]) {
    const result = await controlled.updateShipmentStatus({ googleSheetsService: { get shipments() { assert.fail("Worksheet on invalid fee"); } }, shipmentId: "s/1", status: "delivered", deliveryFee });
    assert.deepEqual(plain(result), { outcome: "invalid_delivery_fee" });
  }
  for (const deliveryFee of [0, 1_000_000_000]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "shipping" })] });
    assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base, status: "delivered", deliveryFee })).shipment.shippingFee, deliveryFee);
  }
});

test("original status: M1 must fulfill before read begins, read must fulfill before selection and data write", async () => {
  const header = deferred(), read = deferred(), events = [];
  const sheets = { shipments: { updateRows: async (range) => { events.push(range); if (range === "M1") await header.promise; }, readRows: range => { events.push(range); return read.promise; } } };
  const pending = services.updateShipmentStatus({ googleSheetsService: sheets, ...base });
  assert.deepEqual(events, ["M1"]); await flush(); assert.deepEqual(events, ["M1"]);
  header.resolve(); await flush(); assert.deepEqual(events, ["M1", "A2:M"]);
  read.resolve([shipmentRow()]); assert.equal((await pending).outcome, "updated"); assert.deepEqual(events, ["M1", "A2:M", "B2:M2"]);
});

test("original status: complete transition matrix returns original outcomes after header/read", async () => {
  const allowed = new Set(["draft:ready_to_ship", "ready_to_ship:shipping", "shipping:delivered"]);
  for (const current of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "unknown"]) for (const next of ["draft", "ready_to_ship", "shipping", "delivered", "canceled"]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: current })] });
    const result = await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base, status: next, deliveryFee: 0, poNumber: "PO" });
    const valid = allowed.has(`${current}:${next}`); assert.equal(result.outcome, valid ? "updated" : "invalid_transition"); assert.equal(h.events.length, valid ? 3 : 2);
  }
});

test("original status: PO transition precedence and original untrimmed length limit", async () => {
  for (const poNumber of [undefined, "", " ", "x".repeat(101), " ".repeat(100) + "x"]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] });
    assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base, status: "shipping", poNumber })).outcome, "invalid_po_number"); assert.equal(h.events.length, 2);
  }
  const valid = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] });
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: valid.sheets, ...base, status: "shipping", poNumber: " ".repeat(99) + "x" })).shipment.poNumber, "x");
  const invalid = fakeShipmentSheets({ shipments: [shipmentRow()] });
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: invalid.sheets, ...base, status: "shipping", poNumber: " " })).outcome, "invalid_transition");
});

test("original status: lookup preserves String conversion, first active row, supplied ID and malformed-row failures", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ id: " s/1 ", deletedAt: " deleted " }), shipmentRow({ id: " s/1 ", status: "shipping" }), shipmentRow()] });
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base })).outcome, "invalid_transition"); assert.equal(h.events.length, 2);
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base, shipmentId: " s/1 " })).outcome, "not_found");
  const numeric = fakeShipmentSheets({ shipments: [shipmentRow({ id: 42, deletedAt: null })] });
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: numeric.sheets, ...base, shipmentId: "42" })).outcome, "updated");
  for (const rows of [null, {}, [null], [42], [true]]) {
    const events = [], sheets = { shipments: { updateRows: async range => events.push(range), readRows: async range => { events.push(range); return rows; } } };
    await assert.rejects(services.updateShipmentStatus({ googleSheetsService: sheets, ...base })); assert.deepEqual(events, ["M1", "A2:M"]);
  }
});

test("original status: exact iterator getter access and conversion/clock precedence", async () => {
  const events = [], values = shipmentRow({ status: { toString() { events.push("status"); return "draft"; } }, poNumber: { toString() { events.push("po"); return "PO"; } } });
  const row = new Proxy(values, { get(target, key, receiver) { if (/^\d+$/.test(String(key))) events.push(Number(key)); return Reflect.get(target, key, receiver); } });
  class Clock extends ShipmentClock { toISOString() { events.push("clock"); return super.toISOString(); } }
  const controlled = shipmentServices({ globals: { Date: Clock } }).services;
  const sheets = { shipments: { updateRows: async range => events.push(range), readRows: async () => [row] } };
  assert.equal((await controlled.updateShipmentStatus({ googleSheetsService: sheets, ...base })).outcome, "updated");
  assert.deepEqual(events, ["M1", ...Array.from({ length: 11 }, (_, i) => i), ...Array.from({ length: 13 }, (_, i) => i), "status", "clock", "po", "B2:M2"]);
});

test("original status: selected row destructuring errors precede transition/PO validation and clock", async () => {
  const error = new Error("selected field getter"), values = shipmentRow({ status: "unknown" });
  Object.defineProperty(values, 12, { get() { throw error; } });
  const sheets = { shipments: { updateRows: async () => {}, readRows: async () => [values] } };
  await assert.rejects(services.updateShipmentStatus({ googleSheetsService: sheets, ...base, status: "shipping" }), e => e === error);
  const conversion = new Error("PO conversion"), events = [], row = shipmentRow({ poNumber: { toString() { events.push("po"); throw conversion; } } });
  class Clock extends ShipmentClock { toISOString() { events.push("clock"); return super.toISOString(); } }
  const controlled = shipmentServices({ globals: { Date: Clock } }).services;
  await assert.rejects(controlled.updateShipmentStatus({ googleSheetsService: { shipments: { updateRows: async () => {}, readRows: async () => [row] } }, ...base }), e => e === conversion);
  assert.deepEqual(events, ["clock", "po"]);
});

test("original status: every synchronous/asynchronous storage failure preserves original error and stops later operations", async () => {
  for (const phase of ["M1", "A2:M", "B2:M2"]) for (const sync of [true, false]) {
    const error = new Error(phase), events = [], sheets = { shipments: {
      updateRows(range) { events.push(range); if (range === phase) { if (sync) throw error; return Promise.reject(error); } return Promise.resolve(); },
      readRows(range) { events.push(range); if (range === phase) { if (sync) throw error; return Promise.reject(error); } return Promise.resolve([shipmentRow()]); },
    } };
    await assert.rejects(services.updateShipmentStatus({ googleSheetsService: sheets, ...base }), e => e === error);
    assert.deepEqual(events, ["M1", "A2:M", "B2:M2"].slice(0, ["M1", "A2:M", "B2:M2"].indexOf(phase) + 1));
  }
});

test("original status: one clock only after valid checks and no success until data write fulfills", async () => {
  const events = [], gate = deferred(); let row;
  class Clock extends ShipmentClock { toISOString() { events.push("clock"); return super.toISOString(); } }
  const controlled = shipmentServices({ globals: { Date: Clock } }).services;
  const sheets = { shipments: { updateRows: async (range, values) => { events.push(range); if (range !== "M1") { row = plain(values); await gate.promise; } }, readRows: async range => { events.push(range); return [shipmentRow()]; } } };
  let success = false; const pending = controlled.updateShipmentStatus({ googleSheetsService: sheets, ...base }); pending.then(() => { success = true; }); await flush();
  assert.equal(success, false); assert.deepEqual(events, ["M1", "A2:M", "clock", "B2:M2"]); gate.resolve(); assert.equal((await pending).outcome, "updated"); assert.equal(row[0][8], SHIPMENT_TIME);
  const noClock = shipmentServices({ globals: { Date: class { constructor() { assert.fail("Invalid outcome invoked clock"); } } } }).services;
  for (const [rows, extra] of [[[], {}], [[shipmentRow({ status: "shipping" })], {}], [[shipmentRow({ status: "ready_to_ship" })], { status: "shipping", poNumber: " " }]]) await noClock.updateShipmentStatus({ googleSheetsService: fakeShipmentSheets({ shipments: rows }).sheets, ...base, ...extra });
});

test("original status: numeric/null/commas, URL clearing and raw untouched columns retain exact values and DTO keys", async () => {
  for (const [fee, expected] of [[0, 0], ["1,234.5", 1234.5], ["", null], ["bad", null], [null, null], [NaN, null], [Infinity, null], [true, null]]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ carrier: true, remark: 7, createdAt: false, createdBy: 42, shippingFee: fee, shippingBillUrl: " old ", shippedAt: " s ", deliveredAt: " d " })] });
    const result = await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base });
    assert.equal(result.shipment.shippingFee, expected); assert.equal(result.shipment.shippingBillUrl, "old");
    assert.deepEqual(h.events[2][3], [["ready_to_ship", true, "PO-1", expected, 7, "s", "d", false, SHIPMENT_TIME, "", 42, "old"]]);
    assert.deepEqual(Object.keys(result.shipment), ["status", "poNumber", "shippingFee", "shippedAt", "deliveredAt", "updatedAt", "shippingBillUrl"]);
  }
  for (const [shippingBillUrl, expected] of [[undefined, ""], [" url ", "url"], [" ", ""]]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship", shippingBillUrl: "old" })] });
    assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, ...base, status: "shipping", poNumber: "PO", shippingBillUrl })).shipment.shippingBillUrl, expected);
  }
});
