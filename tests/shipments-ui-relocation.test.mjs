import {restoreFeatureSource} from "./helpers/features-retirement-history.mjs";
import {restoreEnvironmentTemplate} from "./helpers/loyverse-accounts-history.mjs";
import {readArchive} from "./helpers/retirement-history.mjs";
import { assertShipmentEnumContractHistory } from "./helpers/shipments-enum-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { componentHarness, elements, flush } from "./helpers/component-harness.mjs";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { shipmentUiPath } from "./helpers/shipment-ui-paths.mjs";
import { assertPickerDetailParity } from "./helpers/orders-picker-structure.mjs";
import { pickerFromHttp } from "./helpers/orders-picker.mjs";

const baseline = JSON.parse(readArchive(new URL("./fixtures/shipments-ui-relocation.json", import.meta.url), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const source = file => ts.createSourceFile(file, readArchive(file, "utf8"), ts.ScriptTarget.Latest, true);
const bodyHash = file => { const s = source(file), printer = ts.createPrinter(); return hash(s.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, s)).join("\n")); };
const one = (tree, type, predicate = () => true) => { const item = elements(tree, type).find(e => predicate(e.props)); assert.ok(item, type); return item; };

test("seven original Shipment source bodies/CSS and route wrapper metadata/JSX remain equal before and after moves", () => {
  for (const entry of baseline.files) {
    const file = shipmentUiPath(entry.from.slice("src/app/shipments/".length));
    assert.equal(file.endsWith(".css") ? hash(readArchive(file)) : bodyHash(file), entry.hash, file);
  }
  for (const entry of baseline.wrappers) assert.equal(bodyHash(entry.file), entry.hash, entry.file);
  for (const [file, expected] of Object.entries(baseline.retained)) {
    if (file === ".env.example") { assert.equal(hash(restoreEnvironmentTemplate()), expected, file); continue; }
    if (file === "src/modules/shipments/contracts.ts") { assertShipmentEnumContractHistory(file, expected); continue; }
    if (file === "src/modules/orders/ui/[id]/OrderDetailPage.tsx") assertPickerDetailParity();
    else assert.equal(hash(restoreFeatureSource(baseline.files.find(e => e.from === file)?.to ?? file)), expected, file);
  }
});

test("Orders shipment picker executes original query/create/link requests through the real retained browser client", async () => {
  const requests = [], existing = { id: "ship/old", poNumber: "PO-OLD", status: "draft", carrier: "" };
  const api = loadSource("src/modules/shipments/ui/api.ts", { globals: { fetch: async (url, init) => {
    requests.push({ url, init });
    return Response.json(init.method === "POST" ? url.endsWith("/orders") ? { shipmentOrder: { id: "link" }, created: true } : { shipment: { id: "ship/new", poNumber: "PO-NEW", status: "draft", carrier: "Carrier" } } : { shipments: [existing], total: 1 });
  } } });
  const initial = { id: "order/1", status: "complete", totalPrice: 1, seller: "S", remark: "", createdAt: "created", productImages: [], billImages: [], shipment: existing, shipmentId: existing.id };
  const h = componentHarness("src/modules/orders/ui/[id]/OrderDetailPage.tsx", { api: { getOrder: async () => ({ order: initial }) } });
  h.render(h.module.OrderDetailPage, { orderId: initial.id, shipmentPicker: pickerFromHttp(api) }); await flush();
  const content = one(h.render(), "OrderContent"); const card = one(h.mount(content.type, content.props), "ShipmentLinkCard");
  h.mount(card.type, card.props); await flush();
  assert.equal(one(h.render(), "Select").props.value, "ship/old");
  await one(h.render(), "Form").props.onFinish({ poNumber: "PO-NEW", carrier: "Carrier" });
  assert.equal(one(h.render(), "Select").props.value, "ship/new");
  await one(h.render(), "Button", p => p.children === "Link order").props.onClick();
  assert.deepEqual(requests.map(({ url }) => url), ["/api/shipments?includeOrders=false&excludeStatuses=shipping%2Cdelivered%2Ccanceled", "/api/shipments", "/api/shipments/ship%2Fnew/orders"]);
  assert.equal(requests[0].init.cache, "no-store");
  assert.deepEqual(JSON.parse(requests[1].init.body), { poNumber: "PO-NEW", carrier: "Carrier" });
  assert.deepEqual(JSON.parse(requests[2].init.body), { orderId: "order/1" });
  assert.deepEqual(h.notifications, ["Shipment master created.", "Order linked to shipment."]);
  h.unmount(); assert.equal(requests[0].init.signal.aborted, true);
});

