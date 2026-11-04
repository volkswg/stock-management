import assert from "node:assert/strict";
import test from "node:test";
import { componentHarness, elements, flush, deferred } from "./helpers/component-harness.mjs";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { pickerFromHttp } from "./helpers/orders-picker.mjs";

const detail = "src/modules/orders/ui/[id]/OrderDetailPage.tsx";
const one = (tree, type, predicate = () => true) => { const item = elements(tree, type).find(e => predicate(e.props)); assert.ok(item, type); return item; };
const shipment = (id = "ship/old") => ({ id, poNumber: `PO-${id}`, carrier: "Carrier", status: "draft" });
const order = current => ({ id: "order/1", status: "complete", totalPrice: 1, seller: "Seller", remark: "", createdAt: "", productImages: [], billImages: [], shipment: current ?? null, shipmentId: current?.id ?? null });

async function mountPicker({ current, remote = [], fetch: respond } = {}) {
  const requests = [];
  const http = loadSource("src/modules/shipments/ui/api.ts", { globals: { Error, fetch: async (url, init) => {
    requests.push({ url, init });
    return respond ? respond(url, init, requests.length) : Response.json({ shipments: remote, total: remote.length });
  } } });
  const initial = order(current);
  const h = componentHarness(detail, { api: { getOrder: async () => ({ order: initial }) } });
  h.render(h.module.OrderDetailPage, { orderId: initial.id, shipmentPicker: pickerFromHttp(http) }); await flush();
  const content = one(h.render(), "OrderContent"), card = one(h.mount(content.type, content.props), "ShipmentLinkCard");
  h.mount(card.type, card.props); await flush();
  return { h, requests, http, card, initial, tree: () => h.render() };
}

for (const current of [undefined, shipment()]) test(`picker preserves ${current ? "preselection/duplicate suppression" : "unlinked state"}, search and disabled link`, async () => {
  const remote = [shipment(), shipment("ship/other")], { h, tree } = await mountPicker({ current, remote });
  const select = one(tree(), "Select").props;
  assert.equal(select.value, current?.id); assert.equal(select.showSearch, true); assert.equal(select.optionFilterProp, "label");
  assert.deepEqual(plain(select.options.map(o => o.value)), ["ship/old", "ship/other"]);
  assert.equal(one(tree(), "Button", p => p.children === "Link order").props.disabled, true);
  select.onChange("ship/other"); assert.equal(one(tree(), "Button", p => p.children === "Link order").props.disabled, false);
  h.unmount();
});

test("picker query keeps exact exclusions/order, cache/headers, signal, no repeated requests and abort", async () => {
  const { h, requests, tree } = await mountPicker();
  tree(); tree(); assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/shipments?includeOrders=false&excludeStatuses=shipping%2Cdelivered%2Ccanceled");
  assert.equal(requests[0].init.cache, "no-store"); assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(requests[0].init.signal.aborted, false); h.unmount(); assert.equal(requests[0].init.signal.aborted, true);
});

test("picker load failure retries only on click and aborts the replaced request", async () => {
  const { h, requests, tree } = await mountPicker({ fetch: (_url, _init, count) => Response.json(count === 1 ? { error: "synthetic list failure" } : { shipments: [], total: 0 }, { status: count === 1 ? 500 : 200 }) });
  const alert = one(tree(), "Alert"); assert.equal(alert.props.title, "synthetic list failure"); assert.equal(requests.length, 1);
  one(alert.props.action, "Button").props.onClick(); tree(); assert.equal(requests[0].init.signal.aborted, true);
  assert.equal(one(tree(), "Select").props.loading, true); await flush();
  assert.equal(elements(tree(), "Alert").length, 0); assert.equal(requests.length, 2); h.unmount();
});

test("picker ignores aborted request rejection without an automatic retry", async () => {
  const pending = deferred(), { h, requests, tree } = await mountPicker({ fetch: () => pending.promise });
  assert.equal(one(tree(), "Select").props.loading, true); h.unmount(); pending.reject(new Error("aborted")); await flush();
  assert.equal(elements(tree(), "Alert").length, 0); assert.equal(requests.length, 1); assert.equal(requests[0].init.signal.aborted, true);
});

