import { assertShipmentHttpHistory } from "./helpers/shipments-http-history.mjs";
import { assertShipmentEnumContractHistory } from "./helpers/shipments-enum-history.mjs";
import { assertOrdersDetailServerHistory } from "./helpers/orders-detail-history.mjs";
import { assertShipmentDriveRouteHistory } from "./helpers/shipments-drive-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { shipmentUiPath } from "./helpers/shipment-ui-paths.mjs";
import { componentHarness, elements, flush } from "./helpers/component-harness.mjs";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/shipments-browser-client.json", import.meta.url), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex"), printer = ts.createPrinter();
const parse = file => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const apiPath = () => shipmentUiPath("api.ts");
const api = fetch => loadSource(apiPath(), { globals: { Error, FormData, File, fetch } });
const one = (tree, name, predicate = () => true) => { const e = elements(tree, name).find(e => predicate(e.props)); assert.ok(e, name); return e; };

test("original client raw bytes, every function/guard and all seven exported types remain identical", () => {
  const file = apiPath(), source = parse(file), exported = n => n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  assert.equal(hash(readFileSync(file)), baseline.rawHash);
  const body = source.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, source)).join("\n");
  assert.equal(hash(body), baseline.bodyHash);
  assert.deepEqual(Object.keys(api(() => assert.fail("No HTTP during module loading"))).sort(), baseline.exports.toSorted());
  assert.deepEqual(Object.fromEntries(source.statements.filter(ts.isFunctionDeclaration).map(n => [n.name.text, hash(printer.printNode(ts.EmitHint.Unspecified, n, source))])), baseline.functions);
  assert.deepEqual(Object.fromEntries(source.statements.filter(n => exported(n) && ts.isTypeAliasDeclaration(n)).map(n => [n.name.text, printer.printNode(ts.EmitHint.Unspecified, n, source)])), baseline.types);
  for (const [consumer, expected] of Object.entries(baseline.consumers)) {
    const s = parse(consumer), body = s.statements.filter(n => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, s)).join("\n");
    assert.equal(hash(body), expected, consumer);
  }
  for (const [file, expected] of Object.entries(baseline.retained)) {
    if (["src/app/api/shipments/route.ts", "src/app/api/shipments/[id]/orders/route.ts"].includes(file)) { assertShipmentHttpHistory(file, expected); continue; }
    if (file === "src/modules/shipments/contracts.ts") { assertShipmentEnumContractHistory(file, expected); continue; }
    if (file === "src/modules/orders/server.ts") assertOrdersDetailServerHistory(file, expected);
    else if (file === "src/app/api/shipments/[id]/route.ts") assertShipmentDriveRouteHistory(file, expected);
    else assert.equal(hash(readFileSync(file)), expected, file);
  }
});

test("real client defaults/omissions, encoded GETs, POST payloads and JSON PATCH headers retain exact wire behavior", async () => {
  const calls = [], replies = [{ shipments: [], total: 0 }, { shipment: { orders: [] } }, { shipment: {} }, { shipmentOrder: {}, created: false }, { shipment: { status: "delivered", updatedAt: "fixed", shippingBillUrl: "" } }];
  const client = api(async (url, init) => { calls.push({ url, init }); return Response.json(replies.shift()); });
  assert.deepEqual(plain(await client.getShipments()), { shipments: [], total: 0 });
  await client.getShipment("s/?:#"); await client.createShipmentMaster({ poNumber: " PO ", carrier: undefined });
  assert.deepEqual(plain(await client.linkOrderToShipment("s/1", "o/1")), { shipmentOrder: {}, created: false });
  await client.advanceShipmentStatus("s/1", { status: "delivered", deliveryFee: 0, poNumber: undefined });
  assert.equal(calls[0].url, "/api/shipments"); assert.equal(calls[0].init.method, "GET"); assert.equal(calls[0].init.cache, "no-store"); assert.equal(calls[0].init.signal, undefined);
  assert.deepEqual(plain(calls[0].init.headers), { Accept: "application/json" });
  assert.equal(calls[1].url, "/api/shipments/s%2F%3F%3A%23"); assert.equal(calls[1].init.cache, "no-store");
  assert.equal(calls[2].url, "/api/shipments"); assert.equal(calls[2].init.method, "POST"); assert.deepEqual(JSON.parse(calls[2].init.body), { poNumber: " PO " });
  assert.equal(calls[3].url, "/api/shipments/s%2F1/orders"); assert.deepEqual(JSON.parse(calls[3].init.body), { orderId: "o/1" });
  assert.equal(calls[4].init.method, "PATCH"); assert.deepEqual(JSON.parse(calls[4].init.body), { status: "delivered", deliveryFee: 0 });
  for (const request of calls.slice(2)) assert.deepEqual(plain(request.init.headers), { Accept: "application/json", "Content-Type": "application/json" });
  assert.equal(calls.length, 5);
});

