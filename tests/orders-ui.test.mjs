import { pickerFromHttp, unusedPicker } from "./helpers/orders-picker.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { componentHarness, elements, flush, deferred } from "./helpers/component-harness.mjs";
import { loadSource, plain } from "./helpers/load-source.mjs";

// These paths are updated only after the same tests pass against the base UI.
const files = {
  list: "src/modules/orders/ui/OrderListPage.tsx",
  create: "src/modules/orders/ui/create/OrderCreatePage.tsx",
  detail: "src/modules/orders/ui/[id]/OrderDetailPage.tsx",
  gallery: "src/modules/orders/ui/OrderImageGallery.tsx",
  upload: "src/modules/orders/ui/OrderProductImageUpload.tsx",
  replace: "src/modules/orders/ui/OrderProductImageActions.tsx",
};
const one = (tree, type, predicate = () => true) => {
  const found = elements(tree, type).find((element) => predicate(element.props));
  assert.ok(found, `Missing ${type}`); return found;
};
const order = (i, overrides = {}) => ({ id: `order-${i}`, seller: `Seller ${i}`, createdBy: "Owner", status: "complete", totalPrice: 100, createdAt: "2026-11-01", updatedAt: "", remark: "", shipmentId: null, productImages: [], ...overrides });

test("list search/status/shipment filters reset pagination and preserve expanded rows and mobile data", async () => {
  const orders = Array.from({ length: 23 }, (_, i) => order(i, { status: i % 2 ? "draft" : "complete", shipmentId: i < 5 ? "shipment" : null, productImages: i === 0 ? [{ id: "image", imageUrl: "https://example.test/image", quoteQuantity: "5" }] : [] }));
  const h = componentHarness(files.list, { api: { getOrders: async () => ({ orders }) } });
  h.render(h.module.OrderListPage); await flush();
  let tree = h.render(), table = one(tree, "Table");
  assert.equal(table.props.dataSource.length, 10);
  assert.deepEqual(plain(table.props.expandable.expandedRowKeys), ["order-0"]);
  assert.equal(elements(tree, "OrderMobileCard").length, 10);
  one(tree, "Pagination").props.onChange(3);
  assert.equal(one(h.render(), "Table").props.dataSource.length, 3);
  one(h.render(), "Input").props.onChange({ target: { value: "  SELLER 2 " } });
  tree = h.render(); assert.equal(one(tree, "Pagination").props.current, 1);
  assert.deepEqual(plain(one(tree, "Table").props.dataSource.map((row) => row.id)), ["order-2", "order-20", "order-21", "order-22"]);
  one(tree, "Input").props.onChange({ target: { value: "" } });
  one(h.render(), "Tabs").props.onChange("in-progress");
  assert.equal(one(h.render(), "Pagination").props.total, 11);
  one(h.render(), "Select").props.onChange("linked");
  assert.deepEqual(plain(one(h.render(), "Table").props.dataSource.map((row) => row.id)), ["order-1", "order-3"]);
  one(h.render(), "Tabs").props.onChange("completed");
  assert.deepEqual(plain(one(h.render(), "Table").props.dataSource.map((row) => row.id)), ["order-0", "order-2", "order-4"]);
  one(h.render(), "Table").props.expandable.onExpandedRowsChange([]);
  assert.deepEqual(plain(one(h.render(), "Table").props.expandable.expandedRowKeys), []);
  h.unmount();
});

test("list loading/error/retry uses a fresh request and aborts the previous one", async () => {
  const requests = [];
  const h = componentHarness(files.list, { api: { getOrders: ({ signal }) => { const pending = deferred(); requests.push({ ...pending, signal }); return pending.promise; } } });
  assert.equal(one(h.render(h.module.OrderListPage), "Table").props.loading, true);
  requests[0].reject(new Error("Synthetic failure")); await flush();
  let tree = h.render(); assert.equal(one(tree, "Alert").props.description, "Synthetic failure");
  one(one(tree, "Alert").props.action, "Button").props.onClick();
  tree = h.render(); assert.equal(one(tree, "Table").props.loading, true);
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ orders: [order(1)] }); await flush();
  tree = h.render(); assert.equal(one(tree, "Table").props.loading, false);
  assert.equal(elements(tree, "Alert").length, 0);
  h.unmount(); assert.equal(requests[1].signal.aborted, true);
});

