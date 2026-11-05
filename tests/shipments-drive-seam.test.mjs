import assert from "node:assert/strict";
import test from "node:test";
import { shipmentServices, shipmentParams, shipmentRow } from "./helpers/shipments.mjs";
import { driveRoute, shippingBillRequest, requestBody } from "./helpers/shipments-drive.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";
import { assertShipmentDriveRouteHistory, shipmentDriveBefore as before } from "./helpers/shipments-drive-history.mjs";
const { load } = shipmentServices(), { advanceShipmentStatusWithBill } = load("src/modules/shipments/application/advance-shipment-status-with-bill.ts");

test("pure bill application: no bill delegates once without storage; unavailable upload skips status; successes retain file", async () => {
  const events = [], result = { outcome: "updated", shipment: {} };
  const noBill = await advanceShipmentStatusWithBill({ updateStatus: async url => { events.push(url); return result; } }); assert.equal(noBill.result, result); assert.deepEqual(events, [undefined]);
  const unavailable = await advanceShipmentStatusWithBill({ storage: { upload: async () => ({ outcome: "unavailable" }), cleanup: () => assert.fail("No cleanup on unavailable return") }, updateStatus: () => assert.fail("No status without Drive") }); assert.equal(unavailable.outcome, "drive_unavailable");
  const storage = { upload: async () => ({ outcome: "uploaded", file: { id: "f", webViewLink: " url " } }), cleanup: () => assert.fail("Successful file retained") };
  assert.equal((await advanceShipmentStatusWithBill({ storage, updateStatus: async url => { assert.equal(url, " url "); return result; } })).result, result);
});

test("pure bill application: tracks id before URL access and preserves original exception identity with exact cleanup eligibility", async () => {
  for (const phase of ["upload", "id", "url", "status"]) {
    const error = new Error(phase), events = [], storage = {
      upload: async () => { events.push("upload"); if (phase === "upload") throw error; return { outcome: "uploaded", file: { get id() { events.push("id"); if (phase === "id") throw error; return "f"; }, get webViewLink() { events.push("url"); if (phase === "url") throw error; return "url"; } } }; },
      cleanup: async id => { if (id) events.push(`delete:${id}`); },
    };
    await assert.rejects(advanceShipmentStatusWithBill({ storage, updateStatus: async () => { events.push("status"); throw error; } }), e => e === error);
    assert.deepEqual(events, ["upload", ...(phase === "upload" ? [] : ["id"]), ...(["upload", "id"].includes(phase) ? [] : ["url"]), ...(phase === "status" ? ["status"] : []), ...(["url", "status"].includes(phase) ? ["delete:f"] : [])]);
  }
});

test("pure bill application: all four nonupdated outcomes await one cleanup and clear tracked id before later failures", async () => {
  for (const outcome of ["not_found", "invalid_transition", "invalid_delivery_fee", "invalid_po_number"]) {
    const ids = [], gate = deferred(), result = { outcome }; let done = false;
    const pending = advanceShipmentStatusWithBill({ storage: { upload: async () => ({ outcome: "uploaded", file: { id: "f", webViewLink: "url" } }), cleanup: async id => { if (id) { ids.push(id); await gate.promise; } } }, updateStatus: async () => result }); pending.then(() => { done = true; }); await flush(); assert.equal(done, false); assert.deepEqual(ids, ["f"]);
    gate.resolve(); const workflow = await pending; assert.equal(workflow.result, result); await workflow.cleanupAfterFailure(); assert.deepEqual(ids, ["f"]);
  }
});

test("real Drive adapter is lazy, returns original metadata object without reading getters, and retains original helper declarations", async () => {
  const { GoogleDriveShipmentBillStorage } = load("src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts"); let factories = 0, bytes = 0;
  const file = { get type() { assert.fail("Constructor reads type"); }, arrayBuffer: () => assert.fail("Constructor reads bytes") };
  new GoogleDriveShipmentBillStorage("s", file, () => assert.fail("Constructor invokes factory"));
  const original = { get id() { assert.fail("Adapter eagerly reads metadata"); }, get webViewLink() { assert.fail("Adapter eagerly reads URL"); } };
  const store = new GoogleDriveShipmentBillStorage(" s/id ", { type: "application/pdf", arrayBuffer: async () => { bytes++; return new ArrayBuffer(1); } }, () => { factories++; return { uploadImage: async input => { assert.ok(Buffer.isBuffer(input.bytes)); return original; } }; });
  const result = await store.upload(); assert.equal(result.file, original); assert.equal(factories, 1); assert.equal(bytes, 1);
  assertShipmentDriveRouteHistory(before.file, before.rawHash);
});

