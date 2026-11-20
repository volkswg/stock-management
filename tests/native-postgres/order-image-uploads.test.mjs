import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { dirname, resolve } from 'node:path';
const plain = value => JSON.parse(JSON.stringify(value));
async function waitFor(predicate) { for (let n = 0; n < 250; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); } assert.ok(predicate(), "Expected async operation did not start"); }
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

function load(file, { imports = {}, globals = {}, source = readFileSync(file, 'utf8') } = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { fileName: file.replace(/\.mjs$/, '.ts'), compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new vm.Script(code).runInNewContext({ exports, Error, Map, Set, Promise, Date, setTimeout,
    File, FormData, Response, AbortController, TextEncoder, Uint8Array, crypto: webcrypto,
    ...globals, require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected dependency ${name}`); return imports[name]; },
  });
  return exports;
}
// Reuse the existing component harness body with a closed CURRENT-source
// loader. Its default historical loader intentionally cannot load this release.
const { componentHarness, elements } = load('tests/helpers/component-harness.mjs', {
  source: readFileSync('tests/helpers/component-harness.mjs', 'utf8').replace(/^import .*;\n/gm, ''),
  globals: { readFileSync, dirname, resolve, ts, canonicalPath: path => path, loadSource: load },
});
function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const image = (text = 'synthetic', size) => new File([size ? new Uint8Array(size) : text], text + '.jpeg', { type: 'image/jpeg' });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function browser(post, store = storage(), postgres = true) {
  const posts = [];
  const api = load('src/modules/orders/ui/api.ts', { globals: { sessionStorage: store, fetch: async (url, init) => {
    assert.equal(url, '/api/orders' + (init.method === 'HEAD' ? '' : '/with-images'));
    if (init.method === 'HEAD') return new Response(null, { headers: postgres ? { 'x-stock-revision': '"stock-v2-23"' } : {} });
    posts.push(init); return post(init, posts.length);
  } } });
  return { ...api, posts, store };
}
const receipt = (init, n = 1) => ({ id: uuid(n), url: `https://example.invalid/image/${n}`, imageType: init.body.get('imageType'), uploadKey: init.headers['Idempotency-Key'] });
const saved = () => Response.json({ order: { id: 'SYNTHETIC_ORDER' } }, { status: 201 });
const pendingOrderKey = 'stock-orders-pending-creation:v1';
const refs = () => ['bill', 'product'].map((imageType, i) => ({ id: uuid(i + 1), url: `https://example.invalid/${i}`, imageType, uploadKey: 'order-image:' + uuid(i + 1) }));

test('each selection uploads separately even when their combined bytes exceed the platform limit; creation sends JSON references only', async () => {
  const b = browser((init, n) => typeof init.body === 'string' ? saved() : Response.json({ image: receipt(init, n) }, { status: 201 }));
  const bill = await b.uploadOrderCreationImage(image('bill', 3_000_000), 'bill');
  assert.equal(b.posts.length, 1); // Upload before the user submits the order.
  const product = await b.uploadOrderCreationImage(image('product', 3_000_000), 'product');
  await b.createOrderFromUploadedImages({ seller: 'Synthetic', images: [bill, product] });
  assert.equal(b.posts.length, 3);
  for (const post of b.posts.slice(0, 2)) {
    assert.equal(post.body.getAll('image').length, 1);
    assert.equal(post.body.get('operation'), 'upload');
    assert.ok(post.body.get('image').size < 4_000_000);
    assert.match(post.headers['Idempotency-Key'], /^order-image:/);
  }
  const order = b.posts[2]; assert.equal(order.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(order.body).images, [bill, product]);
  assert.ok(order.body.length < 1000); assert.match(order.headers['Idempotency-Key'], /^order-create:/);
});

test('oversized and unsupported individual images are refused before HEAD, POST or pending identity creation', async () => {
  const b = browser(() => assert.fail('Oversized image was sent'));
  await assert.rejects(b.uploadOrderCreationImage(image('large', 4_000_001), 'bill'), /4 MB/);
  await assert.rejects(b.uploadOrderCreationImage(new File(['x'], 'x.svg', { type: 'image/svg+xml' }), 'bill'), /JPEG/);
  assert.equal(b.posts.length, 0); assert.equal(b.store.data.size, 0);
});

test('overlapping selection events share one upload; completed receipt survives reload and exact file reselection', async () => {
  const gate = deferred(), b = browser(init => gate.promise.then(() => Response.json({ image: receipt(init) }, { status: 201 })));
  const first = b.uploadOrderCreationImage(image(), 'bill'), duplicate = b.uploadOrderCreationImage(image(), 'bill');
  await flush(); gate.resolve(); assert.deepEqual(plain(await first), plain(await duplicate)); assert.equal(b.posts.length, 1);
  const reload = browser(() => assert.fail('Completed upload was repeated'), b.store);
  assert.deepEqual(plain(await reload.uploadOrderCreationImage(image(), 'bill')), plain(await first)); assert.equal(reload.posts.length, 0);
});

test('lost image acknowledgement survives reload and uses the same key and bytes; changed image gets a distinct upload intent', async () => {
  const b = browser(() => { throw Error('Synthetic response loss'); });
  await assert.rejects(b.uploadOrderCreationImage(image(), 'bill'), /unconfirmed/);
  const key = b.posts[0].headers['Idempotency-Key'];
  const reload = browser(init => Response.json({ image: receipt(init) }, { status: 201 }), b.store);
  await reload.uploadOrderCreationImage(image(), 'bill');
  assert.equal(reload.posts[0].headers['Idempotency-Key'], key);
  assert.deepEqual(Buffer.from(await reload.posts[0].body.get('image').arrayBuffer()), Buffer.from(await b.posts[0].body.get('image').arrayBuffer()));
  await reload.uploadOrderCreationImage(image('changed'), 'bill');
  assert.notEqual(reload.posts[1].headers['Idempotency-Key'], key);
});

test('uploads are serialized; an uncertain provider response is retained and never retried automatically', async () => {
  const gate = deferred(), b = browser((init, n) => n === 1 ? gate.promise : Response.json({ image: receipt(init, n) }, { status: 201 }));
  const first = b.uploadOrderCreationImage(image('a'), 'bill');
  const failed = assert.rejects(first, /reconciliation/);
  // Hashing independent files may finish out of selection order. Establish the
  // first pending provider request before testing that the next is queued.
  await waitFor(() => b.posts.length === 1);
  const second = b.uploadOrderCreationImage(image('b'), 'product');
  await flush(); assert.equal(b.posts.length, 1);
  gate.resolve(Response.json({ error: 'Upload outcome requires reconciliation.' }, { status: 503 }));
  await failed; await second; assert.equal(b.posts.length, 2);
  const key = b.posts[0].headers['Idempotency-Key'];
  const reload = browser(init => { assert.equal(init.headers['Idempotency-Key'], key); return Response.json({ error: 'Upload outcome requires reconciliation.' }, { status: 503 }); }, b.store);
  await assert.rejects(reload.uploadOrderCreationImage(image('a'), 'bill'), /reconciliation/); assert.equal(reload.posts.length, 1);
});

test('platform 413 is readable for text or nested JSON and cannot erase earlier image uncertainty', async () => {
  for (const response of [() => new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 }), () => Response.json({ error: { code: 'FUNCTION_PAYLOAD_TOO_LARGE' } }, { status: 413 })]) {
    const b = browser(response); await assert.rejects(b.uploadOrderCreationImage(image(), 'bill'), /too large/);
    const [state] = [...b.store.data.values()].map(JSON.parse); assert.equal(state.phase, 'rejected');
    const uncertain = browser(() => { throw Error('Unknown'); }); await assert.rejects(uncertain.uploadOrderCreationImage(image(), 'bill'));
    const reload = browser(response, uncertain.store); await assert.rejects(reload.uploadOrderCreationImage(image(), 'bill'), /earlier upload still needs review/);
    assert.equal(JSON.parse([...reload.store.data.values()][0]).phase, 'review');
  }
});

test('missing storage or malformed upload metadata stops the request; a legacy uncertain order is preserved', async () => {
  const store = storage(); store.setItem = () => { throw Error('Unavailable'); };
  const b = browser(() => assert.fail('Storage failure was bypassed'), store);
  await assert.rejects(b.uploadOrderCreationImage(image(), 'bill'), /preserve/); assert.equal(b.posts.length, 0);
  const legacy = browser(() => { throw Error('Lost legacy order response'); });
  await assert.rejects(legacy.createOrder({ billImages: [image('bill')], productImages: [image('product')] }));
  const bad = browser(() => { throw Error('Lost image'); });
  await assert.rejects(bad.uploadOrderCreationImage(image(), 'bill'));
  const badKey = [...bad.store.data.keys()][0]; bad.store.setItem(badKey, 'not-json');
  const malformed = browser(() => assert.fail('Malformed identity was replaced'), bad.store);
  await assert.rejects(malformed.uploadOrderCreationImage(image(), 'bill'), /previous upload needs review/);
  assert.equal(malformed.posts.length, 0);
  const original = legacy.store.getItem(pendingOrderKey);
  const next = browser(() => assert.fail('Legacy uncertainty was bypassed'), legacy.store);
  await assert.rejects(next.uploadOrderCreationImage(image('new'), 'bill'), /previous order/);
  assert.equal(next.store.getItem(pendingOrderKey), original);
});

test('JSON order double click shares one request; uncertain retry and reload keep identity and reject changed input', async () => {
  const gate = deferred(), b = browser(() => gate.promise), input = { seller: 'Synthetic', images: refs() };
  const first = b.createOrderFromUploadedImages(input), same = b.createOrderFromUploadedImages(input);
  const failure1 = assert.rejects(first, /previous order/), failure2 = assert.rejects(same, /previous order/);
  await assert.rejects(b.createOrderFromUploadedImages({ ...input, remark: 'changed' }), /previous order/);
  await flush(); gate.reject(Error('Lost acknowledgement')); await failure1; await failure2; assert.equal(b.posts.length, 1);
  const key = b.posts[0].headers['Idempotency-Key'];
  const reload = browser(saved, b.store);
  await assert.rejects(reload.createOrderFromUploadedImages({ ...input, seller: 'Changed' }), /previous order/);
  await reload.createOrderFromUploadedImages(input); assert.equal(reload.posts[0].headers['Idempotency-Key'], key);
  await reload.createOrderFromUploadedImages(input); assert.notEqual(reload.posts[1].headers['Idempotency-Key'], key);
});

test('413 on a later order retry retains uncertainty; rejected first request permits correction', async () => {
  const input = { images: refs() }, b = browser(() => new Response('too large', { status: 413 }));
  await assert.rejects(b.createOrderFromUploadedImages(input), /too large/);
  assert.equal(JSON.parse(b.store.getItem(pendingOrderKey)).phase, 'rejected');
  const unknown = browser(() => { throw Error('Unknown commit'); }); await assert.rejects(unknown.createOrderFromUploadedImages(input));
  const retry = browser(() => new Response('too large', { status: 413 }), unknown.store);
  await assert.rejects(retry.createOrderFromUploadedImages(input), /earlier attempt still needs review/);
  assert.equal(JSON.parse(retry.store.getItem(pendingOrderKey)).phase, 'review');
});

test('selection callbacks start upload before submit; incomplete or failed images cannot create an order; success sends references once', async () => {
  const gate = deferred(), calls = [], creates = [];
  const h = componentHarness('src/modules/orders/ui/create/OrderCreatePage.tsx', { load, api: {
    MAX_ORDER_IMAGE_BYTES: 4_000_000, getPendingOrderCreationNotice: () => undefined,
    uploadOrderCreationImage: async (file, type) => { calls.push([file.name, type]); if (type === 'bill') await gate.promise; return refs().find(r => r.imageType === type); },
    createOrderFromUploadedImages: async input => { creates.push(input); return { order: { id: 'SYNTHETIC_ORDER' } }; },
  } });
  let tree = h.mount(h.module.OrderCreatePage); const fields = elements(tree, 'ImageUploadField');
  fields[0].props.onChange([{ uid: 'b', name: 'b', originFileObj: image('bill') }]);
  fields[1].props.onChange([{ uid: 'p', name: 'p', originFileObj: image('product') }]);
  assert.equal(calls.length, 2); tree = h.render();
  await elements(tree, 'Form')[0].props.onFinish({ seller: 'Synthetic' }); assert.equal(creates.length, 0);
  gate.resolve(); await flush(); tree = h.render();
  const submit = elements(tree, 'Form')[0].props.onFinish;
  await Promise.all([submit({ seller: 'Synthetic' }), submit({ seller: 'Synthetic' })]);
  assert.equal(creates.length, 1); assert.deepEqual(plain(creates[0].images), refs()); assert.equal(creates[0].billImages, undefined);
  assert.deepEqual(plain(h.navigation), ['/orders/SYNTHETIC_ORDER']); h.unmount();
});

test('failed selection stays blocked until the same file is explicitly retried', async () => {
  const selected = [{ uid: 'b', name: 'bill', originFileObj: image('bill') }];
  let attempts = 0, created = 0;
  const h = componentHarness('src/modules/orders/ui/create/OrderCreatePage.tsx', { load, api: {
    MAX_ORDER_IMAGE_BYTES: 4_000_000, getPendingOrderCreationNotice: () => undefined,
    uploadOrderCreationImage: async (file, type) => { if (type === 'bill' && ++attempts === 1) throw Error('Synthetic unconfirmed upload; same reference'); return refs().find(r => r.imageType === type); },
    createOrderFromUploadedImages: async () => { created++; return { order: { id: 'SYNTHETIC_ORDER' } }; },
  } });
  let tree = h.mount(h.module.OrderCreatePage), fields = elements(tree, 'ImageUploadField');
  fields[0].props.onChange(selected); fields[1].props.onChange([{ uid: 'p', originFileObj: image('product') }]);
  await flush(); tree = h.render();
  await elements(tree, 'Form')[0].props.onFinish({}); assert.equal(created, 0); assert.equal(attempts, 1);
  fields = elements(tree, 'ImageUploadField'); assert.match(fields[0].props.imageStates.b.error, /unconfirmed/);
  fields[0].props.onRetry(selected[0]); await flush(); tree = h.render();
  await elements(tree, 'Form')[0].props.onFinish({}); assert.equal(created, 1); assert.equal(attempts, 2); h.unmount();
});
