import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { driveRoute, shippingBillRequest, requestBody } from "./helpers/shipments-drive.mjs";
import { shipmentParams, shipmentRow, ShipmentClock } from "./helpers/shipments.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
const before = JSON.parse(readFileSync("tests/fixtures/shipments-drive-before.json", "utf8"));

test("original bill workflow: golden JSON/multipart responses, factories, Sheets traces and cleanup/error logs", async () => {
  for (const example of before.examples) {
    const scenario = example.scenario, options = scenario === "not_found" ? { rows: [] } : ["invalid_transition", "delete"].includes(scenario) ? { rows: [shipmentRow({ status: "draft" })], fail: scenario === "delete" ? "delete" : undefined } : { fail: scenario };
    const h = driveRoute(options), response = await h.route.PATCH(scenario === "json" ? requestBody({ status: "shipping", poNumber: " PO " }) : shippingBillRequest(), shipmentParams(" s/1 "));
    assert.equal(response.status, example.status); assert.deepEqual(await response.json(), example.json); assert.deepEqual(h.trace, example.trace); assert.deepEqual(h.errors, example.errors);
  }
});

test("original bill workflow: every early JSON validation rejects before configuration or provider construction", async () => {
  for (const [id, body, message] of [
    [" ", { status: "shipping", poNumber: "PO" }, "Shipment ID and a valid next status are required."],
    ["s", null, "Shipment ID and a valid next status are required."], ["s", [], "Shipment ID and a valid next status are required."],
    ["s", { status: "draft" }, "Shipment ID and a valid next status are required."],
    ["s", { status: "shipping", poNumber: " " }, "PO number confirmation is required."], ["s", { status: "shipping", poNumber: "x".repeat(101) }, "PO number confirmation is required."],
    ["s", { status: "shipping", poNumber: "PO", shippingBill: {} }, "Select a PDF, JPEG, PNG, or WebP file up to 10 MB."],
    ...[undefined, null, "10", -1, 1_000_000_001].map(deliveryFee => ["s", { status: "delivered", deliveryFee }, "Delivery fee must be a non-negative number."]),
  ]) {
    const h = driveRoute(), r = await h.route.PATCH(requestBody(body), shipmentParams(id)); assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: message }); assert.deepEqual(h.trace, []);
  }
  for (const request of [new Request("https://example.test", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{" }), { headers: new Headers({ "Content-Type": "multipart/form-data" }), formData: async () => { throw new Error("malformed multipart"); } }]) {
    const h = driveRoute(), r = await h.route.PATCH(request, shipmentParams()); assert.equal(r.status, 400); assert.deepEqual(h.trace, []);
  }
});

test("original bill workflow: no-file and ignored non-Shipping files never evaluate Drive; unavailable Drive precedes clocks/bytes/status", async () => {
  for (const [status, current, extra] of [["ready_to_ship", "draft", {}], ["shipping", "ready_to_ship", { poNumber: "PO" }], ["delivered", "shipping", { deliveryFee: 0 }], ["delivered", "shipping", { deliveryFee: 1_000_000_000 }]]) {
    const h = driveRoute({ rows: [shipmentRow({ status: current })], driveFactory: () => assert.fail("Unnecessary Drive factory") });
    const response = await h.route.PATCH(requestBody({ status, ...extra, ...(status !== "shipping" ? { shippingBill: { ignored: true } } : {}) }), shipmentParams());
    assert.equal(response.status, 200); assert.deepEqual(h.trace.map(e => e[0]), ["config", "sheets", "write", "read", "write"]);
  }
  class Clock extends ShipmentClock { static now() { assert.fail("Filename clock before available Drive"); } }
  const file = new File(["fake"], "bill.pdf", { type: "application/pdf" }); file.arrayBuffer = () => assert.fail("Bytes before available Drive");
  const h = driveRoute({ fail: "unavailable", globals: { Date: Clock } }), r = await h.route.PATCH(requestBody({ status: "shipping", poNumber: "PO", shippingBill: file }), shipmentParams());
  assert.equal(r.status, 503); assert.deepEqual(h.trace, [["config"], ["sheets"], ["drive"]]);
});

test("original bill workflow: exact MIME/size rules including maximum acceptance, zero-byte omission and non-Shipping multipart", async () => {
  for (const [type, size, expected] of [["image/gif", 1, 400], ["application/pdf", 10 * 1024 * 1024 + 1, 400], ["application/pdf", 10 * 1024 * 1024, 200], ["image/gif", 0, 200]]) {
    const h = driveRoute(), r = await h.route.PATCH(shippingBillRequest({ type, size }), shipmentParams()); assert.equal(r.status, expected);
    assert.equal(h.trace.some(e => e[0] === "drive"), expected === 200 && size > 0);
  }
  const h = driveRoute({ rows: [shipmentRow()] }), r = await h.route.PATCH(shippingBillRequest({ status: "ready_to_ship", type: "image/gif" }), shipmentParams()); assert.equal(r.status, 200); assert.ok(!h.trace.some(e => e[0] === "drive"));
});

test("original bill workflow: original filename/extensions, one clock and filename/type/bytes/upload/id/url/status evaluation order", async () => {
  for (const [type, extension] of [["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]) {
    const trace = [], file = new File(["abc"], "ignored", { type });
    Object.defineProperty(file, "type", { get() { trace.push("type"); return type; } }); file.arrayBuffer = async () => { trace.push("bytes"); return new Uint8Array([1, 2, 3]).buffer; };
    class Clock extends ShipmentClock { static now() { trace.push("filename-clock"); return 123; } }
    const h = driveRoute({ globals: { Date: Clock }, driveFactory: () => { trace.push("drive"); return { uploadImage: async payload => { trace.push("upload"); assert.equal(payload.fileName, `shipment-bill-s__id-123${extension}`); assert.equal(payload.contentType, type); assert.ok(Buffer.isBuffer(payload.bytes)); assert.deepEqual([...payload.bytes], [1, 2, 3]); return { get id() { trace.push("id"); return "f"; }, get webViewLink() { trace.push("url"); return "url"; } }; }, deleteFile: () => assert.fail("Unexpected delete") }; }, updateStatus: async input => { trace.push("status"); assert.equal(input.shippingBillUrl, "url"); return { outcome: "updated", shipment: {} }; } });
    assert.equal((await h.route.PATCH(requestBody({ status: "shipping", poNumber: "PO", shippingBill: file }), shipmentParams(" s /id "))).status, 200);
    const tail = trace.slice(trace.indexOf("drive")); assert.equal(tail.filter(e => e === "filename-clock").length, 1);
    assert.ok(tail.indexOf("filename-clock") < tail.indexOf("bytes")); assert.deepEqual(tail.slice(-5), ["bytes", "upload", "id", "url", "status"]);
    assert.equal(tail.filter(e => e === "type").length, type === "application/pdf" ? 2 : type === "image/png" ? 3 : 4);
  }
});

test("original bill workflow: upload result id then URL getters determine exact cleanup eligibility and unusual URL behavior", async () => {
  for (const scenario of ["reject", "id-throws", "url-throws", "empty-id", "zero-id", "undefined-file", "missing-url", "numeric-url"]) {
    const trace = [], error = new Error(scenario);
    const h = driveRoute({ drive: {
      uploadImage: async () => { trace.push("upload"); if (scenario === "reject") throw error; if (scenario === "undefined-file") return undefined; return {
        get id() { trace.push("id"); if (scenario === "id-throws") throw error; return scenario === "empty-id" ? "" : scenario === "zero-id" ? 0 : "f"; },
        get webViewLink() { trace.push("url"); if (["url-throws", "empty-id", "zero-id"].includes(scenario)) throw error; return scenario === "missing-url" ? undefined : 42; },
      }; }, deleteFile: async id => trace.push(`delete:${id}`),
    } });
    const r = await h.route.PATCH(shippingBillRequest(), shipmentParams()); assert.equal(r.status, scenario === "missing-url" ? 200 : 500);
    const cleanup = ["url-throws", "numeric-url"].includes(scenario); assert.equal(trace.includes("delete:f"), cleanup);
    assert.equal(trace.filter(e => e.startsWith("delete:")).length, cleanup ? 1 : 0);
    if (trace.includes("url")) assert.ok(trace.indexOf("id") < trace.indexOf("url"));
    if (scenario === "missing-url") assert.equal((await r.json()).shipment.shippingBillUrl, "");
  }
});

test("original bill workflow: read/Buffer failures prevent upload and status, preserving original error logging", async () => {
  for (const phase of ["bytes", "buffer"]) {
    const trace = [], error = new Error(phase), file = new File(["x"], "bill", { type: "application/pdf" });
    file.arrayBuffer = async () => { trace.push("bytes"); if (phase === "bytes") throw error; return new ArrayBuffer(1); };
    const h = driveRoute({ globals: { Buffer: { from: () => { trace.push("buffer"); throw error; } } }, drive: { uploadImage: () => assert.fail("Upload after conversion failure"), deleteFile: () => assert.fail("No assigned ID") } });
    const r = await h.route.PATCH(requestBody({ status: "shipping", poNumber: "PO", shippingBill: file }), shipmentParams()); assert.equal(r.status, 500); assert.deepEqual(trace, phase === "bytes" ? ["bytes"] : ["bytes", "buffer"]); assert.equal(h.trace.length, 3); assert.equal(h.errors[0][1].error, phase);
  }
});

test("original bill workflow: awaits upload before status and cleanup before response, no duplicate requests", async () => {
  const upload = deferred(), cleanup = deferred(), trace = [];
  const h = driveRoute({ drive: { uploadImage: async () => { trace.push("upload"); return upload.promise; }, deleteFile: async id => { trace.push(`delete:${id}`); await cleanup.promise; } }, updateStatus: async () => { trace.push("status"); return { outcome: "not_found" }; } });
  let done = false; const pending = h.route.PATCH(requestBody({ status: "shipping", poNumber: "PO", shippingBill: new File(["x"], "bill", { type: "application/pdf" }) }), shipmentParams()); pending.then(() => { done = true; }); await flush(); assert.deepEqual(trace, ["upload"]); assert.equal(done, false);
  upload.resolve({ id: "f", webViewLink: "url" }); await flush(); assert.deepEqual(trace, ["upload", "status", "delete:f"]); assert.equal(done, false);
  cleanup.resolve(); assert.equal((await pending).status, 404);
});

test("original bill workflow: every nonupdated outcome cleans once, cleanup failures retain original response and log", async () => {
  for (const [outcome, status] of [["not_found", 404], ["invalid_transition", 409], ["invalid_delivery_fee", 400], ["invalid_po_number", 400], ["throw", 500]]) {
    const trace = [], h = driveRoute({ drive: { uploadImage: async () => ({ id: "f", webViewLink: "url" }), deleteFile: async id => { trace.push(id); throw new Error("cleanup"); } }, updateStatus: async () => { if (outcome === "throw") throw new Error("status error"); return { outcome }; } });
    assert.equal((await h.route.PATCH(shippingBillRequest(), shipmentParams())).status, status); assert.deepEqual(trace, ["f"]); assert.equal(h.errors[0][0], "Failed to clean up shipment bill upload"); assert.equal(h.errors.length, outcome === "throw" ? 2 : 1);
  }
});

test("original bill workflow: errors during response translation still clean an uploaded successful file", async () => {
  const trace = [], error = new Error("response translation"), h = driveRoute({ drive: { uploadImage: async () => ({ id: "f", webViewLink: "url" }), deleteFile: async id => trace.push(id) }, updateStatus: async () => ({ outcome: "updated", get shipment() { throw error; } }) });
  const r = await h.route.PATCH(shippingBillRequest(), shipmentParams()); assert.equal(r.status, 500); assert.deepEqual(trace, ["f"]); assert.equal(h.errors[0][1].error, error.message);
});
