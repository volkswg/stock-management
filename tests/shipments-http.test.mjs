import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shipmentRoutes, fakeShipmentSheets, shipmentRow, shipmentParams, jsonRequest, ShipmentClock, SHIPMENT_TIME } from "./helpers/shipments.mjs";
import { loadSource } from "./helpers/load-source.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/shipments-read.json", import.meta.url), "utf8"));
async function response(result, status, body) { assert.equal(result.status, status); assert.deepEqual(await result.json(), body); }

test("collection GET preserves wrappers, query filtering, includeOrders flag, invalid statuses and read failures", async () => {
  const h = fakeShipmentSheets(fixture.rows), routes = shipmentRoutes(h.sheets);
  await response(await routes.collection.GET(new Request("https://example.test/api/shipments")), 200, { shipments: fixture.expected, total: fixture.expected.length });
  h.events.length = 0;
  const filtered = await routes.collection.GET(new Request("https://example.test/api/shipments?includeOrders=false&excludeStatuses=delivered,delivered,canceled"));
  const data = await filtered.json(); assert.equal(filtered.status, 200);
  assert.ok(data.shipments.every((s) => s.orders.length === 0 && s.costSummary === null && !["delivered", "canceled"].includes(s.status)));
  assert.equal(data.total, data.shipments.length); assert.deepEqual(h.events, [["read", "shipments"]]);
  await response(await routes.collection.GET(new Request("https://example.test/api/shipments?excludeStatuses=wrong")), 400, { error: "excludeStatuses contains an invalid shipment status." });
  const broken = shipmentRoutes(fakeShipmentSheets({}, { failRead: "shipments" }).sheets);
  await response(await broken.collection.GET(new Request("https://example.test/")), 500, { error: "Failed to load shipments." });
});

test("collection POST preserves validation text, normalized draft record, web actor and A:M append", async () => {
  const h = fakeShipmentSheets(), { collection } = shipmentRoutes(h.sheets);
  for (const body of [{}, { poNumber: " " }, { poNumber: "x".repeat(101) }, { poNumber: "PO", carrier: 1 }, { poNumber: "PO", carrier: "x".repeat(101) }, []]) {
    await response(await collection.POST(jsonRequest(body)), 400, { error: "PO number is required and carrier must be text." });
  }
  await response(await collection.POST(new Request("https://example.test/", { method: "POST", body: "{" })), 400, { error: "Request body must be valid JSON." });
  const result = await collection.POST(jsonRequest({ poNumber: " PO ", carrier: " Carrier " })); assert.equal(result.status, 201);
  const record = (await result.json()).shipment;
  assert.deepEqual(record, { id: "synthetic-shipment-id", status: "draft", poNumber: "PO", carrier: "Carrier", shippingFee: null, remark: "", shippedAt: "", deliveredAt: "", createdAt: SHIPMENT_TIME, updatedAt: SHIPMENT_TIME, deletedAt: "", createdBy: "web", shippingBillUrl: "" });
  assert.deepEqual(h.events, [["append", "shipments", "A:M", [[record.id, "draft", "Carrier", "PO", null, "", "", "", SHIPMENT_TIME, SHIPMENT_TIME, "", "web", ""]]]]);
  const broken = shipmentRoutes(fakeShipmentSheets({}, { failAppend: "shipments" }).sheets);
  await response(await broken.collection.POST(jsonRequest({ poNumber: "PO" })), 500, { error: "Failed to create shipment." });
});

test("detail GET retains decoded IDs, 200/400/404/500 wrappers and exact errors", async () => {
  const routes = shipmentRoutes(fakeShipmentSheets(fixture.rows).sheets);
  await response(await routes.detail.GET(undefined, shipmentParams(" s/1 ")), 200, { shipment: fixture.expected.find((s) => s.id === "s/1") });
  await response(await routes.detail.GET(undefined, shipmentParams(" ")), 400, { error: "Shipment ID is required." });
  await response(await routes.detail.GET(undefined, shipmentParams("unknown")), 404, { error: "Shipment was not found." });
  const broken = shipmentRoutes(fakeShipmentSheets({}, { failRead: "orders" }).sheets);
  await response(await broken.detail.GET(undefined, shipmentParams()), 500, { error: "Failed to load shipment." });
});

