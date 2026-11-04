import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadSource, plain } from "./helpers/load-source.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/orders-read-model.json", import.meta.url), "utf8"));
const contracts = loadSource("src/modules/orders/contracts.ts");
const shipmentTypes = loadSource("src/services/shipments/types.ts");
const noIO = () => { throw new Error("Unexpected real dependency in Orders tests"); };

test("extracted DTO fields, optionality and nullability retain their base declarations", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/orders-type-shapes.json", import.meta.url), "utf8"));
  const source = ts.createSourceFile("contracts.ts", readFileSync("src/modules/orders/contracts.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ removeComments: true });
  for (const [name, shape] of Object.entries(expected)) {
    const node = source.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === name);
    assert.ok(node, name);
    const actual = printer.printNode(ts.EmitHint.Unspecified, node.type, source).replace(/\s+/g, " ").trim();
    // The nested shipment projection is now Orders-owned; its fields/status
    // wire values are separately checked against Shipment in the typecheck fixture.
    assert.equal(actual, name === "OrderDetail" ? shape.replace("Shipment | null", "OrderShipment | null") : shape, name);
  }
});

test("Orders contract enum values and legacy exports retain the same runtime identity", () => {
  assert.deepEqual(plain(contracts.OrderStatus), fixture.statuses);
  assert.deepEqual(plain(contracts.OrderItemQuantityType), { Quote: "quote", Delivered: "delivered" });
  assert.deepEqual(Object.keys(contracts).sort(), ["OrderItemQuantityType", "OrderStatus"]);
  const draft = loadSource("src/services/orders/createDraftOrder.ts", { imports: {
    "@/modules/orders/contracts": contracts,
    "@/externals/google/sheet": {},
    "@/externals/google/sheet/sheets/orders/const": {},
    "@/externals/google/sheet/sheets/user-state/const": {},
    "../utils/createSortableId": { createSortableId: noIO },
  } });
  const quantities = loadSource("src/services/orders/OrderItemQuantityType.ts", { imports: { "@/modules/orders/contracts": contracts } });
  assert.equal(draft.OrderStatus, contracts.OrderStatus);
  assert.equal(draft.UserStateFlowName.OrderCreate, "OrderCreate");
  assert.equal(quantities.OrderItemQuantityType, contracts.OrderItemQuantityType);
});

function readService() {
  return loadSource("src/services/orders/listOrders.ts", { imports: {
    "@/services/shipments": shipmentTypes,
    "./createDraftOrder": contracts,
    "@/modules/orders/contracts": contracts,
  } });
}

test("creation keeps provided/generated IDs, price-dependent status and the existing append values", async () => {
  const { createOrder } = loadSource("src/services/orders/createOrder.ts", { imports: {
    "@/modules/orders/contracts": contracts,
    "./createDraftOrder": contracts,
    "../utils/createSortableId": { createSortableId: () => "synthetic-generated-id" },
    "@/externals/google/sheet": {
      ...loadSource("src/externals/google/sheet/const.ts"),
      ...loadSource("src/externals/google/sheet/sheets/orders/const.ts"),
    },
  } });
  for (const [id, totalPrice, expectedId, status] of [[" order/1 ", 0, "order/1", "complete"], [undefined, null, "synthetic-generated-id", "waiting_for_total_price"]]) {
    const writes = [];
    const order = await createOrder({ id, totalPrice, seller: " Seller ", remark: " note ", createdBy: "web", googleSheetsService: { orders: { appendRows: async (...args) => writes.push(plain(args)) } } });
    assert.equal(order.id, expectedId);
    assert.equal(order.status, status);
    assert.equal(order.totalPrice, totalPrice);
    assert.equal(writes[0][0], "A:I");
    assert.deepEqual(writes[0][1][0], [expectedId, status, "Seller", totalPrice, "note", order.createdAt, order.updatedAt, "", "web"]);
  }
});
function fakeSheets() {
  return Object.fromEntries(Object.entries(fixture.rows).map(([key, rows]) => [key, { readRows: async () => rows }]));
}

test("existing order list/detail wire shapes, row filtering, links and quantity strings match the base", async () => {
  const service = readService(), googleSheetsService = fakeSheets();
  assert.deepEqual(plain(await service.listOrders({ googleSheetsService })), fixture.expectedList);
  assert.deepEqual(plain(await service.getOrderDetail({ googleSheetsService, orderId: "order/1" })), fixture.expectedDetail);
  assert.equal(await service.getOrderDetail({ googleSheetsService, orderId: "missing" }), undefined);
  const unlinked = await service.getOrderDetail({ googleSheetsService, orderId: "old" });
  assert.equal(unlinked.shipment, null);
  assert.equal(unlinked.shipmentId, null);
  assert.deepEqual(plain(unlinked.productImages), []);
});

function browserClient(body, status = 200) {
  const requests = [];
  const api = loadSource("src/app/orders/api.ts", { globals: {
    FormData, File,
    fetch: async (url, init) => { requests.push({ url, init }); return Response.json(body, { status }); },
  } });
  return { api, requests };
}

test("browser reads preserve response wrappers, encoded IDs, no-store and abort signals", async () => {
  const list = { orders: fixture.expectedList, total: fixture.expectedList.length };
  const { api, requests } = browserClient(list);
  const controller = new AbortController();
  assert.deepEqual(await api.getOrders({ signal: controller.signal }), list);
  assert.equal(requests[0].url, "/api/orders");
  assert.equal(requests[0].init.cache, "no-store");
  assert.equal(requests[0].init.signal, controller.signal);
  const detail = browserClient({ order: fixture.expectedDetail });
  assert.deepEqual(await detail.api.getOrder("order/1"), { order: fixture.expectedDetail });
  assert.equal(detail.requests[0].url, "/api/orders/order%2F1");
});