test("creation retains field limits, required image messages, file rules and navigation", async () => {
  const calls = [];
  const h = componentHarness(files.create, { api: { createOrder: async (input) => { calls.push(input); return { order: { id: "new/order" } }; } } });
  let tree = h.render(h.module.OrderCreatePage);
  assert.equal(one(tree, "Form.Item", (p) => p.name === "seller").props.rules[0].max, 100);
  assert.equal(one(tree, "Form.Item", (p) => p.name === "remark").props.rules[0].max, 1000);
  assert.equal(one(tree, "Form.Item", (p) => p.name === "totalPrice").props.rules[0].min, 0);
  await one(tree, "Form").props.onFinish({});
  tree = h.render(); const fields = elements(tree, "ImageUploadField");
  assert.equal(fields[0].props.error, "Add at least one bill image.");
  assert.equal(fields[1].props.error, "Add at least one product image.");
  const fieldTree = fields[0].type(fields[0].props), before = one(fieldTree, "Upload.Dragger").props.beforeUpload;
  assert.equal(before({ type: "image/png", size: 10 * 1024 * 1024, name: "ok.png" }), false);
  assert.equal(before({ type: "image/png", size: 0, name: "empty.png" }), false); // Existing create-flow edge case.
  assert.equal(before({ type: "image/gif", size: 1, name: "bad.gif" }), "LIST_IGNORE");
  assert.equal(before({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1, name: "large.jpg" }), "LIST_IGNORE");
  const image = new File(["fake pixels"], "ok.png", { type: "image/png" });
  for (const field of fields) field.props.onChange([{ uid: field.props.label, originFileObj: image }]);
  await one(h.render(), "Form").props.onFinish({ seller: "Seller", totalPrice: 0, remark: "note" });
  assert.equal(calls.length, 1); assert.equal(calls[0].totalPrice, 0);
  assert.equal(calls[0].billImages[0], image); assert.equal(calls[0].productImages[0], image);
  assert.deepEqual(h.navigation, ["/orders/new%2Forder"]);
});

test("detail loading, aborted failures and retry preserve the existing request lifecycle", async () => {
  const requests = [];
  const h = componentHarness(files.detail, { api: { getOrder: (id, { signal }) => { const pending = deferred(); requests.push({ ...pending, signal, id }); return pending.promise; } } });
  assert.equal(elements(h.render(h.module.OrderDetailPage, { orderId: "one", shipmentPicker: unusedPicker }), "OrderDetailLoading").length, 1);
  h.render(undefined, { orderId: "two", shipmentPicker: unusedPicker }); assert.equal(requests[0].signal.aborted, true);
  requests[0].reject(new Error("Abort from previous order")); await flush();
  assert.equal(elements(h.render(), "OrderDetailError").length, 0);
  requests[1].reject(new Error("Synthetic detail error")); await flush();
  const error = one(h.render(), "OrderDetailError"); assert.equal(error.props.message, "Synthetic detail error");
  error.props.onRetry(); h.render(); requests[2].resolve({ order: order(2) }); await flush();
  assert.equal(one(h.render(), "OrderContent").props.order.id, "order-2");
  h.unmount(); assert.equal(requests[2].signal.aborted, true);
});

