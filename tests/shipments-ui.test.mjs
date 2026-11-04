import assert from "node:assert/strict";
import test from "node:test";
import { componentHarness, elements, flush, deferred } from "./helpers/component-harness.mjs";
import { plain } from "./helpers/load-source.mjs";

const listFile = "src/modules/shipments/ui/ShipmentListPage.tsx", detailFile = "src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx";
const one = (tree, type, match = () => true) => { const item = elements(tree, type).find((element) => match(element.props)); assert.ok(item, `Missing ${type}`); return item; };
const shipment = (i, override = {}) => ({ id: `s/${i}`, poNumber: `PO-${i}`, status: "draft", carrier: "Carrier", shippingFee: null, shippedAt: "", deliveredAt: "", createdAt: "created", updatedAt: "updated", createdBy: "web", remark: "", shippingBillUrl: "", costSummary: null, orders: [{ id: `o/${i}`, status: "complete", seller: `Seller ${i}`, totalPrice: 10, createdAt: "created", productImages: [{ id: "image", imageUrl: "https://example.test/image", quoteQuantity: "2", deliveredQuantity: "1", productCode: "SKU" }] }], ...override });

test("Shipment list retains search/status/pagination, desktop/mobile rows and expansion controls", async () => {
  const shipments = Array.from({ length: 23 }, (_, i) => shipment(i, { status: i % 2 ? "shipping" : "ready_to_ship" }));
  const h = componentHarness(listFile, { api: { getShipments: async () => ({ shipments }) } });
  assert.equal(one(h.render(h.module.ShipmentListPage), "Table").props.loading, true); await flush();
  let tree = h.render(); assert.equal(one(tree, "Table").props.dataSource.length, 10); assert.equal(elements(tree, "ShipmentMobileCard").length, 10);
  assert.equal(one(tree, "Table").props.expandable.expandedRowKeys.length, 23);
  one(tree, "Pagination").props.onChange(3); assert.equal(one(h.render(), "Table").props.dataSource.length, 3);
  one(h.render(), "Input").props.onChange({ target: { value: " SELLER 2 " } });
  tree = h.render(); assert.equal(one(tree, "Pagination").props.current, 1);
  assert.deepEqual(plain(one(tree, "Table").props.dataSource.map((s) => s.id)), ["s/2", "s/20", "s/21", "s/22"]);
  for (const query of ["PO-1", "carrier", "o/1"]) { one(tree, "Input").props.onChange({ target: { value: query } }); tree = h.render(); assert.ok(one(tree, "Pagination").props.total > 0); }
  one(tree, "Input").props.onChange({ target: { value: "" } });
  one(h.render(), "Tabs").props.onChange("preparing"); assert.equal(one(h.render(), "Pagination").props.total, 12);
  one(h.render(), "Tabs").props.onChange("shipping"); assert.equal(one(h.render(), "Pagination").props.total, 11);
  one(h.render(), "Button", (p) => p.children === "Collapse all").props.onClick(); assert.deepEqual(plain(one(h.render(), "Table").props.expandable.expandedRowKeys), shipments.filter(s => s.status !== "shipping").map(s => s.id));
  one(h.render(), "Button", (p) => p.children === "Expand all").props.onClick(); assert.equal(one(h.render(), "Table").props.expandable.expandedRowKeys.length, 23);
  h.unmount();
});

test("Shipment list and detail preserve error/retry/abort lifecycle and back navigation", async () => {
  for (const [file, component, method, props, payload] of [[listFile, "ShipmentListPage", "getShipments", undefined, { shipments: [shipment(1)] }], [detailFile, "ShipmentDetailPage", "getShipment", { shipmentId: "s/1" }, { shipment: shipment(1) }]]) {
    const calls = [];
    const h = componentHarness(file, { api: { [method]: (...args) => { const pending = deferred(); calls.push({ ...pending, signal: (args.at(-1) ?? {}).signal }); return pending.promise; } } });
    h.render(h.module[component], props); calls[0].reject(new Error("synthetic HTTP error")); await flush();
    let tree = h.render(); assert.equal(one(tree, "Alert").props.description, "synthetic HTTP error");
    one(one(tree, "Alert").props.action, "Button").props.onClick(); h.render(); assert.equal(calls[0].signal.aborted, true);
    calls[1].resolve(payload); await flush(); tree = h.render(); assert.equal(elements(tree, "Alert").length, 0);
    assert.equal(one(tree, "Button", (p) => p.type === "text").props.href, file === listFile ? "/orders" : "/shipments");
    h.unmount(); assert.equal(calls[1].signal.aborted, true);
  }
});

test("Shipment detail ignores aborted failures and retains linked Orders/gallery/navigation presentation", async () => {
  const calls = [], h = componentHarness(detailFile, { api: { getShipment: (_id, { signal }) => { const d = deferred(); calls.push({ ...d, signal }); return d.promise; } } });
  h.render(h.module.ShipmentDetailPage, { shipmentId: "s/1" }); h.render(undefined, { shipmentId: "s/2" });
  assert.equal(calls[0].signal.aborted, true); calls[0].reject(new Error("aborted")); calls[1].resolve({ shipment: shipment(2) }); await flush();
  const content = one(h.render(), "ShipmentContent"), tree = h.mount(content.type, content.props);
  const table = one(tree, "Table"); assert.equal(table.props.dataSource[0].id, "o/2");
  const gallery = table.props.columns.find((column) => column.key === "products").render(undefined, shipment(2).orders[0]);
  assert.equal(gallery.type, "OrderImageGallery"); assert.equal(gallery.props.thumbnailSize, 56); assert.equal(gallery.props.showLabels, false);
  const action = table.props.columns.find((column) => column.key === "action").render(undefined, shipment(2).orders[0]);
  assert.equal(action.props.href, "/orders/o%2F2");
  h.unmount();
});

