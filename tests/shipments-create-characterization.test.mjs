import {readArchive} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { shipmentServices, ShipmentClock } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";

const before = JSON.parse(readArchive(new URL("./fixtures/shipments-create-before.json", import.meta.url), "utf8"));

for (const [index, fixture] of before.cases.entries()) test(`creation legacy compatibility matches original fields, field order and single A:M row: case ${index + 1}`, async () => {
  const { services, load } = shipmentServices(), appends = [];
  const direct = load("src/services/shipments/createShipment.ts").createShipment;
  assert.equal(direct, services.createShipment);
  const result = await direct({ ...fixture.input, googleSheetsService: { shipments: { appendRows: async (...args) => appends.push(plain(args)) } } });
  assert.deepEqual(plain(result), fixture.shipment); assert.deepEqual(Object.keys(result), fixture.keys); assert.deepEqual(appends, fixture.appends);
});

test("PO validation rejects blank inputs before clock/ID or any worksheet access", async () => {
  const calls = [];
  class TracedClock extends ShipmentClock { constructor(...args) { calls.push("clock"); super(...args); } }
  const { services } = shipmentServices({ globals: { Date: TracedClock }, createId: () => { calls.push("id"); return "id"; } });
  const sheets = { get shipments() { calls.push("sheet"); throw new Error("No sheet access before validation"); } };
  for (const poNumber of ["", " ", "\n\t"]) await assert.rejects(services.createShipment({ googleSheetsService: sheets, poNumber, createdBy: "web" }), error => error.message === "Shipment PO number is required.");
  assert.deepEqual(calls, []);
});

test("original normalization, clock, ID, carrier, sheet access and append evaluation order remains exact", async () => {
  const calls = [];
  class TracedClock extends ShipmentClock { constructor(...args) { calls.push("clock"); super(...args); } }
  const { services } = shipmentServices({ globals: { Date: TracedClock }, createId: () => { calls.push("id"); return before.id; } });
  const result = await services.createShipment({
    poNumber: { trim() { calls.push("po"); return "PO"; } }, carrier: { trim() { calls.push("carrier"); return "Carrier"; } }, createdBy: " actor ",
    googleSheetsService: { get shipments() { calls.push("sheet"); return { appendRows: async (range, rows) => { calls.push("append"); assert.equal(range, "A:M"); assert.equal(rows[0].length, 13); } }; } },
  });
  assert.deepEqual(calls, ["po", "clock", "id", "carrier", "sheet", "append"]);
  assert.equal(result.createdAt, before.time); assert.equal(result.updatedAt, before.time); assert.equal(result.createdBy, " actor ");
});

test("creation returns only after its one append resolves", async () => {
  const write = deferred(), calls = [], { services } = shipmentServices(); let settled = false;
  const pending = services.createShipment({ poNumber: "PO", createdBy: "web", googleSheetsService: { shipments: { appendRows: async (...args) => { calls.push(plain(args)); await write.promise; } } } });
  pending.then(() => { settled = true; }); await flush(); assert.equal(settled, false); assert.equal(calls.length, 1);
  write.resolve(); const result = await pending; assert.equal(result.id, before.id); assert.equal(settled, true); assert.equal(calls.length, 1);
});

test("append rejection preserves original error identity with no retry, compensation or false success", async () => {
  const write = deferred(), failure = new Error("synthetic append failure"), calls = [], { services } = shipmentServices(); let success = false;
  const pending = services.createShipment({ poNumber: "PO", createdBy: "web", googleSheetsService: { shipments: { appendRows: async () => { calls.push("append"); await write.promise; }, updateRows: () => assert.fail("No compensation"), readRows: () => assert.fail("No read") } } });
  pending.then(() => { success = true; }, () => {}); const rejected = assert.rejects(pending, error => error === failure);
  write.reject(failure); await rejected; assert.equal(success, false); assert.deepEqual(calls, ["append"]);
});

test("clock/ID failures preserve their order, original error identity and no-write behavior", async () => {
  for (const failing of ["clock", "id"]) {
    const calls = [], failure = new Error(`synthetic ${failing} failure`);
    class TracedClock extends ShipmentClock { constructor(...args) { calls.push("clock"); if (failing === "clock") throw failure; super(...args); } }
    const { services } = shipmentServices({ globals: { Date: TracedClock }, createId: () => { calls.push("id"); throw failure; } });
    await assert.rejects(services.createShipment({ poNumber: "PO", createdBy: "web", googleSheetsService: { get shipments() { assert.fail("No worksheet access"); } } }), error => error === failure);
    assert.deepEqual(calls, failing === "clock" ? ["clock"] : ["clock", "id"]);
  }
});
