import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import ts from 'typescript';
import { componentHarness, elements, deferred, flush } from './helpers/component-harness.mjs';

const apiPath = 'src/modules/orders/ui/api.ts';
const pagePath = 'src/modules/orders/ui/create/OrderCreatePage.tsx';
const storageKey = 'stock-orders-pending-creation:v1';
// Load CURRENT sources, without the immutable historical characterization inverses.
function currentSource(path, { imports = {}, globals = {}, source = readFileSync(path, 'utf8') } = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new vm.Script(code).runInNewContext({ exports, Error, Map, Promise, Date, setTimeout,
    FormData, File, Response, TextEncoder, Uint8Array, crypto: crypto.webcrypto,
    console: { error() {} }, ...globals,
    require(spec) { assert.ok(Object.hasOwn(imports, spec), `Unexpected import ${spec}`); return imports[spec]; },
  });
  return exports;
}
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function input(overrides = {}) {
  return { seller: 'Synthetic seller', totalPrice: 123.45, remark: 'Synthetic remark',
    billImages: [new File([new Uint8Array([137, 80, 255])], 'bill.png', { type: 'image/png' })],
    productImages: [new File(['synthetic product'], 'product.webp', { type: 'image/webp' })], ...overrides };
}
function browser(post, { sessionStorage = storage(), postgres = true, source, cryptoOverride } = {}) {
  const requests = [];
  let sql = postgres;
  const fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (options.method === 'HEAD') {
      assert.equal(url, '/api/orders');
      assert.equal(options.cache, 'no-store');
      return new Response(null, { headers: sql ? { 'x-stock-revision': '"stock-v2-23"' } : {} });
    }
    assert.equal(url, '/api/orders/with-images');
    return post(options);
  };
  return { ...currentSource(apiPath, { source, globals: { fetch, sessionStorage, ...(cryptoOverride === undefined ? {} : { crypto: cryptoOverride }) } }),
    sessionStorage, requests, setPostgres(value) { sql = value; }, posts: () => requests.filter(r => r.method === 'POST') };
}
const saved = () => Response.json({ order: { id: 'SYNTHETIC_ORDER_1' } }, { status: 201 });
const pending = b => JSON.parse(b.sessionStorage.getItem(storageKey));

test('multipart creation prefers the Orders collection precondition when the server supplies one',async()=>{
 const token='"stock-edit-v1-'+ 'a'.repeat(64)+'"',requests=[];
 const api=currentSource(apiPath,{globals:{sessionStorage:storage(),fetch:async(url,options)=>{
  requests.push({url,...options});
  return options.method==='HEAD'?new Response(null,{headers:{'x-stock-revision':'"stock-v2-23"','x-stock-edit-scope':'/api/orders','x-stock-edit-revision':token}}):saved();
 }}});
 await api.createOrder(input());
 const post=requests.find(r=>r.method==='POST');assert.ok(post.headers['Idempotency-Key']);
 assert.equal(post.headers['If-Match'],token);assert.equal(post.headers['x-stock-edit-scope'],'/api/orders');
});

// Execute both unchanged PostgreSQL guards against an in-memory transactional
// adapter. No real credentials, SQL connection, files or provider calls are used.
function server({ uploadUncertain = false } = {}) {
  let commands = new Map(), effects = new Map(), tail = Promise.resolve(), uploads = 0, creations = 0;
  class PersistenceFailure extends Error { constructor(status, message) { super(message); this.status = status; } }
  const client = { async query(sql, values) {
    const key = JSON.stringify(values.slice(0, 3));
    if (sql.startsWith('SELECT intent')) {
      const found = commands.get(key); return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
    }
    if (sql.startsWith('SELECT key,state')) return { rows: [...effects].filter(([k]) => k.startsWith(values[0].slice(0, -1))).map(([key, state]) => ({ key, state })) };
    if (sql.startsWith('INSERT INTO stock_operational.commands')) { commands.set(key, { intent: values[3], state: 'pending' }); return {}; }
    if (sql.startsWith('UPDATE stock_operational.commands')) { Object.assign(commands.get(key), { state: 'complete', response: JSON.parse(values[3]) }); return {}; }
    if (sql.startsWith('INSERT INTO stock_operational.side_effects')) { assert.ok(!effects.has(values[0])); effects.set(values[0], 'sending'); return {}; }
    assert.ok(sql.startsWith('UPDATE stock_operational.side_effects'));
    assert.equal(effects.get(values[0]), 'sending'); effects.set(values[0], values[1]); return {};
  } };
  const database = { PersistenceFailure, currentTransaction: () => client, requireMutation: () => client,
    async transaction(_write, run) {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      const beforeCommands = structuredClone(commands), beforeEffects = structuredClone(effects);
      try { return await run(); }
      catch (error) { commands = beforeCommands; effects = beforeEffects; throw error; }
      finally { release(); }
    },
  };
  const command = currentSource('src/infrastructure/persistence/postgres/commands.ts', { imports: { 'server-only': {}, 'node:crypto': crypto, './database': database } });
  const upload = currentSource('src/infrastructure/persistence/postgres/uploads.ts', { imports: { 'server-only': {}, 'node:crypto': crypto, 'node:async_hooks': { AsyncLocalStorage }, './database': database, './commands': command } });
  return { upload, count: () => ({ uploads, creations }), effects: () => [...effects.values()], async post(options) {
    const entries = [];
    for (const [name, value] of options.body.entries()) entries.push(typeof value === 'string' ? [name, value] : [name, value.name, value.type, crypto.createHash('sha256').update(Buffer.from(await value.arrayBuffer())).digest('hex')]);
    try {
      const result = await upload.executeUploadCommand('POST:/api/orders/with-images', options.headers['Idempotency-Key'] || '', command.hashIntent({ query: '', body: command.hashIntent(entries) }), async () => {
        await upload.observeUpload(async () => {
          uploads++;
          if (uploadUncertain) throw Error('Synthetic provider accepted bytes but lost acknowledgement');
          return { id: 'SYNTHETIC_FILE' };
        }, async () => {});
        creations++;
        return { order: { id: 'SYNTHETIC_ORDER_1' } };
      });
      return Response.json(result, { status: 201 });
    } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
  } };
}

