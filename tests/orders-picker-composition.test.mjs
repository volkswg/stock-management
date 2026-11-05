import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { builtinModules } from "node:module";
import test from "node:test";
import ts from "typescript";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { pickerComposition } from "./helpers/orders-picker.mjs";
import { componentHarness, elements, flush, deferred } from "./helpers/component-harness.mjs";
import { assertPickerDetailParity } from "./helpers/orders-picker-structure.mjs";

const clientPath = "src/app/orders/[id]/OrderDetailClient.tsx", detailPath = "src/modules/orders/ui/[id]/OrderDetailPage.tsx";
const one = (tree, name, match = () => true) => { const e = elements(tree, name).find(e => match(e.props)); assert.ok(e, name); return e; };
const real = fetch => loadSource("src/modules/shipments/ui/api.ts", { globals: { Error, fetch } });
const port = fetch => pickerComposition(real(fetch)).render("order/1").props.shipmentPicker;

test("client composition supplies one stable adapter and no DOM; server page passes only the original orderId", async () => {
  const component = function OrderDetailPage() {}, composed = pickerComposition(real(() => assert.fail("No HTTP during composition")), component);
  const first = composed.render("o/1"), second = composed.render("o/2");
  assert.equal(first.type, component); assert.equal(first.props.shipmentPicker, second.props.shipmentPicker);
  assert.deepEqual(Object.keys(first.props), ["orderId", "shipmentPicker"]);
  assert.equal(second.props.orderId, "o/2");
  const page = loadSource("src/app/orders/[id]/page.tsx", { imports: { "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) }, "./OrderDetailClient": composed.module } });
  const tree = await page.default({ params: Promise.resolve({ id: "o/1" }) });
  assert.equal(tree.type, composed.module.OrderDetailClient); assert.deepEqual(plain(tree.props), { orderId: "o/1" });
  assert.deepEqual(plain(page.metadata), { title: "Order details | Stock Management", description: "Review order information, bills, and product images." });
  assert.ok(readFileSync(clientPath, "utf8").startsWith('"use client";'));
  assert.ok(!readFileSync("src/app/orders/[id]/page.tsx", "utf8").includes('"use client"'));
});

test("composition preserves exact exclusions, AbortSignal and delegation identity without mapping/retries", async () => {
  const calls = [], list = { shipments: [{ id: "s/1", status: "draft" }], total: 1 }, created = { shipment: { id: "s/new", status: "draft" } };
  const http = { getShipments: async input => { calls.push(input); return list; }, createShipmentMaster: async input => { calls.push(input); return created; }, linkOrderToShipment: async (...args) => { calls.push(args); return { shipmentOrder: {}, created: true }; } };
  const picker = pickerComposition(http).render("one").props.shipmentPicker, controller = new AbortController();
  assert.equal(await picker.listLinkableShipments({ signal: controller.signal }), list);
  assert.equal(calls[0].signal, controller.signal); assert.deepEqual(plain(calls[0].excludeStatuses), ["shipping", "delivered", "canceled"]); assert.equal(calls[0].includeOrders, false);
  const input = { poNumber: " PO ", carrier: " C " }; assert.equal(await picker.createShipmentMaster(input), created); assert.equal(calls[1], input);
  assert.equal(await picker.linkOrderToShipment("s/1", "o/1"), undefined); assert.deepEqual(calls[2], ["s/1", "o/1"]); assert.equal(calls.length, 3);
});

for (const [body, status, message] of [[{ error: "synthetic list failure" }, 500, "synthetic list failure"], [{}, 500, "Failed to load shipments."], [{ shipments: [] }, 200, "The shipments API returned an invalid response."]]) test(`real composition list preserves response failure: ${message}`, async () => {
  const picker = port(async () => Response.json(body, { status }));
  await assert.rejects(picker.listLinkableShipments({}), e => e.message === message);
});

test("all adapter operations propagate original network rejection identity without retry", async () => {
  const failure = new Error("synthetic network"), calls = [];
  const picker = port(async (...args) => { calls.push(args); throw failure; });
  await assert.rejects(picker.listLinkableShipments({}), e => e === failure);
  await assert.rejects(picker.createShipmentMaster({ poNumber: "PO" }), e => e === failure);
  await assert.rejects(picker.linkOrderToShipment("s/1", "o/1"), e => e === failure);
  assert.equal(calls.length, 3);
});

test("link port waits for the real HTTP response guard before resolving void", async () => {
  const json = deferred(), calls = [];
  const picker = port(async (url, init) => { calls.push({ url, init }); return { ok: true, json: () => json.promise }; });
  let settled = false;
  const pending = picker.linkOrderToShipment("s/1", "o/1"); pending.then(() => { settled = true; }, () => { settled = true; });
  await flush(); assert.equal(settled, false);
  json.resolve({ created: true });
  await assert.rejects(pending, e => e.message === "The shipment link API returned an invalid response.");
  assert.equal(calls[0].url, "/api/shipments/s%2F1/orders");
  assert.equal(calls[0].init.headers.Accept, "application/json"); assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { orderId: "o/1" });
});

test("a fake Orders-owned port receives only signal, retains lifecycle and refetches only for dependency replacement", async () => {
  const inputCalls = [], signalCalls = [], initial = { id: "o/1", status: "complete", seller: "S", totalPrice: 1, productImages: [], billImages: [], shipment: null, shipmentId: null };
  const shipmentPicker = { listLinkableShipments: async input => { inputCalls.push(Object.keys(input)); signalCalls.push(input.signal); return { shipments: [] }; }, createShipmentMaster: async () => { throw "non-Error"; }, linkOrderToShipment: async () => { throw "non-Error"; } };
  const h = componentHarness(detailPath, { api: { getOrder: async () => ({ order: initial }) } });
  h.render(h.module.OrderDetailPage, { orderId: initial.id, shipmentPicker }); await flush();
  const content = one(h.render(), "OrderContent"); assert.equal(content.props.shipmentPicker, shipmentPicker);
  const card = one(h.mount(content.type, content.props), "ShipmentLinkCard"); assert.equal(card.props.shipmentPicker, shipmentPicker);
  h.mount(card.type, card.props); await flush(); h.render(); h.render();
  assert.deepEqual(inputCalls, [["signal"]]); assert.equal(signalCalls[0].aborted, false);
  await one(h.render(), "Form").props.onFinish({ poNumber: "PO" }); assert.equal(h.notifications.at(-1), "Failed to create shipment.");
  one(h.render(), "Select").props.onChange("s/1"); await one(h.render(), "Button", p => p.children === "Link order").props.onClick(); assert.equal(h.notifications.at(-1), "Failed to link order to shipment.");
  h.render(undefined, { ...card.props, shipmentPicker: { ...shipmentPicker } }); await flush();
  assert.equal(signalCalls[0].aborted, true); assert.equal(signalCalls.length, 2); h.unmount(); assert.equal(signalCalls[1].aborted, true);
});

test("reviewed picker plumbing retains every original statement, including non-picker functions and JSX", () => {
  assertPickerDetailParity();
  const source = ts.createSourceFile(detailPath, readFileSync(detailPath, "utf8"), ts.ScriptTarget.Latest, true);
  for (const name of ["OrderDetailPage", "OrderContent", "ShipmentLinkCard"]) {
    const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    const property = fn.parameters[0].type.members.find(m => m.name.getText() === "shipmentPicker");
    assert.ok(property && !property.questionToken); assert.equal(property.type.getText(), "OrderShipmentPickerPort");
  }
  assert.ok(readFileSync(detailPath, "utf8").includes("[currentShipment, shipmentPicker, shipmentsRequestId]"));
});

for (const runtime of [true, false]) test(`app client composition graph is browser-safe and file-acyclic (${runtime ? "runtime" : "including types"})`, () => {
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  const visited = new Set(), active = [], forbidden = new Set([...builtinModules, ...builtinModules.map(n => `node:${n}`), "server-only", "next/server", "next/headers", "next/cache", "googleapis", "google-auth-library"]);
  function visit(file) {
    assert.ok(!active.includes(file), `File cycle: ${[...active, file].join(" -> ")}`); if (visited.has(file)) return;
    assert.ok(!/^src\/(config|externals|infrastructure|features\/backend)\//.test(file), file);
    assert.ok(!file.startsWith("src/services/"), file);
    assert.ok(!/\/(application|infrastructure)\/|\/server\.ts$/.test(file), file);
    assert.ok(!file.startsWith("src/app/") || file === clientPath, file);
    active.push(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const n of source.statements) {
      if (!(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) || !n.moduleSpecifier) continue;
      const clause = n.importClause, names = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
      if (runtime && (n.isTypeOnly || clause?.isTypeOnly || (names?.length && !clause.name && names.every(e => e.isTypeOnly)))) continue;
      const specifier = n.moduleSpecifier.text; assert.ok(!forbidden.has(specifier), `${file}: ${specifier}`);
      const target = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
      if (target) { const project = relative(process.cwd(), target); if (project.startsWith("src/")) visit(project); }
      else if (/^(\.|@\/)/.test(specifier) && !specifier.endsWith(".css")) assert.fail(`Unresolved ${specifier}`);
    }
    active.pop(); visited.add(file);
  }
  visit(clientPath); assert.ok(visited.has(detailPath)); assert.ok(visited.has("src/modules/shipments/ui/api.ts")); assert.ok(visited.has("src/modules/shipments/contracts.ts"));
});