test("picker create modal retains temporary PO, fields, loading, selection, close/reset and notification order", async () => {
  const pending = deferred(), created = shipment("ship/new"), { h, requests, tree } = await mountPicker({ fetch: (_url, init) => init.method === "POST" ? pending.promise : Response.json({ shipments: [], total: 0 }) });
  const menu = one(tree(), "Select").props.popupRender("menu"); one(menu, "Button").props.onClick();
  assert.equal(one(tree(), "Modal").props.open, true);
  const fields = h.formEvents.find(e => e[0] === "set")[1];
  assert.match(fields.poNumber, /^TEMP-\d{8}-\d{6}-\d{3}$/); assert.equal(fields.carrier, "");
  assert.equal(one(tree(), "Form.Item", p => p.name === "poNumber").props.rules[0].message, "Enter a PO number.");
  assert.equal(one(tree(), "Input", p => p.placeholder === "PO number").props.maxLength, 100);
  const promise = one(tree(), "Form").props.onFinish({ poNumber: " PO-NEW ", carrier: " Carrier " });
  assert.equal(one(tree(), "Modal").props.confirmLoading, true); assert.equal(one(tree(), "Modal").props.closable, false);
  pending.resolve(Response.json({ shipment: created })); await promise;
  assert.equal(one(tree(), "Select").props.value, "ship/new"); assert.equal(one(tree(), "Modal").props.open, false);
  assert.deepEqual(JSON.parse(requests[1].init.body), { poNumber: " PO-NEW ", carrier: " Carrier " });
  assert.equal(requests[1].url, "/api/shipments"); assert.equal(requests[1].init.headers.Accept, "application/json"); assert.equal(requests[1].init.headers["Content-Type"], "application/json");
  assert.equal(h.formEvents.filter(e => e[0] === "reset").length, 1);
  assert.deepEqual(h.notifications, ["Shipment master created."]); h.unmount();
});

for (const [body, status, message] of [[{ error: "synthetic create failure" }, 500, "synthetic create failure"], [{}, 500, "Failed to load shipments."], [{}, 200, "The shipment API returned an invalid response."]]) {
  test(`picker create preserves failure: ${message}`, async () => {
    const { h, tree } = await mountPicker({ fetch: (_url, init) => Response.json(init.method === "POST" ? body : { shipments: [], total: 0 }, { status: init.method === "POST" ? status : 200 }) });
    one(one(tree(), "Select").props.popupRender("menu"), "Button").props.onClick();
    await one(tree(), "Form").props.onFinish({ poNumber: "PO" });
    assert.equal(one(tree(), "Modal").props.open, true); assert.equal(one(tree(), "Modal").props.confirmLoading, false);
    assert.equal(one(tree(), "Select").props.value, undefined); assert.deepEqual(h.notifications, [message]); h.unmount();
  });
}

for (const [body, status, message] of [[{ error: "synthetic link conflict" }, 409, "synthetic link conflict"], [{}, 500, "Failed to load shipments."], [{}, 200, "The shipment link API returned an invalid response."]]) {
  test(`picker link preserves failure: ${message}`, async () => {
    const { h, requests, tree } = await mountPicker({ remote: [shipment()], fetch: (_url, init) => Response.json(init.method === "POST" ? body : { shipments: [shipment()], total: 1 }, { status: init.method === "POST" ? status : 200 }) });
    one(tree(), "Select").props.onChange("ship/old"); await one(tree(), "Button", p => p.children === "Link order").props.onClick();
    assert.equal(one(tree(), "Button", p => p.children === "Link order").props.disabled, false);
    assert.deepEqual(h.notifications, [message]); assert.equal(requests[1].url, "/api/shipments/ship%2Fold/orders");
    assert.deepEqual(JSON.parse(requests[1].init.body), { orderId: "order/1" }); h.unmount();
  });
}

test("picker create/link success keeps notification ordering and linked button state", async () => {
  const { h, tree } = await mountPicker({ fetch: (url, init) => Response.json(init.method === "POST" ? url.endsWith("/orders") ? { shipmentOrder: {}, created: true } : { shipment: shipment("new/ship") } : { shipments: [], total: 0 }) });
  await one(tree(), "Form").props.onFinish({ poNumber: "PO", carrier: "C" });
  await one(tree(), "Button", p => p.children === "Link order").props.onClick();
  assert.deepEqual(h.notifications, ["Shipment master created.", "Order linked to shipment."]);
  assert.equal(one(tree(), "Button", p => p.children === "Link order").props.disabled, true); h.unmount();
});