test('reproduces pre-fix missing key; current multipart succeeds through unchanged SQL guards', async () => {
  const s = server();
  const before = JSON.parse(readFileSync('tests/fixtures/order-create-key-before.json', 'utf8')).edits[apiPath].before;
  const broken = browser(options => s.post(options), { source: before });
  await assert.rejects(broken.createOrder(input()), /A stable Idempotency-Key is required/);
  assert.deepEqual(s.count(), { uploads: 0, creations: 0 });
  const b = browser(options => s.post(options));
  assert.equal((await b.createOrder(input())).order.id, 'SYNTHETIC_ORDER_1');
  const post = b.posts()[0];
  assert.match(post.headers['Idempotency-Key'], /^order-create:[a-f0-9-]{36}$/);
  assert.equal(post.headers.Accept, 'application/json');
  assert.equal(post.headers['If-Match'], '"stock-v2-23"');
  assert.equal(post.headers['Content-Type'], undefined);
  assert.deepEqual([...post.body.keys()], ['seller', 'totalPrice', 'remark', 'billImages', 'productImages']);
  assert.equal(post.body.get('totalPrice'), '123.45');
  assert.equal(post.body.get('billImages').type, 'image/png');
  assert.equal(b.sessionStorage.getItem(storageKey), null);
  assert.deepEqual(s.count(), { uploads: 1, creations: 1 });
});

test('confirmed success ends intent; a new intentional identical creation gets a new key', async () => {
  const b = browser(saved);
  await b.createOrder(input({ totalPrice: null })); await b.createOrder(input({ totalPrice: null }));
  assert.notEqual(b.posts()[0].headers['Idempotency-Key'], b.posts()[1].headers['Idempotency-Key']);
  assert.equal(b.posts()[0].body.has('totalPrice'), false);
});

test('the existing production fetch helper preserves the explicit feature key and revision on retry', async () => {
  const sessionStorage = storage(), keys = [];
  const window = { async fetch(request, init) {
    if (init?.method === 'HEAD') return new Response(null, { headers: { 'x-stock-revision': '"stock-v2-23"' } });
    assert.ok(request instanceof Request);
    assert.equal(request.headers.get('If-Match'), '"stock-v2-23"');
    keys.push(request.headers.get('Idempotency-Key'));
    if (keys.length === 1) throw Error('Synthetic lost acknowledgement');
    return saved();
  } };
  vm.runInNewContext(readFileSync('public/stock-staging-operations.js', 'utf8'), {
    window, Request, Response, URL, TextEncoder, Uint8Array, FormData, crypto: crypto.webcrypto, sessionStorage,
    location: { href: 'https://example.test/orders/create', origin: 'https://example.test' },
  });
  const api = currentSource(apiPath, { globals: { fetch: window.fetch, sessionStorage } });
  await assert.rejects(api.createOrder(input()), /previous order/);
  const reference = JSON.parse(sessionStorage.getItem(storageKey)).key;
  await api.createOrder(input());
  assert.deepEqual(keys, [reference, reference]); assert.equal(sessionStorage.values.size, 0);
});