test("gallery preview, keyboard bounds, edit focus exclusion and modal close remain stable", () => {
  class EditableElement { closest() { return this; } }
  const h = componentHarness(files.gallery, { globals: { HTMLElement: EditableElement } });
  const images = [1, 2].map((id) => ({ id: String(id), title: `Image ${id}`, imageUrl: `https://drive.google.com/file/d/fake-${id}/view` }));
  let tree = h.render(h.module.OrderImageGallery, { images, ariaLabel: "Photos" });
  assert.equal(one(tree, "Modal").props.open, false);
  elements(tree, "OrderImageCard")[0].props.onPreview(); tree = h.render();
  assert.equal(one(tree, "Modal").props.title, "Image 1 (1 of 2)");
  assert.equal(one(tree, "img").props.src, "https://lh3.googleusercontent.com/d/fake-1?authuser=0");
  h.listeners.get("keydown")({ key: "ArrowRight" }); tree = h.render();
  assert.equal(one(tree, "Modal").props.title, "Image 2 (2 of 2)");
  h.listeners.get("keydown")({ key: "ArrowRight" }); assert.equal(one(h.render(), "Modal").props.title, "Image 2 (2 of 2)");
  h.listeners.get("keydown")({ key: "ArrowLeft", defaultPrevented: true }); assert.equal(one(h.render(), "Modal").props.title, "Image 2 (2 of 2)");
  h.listeners.get("keydown")({ key: "ArrowLeft", target: new EditableElement() }); assert.equal(one(h.render(), "Modal").props.title, "Image 2 (2 of 2)");
  one(h.render(), "Modal").props.onCancel(); tree = h.render();
  assert.equal(one(tree, "Modal").props.open, false); assert.equal(h.listeners.has("keydown"), false);
  h.unmount();
});

test("product drafts validate positive integers, trim codes and save the same item changes", async () => {
  const calls = [], initial = { ...order(1), billImages: [], shipment: null, productImages: [{ id: "item/1", imageUrl: "https://example.test/image", quoteQuantity: "10", deliveredQuantity: "5", productCode: "OLD" }] };
  let current = initial;
  const h = componentHarness(files.detail, { api: {
    getOrder: async () => ({ order: initial }),
    updateOrderProducts: async (...args) => { calls.push(plain(args)); return { items: [{ id: "item/1", quoteQuantity: "12", productCode: "NEW", deliveredQuantity: "5", updatedAt: "fixed" }] }; },
  } });
  h.render(h.module.OrderDetailPage, { orderId: initial.id, shipmentPicker: unusedPicker }); await flush();
  const content = one(h.render(), "OrderContent");
  let tree = h.mount(content.type, { order: initial, shipmentPicker: unusedPicker, onOrderChange: (update) => { current = update(current); } });
  one(tree, "OrderItemQuantity").props.onChange(1.5);
  tree = h.render(); assert.equal(one(tree, "Button", (p) => p.children === "Save").props.disabled, true);
  one(tree, "OrderItemQuantity").props.onChange(12);
  one(h.render(), "OrderItemProductCode").props.onChange(" NEW ");
  one(h.render(), "Button", (p) => p.children === "Save").props.onClick(); await flush();
  assert.deepEqual(calls, [[initial.id, [{ id: "item/1", productCode: "NEW", quoteQuantity: 12 }]]]);
  assert.equal(current.productImages[0].quoteQuantity, "12");
  assert.equal(current.productImages[0].productCode, "NEW");
  h.unmount();
});