test("Shipment list/detail execute actual browser reads with encoded IDs and preserve abort signals", async () => {
  const shipment = { id: "s/1", status: "draft", poNumber: "PO", orders: [], carrier: "", createdAt: "", shippingFee: null, costSummary: null };
  for (const [file, component, props, expected] of [["ShipmentListPage.tsx", "ShipmentListPage", undefined, "/api/shipments"], ["[id]/ShipmentDetailPage.tsx", "ShipmentDetailPage", { shipmentId: "s/1" }, "/api/shipments/s%2F1"]]) {
    const calls = [], api = loadSource("src/modules/shipments/ui/api.ts", { globals: { fetch: async (url, init) => { calls.push({ url, init }); return Response.json({ shipments: [shipment], total: 1, shipment }); } } });
    const h = componentHarness(shipmentUiPath(file), { api });
    h.render(h.module[component], props); await flush(); h.render();
    assert.equal(calls[0].url, expected); assert.equal(calls[0].init.cache, "no-store");
    assert.equal(calls[0].init.signal.aborted, false); h.unmount(); assert.equal(calls[0].init.signal.aborted, true);
    assert.equal(plain(calls).length, 1);
  }
});

test("all seven implementations/styles move once; four wrappers reference their exact module UI/CSS entries", async () => {
  const { existsSync, readdirSync } = await import("node:fs");
  const moved = baseline.files.filter(e => e.moved); assert.equal(moved.length, 7);
  for (const entry of moved) { assert.equal(existsSync(entry.from), false, entry.from); assert.equal(existsSync(entry.to), true, entry.to); }
  assert.equal(existsSync("src/app/shipments/api.ts"), false, "No legacy client, compatibility shim or placeholder may remain");
  assert.deepEqual(readdirSync("src/app/shipments").sort(), ["[id]", "loading.tsx", "page.tsx"]);
  assert.deepEqual(readdirSync("src/app/shipments/[id]").sort(), ["loading.tsx", "page.tsx"]);
  const imports = [
    ["src/app/shipments/page.tsx", "@/modules/shipments/ui/ShipmentListPage"],
    ["src/app/shipments/loading.tsx", "@/modules/shipments/ui/shipments.module.css"],
    ["src/app/shipments/[id]/page.tsx", "@/modules/shipments/ui/[id]/ShipmentDetailPage"],
    ["src/app/shipments/[id]/loading.tsx", "@/modules/shipments/ui/[id]/shipmentDetail.module.css"],
  ];
  for (const [file, target] of imports) assert.ok(source(file).statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === target), file);
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
  assert.deepEqual(walk("src/modules/shipments/ui").sort(), moved.map(e => e.to).sort());
  for (const file of walk("src").filter(f => /\.tsx?$/.test(f))) {
    const text = readArchive(file, "utf8");
    for (const entry of moved) assert.ok(!text.includes(`@/${entry.from.slice(4).replace(/\.(tsx?|css)$/, "")}`), `${file}: retired ${entry.from}`);
  }
  for (const [file, client] of [["ShipmentListPage.tsx", "./api"], ["[id]/ShipmentDetailPage.tsx", "../api"]]) assert.ok(source(shipmentUiPath(file)).statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === client));
});