test("actual old/new route parity for entire factory/upload/Sheets/cleanup matrix and golden JSON", async () => {
  for (const mode of ["success", "unavailable", "config", "sheets", "drive", "upload", "missing", "conflict", "M1", "A2:M", "B2:M2", "delete"]) {
    const run = async original => {
      const h = driveRoute({ original, rows: mode === "missing" ? [] : [shipmentRow({ status: ["conflict", "delete"].includes(mode) ? "draft" : "ready_to_ship" })], fail: mode });
      const response = await h.route.PATCH(shippingBillRequest(), shipmentParams()); return { status: response.status, json: await response.json(), trace: h.trace, errors: h.errors };
    };
    assert.deepEqual(await run(false), await run(true), mode);
  }
});

test("actual old/new route parity for returned getter failures, falsy IDs, raw URLs and outcome getter ordering", async () => {
  for (const mode of ["id", "url", "empty", "zero", "undefined", "numeric-url", "missing-url", "outcome", "response"]) {
    const run = async original => {
      const events = [], error = new Error(mode), h = driveRoute({ original, drive: {
        uploadImage: async () => { events.push("upload"); if (mode === "undefined") return undefined; return { get id() { events.push("id"); if (mode === "id") throw error; return mode === "empty" ? "" : mode === "zero" ? 0 : "f"; }, get webViewLink() { events.push("url"); if (["url", "empty", "zero"].includes(mode)) throw error; return mode === "numeric-url" ? 42 : mode === "missing-url" ? undefined : " url "; } }; },
        deleteFile: async id => events.push(`delete:${id}`),
      }, ...(["outcome", "response"].includes(mode) ? { updateStatus: async () => ({ get outcome() { events.push("outcome"); if (mode === "outcome") throw error; return "updated"; }, get shipment() { events.push("shipment"); throw error; } }) } : {}) });
      const r = await h.route.PATCH(shippingBillRequest(), shipmentParams()); return { status: r.status, json: await r.json(), trace: h.trace, errors: h.errors, events };
    };
    assert.deepEqual(await run(false), await run(true), mode);
  }
});

test("actual old/new routes retain cleanup on JSON serialization errors after status success and await data writes before 200", async () => {
  const run = async original => {
    const events = [], circular = {}; circular.self = circular;
    const h = driveRoute({ original, updateStatus: async () => ({ outcome: "updated", shipment: circular }), drive: { uploadImage: async () => ({ id: "f", webViewLink: "url" }), deleteFile: async id => events.push(id) } });
    const r = await h.route.PATCH(shippingBillRequest(), shipmentParams()); return { status: r.status, events, errors: h.errors };
  };
  assert.deepEqual(await run(false), await run(true));
  const gate = deferred(), h = driveRoute(), original = h.sheets.shipments.updateRows; let completed = false;
  h.sheets.shipments.updateRows = async (...args) => { if (args[0] !== "M1") await gate.promise; return original(...args); };
  const promise = h.route.PATCH(requestBody({ status: "shipping", poNumber: "PO" }), shipmentParams()); promise.then(() => { completed = true; }); await flush(); assert.equal(completed, false); gate.resolve(); assert.equal((await promise).status, 200);
});

test("explicit server composition leaves existing exports identical and no-file path never creates Drive", async () => {
  const server = load("src/modules/shipments/server.ts"), services = load("src/services/shipments/index.ts");
  for (const name of ["createShipment", "listShipments", "getShipmentDetail", "linkOrderToShipment", "updateShipmentStatus"]) assert.equal(server[name], services[name]);
  const result = await server.advanceShipmentStatusWithBill({ shipmentId: "s", createDriveService: () => assert.fail("No bill"), updateStatus: async url => { assert.equal(url, undefined); return { outcome: "not_found" }; } }); assert.equal(result.result.outcome, "not_found");
});