test("multipart optional omissions, zero-byte files and deliveryFee omission preserve the existing client edge cases", async () => {
  const calls = [], client = api(async (url, init) => { calls.push({ url, init }); return Response.json({ shipment: { status: "shipping", updatedAt: "fixed", shippingBillUrl: "bill" } }); });
  const file = new File([], "synthetic.png", { type: "image/png" });
  await client.advanceShipmentStatus("s/1", { status: "shipping", deliveryFee: 123, shippingBill: file });
  assert.equal(calls[0].url, "/api/shipments/s%2F1"); assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(plain(calls[0].init.headers), { Accept: "application/json" });
  const body = calls[0].init.body; assert.ok(body instanceof FormData); assert.equal(body.get("status"), "shipping"); assert.equal(body.get("poNumber"), null); assert.equal(body.get("deliveryFee"), null);
  assert.equal(body.get("shippingBill").size, 0); assert.equal(body.get("shippingBill").name, "synthetic.png"); assert.equal(body.get("shippingBill").type, "image/png");
});

const operations = [
  ["getShipments", []], ["getShipment", ["s/1"]], ["createShipmentMaster", [{ poNumber: "PO" }]],
  ["linkOrderToShipment", ["s/1", "o/1"]], ["advanceShipmentStatus", ["s/1", { status: "ready_to_ship" }]],
];
for (const [name, args] of operations) test(`real ${name} preserves network/AbortError/JSON rejection identity and never retries`, async () => {
  for (const failure of [new Error("synthetic network"), new DOMException("synthetic abort", "AbortError"), new SyntaxError("synthetic JSON")]) {
    let count = 0;
    const client = api(async () => { count++; if (failure instanceof SyntaxError) return { ok: true, json: async () => { throw failure; } }; throw failure; });
    await assert.rejects(client[name](...args), error => error === failure); assert.equal(count, 1);
  }
});

test("HTTP error parsing preserves empty messages, non-string fallbacks and shallow success guards", async () => {
  for (const [body, expected] of [[{ error: "" }, ""], [{ error: 123 }, "Failed to load shipments."], [null, "Failed to load shipments."]]) {
    const client = api(async () => Response.json(body, { status: 500 }));
    await assert.rejects(client.getShipments(), error => error.message === expected);
  }
  const client = api(async () => Response.json({ shipment: { status: "unknown-status-still-a-string", updatedAt: "", shippingBillUrl: "" } }));
  assert.equal((await client.advanceShipmentStatus("s/1", { status: "ready_to_ship" })).shipment.status, "unknown-status-still-a-string");
});

test("Shipment list retry executes the actual client, keeps loading/error states and aborts replaced/unmounted reads", async () => {
  const calls = [], client = api(async (url, init) => { calls.push({ url, init }); return Response.json(calls.length === 1 ? { error: "synthetic list failure" } : { shipments: [], total: 0 }, { status: calls.length === 1 ? 500 : 200 }); });
  const h = componentHarness("src/modules/shipments/ui/ShipmentListPage.tsx", { api: client });
  assert.equal(one(h.render(h.module.ShipmentListPage), "Table").props.loading, true); await flush();
  let tree = h.render(); assert.equal(one(tree, "Alert").props.description, "synthetic list failure"); assert.equal(calls.length, 1);
  one(one(tree, "Alert").props.action, "Button").props.onClick(); tree = h.render(); assert.equal(one(tree, "Table").props.loading, true); assert.equal(calls[0].init.signal.aborted, true); await flush();
  tree = h.render(); assert.equal(elements(tree, "Alert").length, 0); h.render(); assert.equal(calls.length, 2);
  h.unmount(); assert.equal(calls[1].init.signal.aborted, true);
});

