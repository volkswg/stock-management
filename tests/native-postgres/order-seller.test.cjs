/* eslint-disable @typescript-eslint/no-require-imports -- Current owners with synthetic storage and no providers. */
require('../helpers/postgres-runtime.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const orders = require('../../src/modules/orders/server.ts');

function setup() {
  const record = { id: 'order-one', seller: 'Original seller', status: 'waiting_for_total_price', totalPrice: null, remark: 'Keep remark', createdAt: 'created', createdBy: 'web' };
  const writes = [];
  const storage = { orders: { all: async () => [record], update: async (row, changes) => { writes.push(changes); Object.assign(row, changes); } } };
  const exports = {};
  const imports = {
    '@/composition/postgres/route': { withPersistence: handler => handler },
    'next/server': { NextResponse: Response },
    '@/composition/postgres/service': { createBusinessDatabase: () => storage },
    '@/modules/orders/server': orders,
    '@/modules/shipments/infrastructure/postgres/order-detail-shipment-projection': {},
  };
  const filename = 'src/app/api/orders/[id]/route.ts';
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, console, require: name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; } });
  return { record, writes, patch: (body, id = record.id) => exports.PATCH(new Request('http://localhost/api/orders/order-one', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) }) };
}

test('seller PATCH persists trimmed text and preserves price, status, remark and creation fields', async () => {
  const s = setup();
  const response = await s.patch({ seller: ' New seller ' });
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.seller, 'New seller');
  assert.equal(s.record.seller, order.seller);
  assert.equal(s.record.status, 'waiting_for_total_price');
  assert.equal(s.record.totalPrice, null);
  assert.equal(s.record.remark, 'Keep remark');
  assert.equal(s.record.createdAt, 'created');
  assert.equal(s.record.createdBy, 'web');
  assert.ok(order.updatedAt);
  assert.equal(s.writes.length, 1);
});

test('seller can be cleared and omitted seller is preserved by other edits', async () => {
  const s = setup();
  await s.patch({ remark: 'Updated remark' });
  assert.equal(s.record.seller, 'Original seller');
  assert.equal((await s.patch({ seller: '  ' })).status, 200);
  assert.equal(s.record.seller, '');
  assert.equal((await s.patch({ seller: 'x'.repeat(100), totalPrice: 42 })).status, 200);
  assert.equal(s.record.seller.length, 100);
  assert.equal(s.record.totalPrice, 42);
  assert.equal(s.record.status, 'complete');
});

test('invalid seller values and empty updates return 400 without writes', async () => {
  for (const body of [{ seller: null }, { seller: 1 }, { seller: [] }, { seller: {} }, { seller: 'x'.repeat(101) }, {}]) {
    const s = setup();
    assert.equal((await s.patch(body)).status, 400, JSON.stringify(body));
    assert.equal(s.writes.length, 0);
  }
});

test('missing orders and invalid status do not write seller', async () => {
  const s = setup();
  assert.equal((await s.patch({ seller: 'New' }, 'missing')).status, 404);
  s.record.status = 'unknown';
  assert.equal((await s.patch({ seller: 'New' })).status, 409);
  assert.equal(s.writes.length, 0);
});

test('historical inverse restores exact prior bytes and rejects unrelated changes', () => {
  const { beforeSeller } = require('../helpers/order-seller-history.cjs');
  const { createHash } = require('node:crypto');
  const fixture = JSON.parse(fs.readFileSync('tests/fixtures/order-seller-before.json'));
  for (const [name, edit] of Object.entries(fixture.edits)) {
    assert.equal(createHash('sha256').update(beforeSeller(name)).digest('hex'), edit.beforeSha256);
    assert.throws(() => beforeSeller(name, Buffer.concat([fs.readFileSync(name), Buffer.from('\n')])));
  }
});

test('browser API sends seller to PATCH and accepts the saved seller in the response', async () => {
  const s = setup(), exports = {}, requests = [];
  const filename = 'src/modules/orders/ui/api.ts';
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    exports, JSON, Error, encodeURIComponent,
    fetch: async (url, init) => {
      requests.push({ url, method: init.method });
      return s.patch(JSON.parse(init.body));
    },
  });
  const result = await exports.updateOrderDetails('order-one', { seller: 'Edited from browser' });
  assert.deepEqual(requests, [{ url: '/api/orders/order-one', method: 'PATCH' }]);
  assert.equal(result.order.seller, 'Edited from browser');
  assert.equal(s.record.seller, result.order.seller);
});
