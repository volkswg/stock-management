import {readArchive} from "./helpers/retirement-history.mjs";
import {restoreOrdersLineSource} from "./helpers/orders-line-history.mjs";
import { assertOrderDetailHistory } from "./helpers/orders-detail-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ESLint } from "eslint";
import { ordersServer } from "./helpers/orders-server.mjs";
import { loadSource, plain } from "./helpers/load-source.mjs";

const cases = JSON.parse(readArchive(new URL("./fixtures/orders-seam-list.json", import.meta.url), "utf8"));
const load = ordersServer();

test("application list runs with a fake business port and reverses its mapped records", async () => {
  const { listOrders } = load("src/modules/orders/application/list-orders.ts");
  let calls = 0;
  const source = [{ id: "first" }, { id: "last" }];
  assert.deepEqual(await listOrders({ readOrderList: async () => { calls++; return source; } }), [{ id: "last" }, { id: "first" }]);
  assert.equal(calls, 1);
  const failure = new Error("fake port failure");
  await assert.rejects(listOrders({ readOrderList: async () => { throw failure; } }), (error) => error === failure);
});

test("application create needs only a business writer, clock and ID function", async () => {
  const { createOrder } = load("src/modules/orders/application/create-order.ts");
  for (const totalPrice of [undefined, null, 0, 12.5]) {
    const writes = [], events = [];
    const record = await createOrder({ totalPrice, seller: " Seller ", remark: " note ", createdBy: " actor " }, {
      now: () => { events.push("clock"); return "fixed timestamp"; },
      createId: () => { events.push("id"); return "fake-id"; },
      writer: { appendCreatedOrder: async (order) => { events.push("write"); writes.push(order); } },
    });
    assert.equal(record, writes[0]);
    assert.equal(record.createdAt, "fixed timestamp"); assert.equal(record.updatedAt, record.createdAt);
    assert.equal(record.status, totalPrice == null ? "waiting_for_total_price" : "complete");
    assert.equal(record.totalPrice, totalPrice ?? null);
    assert.equal(record.seller, "Seller"); assert.equal(record.remark, "note"); assert.equal(record.createdBy, " actor ");
    assert.deepEqual(events, ["clock", "id", "write"]);
  }
  const failure = new Error("write failure");
  await assert.rejects(createOrder({ id: "fixed", createdBy: "web" }, { now: () => "now", createId: () => assert.fail("ID must not be generated"), writer: { appendCreatedOrder: async () => { throw failure; } } }), (error) => error === failure);
});

for (const { name, rows, expected } of cases) {
  test(`Sheets reader + application match pre-refactor legacy output: ${name}`, async () => {
    const calls = [];
    const sheets = Object.fromEntries(Object.entries(rows).map(([name, data]) => [name, { readRows: async (...args) => { calls.push([name, ...args]); return data; } }]));
    const { GoogleSheetsOrderListReader } = load("src/modules/orders/infrastructure/google-sheets/order-list-reader.ts");
    const { listOrders } = load("src/modules/orders/application/list-orders.ts");
    assert.deepEqual(plain(await listOrders(new GoogleSheetsOrderListReader(sheets))), expected);
    assert.deepEqual(calls, [["orders", "A:I"], ["orderItems"], ["shipmentOrders"]]);
  });
}

