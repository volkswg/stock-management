import {productHistory} from "./helpers/product-master-history.mjs";
import {readArchive} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { routeContracts } from "./helpers/routes.mjs";

const forbidden = () => { throw new Error("Persistence is forbidden in pure-rule tests"); };
const { calculateAdvanceDeductions } = loadSource("src/services/employees/manageSalaryAdvances.ts", {
  imports: {
    "./manageEmployees": { listEmployees: forbidden },
    "@/services/expenses": { listExpenseShops: forbidden },
  },
});
const advance = (id, overrides = {}) => ({
  id, employeeId: "employee-1", paidAmount: 3000, status: "paid",
  payrollMonth: "2026-09", paidDate: "2026-09-01", reference: "synthetic", ...overrides,
});

test("advance recovery is oldest-first, capped at gross earnings, and carries the excess", () => {
  const result = plain(calculateAdvanceDeductions([
    advance("newer", { paidAmount: 2000, paidDate: "2026-09-02" }), advance("older"),
  ], [], "employee-1", "2026-09", 4000));
  assert.deepEqual(result.advances.map(({ id, deduction, balance }) => ({ id, deduction, balance })), [
    { id: "older", deduction: 3000, balance: 0 },
    { id: "newer", deduction: 1000, balance: 1000 },
  ]);
  assert.equal(result.advanceDeduction, 4000);
  assert.equal(result.advanceBalance, 1000);
  assert.equal(result.totalPay, 0);
});

test("earlier settlements reduce recovery; same-month snapshots do not reduce the preview twice", () => {
  const settlement = (month) => ({ month, snapshot: { advances: [{ id: "advance", deduction: 1000 }] } });
  const result = plain(calculateAdvanceDeductions([advance("advance")], [
    settlement("2026-09"), settlement("2026-10"),
  ], "employee-1", "2026-10", 5000));
  assert.equal(result.advanceDeduction, 2000);
  assert.equal(result.totalPay, 3000);
  assert.equal(result.advanceBalance, 0);
});

test("unpaid, future and other employees' advances are excluded; cents remain exact", () => {
  const result = plain(calculateAdvanceDeductions([
    advance("unpaid", { status: "requested" }),
    advance("future-month", { payrollMonth: "2026-11" }),
    advance("future-payment", { paidDate: "2026-11-01" }),
    advance("someone-else", { employeeId: "employee-2" }),
    advance("cents", { paidAmount: 10.15 }),
  ], [], "employee-1", "2026-10", 10.10));
  assert.deepEqual(result.advances.map(({ id }) => id), ["cents"]);
  assert.equal(result.advanceDeduction, 10.10);
  assert.equal(result.advanceBalance, 0.05);
  assert.equal(result.totalPay, 0);
});

test("zero earnings preserve the advance balance without negative net pay", () => {
  const result = plain(calculateAdvanceDeductions([advance("advance")], [], "employee-1", "2026-09", 0));
  assert.equal(result.advanceDeduction, 0);
  assert.equal(result.advanceBalance, 3000);
  assert.equal(result.totalPay, 0);
});

test("receipt identifiers retain legacy sanitization and fallback formats", () => {
  const ids = loadSource("src/services/sales/idBuilders.ts");
  assert.equal(ids.createSalesReceiptId("shop/1", "#42"), "RECEIPT-shop_1-_42");
  assert.equal(ids.createSalesReceiptSyncId("shop/1", "2026-11-04"), "RECEIPT-SYNC-shop_1-20261104");
  assert.equal(ids.createSalesReceiptItemId("receipt", "", 0), "RECEIPT-ITEM-receipt-0");
  assert.equal(ids.createSalesReceiptPaymentId("", 2), "RECEIPT-PAYMENT-unknown-2");
});

