import test from 'node:test';
import assert from 'node:assert/strict';
import { externalGraph } from './helpers/external-source.mjs';

const receipt = (number, type = 'SALE', total = 100) => ({
  receipt_number: number, receipt_type: type, receipt_date: '2026-01-01T01:00:00Z',
  created_at: '2026-01-01T01:00:00Z', updated_at: '2026-01-01T01:00:00Z',
  cancelled_at: null, total_money: total,
  line_items: [{ id: number + '-item', item_name: 'synthetic', quantity: 1,
    gross_total_money: total, total_discount: 0, cost_total: 1, line_taxes: [] }],
  payments: [{ name: 'Cash', money_amount: total }],
});
const plain = value => JSON.parse(JSON.stringify(value));
function client(pages) {
  const calls = [];
  const graph = externalGraph({ globals: { fetch: async (url, init) => {
    calls.push({ url, init });
    assert.ok(pages.length, 'Unexpected provider retry');
    const page = pages.shift();
    if (page instanceof Error) throw page;
    return Response.json(page);
  } } });
  const { LoyverseService } = graph.load('src/infrastructure/external/loyverse/LoyverseService.ts');
  return { service: new LoyverseService({ accessToken: 'synthetic', baseUrl: 'https://provider.test/v1' }), calls };
}

test('overlapping receipt pages keep first-seen order and one sale/refund identity', async () => {
  const sale = receipt('WT-SALE'), refund = receipt('WT-REFUND', 'REFUND', 20);
  const { service, calls } = client([{ receipts: [sale, sale], cursor: 'next' }, { receipts: [refund, sale] }]);
  assert.deepEqual(plain(await service.getReceipts()), [sale, refund]);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /cursor=next/);
});

test('duplicate comparison ignores object key order, preserves nested arrays and original values', async () => {
  const sale = receipt('WT-SALE');
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)])) : value;
  const { service } = client([{ receipts: [sale, reverseKeys(sale)] }]);
  assert.deepEqual(plain(await service.getReceipts()), [sale]);
});

test('conflicting receipt versions reject rather than choosing financial or status values', async () => {
  const sale = receipt('WT-PRIVATE-IDENTITY');
  for (const patch of [{ total_money: 99 }, { cancelled_at: '2026-01-02T00:00:00Z' },
    { updated_at: '2026-01-02T00:00:00Z' }, { line_items: [{ ...sale.line_items[0], quantity: 2 }] },
    { payments: [{ name: 'Cash', money_amount: 99 }] }]) {
    const { service } = client([{ receipts: [sale], cursor: 'next' }, { receipts: [{ ...sale, ...patch }] }]);
    await assert.rejects(service.getReceipts(), { message: 'Loyverse returned conflicting versions of a receipt. No receipts were returned.' });
  }
});

test('missing or blank receipt identity is refused without a provider retry', async () => {
  for (const id of [undefined, '', ' ', 7]) {
    const { service, calls } = client([{ receipts: [{ ...receipt('WT'), receipt_number: id }] }]);
    await assert.rejects(service.getReceipts(), { message: 'Loyverse returned a receipt without a valid identity. No receipts were returned.' });
    assert.equal(calls.length, 1);
  }
});

test('receipt date filtering still precedes duplicate validation and cancelled receipts remain explicit', async () => {
  const outside = { ...receipt('WT-OUTSIDE'), receipt_date: '2025-12-01T01:00:00Z' };
  const cancelled = { ...receipt('WT-CANCELLED'), cancelled_at: '2026-01-02T00:00:00Z' };
  const { service } = client([{ receipts: [outside, { ...outside, total_money: 99 }, cancelled, cancelled] }]);
  assert.deepEqual(plain(await service.getReceipts({ receiptDateMin: '2026-01-01T00:00:00Z', receiptDateMax: '2026-01-01T23:59:59Z' })), [cancelled]);
});

test('late pagination failure preserves error identity and returns no partial receipt list', async () => {
  const marker = new Error('synthetic provider failure');
  const { service, calls } = client([{ receipts: [receipt('WT-SALE')], cursor: 'next' }, marker]);
  await assert.rejects(service.getReceipts(), error => error === marker);
  assert.equal(calls.length, 2);
});
