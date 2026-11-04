import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { plain } from "./helpers/load-source.mjs";
import { shipmentServices, fakeShipmentSheets, shipmentRow, SHIPMENT_TIME } from "./helpers/shipments.mjs";

const { services } = shipmentServices();
const fixture = JSON.parse(readFileSync(new URL("./fixtures/shipments-read.json", import.meta.url), "utf8"));

test("original shipment list/detail preserve exact JSON, trimming, statuses, deleted/duplicate data and read order", async () => {
  const h = fakeShipmentSheets(fixture.rows);
  assert.deepEqual(plain(await services.listShipments({ googleSheetsService: h.sheets })), fixture.expected);
  assert.deepEqual(h.events, [["read", "shipments"], ["read", "shipmentOrders"], ["read", "orders", "A:I"], ["read", "orderItems"]]);
  const detail = await services.getShipmentDetail({ googleSheetsService: h.sheets, shipmentId: "s/1" });
  assert.deepEqual(plain(detail), fixture.expected.find((shipment) => shipment.id === "s/1"));
  assert.equal(await services.getShipmentDetail({ googleSheetsService: h.sheets, shipmentId: "missing" }), undefined);
});

test("empty sheets, excluded statuses and includeOrders=false retain their read/result behavior", async () => {
  assert.deepEqual(plain(await services.listShipments({ googleSheetsService: fakeShipmentSheets().sheets })), []);
  const h = fakeShipmentSheets(fixture.rows);
  const list = await services.listShipments({ googleSheetsService: h.sheets, includeOrders: false, excludeStatuses: ["delivered", "canceled"] });
  assert.ok(list.every((item) => !["delivered", "canceled"].includes(item.status) && item.orders.length === 0 && item.costSummary === null));
  assert.deepEqual(h.events, [["read", "shipments"]]);
});

test("list read rejection and malformed iterable rows propagate rather than being repaired", async () => {
  for (const failRead of ["shipments", "shipmentOrders", "orders", "orderItems"]) {
    const h = fakeShipmentSheets(fixture.rows, { failRead });
    await assert.rejects(services.listShipments({ googleSheetsService: h.sheets }), /synthetic read failure/);
    assert.equal(h.events.length, 4);
  }
  const h = fakeShipmentSheets({ shipments: [null] });
  await assert.rejects(services.listShipments({ googleSheetsService: h.sheets }), /iterable/);
});

const costCases = [
  ["no orders", 10, [], null], ["missing fee", null, [{ total: 10, quote: "2", delivered: "1" }], null],
  ["null total", 10, [{ total: null, quote: "2", delivered: "1" }], null],
  ["zero total", 10, [{ total: 0, quote: "2", delivered: "1" }], { totalOrderPrice: 0, shippingFee: 10, quote: { totalQuantity: 2, averageLandedCostPerUnit: 5 }, delivered: { totalQuantity: 1, averageLandedCostPerUnit: 10 } }],
  ["commas/multiple orders", "1,000", [{ total: "2,000", quote: "1,000", delivered: "500" }, { total: "3,000", quote: "500", delivered: "250" }], { totalOrderPrice: 5000, shippingFee: 1000, quote: { totalQuantity: 1500, averageLandedCostPerUnit: 4 }, delivered: { totalQuantity: 750, averageLandedCostPerUnit: 8 } }],
  ["invalid quote", 10, [{ total: 10, quote: "bad", delivered: "2" }], { totalOrderPrice: 10, shippingFee: 10, quote: null, delivered: { totalQuantity: 2, averageLandedCostPerUnit: 10 } }],
  ["zero/missing quantities", 0, [{ total: 10, quote: "0", delivered: "" }], { totalOrderPrice: 10, shippingFee: 0, quote: null, delivered: null }],
  ["fractional semantics", 0.3, [{ total: 0.1, quote: "1.5", delivered: "3" }, { total: 0.2, quote: "1.5", delivered: "3" }], { totalOrderPrice: 0.1 + 0.2, shippingFee: 0.3, quote: { totalQuantity: 3, averageLandedCostPerUnit: (0.1 + 0.2 + 0.3) / 3 }, delivered: { totalQuantity: 6, averageLandedCostPerUnit: (0.1 + 0.2 + 0.3) / 6 } }],
];
for (const [name, fee, orders, expected] of costCases) {
  test(`original landed-cost calculation: ${name}`, async () => {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ shippingFee: fee })],
      orders: orders.map((order, i) => [`o-${i}`, "complete", "Seller", order.total]),
      shipmentOrders: orders.map((_, i) => [`link-${i}`, "s/1", `o-${i}`]),
      orderItems: orders.map((order, i) => [`item-${i}`, `o-${i}`, "https://example.test/image", order.quote, order.delivered]),
    });
    assert.deepEqual(plain((await services.listShipments({ googleSheetsService: h.sheets }))[0].costSummary), expected);
  });
}

