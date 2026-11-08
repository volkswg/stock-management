import assert from 'node:assert/strict';
import test from 'node:test';
import { ordersServer } from './helpers/orders-server.mjs';
import { shipmentServices } from './helpers/shipments.mjs';
import { loadSource } from './helpers/load-source.mjs';

// Preserved keyless Sheets behavior; PostgreSQL journal tests are separate. Execute the unchanged route
// and application. The fake writer enforces primary-key uniqueness only.
function orders({ loseFirstAcknowledgement = false } = {}) {
  const records = new Map(), received = [];
  const { createOrder } = ordersServer()('src/modules/orders/application/create-order.ts');
  let generated = 0, attempts = 0;
  const writer = { async appendCreatedOrder(order) {
    assert.equal(records.has(order.id), false, 'generated business IDs remain unique');
    records.set(order.id, order);
  } };
  const route = loadSource('src/app/api/orders/route.ts', { imports: {
    'next/server': { NextResponse: Response },
    '@/config': { getConfig: () => ({}) },
    '@/composition/google-sheets': { createGoogleSheetsServiceFromConfig: () => ({}) },
    '@/modules/orders/server': { async createOrder(input) {
      received.push(input);
      const result = await createOrder(input, {
        writer, createId: () => `synthetic-order-${++generated}`,
        now: () => '2026-11-09T00:00:00.000Z',
      });
      if (++attempts === 1 && loseFirstAcknowledgement) throw new Error('Synthetic commit acknowledgement lost');
      return result;
    } },
  }, globals: { console: { error() {} } } });
  return {
    records, received,
    post: (body, headers = {}) => route.POST(new Request('https://example.test/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    })),
  };
}

const input = { seller: 'Synthetic seller', totalPrice: 125.50, remark: 'Same goods and price' };

test('Sheets compatibility: a lost commit acknowledgement plus keyless retry creates a second Order despite unique business IDs', async () => {
  const run = orders({ loseFirstAcknowledgement: true });
  assert.equal((await run.post(input)).status, 500);
  assert.equal(run.records.size, 1, 'first commit survived the failed acknowledgement');
  const retry = await run.post(input);
  assert.equal(retry.status, 201);
  assert.equal(run.records.size, 2, 'the old request contract cannot identify the retry');
  assert.equal([...run.records.values()].reduce((sum, row) => sum + row.totalPrice, 0), 251);
});

test('Sheets compatibility: two intentional identical creates have the same request data as a retry and must retain separate business IDs', async () => {
  const run = orders();
  const first = await run.post(input), second = await run.post(input);
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  const a = (await first.json()).order, b = (await second.json()).order;
  assert.notEqual(a.id, b.id);
  assert.deepEqual({ ...a, id: null }, { ...b, id: null });
  assert.equal(run.records.size, 2, 'deduplicating by business fields would discard a legitimate order');
});

test('Sheets compatibility: current Orders HTTP mapping does not propagate supplied command identities', async () => {
  const run = orders();
  const body = { ...input, id: 'caller-id', requestId: 'caller-operation' };
  const headers = { 'Idempotency-Key': 'caller-operation' };
  assert.equal((await run.post(body, headers)).status, 201);
  assert.equal((await run.post(body, headers)).status, 201);
  assert.equal(run.records.size, 2);
  for (const received of run.received) {
    assert.equal(received.id, undefined);
    assert.equal(received.requestId, undefined);
  }
});

test('Sheets compatibility: Shipment creation also allocates a fresh ID for repeated identical business inputs', async () => {
  const { createShipment } = shipmentServices().load('src/modules/shipments/application/create-shipment.ts');
  const rows = new Map(); let generated = 0;
  const dependencies = {
    now: () => '2026-11-09T00:00:00.000Z', createId: () => `synthetic-shipment-${++generated}`,
    writer: { async appendCreatedShipment(row) { assert.equal(rows.has(row.id), false); rows.set(row.id, row); } },
  };
  const input = { poNumber: 'PO-synthetic', carrier: 'Synthetic carrier', createdBy: 'web' };
  const first = await createShipment(input, dependencies), second = await createShipment(input, dependencies);
  assert.notEqual(first.id, second.id); assert.equal(rows.size, 2);
});
