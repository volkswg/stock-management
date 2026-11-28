// Historical client-only pagination witnesses. Current server paging is tested in scoped-order-pagination.test.mjs and real PostgreSQL acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import scopedHistory from '../helpers/scoped-reads-history.cjs';
function load(file,{imports={},globals={},source=scopedHistory.beforeScopedReads(file).toString()}={}){const exports={};new vm.Script(ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText).runInNewContext({exports,Error,Promise,AbortController,JSON,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;}
const{componentHarness,elements}=load('tests/helpers/component-harness.mjs',{source:readFileSync('tests/helpers/component-harness.mjs','utf8').replace(/^import .*;\n/gm,'').replace('const imports = {','const imports = {\"next/link\":{__esModule:true,default:\"Link\"},'),globals:{readFileSync,dirname,resolve,ts,canonicalPath:path=>path,loadSource:load}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test("order page size applies to desktop and mobile, resets the page and survives filtering", async () => {
  const orders = Array.from({ length: 55 }, (_, index) => ({
    id: `order-${index}`, seller: "Seller", createdBy: "Owner",
    status: "complete", totalPrice: 100, createdAt: "2026-11-01",
    shipmentId: null, productImages: [],
  }));
  let href = "https://example.test/orders";
  const browser = {
    location: { get href() { return href; } },
    history: { state: null, replaceState(_state, _title, url) { href = String(url); } },
    addEventListener() {}, removeEventListener() {},
  };
  const h = componentHarness("src/modules/orders/ui/OrderListPage.tsx", {
    load, globals: { window: browser, URL },
    api: { getOrders: async () => ({ orders }) },
  });
  const one = (tree, type) => elements(tree, type)[0];
  h.render(h.module.OrderListPage);
  await flush();
  let tree = h.render();
  assert.equal(one(tree, "Table").props.dataSource.length, 10);
  assert.equal(one(tree, "Pagination").props.showSizeChanger["aria-label"], "Orders per page");
  one(tree, "Pagination").props.onChange(5, 10);
  tree = h.render();
  assert.equal(one(tree, "Table").props.dataSource[0].id, "order-40");
  one(tree, "Pagination").props.onChange(3, 20);
  tree = h.render();
  assert.equal(one(tree, "Pagination").props.current, 1);
  assert.equal(new URL(href).searchParams.has("page"), false);
  assert.equal(one(tree, "Table").props.dataSource.length, 20);
  assert.equal(elements(tree, "OrderMobileCard").length, 20);
  one(tree, "Pagination").props.onChange(3, 20);
  tree = h.render();
  assert.equal(one(tree, "Table").props.dataSource.length, 15);
  one(tree, "Input").props.onChange({ target: { value: "order-1" } });
  tree = h.render();
  assert.equal(one(tree, "Pagination").props.current, 1);
  assert.equal(one(tree, "Pagination").props.pageSize, 20);
  assert.equal(one(tree, "Table").props.dataSource.length, 11);
  one(tree, "Input").props.onChange({ target: { value: "" } });
  for (const size of [50, 100, 10]) {
    one(h.render(), "Pagination").props.onChange(1, size);
    tree = h.render();
    assert.equal(one(tree, "Table").props.dataSource.length, Math.min(size, 55));
    assert.equal(elements(tree, "OrderMobileCard").length, Math.min(size, 55));
  }
  h.unmount();
});

const persistedOrders = Array.from({ length: 135 }, (_, index) => ({
  id: `order-${index}`, seller: "Seller", createdBy: "Owner",
  status: "complete", totalPrice: 100, createdAt: "2026-11-01",
  shipmentId: null, productImages: [],
}));

function pageSizeHarness(href, request = async () => ({ orders: persistedOrders })) {
  let url = new URL(href), requests = 0;
  const listeners = new Map(), historyState = { keep: "existing navigation state" }, writes = [];
  const browser = {
    get location() { return { href: url.href }; },
    history: { state: historyState, replaceState(state, _title, next) {
      assert.equal(state, historyState);
      url = new URL(next);
      writes.push(url.href);
    } },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const h = componentHarness("src/modules/orders/ui/OrderListPage.tsx", {
    load, globals: { window: browser, URL },
    api: { getOrders: (...args) => { requests++; return request(...args); } },
  });
  h.mount(h.module.OrderListPage);
  const tree = () => h.render();
  return {
    h, tree, writes, listeners,
    get href() { return url.href; },
    get requests() { return requests; },
    pagination: () => elements(tree(), "Pagination")[0],
    rows: () => elements(tree(), "Table")[0].props.dataSource.map(row => row.id),
    navigate(next) { url = new URL(next); listeners.get("popstate")(); },
    async ready() { await flush(); tree(); },
  };
}

test("selected size and page survive refresh for every nondefault size without losing other URL state", async () => {
  for (const size of [20, 50, 100]) {
    const b = pageSizeHarness("https://example.test/orders?other=keep#list");
    await b.ready();
    b.pagination().props.onChange(1, size);
    b.pagination().props.onChange(2, size);
    assert.equal(new URL(b.href).searchParams.get("pageSize"), String(size));
    assert.equal(new URL(b.href).searchParams.get("page"), "2");
    assert.equal(new URL(b.href).searchParams.get("other"), "keep");
    assert.equal(new URL(b.href).hash, "#list");
    assert.equal(b.requests, 1);
    const rows = b.rows();
    b.h.unmount();
    const refreshed = pageSizeHarness(b.href);
    await refreshed.ready();
    assert.equal(refreshed.pagination().props.pageSize, size);
    assert.equal(refreshed.pagination().props.current, 2);
    assert.deepEqual(refreshed.rows(), rows);
    assert.equal(elements(refreshed.tree(), "OrderMobileCard").length, rows.length);
    refreshed.h.unmount();
  }
});

test("legacy URLs and unsupported page sizes retain the default ten orders", async () => {
  for (const value of [undefined, "", "0", "-20", "20.0", "020", "+20", "25", "abc", "9007199254740992"]) {
    const url = new URL("https://example.test/orders?page=2&other=keep#list");
    if (value !== undefined) url.searchParams.set("pageSize", value);
    const b = pageSizeHarness(url.href);
    await b.ready();
    assert.equal(b.pagination().props.pageSize, 10, String(value));
    assert.equal(b.rows()[0], "order-10");
    assert.equal(new URL(b.href).searchParams.has("pageSize"), false);
    assert.equal(new URL(b.href).searchParams.get("other"), "keep");
    assert.equal(new URL(b.href).hash, "#list");
    b.h.unmount();
  }
});

test("returning to size ten removes the size parameter and resets the page", async () => {
  const b = pageSizeHarness("https://example.test/orders?page=2&pageSize=50&other=keep");
  await b.ready();
  b.pagination().props.onChange(2, 10);
  assert.equal(b.pagination().props.pageSize, 10);
  assert.equal(b.pagination().props.current, 1);
  assert.equal(new URL(b.href).searchParams.has("pageSize"), false);
  assert.equal(new URL(b.href).searchParams.has("page"), false);
  assert.equal(new URL(b.href).searchParams.get("other"), "keep");
  b.h.unmount();
});

test("search and filters reset the page while preserving its restored size", async () => {
  for (const filter of ["search", "status", "shipment"]) {
    const b = pageSizeHarness("https://example.test/orders?page=2&pageSize=50");
    await b.ready();
    if (filter === "search") elements(b.tree(), "Input")[0].props.onChange({ target: { value: "Seller" } });
    if (filter === "status") elements(b.tree(), "Tabs")[0].props.onChange("completed");
    if (filter === "shipment") elements(b.tree(), "Select")[0].props.onChange("not-linked");
    assert.equal(b.pagination().props.pageSize, 50);
    assert.equal(b.pagination().props.current, 1);
    assert.equal(new URL(b.href).searchParams.get("pageSize"), "50");
    assert.equal(new URL(b.href).searchParams.has("page"), false);
    b.h.unmount();
  }
});

test("history navigation restores size and page together and cleans up its listener", async () => {
  const b = pageSizeHarness("https://example.test/orders?page=3&pageSize=20");
  await b.ready();
  b.navigate("https://example.test/orders?page=2&pageSize=50&other=keep#history");
  assert.equal(b.pagination().props.pageSize, 50);
  assert.equal(b.pagination().props.current, 2);
  assert.equal(b.rows()[0], "order-50");
  assert.equal(new URL(b.href).hash, "#history");
  b.navigate("https://example.test/orders?page=3");
  assert.equal(b.pagination().props.pageSize, 10);
  assert.equal(b.rows()[0], "order-20");
  b.h.unmount();
  assert.equal(b.listeners.has("popstate"), false);
});

test("loading and errors preserve the requested pair; successful loading clamps using the saved size", async () => {
  let resolve;
  const pending = new Promise(yes => { resolve = yes; });
  const b = pageSizeHarness("https://example.test/orders?page=99&pageSize=100", () => pending);
  b.tree();
  assert.equal(b.writes.length, 0);
  resolve({ orders: persistedOrders });
  await b.ready();
  assert.equal(b.pagination().props.pageSize, 100);
  assert.equal(b.pagination().props.current, 2);
  assert.equal(b.rows()[0], "order-100");
  assert.equal(new URL(b.href).searchParams.get("page"), "2");
  assert.equal(new URL(b.href).searchParams.get("pageSize"), "100");
  b.h.unmount();
  const failed = pageSizeHarness("https://example.test/orders?page=3&pageSize=50", async () => { throw Error("Offline"); });
  await failed.ready();
  assert.equal(new URL(failed.href).searchParams.get("page"), "3");
  assert.equal(new URL(failed.href).searchParams.get("pageSize"), "50");
  assert.equal(failed.writes.length, 0);
  failed.h.unmount();
});

test("pagination above and below the results shares page, size and saved URL state", async () => {
  const b = pageSizeHarness("https://example.test/orders?page=2&pageSize=20");
  await b.ready();
  const controls = () => elements(b.tree(), "Pagination");
  assert.equal(controls().length, 2);
  const card = elements(b.tree(), "Card").find(node => node.props.className === "orderList");
  const children = card.props.children;
  const top = children.findIndex(node => node?.props?.["aria-label"] === "Orders pagination above list");
  const bottom = children.findIndex(node => node?.props?.["aria-label"] === "Orders pagination below list");
  const desktop = children.findIndex(node => node?.props?.className === "desktopOrderTable");
  const mobile = children.findIndex(node => node?.props?.className === "mobileOrderList");
  assert.ok(top >= 0 && top < desktop && top < mobile);
  assert.ok(bottom > desktop && bottom > mobile);
  controls()[1].props.onChange(1, 50);
  for (const control of controls()) {
    assert.equal(control.props.current, 1);
    assert.equal(control.props.pageSize, 50);
    assert.equal(control.props.responsive, true);
  }
  assert.equal(b.rows().length, 50);
  controls()[0].props.onChange(2, 50);
  for (const control of controls()) assert.equal(control.props.current, 2);
  assert.equal(new URL(b.href).searchParams.get("pageSize"), "50");
  assert.equal(new URL(b.href).searchParams.get("page"), "2");
  assert.equal(b.requests, 1);
  b.h.unmount();
});