test('an older global-helper pending reference cannot be silently replaced on upgrade', async () => {
  const store = storage(), window = { async fetch() { throw Error('Synthetic lost response'); } };
  vm.runInNewContext(readFileSync('public/stock-staging-operations.js', 'utf8'), {
    window, Request, Response, URL, TextEncoder, Uint8Array, FormData, crypto: crypto.webcrypto, sessionStorage: store,
    location: { href: 'https://example.test/orders/create', origin: 'https://example.test' },
  });
  const source = JSON.parse(readFileSync('tests/fixtures/order-create-key-before.json', 'utf8')).edits[apiPath].before;
  const legacy = currentSource(apiPath, { source, globals: { fetch: window.fetch, sessionStorage: store } });
  await assert.rejects(legacy.createOrder(input()), /Synthetic lost response/);
  assert.equal(store.values.size, 1);
  const [[legacyStorageKey, reference]] = [...store.values];
  assert.match(legacyStorageKey, /^stock-pending-operation:/);
  const reload = browser(() => assert.fail('Old operation was blindly resubmitted'), { sessionStorage: store });
  await assert.rejects(reload.createOrder(input()), error => error.message.includes(reference));
  assert.equal(reload.requests.length, 0); assert.equal(store.getItem(storageKey), null);
  assert.equal(store.getItem(legacyStorageKey), reference);
});

test('identical overlapping calls share one request; changed concurrent intent is refused', async () => {
  const gate = deferred(), b = browser(() => gate.promise);
  const first = b.createOrder(input()), duplicate = b.createOrder(input());
  await assert.rejects(b.createOrder(input({ remark: 'Changed during submission' })), /previous order/);
  gate.resolve(saved());
  assert.deepEqual(await first, await duplicate); assert.equal(b.posts().length, 1);
});

test('lost committed response survives reload and identical file reselection, replaying without another upload', async () => {
  const s = server(), store = storage();
  const b = browser(async options => { await s.post(options); throw Error('Lost response'); }, { sessionStorage: store });
  await assert.rejects(b.createOrder(input()), /previous order/);
  const reference = pending(b).key;
  assert.deepEqual(s.count(), { uploads: 1, creations: 1 });
  assert.equal(b.posts().length, 1); // No automatic resend.
  assert.equal(JSON.stringify([...store.values]).includes('Synthetic seller'), false);
  const reload = browser(options => s.post(options), { sessionStorage: store });
  assert.match(reload.getPendingOrderCreationNotice(), /Reselect the same images/);
  assert.equal(reload.posts().length, 0);
  assert.equal((await reload.createOrder(input())).order.id, 'SYNTHETIC_ORDER_1');
  assert.equal(reload.posts()[0].headers['Idempotency-Key'], reference);
  assert.deepEqual(s.count(), { uploads: 1, creations: 1 });
});

test('changed text, image bytes, name, type or order cannot replace a pending identity', async () => {
  const b = browser(() => { throw Error('Network outcome unknown'); });
  await assert.rejects(b.createOrder(input())); const original = pending(b);
  const changes = [input({ seller: 'Changed' }), input({ totalPrice: 0 }), input({ remark: '' }),
    input({ billImages: [new File([new Uint8Array([137, 80, 254])], 'bill.png', { type: 'image/png' })] }),
    input({ billImages: [new File([new Uint8Array([137, 80, 255])], 'other.png', { type: 'image/png' })] }),
    input({ billImages: [new File([new Uint8Array([137, 80, 255])], 'bill.png', { type: 'image/jpeg' })] }),
    input({ billImages: input().productImages, productImages: input().billImages })];
  for (const changed of changes) await assert.rejects(b.createOrder(changed), /previous order/);
  assert.equal(b.posts().length, 1); assert.deepEqual(pending(b), original);
});

test('uncertain provider acceptance is reconciled by the durable guard, never uploaded again', async () => {
  const s = server({ uploadUncertain: true }), store = storage();
  const b = browser(options => s.post(options), { sessionStorage: store });
  await assert.rejects(b.createOrder(input()), /outcome needs review/);
  const reference = pending(b).key;
  assert.deepEqual(s.effects(), ['uncertain']);
  const reload = browser(options => s.post(options), { sessionStorage: store });
  assert.match(reload.getPendingOrderCreationNotice(), /Contact the operator/);
  await assert.rejects(reload.createOrder(input()), /outcome needs review/);
  assert.equal(reload.posts()[0].headers['Idempotency-Key'], reference);
  assert.deepEqual(s.count(), { uploads: 1, creations: 0 });
});

test('a server changed-input conflict preserves the reference and never generates a fallback key', async () => {
  const b = browser(() => Response.json({ error: 'Operation key was already used for different input.' }, { status: 409 }));
  await assert.rejects(b.createOrder(input()), /different input/); const reference = pending(b).key;
  await assert.rejects(b.createOrder(input()), /different input/);
  assert.ok(b.posts().every(p => p.headers['Idempotency-Key'] === reference));
});

