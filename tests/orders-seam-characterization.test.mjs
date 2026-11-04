import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ordersServer } from "./helpers/orders-server.mjs";
import { plain, loadSource } from "./helpers/load-source.mjs";
import { deferred, flush } from "./helpers/component-harness.mjs";

const FIXED = "2026-11-04T00:00:00.000Z";
function clock(events = []) {
  return class extends Date {
    constructor(...args) { super(...(args.length ? args : [FIXED])); if (!args.length) events.push("clock"); }
    static now() { return Date.parse(FIXED); }
  };
}
const fixture = JSON.parse(readFileSync(new URL("./fixtures/orders-read-model.json", import.meta.url), "utf8"));
const cases = JSON.parse(readFileSync(new URL("./fixtures/orders-seam-list.json", import.meta.url), "utf8"));

for (const { name, rows, expected } of cases) {
  test(`legacy list parity: ${name}`, async () => {
    const calls = [];
    const service = Object.fromEntries(Object.entries(rows).map(([sheet, data]) => [sheet, { readRows: async (...args) => { calls.push([sheet, ...args]); return data; } }]));
    const { listOrders } = ordersServer()("src/services/orders/listOrders.ts");
    assert.deepEqual(plain(await listOrders({ googleSheetsService: service })), expected);
    assert.deepEqual(calls, [["orders", "A:I"], ["orderItems"], ["shipmentOrders"]]);
  });
}

test("list reads start concurrently; failures propagate unchanged without retries", async () => {
  const calls = [], pending = [deferred(), deferred(), deferred()];
  const service = Object.fromEntries(["orders", "orderItems", "shipmentOrders"].map((name, index) => [name, { readRows: (...args) => { calls.push([name, ...args]); return pending[index].promise; } }]));
  const { listOrders } = ordersServer()("src/services/orders/listOrders.ts");
  const result = listOrders({ googleSheetsService: service });
  assert.equal(calls.length, 3);
  const failure = new Error("synthetic read failure");
  pending[1].reject(failure); pending[0].resolve([]); pending[2].resolve([]);
  await assert.rejects(result, (error) => error === failure);
  assert.equal(calls.length, 3);
});

test("malformed iterable rows retain their existing failure instead of being repaired", async () => {
  const service = { orders: { readRows: async () => [null] }, orderItems: { readRows: async () => [] }, shipmentOrders: { readRows: async () => [] } };
  const { listOrders } = ordersServer()("src/services/orders/listOrders.ts");
  await assert.rejects(listOrders({ googleSheetsService: service }), /iterable/);
});

for (const input of [
  { id: " provided ", totalPrice: 0, seller: " Seller ", remark: " note " },
  { id: "   ", totalPrice: null },
  {},
  { totalPrice: 1234.5, seller: "  ", remark: "  " },
]) {
  test(`legacy create parity: ${JSON.stringify(input)}`, async () => {
    const events = [], writes = [];
    const { createOrder } = ordersServer({ globals: { Date: clock(events) }, createId: () => { events.push("id"); return "generated"; } })("src/services/orders/createOrder.ts");
    const result = await createOrder({ ...input, createdBy: " web ", googleSheetsService: { orders: { appendRows: async (...args) => { events.push("append"); writes.push(plain(args)); } } } });
    const id = input.id?.trim() || "generated", price = input.totalPrice ?? null, status = price === null ? "waiting_for_total_price" : "complete";
    assert.deepEqual(plain(result), { id, status, seller: input.seller?.trim() || "", totalPrice: price, remark: input.remark?.trim() || "", createdAt: FIXED, updatedAt: FIXED, deletedAt: "", createdBy: " web " });
    assert.deepEqual(writes, [["A:I", [[id, status, result.seller, price, result.remark, FIXED, FIXED, "", " web "]]]]);
    assert.deepEqual(events, input.id?.trim() ? ["clock", "append"] : ["clock", "id", "append"]);
  });
}

test("create returns only after one append; rejection is not a success or retried write", async () => {
  const pending = deferred(), writes = [];
  const { createOrder } = ordersServer()("src/services/orders/createOrder.ts");
  let settled = false;
  const result = createOrder({ createdBy: "web", googleSheetsService: { orders: { appendRows: (...args) => { writes.push(args); return pending.promise; } } } });
  void result.then(() => { settled = true; }, () => { settled = true; });
  await flush(); assert.equal(settled, false); assert.equal(writes.length, 1);
  const failure = new Error("synthetic append failure"); pending.reject(failure);
  await assert.rejects(result, (error) => error === failure); assert.equal(writes.length, 1);
});