test("link route returns 201 then 200 without duplicate writes, and preserves ID validation/500", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow()], orders: [["o/1", "complete"]] });
  const routes = shipmentRoutes(h.sheets);
  const first = await routes.links.POST(jsonRequest({ orderId: " o/1 " }), shipmentParams()); assert.equal(first.status, 201);
  const data = await first.json(); assert.equal(data.created, true); assert.equal(data.shipmentOrder.createdBy, "web");
  await response(await routes.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams()), 200, { ...data, created: false });
  assert.equal(h.events.filter(([op]) => op === "append").length, 1);
  for (const body of [{}, { orderId: " " }, { orderId: "x".repeat(101) }, { orderId: 1 }]) await response(await routes.links.POST(jsonRequest(body), shipmentParams()), 400, { error: "Shipment ID and order ID are required." });
  await response(await routes.links.POST(new Request("https://example.test/", { method: "POST", body: "{" }), shipmentParams()), 400, { error: "Shipment ID and order ID are required." });
  await response(await routes.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams(" ")), 400, { error: "Shipment ID and order ID are required." });
  const broken = shipmentRoutes(fakeShipmentSheets({ shipments: [shipmentRow()], orders: [["o/1", "complete"]] }, { failAppend: "shipmentOrders" }).sheets);
  await response(await broken.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams()), 500, { error: "Failed to link order to shipment." });
});

for (const [rows, status, message] of [
  [{}, 404, "Shipment not found."],
  [{ shipments: [shipmentRow()] }, 404, "Order not found."],
  [{ shipments: [shipmentRow()], orders: [["o/1", "complete"]], shipmentOrders: [["link", "other", "o/1"]] }, 409, "Order is already linked to another shipment."],
  [{ shipments: [shipmentRow({ status: "shipping" })], orders: [["o/1", "complete"]] }, 409, "Orders can only be linked to draft or ready-to-ship shipments."],
]) test(`link HTTP mapping: ${message}`, async () => {
  const routes = shipmentRoutes(fakeShipmentSheets(rows).sheets);
  await response(await routes.links.POST(jsonRequest({ orderId: "o/1" }), shipmentParams()), status, { error: message });
});

test("JSON PATCH preserves success, validation/outcome errors and the existing header write", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow()] }), routes = shipmentRoutes(h.sheets);
  const success = await routes.detail.PATCH(jsonRequest({ status: "ready_to_ship" }, "PATCH"), shipmentParams());
  await response(success, 200, { shipment: { status: "ready_to_ship", poNumber: "PO-1", shippingFee: null, shippedAt: "", deliveredAt: "", updatedAt: SHIPMENT_TIME, shippingBillUrl: "" } });
  assert.deepEqual(h.events[0], ["update", "shipments", "M1", [["shippingBillUrl"]]]);
  for (const [body, error] of [
    [{ status: "draft" }, "Shipment ID and a valid next status are required."],
    [{ status: "delivered", deliveryFee: -1 }, "Delivery fee must be a non-negative number."],
    [{ status: "delivered", deliveryFee: 1_000_000_001 }, "Delivery fee must be a non-negative number."],
    [{ status: "shipping" }, "PO number confirmation is required."],
    [{ status: "shipping", poNumber: "PO", shippingBill: {} }, "Select a PDF, JPEG, PNG, or WebP file up to 10 MB."],
  ]) await response(await routes.detail.PATCH(jsonRequest(body, "PATCH"), shipmentParams()), 400, { error });
  const missing = shipmentRoutes(fakeShipmentSheets().sheets);
  await response(await missing.detail.PATCH(jsonRequest({ status: "ready_to_ship" }, "PATCH"), shipmentParams()), 404, { error: "Shipment was not found." });
  const conflict = shipmentRoutes(fakeShipmentSheets({ shipments: [shipmentRow()] }).sheets);
  await response(await conflict.detail.PATCH(jsonRequest({ status: "shipping", poNumber: "PO" }, "PATCH"), shipmentParams()), 409, { error: "Shipment status has changed or cannot be advanced." });
  for (const options of [{ failUpdate: "M1" }, { failRead: "shipments" }, { failUpdate: "B2:M2" }]) {
    const failed = shipmentRoutes(fakeShipmentSheets({ shipments: [shipmentRow()] }, options).sheets);
    await response(await failed.detail.PATCH(jsonRequest({ status: "ready_to_ship" }, "PATCH"), shipmentParams()), 500, { error: "Failed to update shipment status." });
  }
});