test("movement notes sum standalone quantities and preserve label text", () => {
  const { parseQuantity, isValidMovementQuantity } = loadSource("src/modules/inventory/quantity.ts");
  assert.deepEqual(plain(parseQuantity("ดำ 5 ขาว 3")), { quantity: "8", remark: "ดำ 5 ขาว 3" });
  assert.deepEqual(plain(parseQuantity("5")), { quantity: "5", remark: "" });
  assert.deepEqual(plain(parseQuantity("1,000 2.5")), { quantity: "1002.5", remark: "1,000 2.5" });
  assert.equal(parseQuantity("Lot2 Set2ชิ้น"), undefined);
  assert.equal(isValidMovementQuantity("0"), false);
  assert.equal(isValidMovementQuantity("1,000"), true);
});

test("LINE validates the exact raw body and rejects changed, missing, or invalid signatures", () => {
  const constants = loadSource("src/infrastructure/external/line/const.ts");
  const { LineBotService } = loadSource("src/infrastructure/external/line/LineBotService.ts", {
    imports: { "node:crypto": crypto, "./const": constants },
  });
  const secret = "synthetic-test-secret";
  const service = new LineBotService("synthetic-unused-token", secret);
  const body = Buffer.from('{"events":[]}');
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(service.verifyLineSignature(body, signature), true);
  assert.equal(service.verifyLineSignature(Buffer.from('{ "events":[]}'), signature), false);
  assert.equal(service.verifyLineSignature(body, undefined), false);
  assert.equal(service.verifyLineSignature(body, "invalid"), false);
  assert.equal(new LineBotService("", "").verifyLineSignature(body, signature), false);
});

function sheetsHarness(responses) {
  const requests = [];
  const { GoogleSheetsClient } = loadSource("src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts", {
    imports: { "../const": loadSource("src/infrastructure/persistence/google-sheets/const.ts") },
    globals: {
      fetch: async (url, init) => {
        requests.push({ url, init });
        assert.ok(responses.length, "Unexpected HTTP request");
        return new Response(JSON.stringify(responses.shift()), { status: 200 });
      },
    },
  });
  return { requests, client: new GoogleSheetsClient({ getAccessToken: async () => "fake-token" }, "fake-sheet") };
}

test("Sheets batch reads quote worksheet names, preserve range order, and reject incomplete responses", async () => {
  const { client, requests } = sheetsHarness([
    { valueRanges: [{ values: [["first"]] }, {}] }, { valueRanges: [] },
  ]);
  const ranges = [{ worksheetName: "Owner's shop", range: "A:H" }, { worksheetName: "details", range: "A:N" }];
  assert.deepEqual(plain(await client.getValuesBatch(ranges)), [[["first"]], []]);
  assert.deepEqual(new URL(requests[0].url).searchParams.getAll("ranges"), ["'Owner''s shop'!A:H", "'details'!A:N"]);
  await assert.rejects(client.getValuesBatch(ranges), /incomplete set of ranges/);
  assert.deepEqual(plain(await client.getValuesBatch([])), []);
  assert.equal(requests.length, 2);
});

test("Sheets writes preserve RAW financial values and the legacy USER_ENTERED default", async () => {
  const { client, requests } = sheetsHarness([{}, {}]);
  const values = [["2026-11-04", "=literal-reference", '{"amount":10.15}']];
  await client.appendValues("payroll", "A:G", values, "RAW");
  await client.updateValues("orders", "A2:C2", [["order", "5", "note"]]);
  assert.equal(new URL(requests[0].url).searchParams.get("valueInputOption"), "RAW");
  assert.equal(new URL(requests[0].url).searchParams.get("insertDataOption"), "INSERT_ROWS");
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].init.body), { values });
  assert.equal(new URL(requests[1].url).searchParams.get("valueInputOption"), "USER_ENTERED");
  assert.equal(requests[1].init.method, "PUT");
});

test("existing page URLs, dynamic segments and explicitly exported API methods remain stable", () => {
  const expected = JSON.parse(readArchive(new URL("./fixtures/route-contracts.json", import.meta.url), "utf8"));
  const actual=routeContracts(),added=new Set(productHistory.newRoutes.map(route=>route.file));
  assert.deepEqual(actual.filter(route=>!added.has(route.file)),expected);
  assert.deepEqual(actual.filter(route=>added.has(route.file)),productHistory.newRoutes);
});
