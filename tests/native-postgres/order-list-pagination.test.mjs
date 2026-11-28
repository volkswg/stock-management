// Historical client-only pagination witnesses. Current server paging is tested in scoped-order-pagination.test.mjs and real PostgreSQL acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import scopedHistory from '../helpers/scoped-reads-history.cjs';
function load(file,{imports={},globals={},source=scopedHistory.beforeScopedReads(file).toString()}={}){
 const exports={};const code=ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new vm.Script(code).runInNewContext({exports,Error,Promise,AbortController,JSON,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;
}
const {componentHarness,elements}=load('tests/helpers/component-harness.mjs',{source:readFileSync('tests/helpers/component-harness.mjs','utf8').replace(/^import .*;\n/gm,''),globals:{readFileSync,dirname,resolve,ts,canonicalPath:path=>path,loadSource:load}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const orders = Array.from({ length: 25 }, (_, index) => ({
  id: `order-${index + 1}`, seller: `Seller ${index + 1}`, createdBy: "web",
  status: "complete", shipmentId: null, totalPrice: 10, createdAt: "", productImages: [],
}));

function setup(href = "https://example.invalid/orders", request = async () => ({ orders })) {
  let currentUrl = new URL(href);
  const listeners = new Map(), state = { preserved: true }, writes = [];
  const browser = {
    get location() { return { href: currentUrl.href }; },
    history: { state, replaceState(value, unused, url) {
      assert.equal(value, state);
      currentUrl = new URL(url);
      writes.push(currentUrl.href);
    } },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name); },
  };
  const h = componentHarness("src/modules/orders/ui/OrderListPage.tsx", {
    load, globals: { window: browser, URL }, api: { getOrders: request },
  });
  h.mount(h.module.OrderListPage);
  const tree = () => h.render();
  return {
    h, tree, writes, listeners,
    get href() { return currentUrl.href; },
    pagination: () => elements(tree(), "Pagination")[0],
    rows: () => plain(elements(tree(), "Table")[0].props.dataSource.map(row => row.id)),
    navigate(url) { currentUrl = new URL(url); listeners.get("popstate")(); },
    async ready() { await flush(); tree(); },
  };
}

test("pagination survives a fresh mount using the URL, preserving unrelated parameters and hash", async () => {
  const b = setup("https://example.invalid/orders?other=value#list");
  await b.ready();
  b.pagination().props.onChange(2);
  assert.equal(b.href, "https://example.invalid/orders?other=value&page=2#list");
  assert.equal(b.rows()[0], "order-11");
  b.h.unmount();
  const refreshed = setup(b.href);
  await refreshed.ready();
  assert.equal(refreshed.pagination().props.current, 2);
  assert.deepEqual(refreshed.rows(), b.rows());
});

test("restored pages wait for data before clamping and stale pages clamp to the last available page", async () => {
  let resolve;
  const pending = new Promise(yes => { resolve = yes; });
  const b = setup("https://example.invalid/orders?page=99", () => pending);
  assert.equal(b.writes.length, 0);
  resolve({ orders });
  await b.ready();
  assert.equal(b.pagination().props.current, 3);
  assert.deepEqual(b.rows(), ["order-21", "order-22", "order-23", "order-24", "order-25"]);
  assert.equal(new URL(b.href).searchParams.get("page"), "3");
});

test("invalid page values default to page one", async () => {
  for (const page of ["", "0", "-1", "1.5", "abc", "Infinity", "9007199254740992"]) {
    const b = setup(`https://example.invalid/orders?page=${page}`);
    await b.ready();
    assert.equal(b.pagination().props.current, 1, page);
    assert.equal(b.rows()[0], "order-1");
  }
});

test("search, status and shipment filter changes reset the saved page", async () => {
  for (const filter of ["search", "status", "shipment"]) {
    const b = setup("https://example.invalid/orders?page=2&other=value");
    await b.ready();
    if (filter === "search") elements(b.tree(), "Input")[0].props.onChange({ target: { value: "Seller" } });
    if (filter === "status") elements(b.tree(), "Tabs")[0].props.onChange("completed");
    if (filter === "shipment") elements(b.tree(), "Select")[0].props.onChange("not-linked");
    assert.equal(b.pagination().props.current, 1);
    assert.equal(new URL(b.href).searchParams.has("page"), false);
    assert.equal(new URL(b.href).searchParams.get("other"), "value");
  }
});

test("empty lists normalize to page one; failed requests preserve the requested page for retry", async () => {
  const empty = setup("https://example.invalid/orders?page=3", async () => ({ orders: [] }));
  await empty.ready();
  assert.equal(empty.pagination().props.current, 1);
  assert.equal(new URL(empty.href).searchParams.has("page"), false);
  const failed = setup("https://example.invalid/orders?page=3", async () => { throw Error("Offline"); });
  await failed.ready();
  assert.equal(new URL(failed.href).searchParams.get("page"), "3");
  assert.equal(failed.writes.length, 0);
});

test("browser history navigation restores the page and unmount removes its listener", async () => {
  const b = setup();
  await b.ready();
  b.navigate("https://example.invalid/orders?page=2");
  assert.equal(b.pagination().props.current, 2);
  assert.equal(b.rows()[0], "order-11");
  b.h.unmount();
  assert.equal(b.listeners.has("popstate"), false);
});

test("the additive history inverse restores exact predecessor bytes and rejects unrelated edits", async () => {
  const { createRequire } = await import("node:module");
  const { createHash } = await import("node:crypto");
  const { beforeOrderPagination } = createRequire(import.meta.url)("../helpers/order-list-pagination-history.cjs");
  const fixture = JSON.parse(readFileSync("tests/fixtures/order-list-pagination-before.json", "utf8"));
  for (const [file, edit] of Object.entries(fixture.edits)) {
    assert.equal(createHash("sha256").update(beforeOrderPagination(file)).digest("hex"), edit.beforeSha256);
    assert.throws(() => beforeOrderPagination(file, Buffer.concat([readFileSync(file), Buffer.from("\n")])));
  }
});