function billRequest(type = "application/pdf", size = 4, status = "shipping") {
  const data = new FormData(); data.set("status", status); data.set("poNumber", " PO-CONFIRMED ");
  data.set("shippingBill", new File([new Uint8Array(size)], "original-name-is-not-used.pdf", { type }));
  return new Request("https://example.test/shipment", { method: "PATCH", body: data });
}
for (const [type, extension] of [["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]) {
  test(`shipping bill accepts ${type}, sanitizes ID and uploads before worksheet operations`, async () => {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] }), uploaded = [], trace = [];
    const original = h.sheets.shipments.updateRows;
    h.sheets.shipments.updateRows = (...args) => { trace.push(args[0]); return original(...args); };
    const routes = shipmentRoutes(h.sheets, { drive: { uploadImage: async (input) => { trace.push("upload"); uploaded.push(input); return { id: "fake-file", webViewLink: "https://example.test/bill" }; }, deleteFile: async () => assert.fail("Successful update must not clean up") } });
    const result = await routes.detail.PATCH(billRequest(type), shipmentParams()); assert.equal(result.status, 200);
    assert.equal(uploaded[0].fileName, `shipment-bill-s_1-${ShipmentClock.now()}${extension}`);
    assert.equal(uploaded[0].contentType, type); assert.equal(uploaded[0].bytes.length, 4);
    assert.deepEqual(trace, ["upload", "M1", "B2:M2"]);
    assert.equal((await result.json()).shipment.shippingBillUrl, "https://example.test/bill");
  });
}

test("shipping bill size/type limits, empty-file omission, JSON without a file and missing Drive keep existing behavior", async () => {
  for (const [type, size] of [["image/gif", 1], ["application/pdf", 10 * 1024 * 1024 + 1]]) {
    const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] });
    const routes = shipmentRoutes(h.sheets);
    await response(await routes.detail.PATCH(billRequest(type, size), shipmentParams()), 400, { error: "Select a PDF, JPEG, PNG, or WebP file up to 10 MB." });
    assert.deepEqual(h.events, []);
  }
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] }), routes = shipmentRoutes(h.sheets);
  await response(await routes.detail.PATCH(billRequest(), shipmentParams()), 503, { error: "Google Drive is not configured." });
  assert.deepEqual(h.events, []); assert.deepEqual(routes.events, ["sheets", "drive"]);
  const empty = await routes.detail.PATCH(billRequest("image/gif", 0), shipmentParams()); assert.equal(empty.status, 200); // Empty multipart files are ignored, not rejected.
  const noFile = shipmentRoutes(fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship", shippingBillUrl: "old" })] }).sheets);
  const json = await noFile.detail.PATCH(jsonRequest({ status: "shipping", poNumber: "PO" }, "PATCH"), shipmentParams()); assert.equal(json.status, 200); assert.equal((await json.json()).shipment.shippingBillUrl, "");
});