test("write adapter uses the existing OrdersSheet transport with one USER_ENTERED append", async () => {
  const requests = [];
  const constants = loadSource("src/infrastructure/persistence/google-sheets/const.ts");
  const { GoogleSheetsClient } = loadSource("src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts", { imports: { "../const": constants }, globals: {
    fetch: async (url, init) => { requests.push({ url, init }); return Response.json({}); },
  } });
  const base = loadSource("src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts");
  const { OrdersSheet } = loadSource("src/modules/orders/infrastructure/google-sheets/orders/OrdersSheet.ts", { imports: { "../BaseGoogleSheet": base } });
  const sheet = new OrdersSheet(new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake-sheet"), "orders");
  const { GoogleSheetsOrderWriter } = load("src/modules/orders/infrastructure/google-sheets/order-writer.ts");
  const record = { id: "id", status: "complete", seller: "Seller", totalPrice: 0, remark: "=literal legacy mode", createdAt: "created", updatedAt: "updated", deletedAt: "", createdBy: "web" };
  await new GoogleSheetsOrderWriter({ orders: sheet }).appendCreatedOrder(record);
  assert.equal(requests.length, 1); assert.equal(requests[0].init.method, "POST");
  const url = new URL(requests[0].url);
  assert.equal(url.searchParams.get("valueInputOption"), "USER_ENTERED");
  assert.ok(decodeURIComponent(url.pathname).endsWith("/values/'orders'!A:I:append"));
  assert.deepEqual(JSON.parse(requests[0].init.body), { values: [["id", "complete", "Seller", 0, "=literal legacy mode", "created", "updated", "", "web"]] });
});

test("unmigrated image/draft implementations, barrel exports and detail orchestration remain unchanged", () => {
  const expected = JSON.parse(readArchive(new URL("./fixtures/orders-seam-preserved.json", import.meta.url), "utf8"));
  for (const [file, hash] of Object.entries(expected.files)) assert.equal(createHash("sha256").update(restoreOrdersLineSource(file)).digest("hex"), hash, file);
  assertOrderDetailHistory(expected.detailBodyHash);
});

test("detail PATCH retains 404/409 outcomes and validation without migrating its use case", async () => {
  let rows = [];
  const legacy = load("src/services/orders/updateOrderDetails.ts");
  const route = loadSource("src/app/api/orders/[id]/route.ts", { imports: {
    "next/server": { NextResponse: Response }, "@/config": { getConfig: () => ({}) },
    "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: () => ({ orders: { readRows: async () => rows, updateRows: async () => assert.fail("Must not write") } }) },
    "@/services/orders": legacy,
    "@/modules/orders/server": {},
    "@/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection": {},
  }, globals: { console: { error() {} } } });
  const patch = (body) => route.PATCH(new Request("https://example.test/order", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "id" }) });
  const missing = await patch({ totalPrice: 0 }); assert.equal(missing.status, 404); assert.deepEqual(await missing.json(), { error: "Order not found." });
  rows = [["id", "invalid-status", "", null, "", "", "", "", "web"]];
  const invalid = await patch({ totalPrice: 0 }); assert.equal(invalid.status, 409); assert.deepEqual(await invalid.json(), { error: "Order has an invalid status." });
});

test("actual ESLint rules enforce pure application imports and explicit server/adapter boundaries", async () => {
  const eslint = new ESLint();
  const app = "src/modules/orders/application/create-order.ts";
  const invalid = [
    'import type { GoogleSheetRow } from "@/externals/google/sheet";',
    'import { GoogleSheetsOrderWriter } from "../infrastructure/google-sheets/order-writer";',
    'import { getConfig } from "../../../../config";',
    'import { createOrder } from "@/services/orders";',
    'import React from "react";', 'import { cookies } from "next/headers";',
    'import crypto from "node:crypto";', 'import { OrderDetailPage } from "../ui/[id]/OrderDetailPage";',
    'const secret = process.env.LINE_CHANNEL_SECRET;', 'fetch("https://example.test");',
    'const time = new Date();', 'const service = import("../server");',
  ];
  for (const code of invalid) {
    const [result] = await eslint.lintText(code, { filePath: app });
    assert.ok(result.messages.some(({ ruleId }) => ["no-restricted-imports", "no-restricted-globals", "no-restricted-syntax"].includes(ruleId)), code);
  }
  const [valid] = await eslint.lintText('import { OrderStatus } from "../contracts"; export const status = OrderStatus.Complete;', { filePath: app });
  assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages));
  for (const filePath of ["src/modules/orders/application/list-orders.ts", "src/modules/orders/application/ports/order-list-reader.ts", "src/modules/orders/application/ports/created-order-writer.ts"]) {
    const [result] = await eslint.lintText('import type { GoogleSheetRow } from "@/externals/google/sheet";', { filePath });
    assert.ok(result.messages.some(({ ruleId }) => ruleId === "no-restricted-imports"), filePath);
  }
  for (const filePath of ["src/modules/orders/server.ts", "src/modules/orders/infrastructure/google-sheets/order-writer.ts", "src/modules/orders/infrastructure/google-sheets/order-list-reader.ts", "src/modules/orders/infrastructure/google-sheets/order-row-mapping.ts"]) {
    assert.match(readArchive(filePath, "utf8"), /^import "server-only";/);
    const [result] = await eslint.lintText('import { getConfig } from "@/config";', { filePath });
    assert.ok(result.messages.some(({ ruleId }) => ruleId === "no-restricted-imports"), filePath);
    const [valueImport] = await eslint.lintText('import { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";', { filePath });
    assert.ok(valueImport.messages.some(({ ruleId }) => ruleId === "no-restricted-syntax"), filePath);
    const [broadExport] = await eslint.lintText('export * from "@/externals/google/sheet";', { filePath });
    assert.ok(broadExport.messages.some(({ ruleId }) => ruleId === "no-restricted-syntax"), filePath);
  }
});