test("shipment picker preserves current selection, de-duplicates it, creates and links shipments", async () => {
  const calls = [], currentShipment = { id: "existing", poNumber: "PO-1", carrier: "Carrier", status: "draft" };
  const initial = { ...order(1), billImages: [], productImages: [], shipment: currentShipment, shipmentId: currentShipment.id };
  const shipmentPicker = pickerFromHttp({
    getShipments: async (input) => { calls.push(["query", input]); return { shipments: [currentShipment, { id: "other", poNumber: "PO-2", carrier: "", status: "ready_to_ship" }] }; },
    createShipmentMaster: async (input) => { calls.push(["create", input]); return { shipment: { id: "new", poNumber: "PO-3", carrier: "New", status: "draft" } }; },
    linkOrderToShipment: async (...args) => { calls.push(["link", ...args]); },
  });
  const h = componentHarness(files.detail, { api: { getOrder: async () => ({ order: initial }) } });
  h.render(h.module.OrderDetailPage, { orderId: initial.id, shipmentPicker }); await flush();
  const content = one(h.render(), "OrderContent");
  const card = one(h.mount(content.type, { order: initial, shipmentPicker, onOrderChange() {} }), "ShipmentLinkCard");
  h.mount(card.type, card.props); await flush(); let tree = h.render();
  assert.deepEqual(plain(one(tree, "Select").props.options.map((option) => option.value)), ["existing", "other"]);
  assert.equal(one(tree, "Select").props.value, "existing");
  assert.equal(calls[0][1].includeOrders, false);
  assert.deepEqual(plain(calls[0][1].excludeStatuses), ["shipping", "delivered", "canceled"]);
  one(tree, "Select").props.onChange("other");
  await one(h.render(), "Button", (p) => p.children === "Link order").props.onClick();
  assert.deepEqual(calls[1], ["link", "other", initial.id]);
  await one(h.render(), "Form").props.onFinish({ poNumber: "PO-3", carrier: "New" });
  tree = h.render(); assert.equal(one(tree, "Select").props.value, "new");
  await one(tree, "Button", (p) => p.children === "Link order").props.onClick();
  assert.deepEqual(calls.at(-1), ["link", "new", initial.id]);
  h.unmount();
});

test("add/replace image controls retain stricter zero-byte rejection and 10 MB boundary", () => {
  for (const [path, name, props] of [[files.upload, "OrderProductImageUpload", { orderId: "one", onUploaded() {} }], [files.replace, "OrderProductImageActions", { productNumber: 1, disabled: false, onReplace: async () => {} }]]) {
    const h = componentHarness(path), tree = h.render(h.module[name], props);
    const before = one(tree, "Upload.Dragger").props.beforeUpload;
    assert.equal(before({ type: "image/png", size: 0, name: "empty" }), "LIST_IGNORE");
    assert.equal(before({ type: "image/svg+xml", size: 10, name: "svg" }), "LIST_IGNORE");
    assert.equal(before({ type: "image/webp", size: 10 * 1024 * 1024, name: "ok" }), false);
    assert.equal(before({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1, name: "large" }), "LIST_IGNORE");
  }
});

test("browser product edits and shipment queries/linking retain URLs and JSON payloads", async () => {
  const requests = [];
  const fetch = async (url, init) => { requests.push({ url, init }); return Response.json(url.includes("shipments") ? { shipmentOrder: { id: "link" }, created: true, shipments: [], total: 0 } : { items: [{ id: "item/1", productCode: "SKU", quoteQuantity: "10", deliveredQuantity: "5", updatedAt: "fixed" }] }); };
  const api = loadSource("src/modules/orders/ui/api.ts", { globals: { fetch } });
  await api.updateOrderProducts("order/1", [{ id: "item/1", productCode: "SKU", quoteQuantity: 10, deliveredQuantity: 5 }]);
  assert.equal(requests[0].url, "/api/orders/order%2F1/items");
  assert.deepEqual(JSON.parse(requests[0].init.body), { items: [{ id: "item/1", productCode: "SKU", quoteQuantity: 10, deliveredQuantity: 5 }] });
  const shipments = loadSource("src/modules/shipments/ui/api.ts", { globals: { fetch } });
  await shipments.getShipments({ includeOrders: false, excludeStatuses: ["shipping", "delivered", "canceled"] });
  assert.equal(requests[1].url, "/api/shipments?includeOrders=false&excludeStatuses=shipping%2Cdelivered%2Ccanceled");
  await shipments.linkOrderToShipment("ship/1", "order/1");
  assert.equal(requests[2].url, "/api/shipments/ship%2F1/orders");
  assert.deepEqual(JSON.parse(requests[2].init.body), { orderId: "order/1" });
});
