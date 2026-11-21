/* eslint-disable @typescript-eslint/no-require-imports -- Execute current adapters and HTTP owner with synthetic stores and no providers. */
require('../helpers/postgres-runtime.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const orders = require('../../src/modules/orders/server.ts');
const { PostgresOrderDetailShipmentProjection } = require('../../src/modules/shipments/infrastructure/postgres/order-detail-shipment-projection.ts');
const { shipmentsTables } = require('../../src/modules/shipments/infrastructure/postgres/tables.ts');

const at = '2026-11-01T01:00:00.000Z';
const order = { id: 'order-one', status: 'draft', seller: 'Synthetic', totalPrice: '10', createdAt: at };
const shipment = (id, extra = {}) => ({ id, status: 'shipping', poNumber: 'PO-synthetic', carrier: 'Synthetic carrier', shippingFee: '12.50', remark: 'Shipment remark', shippingBillUrl: 'https://example.invalid/bill', createdAt: at, ...extra });
const link = (shipmentId, extra = {}) => ({ id: 'link-' + shipmentId, shipmentId, orderId: order.id, createdAt: at, ...extra });

function storage({ links = [], shipments = [], orders: orderRows = [order] } = {}) {
  // Match the actual native repository's public field names; no legacy alias.
  const columns = shipmentsTables().shipmentOrders.columns;
  const store = rows => ({ all: async direction => [...rows].sort((a, b) => {
    const time = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    return (direction === 'descending' ? -time : time) || a.id.localeCompare(b.id);
  }) });
  return {
    orders: store(orderRows), orderItems: store([]), orderBills: store([]),
    shipmentOrders: store(links.map(row => Object.fromEntries(Object.keys(columns).map(key => [key, row[key]])))),
    shipments: store(shipments),
  };
}

async function detail(data) {
  const service = storage(data);
  return orders.getOrderDetail({ storage: service, orderId: order.id, shipmentProjection: new PostgresOrderDetailShipmentProjection(service) });
}

test('native orderId link returns shipment ID and all shipment details', async () => {
  const result = await detail({ links: [link('shipment-one')], shipments: [shipment('shipment-one')] });
  assert.equal(result.shipmentId, 'shipment-one');
  assert.deepEqual(result.shipment, {
    id: 'shipment-one', status: 'shipping', poNumber: 'PO-synthetic', carrier: 'Synthetic carrier',
    shippingFee: 12.5, remark: 'Shipment remark', shippingBillUrl: 'https://example.invalid/bill',
    createdAt: at, updatedAt: '', deletedAt: '', shippedAt: '', deliveredAt: '', createdBy: '',
  });
  assert.equal(result.id, order.id);
  assert.deepEqual(result.productImages, []);
  assert.deepEqual(result.billImages, []);
});

test('no link, another order and deleted links do not attach a shipment', async () => {
  for (const links of [[], [link('shipment-one', { orderId: 'another-order' })], [link('shipment-one', { deletedAt: at })]]) {
    const result = await detail({ links, shipments: [shipment('shipment-one')] });
    assert.equal(result.shipmentId, null);
    assert.equal(result.shipment, null);
  }
});

test('newest active link wins and a newer deleted link is ignored', async () => {
  const older = link('older'), newer = link('newer', { createdAt: '2026-11-01T02:00:00.000Z' });
  for (const deletedAt of ['', at]) {
    const result = await detail({ links: [newer, older].map(row => row.id === newer.id ? { ...row, deletedAt } : row), shipments: [shipment('older'), shipment('newer')] });
    assert.equal(result.shipmentId, deletedAt ? 'older' : 'newer');
    assert.equal(result.shipment.id, result.shipmentId);
  }
});

test('missing, deleted or invalid shipment keeps the link ID but no shipment details', async () => {
  for (const shipments of [[], [shipment('shipment-one', { deletedAt: at })], [shipment('shipment-one', { status: 'invalid' })], [shipment('shipment-one', { poNumber: '' })]]) {
    const result = await detail({ links: [link('shipment-one')], shipments });
    assert.equal(result.shipmentId, 'shipment-one');
    assert.equal(result.shipment, null);
  }
});

function route(service) {
  const filename = 'src/app/api/orders/[id]/route.ts';
  const exports = {};
  const imports = {
    '@/composition/postgres/route': { withPersistence: handler => handler },
    'next/server': { NextResponse: Response },
    '@/composition/postgres/service': { createBusinessDatabase: () => service },
    '@/modules/orders/server': orders,
    '@/modules/shipments/infrastructure/postgres/order-detail-shipment-projection': { PostgresOrderDetailShipmentProjection },
  };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, console, require(specifier) { assert.ok(Object.hasOwn(imports, specifier), specifier); return imports[specifier]; } }, { filename });
  return exports;
}

test('actual order-detail GET returns the linked shipment in its existing response envelope', async () => {
  const api = route(storage({ links: [link('shipment-one')], shipments: [shipment('shipment-one')] }));
  const response = await api.GET(undefined, { params: Promise.resolve({ id: ' order-one ' }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['order']);
  assert.equal(body.order.shipmentId, 'shipment-one');
  assert.equal(body.order.shipment.id, 'shipment-one');
  assert.equal(body.order.shipment.carrier, 'Synthetic carrier');
});

test('order-detail GET retains missing-order and blank-ID responses', async () => {
  const api = route(storage({ orders: [] }));
  for (const [id, status, error] of [['missing', 404, 'Order not found.'], [' ', 400, 'Order ID is required.']]) {
    const response = await api.GET(undefined, { params: Promise.resolve({ id }) });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error });
  }
});

test('historical inverse is limited to the exact reviewed source delta and rejects other bytes', () => {
  const { createHash } = require('node:crypto');
  const { beforeBillIdentity } = require('../helpers/bill-identity-history.cjs');
  const fixture = JSON.parse(fs.readFileSync('tests/fixtures/order-detail-shipment-before.json', 'utf8'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const [file, edit] of Object.entries(fixture.edits)) {
    assert.equal(hash(fs.readFileSync(file)), edit.afterSha256, file);
    assert.equal(hash(edit.before), edit.beforeSha256, file);
    assert.throws(() => beforeBillIdentity(file, Buffer.concat([fs.readFileSync(file), Buffer.from('\n')])), { code: 'ERR_ASSERTION' });
  }
  const projection = 'src/modules/shipments/infrastructure/postgres/order-detail-shipment-projection.ts';
  assert.equal(beforeBillIdentity(projection).toString(), fixture.edits[projection].before);
});