test("Shipment status controls preserve immediate ready, PO/bill confirmation, fee entry and notifications", async () => {
  const requests = []; let current = shipment(1);
  const update = (callback) => { current = callback(current); };
  const h = componentHarness(detailFile, { api: {
    getShipment: async () => ({ shipment: current }),
    advanceShipmentStatus: async (id, input) => { requests.push({ id, input }); return { shipment: { status: input.status, updatedAt: "fixed", shippingBillUrl: input.shippingBill ? "https://example.test/bill" : current.shippingBillUrl } }; },
  } });
  h.render(h.module.ShipmentDetailPage, { shipmentId: current.id }); await flush();
  const content = one(h.render(), "ShipmentContent");
  let tree = h.mount(content.type, { shipment: current, onShipmentChange: update });
  one(tree, "Button", (p) => p.children === "Mark ready to ship").props.onClick(); await flush();
  assert.equal(requests[0].input.status, "ready_to_ship");
  tree = h.render(undefined, { shipment: current, onShipmentChange: update });
  one(tree, "Button", (p) => p.children === "Start shipping").props.onClick(); tree = h.render();
  assert.equal(one(tree, "Modal", (p) => p.title === "Start shipping").props.open, true);
  assert.equal(one(tree, "Form.Item", (p) => p.name === "poNumber").props.rules[1].max, 100);
  const file = new File(["fake"], "bill.pdf", { type: "application/pdf" });
  assert.equal(one(tree, "Upload").props.beforeUpload(file), false);
  one(tree, "Upload").props.onChange({ fileList: [{ uid: "old" }, { uid: "new", originFileObj: file }] }); tree = h.render();
  assert.equal(one(tree, "Upload").props.fileList.length, 1);
  one(one(tree, "Modal", (p) => p.title === "Start shipping"), "Form").props.onFinish({ poNumber: " CONFIRM " }); await flush();
  assert.equal(requests[1].input.poNumber, " CONFIRM "); assert.equal(requests[1].input.shippingBill, file);
  tree = h.render(undefined, { shipment: current, onShipmentChange: update }); one(tree, "Button", (p) => p.children === "Mark delivered").props.onClick(); tree = h.render();
  assert.equal(one(tree, "Modal", (p) => p.title === "Complete delivery").props.open, true);
  const fee = one(tree, "InputNumber").props; assert.equal(fee.min, 0); assert.equal(fee.max, 1_000_000_000); assert.equal(fee.precision, 2);
  one(one(tree, "Modal", (p) => p.title === "Complete delivery"), "Form").props.onFinish({ deliveryFee: 0 }); await flush();
  assert.deepEqual(plain(requests[2].input), { deliveryFee: 0, status: "delivered" });
  tree = h.render(undefined, { shipment: current, onShipmentChange: update }); assert.equal(one(tree, "Steps").props.current, 3);
  assert.deepEqual(h.notifications, ["Shipment status updated to ready to ship.", "Shipment status updated to shipping.", "Shipment status updated to delivered."]);
  h.unmount();
});

test("status failure keeps confirmation open, restores controls and shows the original message", async () => {
  const current = shipment(1, { status: "ready_to_ship" });
  const h = componentHarness(detailFile, { api: { getShipment: async () => ({ shipment: current }), advanceShipmentStatus: async () => { throw new Error("synthetic status failure"); } } });
  h.render(h.module.ShipmentDetailPage, { shipmentId: current.id }); await flush();
  const content = one(h.render(), "ShipmentContent"); let tree = h.mount(content.type, content.props);
  one(tree, "Button", (p) => p.children === "Start shipping").props.onClick(); tree = h.render();
  one(one(tree, "Modal", (p) => p.title === "Start shipping"), "Form").props.onFinish({ poNumber: "PO" }); await flush(); tree = h.render();
  assert.equal(one(tree, "Modal", (p) => p.title === "Start shipping").props.open, true); assert.equal(one(tree, "Button", (p) => p.children === "Start shipping").props.loading, false);
  assert.equal(h.notifications.at(-1), "synthetic status failure"); h.unmount();
});

test("mobile linked-order presentation retains expand/collapse and gallery navigation properties", () => {
  const h = componentHarness("src/modules/shipments/ui/ShipmentMobileCard.tsx"), toggles = [];
  const props = { shipment: shipment(1), ordersExpanded: false, onOrdersExpandedChange: (value) => toggles.push(value) };
  let tree = h.render(h.module.ShipmentMobileCard, props); one(tree, "Button", (p) => p.children === "Expand").props.onClick(); assert.deepEqual(toggles, [true]);
  tree = h.render(undefined, { ...props, ordersExpanded: true });
  const order = one(tree, "ShipmentMobileOrder"), child = order.type(order.props);
  assert.equal(one(child, "OrderImageGallery").props.thumbnailSize, 64); assert.equal(one(child, "Button").props.href, "/orders/o%2F1");
  assert.equal(one(tree, "Button", (p) => p.children === "View shipment details").props.href, "/shipments/s%2F1");
});