for (const [outcome, status, message] of [
  ["not_found", 404, "Shipment was not found."], ["invalid_transition", 409, "Shipment status has changed or cannot be advanced."],
  ["invalid_delivery_fee", 400, "Delivery fee must be a non-negative number."], ["invalid_po_number", 400, "Enter a valid PO number before starting shipping."],
  ["throw", 500, "Failed to update shipment status."],
]) test(`uploaded bill cleanup preserves outcome/error response: ${outcome}`, async () => {
  const events = [];
  const routes = shipmentRoutes(fakeShipmentSheets().sheets, {
    drive: { uploadImage: async () => { events.push("upload"); return { id: "fake-file", webViewLink: "url" }; }, deleteFile: async (id) => { events.push(`delete-${id}`); throw new Error("synthetic cleanup failure"); } },
    services: { updateShipmentStatus: async () => { events.push("update"); if (outcome === "throw") throw new Error("synthetic update failure"); return { outcome }; } },
  });
  await response(await routes.detail.PATCH(billRequest(), shipmentParams()), status, { error: message });
  assert.deepEqual(events, ["upload", "update", "delete-fake-file"]);
  assert.equal(routes.errors[0][0], "Failed to clean up shipment bill upload");
  assert.equal(routes.errors.length, outcome === "throw" ? 2 : 1);
});

test("bill upload provider failures log and return 500 before any worksheet writes", async () => {
  const h = fakeShipmentSheets(), routes = shipmentRoutes(h.sheets, { drive: { uploadImage: async () => { throw new Error("synthetic upload failure"); }, deleteFile: async () => assert.fail("No uploaded ID to delete") } });
  await response(await routes.detail.PATCH(billRequest(), shipmentParams()), 500, { error: "Failed to update shipment status." });
  assert.deepEqual(h.events, []); assert.equal(routes.errors.length, 1);
});

const clients = [
  ["getShipments", [], "The shipments API returned an invalid response."],
  ["getShipment", ["s/1"], "The shipment API returned an invalid response."],
  ["advanceShipmentStatus", ["s/1", { status: "ready_to_ship" }], "The shipment API returned an invalid response."],
  ["createShipmentMaster", [{ poNumber: "PO" }], "The shipment API returned an invalid response."],
  ["linkOrderToShipment", ["s/1", "o/1"], "The shipment link API returned an invalid response."],
];
for (const [name, args, invalid] of clients) test(`browser ${name} preserves API, fallback and invalid-success errors`, async () => {
  for (const [body, status, message] of [[{ error: "synthetic" }, 409, "synthetic"], [{}, 500, "Failed to load shipments."], [{}, 200, invalid]]) {
    const api = loadSource("src/modules/shipments/ui/api.ts", { globals: { FormData, File, fetch: async () => Response.json(body, { status }) } });
    await assert.rejects(api[name](...args), (error) => error.message === message);
  }
});

test("browser client preserves encoded requests, abort/no-store and JSON/multipart field names", async () => {
  const requests = [], bodies = [{ shipments: [], total: 0 }, { shipment: { orders: [] } }, { shipment: { status: "shipping", updatedAt: "now", shippingBillUrl: "url" } }, { shipment: {} }, { shipmentOrder: {}, created: false }];
  const api = loadSource("src/modules/shipments/ui/api.ts", { globals: { FormData, File, fetch: async (url, init) => { requests.push({ url, init }); return Response.json(bodies.shift()); } } });
  const controller = new AbortController();
  await api.getShipments({ includeOrders: false, excludeStatuses: ["delivered", "canceled"], signal: controller.signal });
  await api.getShipment("s/1", { signal: controller.signal });
  await api.advanceShipmentStatus("s/1", { status: "shipping", poNumber: "PO", deliveryFee: 123, shippingBill: new File(["fake"], "bill.pdf", { type: "application/pdf" }) });
  await api.createShipmentMaster({ poNumber: "PO", carrier: "Carrier" }); await api.linkOrderToShipment("s/1", "o/1");
  assert.equal(requests[0].url, "/api/shipments?includeOrders=false&excludeStatuses=delivered%2Ccanceled");
  assert.equal(requests[0].init.signal, controller.signal); assert.equal(requests[0].init.cache, "no-store");
  assert.equal(requests[1].url, "/api/shipments/s%2F1"); assert.equal(requests[1].init.signal, controller.signal);
  assert.equal(requests[2].init.method, "PATCH"); assert.equal(requests[2].init.headers["Content-Type"], undefined);
  assert.equal(requests[2].init.body.get("poNumber"), "PO"); assert.equal(requests[2].init.body.get("deliveryFee"), null);
  assert.deepEqual(JSON.parse(requests[3].init.body), { poNumber: "PO", carrier: "Carrier" });
  assert.equal(requests[4].url, "/api/shipments/s%2F1/orders"); assert.deepEqual(JSON.parse(requests[4].init.body), { orderId: "o/1" });
});