test("link creation preserves ranges, ID/time and seven-column append; exact retries do not append", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow()], orders: [["o/1", "invalid-but-existing-status"]] });
  const first = await services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: " actor " });
  assert.deepEqual(plain(first), { created: true, shipmentOrder: { id: "synthetic-shipment-id", shipmentId: "s/1", orderId: "o/1", createdAt: SHIPMENT_TIME, updatedAt: SHIPMENT_TIME, deletedAt: "", createdBy: " actor " } });
  assert.deepEqual(h.events, [["read", "shipments"], ["read", "orders", "A:I"], ["read", "shipmentOrders"], ["append", "shipmentOrders", "A:G", [["synthetic-shipment-id", "s/1", "o/1", SHIPMENT_TIME, SHIPMENT_TIME, "", " actor "]]]]);
  h.rows.shipments[0][1] = "delivered"; // Existing-link recognition precedes eligibility validation.
  assert.equal((await services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" })).created, false);
  assert.equal(h.events.filter(([op]) => op === "append").length, 1);
});

for (const [name, changes, code, message] of [
  ["missing shipment", { shipments: [] }, "shipment_not_found", "Shipment not found."],
  ["missing order", { orders: [] }, "order_not_found", "Order not found."],
  ["conflict before eligibility", { shipments: [shipmentRow({ status: "delivered" })], shipmentOrders: [["a", "other", "o/1"]] }, "order_already_linked", "Order is already linked to another shipment."],
  ["ineligible", { shipments: [shipmentRow({ status: "shipping" })] }, "shipment_not_linkable", "Orders can only be linked to draft or ready-to-ship shipments."],
]) {
  test(`link error contract: ${name}`, async () => {
    const h = fakeShipmentSheets({ shipments: [shipmentRow()], orders: [["o/1", "complete"]], ...changes });
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" }), (error) => error.code === code && error.message === message);
    assert.equal(h.events.length, 3);
  });
}

test("latest active link, deleted links/rows, ready eligibility and append failure preserve ordering", async () => {
  const initial = { shipments: [shipmentRow({ status: "ready_to_ship" })], orders: [["o/1", "complete"]], shipmentOrders: [["old", "other", "o/1"], ["latest", "s/1", "o/1", " c ", " u ", "", " who "], ["deleted", "other", "o/1", "", "", "deleted"]] };
  const h = fakeShipmentSheets(initial);
  const result = await services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" });
  assert.equal(result.created, false); assert.equal(result.shipmentOrder.id, "latest"); assert.equal(result.shipmentOrder.createdBy, "who");
  const failure = fakeShipmentSheets({ ...initial, shipmentOrders: [] }, { failAppend: "shipmentOrders" });
  await assert.rejects(services.linkOrderToShipment({ googleSheetsService: failure.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" }), /append failure/);
  assert.equal(failure.events.length, 4);
});

test("status progression preserves M1-before-read and all twelve B:M values", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ carrier: " Carrier ", remark: " remark ", shippingFee: "1,234.5" })] });
  for (const [status, extra] of [["ready_to_ship", {}], ["shipping", { poNumber: " PO-CONFIRMED ", shippingBillUrl: " https://example.test/bill " }], ["delivered", { deliveryFee: 0 }]]) {
    h.events.length = 0;
    const result = await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status, ...extra });
    assert.equal(result.outcome, "updated"); assert.equal(result.shipment.status, status); assert.equal(result.shipment.updatedAt, SHIPMENT_TIME);
    assert.deepEqual(h.events.slice(0, 2), [["update", "shipments", "M1", [["shippingBillUrl"]]], ["read", "shipments", "A2:M"]]);
    assert.equal(h.events[2][2], "B2:M2"); assert.equal(h.events[2][3][0].length, 12);
    assert.deepEqual(h.events[2][3][0], h.rows.shipments[0].slice(1));
  }
  assert.equal(h.rows.shipments[0].length, 13);
  assert.equal(h.rows.shipments[0][3], "PO-CONFIRMED"); assert.equal(h.rows.shipments[0][4], 0);
  assert.equal(h.rows.shipments[0][6], SHIPMENT_TIME); assert.equal(h.rows.shipments[0][7], SHIPMENT_TIME);
  assert.equal(h.rows.shipments[0][12], "https://example.test/bill");
});

for (const fee of [undefined, -1, NaN, Infinity, 1_000_000_001]) {
  test(`invalid delivery fee fails before the M1 write: ${String(fee)}`, async () => {
    const h = fakeShipmentSheets();
    assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status: "delivered", deliveryFee: fee })).outcome, "invalid_delivery_fee");
    assert.deepEqual(h.events, []);
  });
}