test('invalid success JSON or a missing order ID keeps the same pending operation', async () => {
  for (const response of [() => new Response('not-json', { status: 201 }), () => Response.json({ order: {} }, { status: 201 })]) {
    const store = storage(), b = browser(response, { sessionStorage: store });
    await assert.rejects(b.createOrder(input()), /previous order/); const reference = pending(b).key;
    const reload = browser(saved, { sessionStorage: store }); await reload.createOrder(input());
    assert.equal(reload.posts()[0].headers['Idempotency-Key'], reference);
  }
});

test('Sheets keeps multipart compatibility but uncertain Sheets requests are never replayed, even after a backend switch', async () => {
  const success = browser(saved, { postgres: false }); await success.createOrder(input());
  assert.ok(success.posts()[0].headers['Idempotency-Key']);
  assert.equal(success.posts()[0].headers['If-Match'], undefined);
  const store = storage(), sheets = browser(() => { throw Error('Unknown Sheets save'); }, { postgres: false, sessionStorage: store });
  await assert.rejects(sheets.createOrder(input())); const reference = pending(sheets).key;
  for (const postgres of [false, true]) {
    const reload = browser(() => assert.fail('Unsafe Sheets replay'), { postgres, sessionStorage: store });
    await assert.rejects(reload.createOrder(input()), /cannot be retried safely/);
    assert.equal(reload.requests.length, 0); assert.equal(pending(reload).key, reference);
  }
});

test('retry is held if PostgreSQL capability is no longer confirmed', async () => {
  const store = storage(), b = browser(() => { throw Error('Unknown save'); }, { sessionStorage: store });
  await assert.rejects(b.createOrder(input()));
  const reload = browser(() => assert.fail('Unsafe retry'), { postgres: false, sessionStorage: store });
  await assert.rejects(reload.createOrder(input()), /Cannot confirm safe retry/); assert.equal(reload.posts().length, 0);
});

test('validation rejection permits a corrected new operation while an unchanged validation retry retains its key', async () => {
  const b = browser(() => Response.json({ error: 'Invalid order details' }, { status: 400 }));
  await assert.rejects(b.createOrder(input()), /Invalid order details/); const reference = pending(b).key;
  await assert.rejects(b.createOrder(input()), /Invalid order details/); assert.equal(pending(b).key, reference);
  await assert.rejects(b.createOrder(input({ seller: 'Corrected' })), /Invalid order details/); assert.notEqual(pending(b).key, reference);
});

test('storage or secure-crypto failure cannot send a keyless multipart request or forget a corrupt pending identity', async () => {
  const corrupt = storage(); corrupt.setItem(storageKey, '{}');
  const disabled = { getItem() { throw Error('Disabled'); }, setItem() { throw Error('Disabled'); } };
  const discarded = { getItem() { return null; }, setItem() {} };
  for (const sessionStorage of [corrupt, disabled, discarded]) {
    const b = browser(() => assert.fail('Unsafe POST'), { sessionStorage });
    await assert.rejects(b.createOrder(input()), /browser cannot/); assert.equal(b.posts().length, 0);
  }
  const b = browser(() => assert.fail('Unsafe POST'), { cryptoOverride: null });
  await assert.rejects(b.createOrder(input()), /secure browser/); assert.equal(b.posts().length, 0);
});

function createPage(api) {
  const h = componentHarness(pagePath, { api, load: currentSource });
  let tree = h.render(h.module.OrderCreatePage);
  for (const field of elements(tree, 'ImageUploadField')) field.props.onChange([{ uid: field.props.label, originFileObj: input().billImages[0] }]);
  tree = h.render();
  return { h, submit: elements(tree, 'Form')[0].props.onFinish };
}
test('current form callback locks synchronous double-clicks and stays locked after success until navigation', async () => {
  const gate = deferred(); let calls = 0;
  const { h, submit } = createPage({ createOrder() { calls++; return gate.promise; }, getPendingOrderCreationNotice() {} });
  const first = submit({}); await submit({}); assert.equal(calls, 1);
  gate.resolve({ order: { id: 'SYNTHETIC_ORDER_1' } }); await first;
  await submit({}); assert.equal(calls, 1); assert.deepEqual(h.navigation, ['/orders/SYNTHETIC_ORDER_1']);
});
test('current form unlocks after an uncertain response and displays the recoverable pending reference', async () => {
  const b = browser(() => { throw Error('Lost response'); }), { h, submit } = createPage(b);
  await submit({}); const reference = pending(b).key;
  await submit({}); assert.equal(b.posts().length, 2);
  assert.ok(b.posts().every(p => p.headers['Idempotency-Key'] === reference));
  assert.match(elements(h.render(), 'Alert')[0].props.description, /previous order/);
  const reload = createPage(b);
  await flush();
  assert.match(elements(reload.h.render(), 'Alert')[0].props.description, /Reselect the same images/);
  assert.equal(b.posts().length, 2);
});