test("successful cleanup on actual storage/outcome failure deletes exactly once without retries", async () => {
  for (const options of [{}, { failUpdate: "B2:M2" }]) {
    const h = fakeShipmentSheets(options.failUpdate ? { shipments: [shipmentRow({ status: "ready_to_ship" })] } : {}, options), trace = [];
    const routes = shipmentRoutes(h.sheets, { drive: { uploadImage: async () => { trace.push("upload"); return { id: "fake", webViewLink: "url" }; }, deleteFile: async id => trace.push(`delete-${id}`) } });
    await response(await routes.detail.PATCH(billRequest(), shipmentParams()), options.failUpdate ? 500 : 404, { error: options.failUpdate ? "Failed to update shipment status." : "Shipment was not found." });
    assert.deepEqual(trace, ["upload", "delete-fake"]);
    assert.equal(routes.errors.length, options.failUpdate ? 1 : 0);
    assert.equal(h.events.filter(([op, , range]) => op === "update" && range === "B2:M2").length, options.failUpdate ? 1 : 0);
  }
});

test("PATCH malformed JSON, missing IDs, long PO and delivery fee types preserve validation errors", async () => {
  const h = fakeShipmentSheets(), routes = shipmentRoutes(h.sheets);
  await response(await routes.detail.PATCH(new Request("https://example.test/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{" }), shipmentParams()), 400, { error: "Shipment ID and a valid next status are required." });
  await response(await routes.detail.PATCH(jsonRequest({ status: "ready_to_ship" }), shipmentParams(" ")), 400, { error: "Shipment ID and a valid next status are required." });
  await response(await routes.detail.PATCH(jsonRequest({ status: "shipping", poNumber: "x".repeat(101) }), shipmentParams()), 400, { error: "PO number confirmation is required." });
  for (const deliveryFee of [undefined, null, "10"]) await response(await routes.detail.PATCH(jsonRequest({ status: "delivered", deliveryFee }), shipmentParams()), 400, { error: "Delivery fee must be a non-negative number." });
  assert.deepEqual(h.events, []);
});

test("exact maximum bill size is accepted, JSON delivery sends zero fee and HTTP errors retain abort identity", async () => {
  const h = fakeShipmentSheets({ shipments: [shipmentRow({ status: "ready_to_ship" })] });
  const routes = shipmentRoutes(h.sheets, { drive: { uploadImage: async input => { assert.equal(input.bytes.length, 10 * 1024 * 1024); return { id: "fake", webViewLink: "url" }; } } });
  assert.equal((await routes.detail.PATCH(billRequest("application/pdf", 10 * 1024 * 1024), shipmentParams())).status, 200);
  assert.equal((await routes.detail.PATCH(jsonRequest({ status: "delivered", deliveryFee: 0 }), shipmentParams())).status, 200);
  const calls = [], api = loadSource("src/modules/shipments/ui/api.ts", { globals: { fetch: async (url, init) => { calls.push({ url, init }); return Response.json({ shipment: { status: "delivered", updatedAt: "now", shippingBillUrl: "url" } }); } } });
  await api.advanceShipmentStatus("s/1", { status: "delivered", deliveryFee: 0 });
  assert.deepEqual(JSON.parse(calls[0].init.body), { status: "delivered", deliveryFee: 0 });
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  const abort = new DOMException("synthetic abort", "AbortError");
  const aborted = loadSource("src/modules/shipments/ui/api.ts", { globals: { fetch: async () => { throw abort; } } });
  await assert.rejects(aborted.getShipments(), error => error === abort);
});