const operations = [
  ["getOrders", [], "The orders API returned an invalid response."],
  ["getOrder", ["order/1"], "The order API returned an invalid response."],
  ["createOrder", [{ billImages: [], productImages: [] }], "The order API returned an invalid response."],
  ["updateOrderDetails", ["order/1", { totalPrice: 20 }], "The order details API returned an invalid response."],
  ["updateOrderItemQuantity", ["order/1", "item/1", contracts.OrderItemQuantityType.Delivered, 5], "The product quantity API returned an invalid response."],
  ["updateOrderItemProductCode", ["order/1", "item/1", "SKU"], "The product code API returned an invalid response."],
  ["updateOrderProducts", ["order/1", []], "The product updates API returned an invalid response."],
  ["uploadOrderImage", ["order/1", new File(["fake"], "photo.png"), "product"], "The image upload API returned an invalid response."],
  ["replaceOrderProductImage", ["order/1", "item/1", new File(["fake"], "photo.png")], "The image replacement API returned an invalid response."],
];
for (const [name, args, invalidMessage] of operations) {
  test(`${name} preserves API errors, fallback errors and malformed-success errors`, async () => {
    await assert.rejects(browserClient({ error: "synthetic API error" }, 400).api[name](...args), /synthetic API error/);
    await assert.rejects(browserClient({}, 500).api[name](...args), /Failed to load orders\./);
    await assert.rejects(browserClient({}).api[name](...args), (error) => error.message === invalidMessage);
  });
}

test("quantity updates preserve JSON fields, enum values, encoded IDs and string results", async () => {
  const response = { item: { id: "item/1", quantity: "5", quantityType: "delivered", updatedAt: "fixed" } };
  const { api, requests } = browserClient(response);
  assert.deepEqual(await api.updateOrderItemQuantity("order/1", "item/1", contracts.OrderItemQuantityType.Delivered, 5), response);
  assert.equal(requests[0].url, "/api/orders/order%2F1/items/item%2F1");
  assert.equal(requests[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0].init.body), { quantity: 5, quantityType: "delivered" });
});

test("existing quantity UI preserves hidden, matched, short and extra states and percentage caps", () => {
  const jsx = (type, props) => ({ type, props });
  const { OrderQuantityStatus } = loadSource("src/features/frontend/orders/components/OrderQuantityStatus.tsx", { imports: {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    antd: { Progress: "Progress", Tag: "Tag" },
    "./orderQuantityStatus.module.css": {},
  } });
  for (const [deliveredQuantity, quoteQuantity] of [[null, 10], [0, 10], [1.5, 10], [10, null], [10, 0]]) {
    assert.equal(OrderQuantityStatus({ deliveredQuantity, quoteQuantity }), null);
  }
  for (const [deliveredQuantity, state, label, percent] of [[10, "matched", "Matched", 100], [5, "partial", "Short", 50], [15, "exceeds", "Extra", 100]]) {
    const element = OrderQuantityStatus({ deliveredQuantity, quoteQuantity: 10 });
    assert.equal(element.props["data-state"], state);
    assert.equal(element.props.children[1].props.children, label);
    assert.equal(element.props.children[2].props.percent, percent);
  }
});

test("image uploads and order creation preserve multipart fields and response discriminants", async () => {
  const image = new File(["fake pixels"], "photo.png", { type: "image/png" });
  const response = { imageType: "product", record: fixture.expectedDetail.productImages[0] };
  const upload = browserClient(response);
  assert.deepEqual(await upload.api.uploadOrderImage("order/1", image, "product"), response);
  assert.equal(upload.requests[0].init.body.get("imageType"), "product");
  assert.equal(upload.requests[0].init.body.get("image").name, "photo.png");
  assert.equal(upload.requests[0].init.headers["Content-Type"], undefined);
  const create = browserClient({ order: { id: "created", status: "waiting_for_total_price" } });
  await create.api.createOrder({ totalPrice: null, seller: "Seller", billImages: [image], productImages: [image] });
  assert.equal(create.requests[0].url, "/api/orders/with-images");
  assert.equal(create.requests[0].init.body.has("totalPrice"), false);
  assert.equal(create.requests[0].init.body.getAll("billImages").length, 1);
  assert.equal(create.requests[0].init.body.getAll("productImages").length, 1);
});

test("existing order detail HTTP handler preserves 200/400/404/500 response shapes", async () => {
  let result = fixture.expectedDetail;
  const route = loadSource("src/app/api/orders/[id]/route.ts", { imports: {
    "next/server": { NextResponse: Response },
    "@/config": { getConfig: () => ({}) },
    "@/externals/google/sheet": { createGoogleSheetsServiceFromConfig: () => ({}) },
    "@/services/orders": { getOrderDetail: async () => { if (result instanceof Error) throw result; return result; } },
  }, globals: { console: { error: () => {} } } });
  const get = (id) => route.GET(undefined, { params: Promise.resolve({ id }) });
  const success = await get("order/1");
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { order: fixture.expectedDetail });
  const missingId = await get(" ");
  assert.equal(missingId.status, 400);
  assert.deepEqual(await missingId.json(), { error: "Order ID is required." });
  result = undefined;
  const missing = await get("unknown");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Order not found." });
  result = new Error("synthetic storage failure");
  const failure = await get("order/1");
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: "Failed to load order." });
});