function imageWorkflow(failAt) {
  const events = [], failure = new Error(`synthetic ${failAt}`);
  const load = ordersServer({ globals: { Date: clock(), console: { error() {} } } });
  const { createOrderWithImages } = load("src/services/orders/createOrderWithImages.ts");
  let uploads = 0;
  const drive = {
    uploadImage: async () => { const id = ++uploads; events.push(`upload-${id}`); if (failAt === `upload-${id}`) throw failure; return { id: `file-${id}`, webViewLink: `https://example.test/${id}` }; },
    deleteFile: async (id) => { events.push(`delete-${id}`); },
  };
  const sheets = Object.fromEntries(["orders", "orderBills", "orderItems"].map((name) => [name, {
    readRows: async (range) => { events.push(`read-${name}-${range}`); return []; },
    appendRows: async () => { events.push(`write-${name}`); if (failAt === name) throw failure; },
  }]));
  const run = () => createOrderWithImages({ googleDriveService: drive, googleSheetsService: sheets, images: [{ imageType: "bill", contentType: "image/png", bytes: Buffer.from("fake") }, { imageType: "product", contentType: "image/png", bytes: Buffer.from("fake") }], createdBy: "web" });
  return { events, failure, run };
}

test("image creation retains upload → order append → bill/item reference order", async () => {
  const h = imageWorkflow(); const result = await h.run();
  assert.equal(result.id, "synthetic-order-id");
  assert.deepEqual(h.events, ["upload-1", "upload-2", "write-orders", "read-orderBills-A:A", "write-orderBills", "read-orderItems-A:A", "write-orderItems"]);
});

for (const [failAt, expected] of [
  ["upload-2", ["upload-1", "upload-2", "delete-file-1"]],
  ["orders", ["upload-1", "upload-2", "write-orders"]],
  ["orderItems", ["upload-1", "upload-2", "write-orders", "read-orderBills-A:A", "write-orderBills", "read-orderItems-A:A", "write-orderItems"]],
]) {
  test(`image creation preserves cleanup/partial writes on ${failAt} failure`, async () => {
    const h = imageWorkflow(failAt); await assert.rejects(h.run(), (error) => error === h.failure);
    assert.deepEqual(h.events, expected);
  });
}

test("collection route retains GET/POST payloads, web creator and 400/500 failures", async () => {
  let fail = false, createdBy;
  const load = ordersServer(); const legacy = { ...load("src/services/orders/listOrders.ts"), ...load("src/services/orders/createOrder.ts") };
  const sheets = Object.fromEntries(Object.entries(fixture.rows).map(([name, rows]) => [name, { readRows: async () => { if (fail) throw new Error("read"); return rows; }, appendRows: async () => { if (fail) throw new Error("write"); } }]));
  const route = loadSource("src/app/api/orders/route.ts", { imports: {
    "next/server": { NextResponse: Response }, "@/config": { getConfig: () => ({}) },
    "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: () => sheets },
    "@/services/orders": { ...legacy, createOrder: (input) => { createdBy = input.createdBy; return legacy.createOrder(input); } },
  }, globals: { console: { error() {} } } });
  const list = await route.GET(); assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { orders: fixture.expectedList, total: fixture.expectedList.length });
  const post = (body) => route.POST(new Request("https://example.test/api/orders", { method: "POST", body: JSON.stringify(body) }));
  const created = await post({ seller: " Seller ", totalPrice: 0 }); assert.equal(created.status, 201); assert.equal(createdBy, "web"); assert.equal((await created.json()).order.status, "complete");
  const invalid = await post({ totalPrice: -1 }); assert.equal(invalid.status, 400); assert.deepEqual(await invalid.json(), { error: "Enter valid order details." });
  fail = true;
  const failedRead = await route.GET(); assert.equal(failedRead.status, 500); assert.deepEqual(await failedRead.json(), { error: "Failed to load orders." });
  const failedWrite = await post({}); assert.equal(failedWrite.status, 500); assert.deepEqual(await failedWrite.json(), { error: "Failed to create order." });
});
