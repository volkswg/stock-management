import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,{imports={},globals={},source=readFileSync(file,'utf8')}={}){const exports={};new vm.Script(ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText).runInNewContext({exports,Error,Promise,AbortController,JSON,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;}
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
