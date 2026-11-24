import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,{imports={},globals={},source=readFileSync(file,'utf8')}={}){
 const exports={};const code=ts.transpileModule(source,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new vm.Script(code).runInNewContext({exports,Error,Promise,AbortController,JSON,...globals,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected dependency '+name);return imports[name];}});return exports;
}
const {componentHarness,elements}=load('tests/helpers/component-harness.mjs',{source:readFileSync('tests/helpers/component-harness.mjs','utf8').replace(/^import .*;\n/gm,''),globals:{readFileSync,dirname,resolve,ts,canonicalPath:path=>path,loadSource:load}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
function setup({ fail = false } = {}) {
 const calls = [], updates = [];
 const h = componentHarness('src/modules/orders/ui/[id]/OrderDetailPage.tsx', {
   api: { updateOrderDetails: async (id, input) => {
     calls.push({ id, input: plain(input) });
     if (fail) throw new Error('Save failed');
     return { order: { id, seller: input.seller, status: 'complete', totalPrice: 42, remark: '', updatedAt: 'now' } };
   } },
   load: (file, options) => load(file, { ...options, source: readFileSync(file, 'utf8') + '\nexport { OrderSeller };' }),
 });
 h.mount(h.module.OrderSeller, { order: { id: 'o', seller: 'Original' }, onUpdated: value => updates.push(plain(value)) });
 const tree = () => h.render();
 const button = name => elements(tree(), 'Button').find(b => b.props['aria-label'] === name);
 const input = () => elements(tree(), 'Input')[0];
 return { h, calls, updates, tree, button, input, async click(name) { button(name).props.onClick(); await flush(); }, change(value) { input().props.onChange({ target: { value } }); } };
}

test('seller editor opens with saved text, trims on save and updates the parent', async () => {
 const b = setup();
 await b.click('Edit seller');
 assert.equal(b.input().props.value, 'Original');
 assert.equal(b.input().props.maxLength, 100);
 assert.equal(b.button('Save seller').props.disabled, true);
 b.change('  New seller  ');
 await b.click('Save seller');
 assert.deepEqual(b.calls, [{ id: 'o', input: { seller: 'New seller' } }]);
 assert.equal(b.updates[0].seller, 'New seller');
 assert.ok(b.button('Edit seller'));
});

test('Cancel discards the draft without a request', async () => {
 const b = setup();
 await b.click('Edit seller');
 b.change('Discard');
 await b.click('Cancel seller edit');
 assert.equal(b.calls.length, 0);
 await b.click('Edit seller');
 assert.equal(b.input().props.value, 'Original');
});

test('failed saves keep the draft and show the error for retry', async () => {
 const b = setup({ fail: true });
 await b.click('Edit seller');
 b.change('Keep draft');
 await b.click('Save seller');
 assert.equal(b.input().props.value, 'Keep draft');
 assert.equal(b.updates.length, 0);
 assert.ok(elements(b.tree(), 'Text').some(t => t.props.children === 'Save failed'));
 assert.equal(b.input().props.disabled, false);
});

test('clearing the seller saves an empty string; overlength drafts cannot save', async () => {
 const b = setup();
 await b.click('Edit seller');
 b.change('x'.repeat(101));
 assert.equal(b.button('Save seller').props.disabled, true);
 b.input().props.onPressEnter();
 await flush();
 assert.equal(b.calls.length, 0);
 b.change('');
 b.input().props.onPressEnter();
 await flush();
 assert.equal(b.calls[0].input.seller, '');
});