test("status validation, missing/deleted rows and header/read/data-write failures keep original side effects", async () => {
  for (const [rows, status, extra, outcome] of [
    [[], "ready_to_ship", {}, "not_found"], [[shipmentRow({ deletedAt: "deleted" })], "ready_to_ship", {}, "not_found"],
    [[shipmentRow()], "shipping", { poNumber: "PO" }, "invalid_transition"],
    [[shipmentRow({ status: "ready_to_ship" })], "shipping", { poNumber: " " }, "invalid_po_number"],
    [[shipmentRow({ status: "ready_to_ship" })], "shipping", { poNumber: "x".repeat(101) }, "invalid_po_number"],
  ]) {
    const h = fakeShipmentSheets({ shipments: rows });
    assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status, ...extra })).outcome, outcome);
    assert.deepEqual(h.events.map(([op, , range]) => [op, range]), [["update", "M1"], ["read", "A2:M"]]);
  }
  const valid = new Set(["draft:ready_to_ship", "ready_to_ship:shipping", "shipping:delivered"]);
  for (const current of ["draft", "ready_to_ship", "shipping", "delivered", "canceled", "invalid"]) {
    for (const status of ["draft", "ready_to_ship", "shipping", "delivered", "canceled"]) {
      if (valid.has(`${current}:${status}`)) continue;
      const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: current })] });
      assert.equal((await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status, poNumber: "PO", deliveryFee: 0 })).outcome, "invalid_transition");
      assert.equal(h.events.length, 2, `${current} -> ${status}`);
    }
  }
  for (const [options, count] of [[{ failUpdate: "M1" }, 1], [{ failRead: "shipments" }, 2], [{ failUpdate: "B2:M2" }, 3]]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow()] }, options);
    await assert.rejects(services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status: "ready_to_ship" }), /synthetic/);
    assert.equal(h.events.length, count);
  }
});

test("deleted shipment/order existence, all link read failures and malformed links retain check order", async () => {
  for (const [rows, code] of [
    [{ shipments: [shipmentRow({ deletedAt: "deleted" })], orders: [] }, "shipment_not_found"],
    [{ shipments: [shipmentRow()], orders: [["o/1", "complete", "", "", "", "", "", "deleted"]] }, "order_not_found"],
  ]) {
    const h = fakeShipmentSheets(rows);
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" }), e => e.code === code);
    assert.equal(h.events.length, 3);
  }
  for (const failRead of ["shipments", "orders", "shipmentOrders"]) {
    const h = fakeShipmentSheets({}, { failRead });
    await assert.rejects(services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" }), /read failure/);
    assert.equal(h.events.length, 3);
  }
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })], orders: [["o/1"]], shipmentOrders: [[], ["missing-shipment", "", "o/1"], ["deleted", "other", "o/1", "", "", "deleted"]] });
  assert.equal((await services.linkOrderToShipment({ googleSheetsService: h.sheets, shipmentId: "s/1", orderId: "o/1", createdBy: "web" })).created, true);
  assert.equal(h.events.filter(([op]) => op === "append").length, 1);
});

test("quantity absence/negative/infinite values and missing totals remain nullable, never rounded", async () => {
  for (const quantity of ["-1", "Infinity", undefined]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ shippingFee: 0 })], orders: [["o", "complete", "seller", 1]], shipmentOrders: [["l", "s/1", "o"]], orderItems: [["i", "o", "url", quantity, quantity]] });
    assert.deepEqual(plain((await services.listShipments({ googleSheetsService: h.sheets }))[0].costSummary), { totalOrderPrice: 1, shippingFee: 0, quote: null, delivered: null });
  }
  const noImages = fakeShipmentSheets({ shipments: [shipmentRow({ shippingFee: 1 })], orders: [["o", "complete", "seller", 0]], shipmentOrders: [["l", "s/1", "o"]] });
  assert.deepEqual(plain((await services.listShipments({ googleSheetsService: noImages.sheets }))[0].costSummary), { totalOrderPrice: 0, shippingFee: 1, quote: null, delivered: null });
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ shippingFee: 1 })], orders: [["o", "complete"]], shipmentOrders: [["l", "s/1", "o"]] });
  assert.equal((await services.listShipments({ googleSheetsService: h.sheets }))[0].costSummary, null);
});

test("status write preserves exact raw columns, parsed fees, upper bound and omitted bill clearing", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship", carrier: " C ", remark: " R ", shippingFee: "1,234.5", shippingBillUrl: "old" })] });
  const shipping = await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status: "shipping", poNumber: " CONFIRMED " });
  assert.deepEqual(plain(shipping), { outcome: "updated", shipment: { status: "shipping", poNumber: "CONFIRMED", shippingFee: 1234.5, shippedAt: SHIPMENT_TIME, deliveredAt: "", updatedAt: SHIPMENT_TIME, shippingBillUrl: "" } });
  const original = shipmentRow();
  assert.deepEqual(h.events[2], ["update", "shipments", "B2:M2", [["shipping", " C ", "CONFIRMED", 1234.5, " R ", SHIPMENT_TIME, "", original[8], SHIPMENT_TIME, "", original[11], ""]]]);
  const delivered = await services.updateShipmentStatus({ googleSheetsService: h.sheets, shipmentId: "s/1", status: "delivered", deliveryFee: 1_000_000_000 });
  assert.equal(delivered.shipment.shippingFee, 1_000_000_000);
  const invalid = fakeShipmentSheets({ shipments: [shipmentRow({ shippingFee: "invalid" })] });
  assert.equal((await services.updateShipmentStatus({ googleSheetsService: invalid.sheets, shipmentId: "s/1", status: "ready_to_ship" })).shipment.shippingFee, null);
});