test("Shipment detail uses the real client for encoded read, ready JSON update and shipping multipart confirmation", async () => {
  let current = { id: "s/1", status: "draft", poNumber: "PO", carrier: "", shippingFee: null, shippedAt: "", deliveredAt: "", orders: [], costSummary: null, createdAt: "", updatedAt: "", createdBy: "web", shippingBillUrl: "" };
  const calls = [], client = api(async (url, init) => {
    calls.push({ url, init });
    if (init.method === "GET") return Response.json({ shipment: current });
    const status = init.body instanceof FormData ? init.body.get("status") : JSON.parse(init.body).status;
    return Response.json({ shipment: { status, updatedAt: "fixed", shippingBillUrl: status === "shipping" ? "url" : "" } });
  });
  const h = componentHarness("src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx", { api: client });
  h.render(h.module.ShipmentDetailPage, { shipmentId: current.id }); await flush();
  const content = one(h.render(), "ShipmentContent"), props = () => ({ shipment: current, onShipmentChange: update => { current = update(current); } });
  let tree = h.mount(content.type, props()); one(tree, "Button", p => p.children === "Mark ready to ship").props.onClick(); await flush();
  tree = h.render(undefined, props()); one(tree, "Button", p => p.children === "Start shipping").props.onClick(); tree = h.render();
  const file = new File(["synthetic"], "bill.pdf", { type: "application/pdf" }); one(tree, "Upload").props.onChange({ fileList: [{ uid: "new", originFileObj: file }] }); tree = h.render();
  one(one(tree, "Modal", p => p.title === "Start shipping"), "Form").props.onFinish({ poNumber: " CONFIRMED " }); await flush();
  assert.equal(calls[0].url, "/api/shipments/s%2F1"); assert.equal(calls[0].init.cache, "no-store");
  assert.deepEqual(JSON.parse(calls[1].init.body), { status: "ready_to_ship" });
  assert.deepEqual(plain(calls[2].init.headers), { Accept: "application/json" }); assert.equal(calls[2].init.body.get("poNumber"), " CONFIRMED "); assert.equal(calls[2].init.body.get("deliveryFee"), null);
  assert.deepEqual(h.notifications, ["Shipment status updated to ready to ship.", "Shipment status updated to shipping."]); assert.equal(calls.length, 3); h.unmount();
});

test("completed client move has exactly three resolved consumers, no retired app file/shim and one HTTP implementation", async () => {
  const { existsSync, readdirSync } = await import("node:fs"), { resolve, relative } = await import("node:path");
  assert.equal(existsSync(baseline.from), false); assert.equal(existsSync(baseline.to), true);
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, process.cwd()).options;
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
  const consumers = []; let implementations = 0;
  for (const file of walk("src").filter(f => /\.tsx?$/.test(f))) {
    const s = parse(file);
    implementations += s.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === "getShipments").length;
    for (const node of s.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
      const specifier = node.moduleSpecifier.text;
      assert.ok(!/(^|\/)app\/shipments\/api(?:\.ts)?$/.test(specifier), `${file}: retired ${specifier}`);
      const target = ts.resolveModuleName(specifier, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
      if (target && relative(process.cwd(), target) === baseline.to) consumers.push(file);
    }
  }
  assert.equal(implementations, 1);
  assert.deepEqual(consumers.sort(), Object.keys(baseline.consumers).sort());
  for (const [file, expected] of [["src/modules/shipments/ui/ShipmentListPage.tsx", "./api"], ["src/modules/shipments/ui/[id]/ShipmentDetailPage.tsx", "../api"], ["src/app/orders/[id]/OrderDetailClient.tsx", "@/modules/shipments/ui/api"]]) assert.ok(parse(file).statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === expected));
});
