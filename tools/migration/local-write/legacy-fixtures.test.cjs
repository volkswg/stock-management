/* eslint-disable @typescript-eslint/no-require-imports -- Closed validation controls; no database or provider access. */
const test = require('node:test'), assert = require('node:assert/strict');
const { validateRows } = require('./legacy-fixtures.cjs');
test('historical seeds accept only append-only synthetic identifiers and canonical business fields', () => {
    const records = [{ table: 'orders', row: { id: 'WT_history', status: 'canceled', totalPrice: 12.34 } }];
    assert.equal(validateRows(records), records);
    for (const value of [[], Array(13).fill(records[0]), [{ table: 'commands', row: { id: 'WT_key' } }], [{ table: 'orders', row: { id: 'original-id' } }], [{ table: 'orders', row: { id: 'WT_id', archived_at: 'WT' } }], [{ table: 'orders', row: { id: 'WT_id', remark: {} } }], [{ table: 'shipment_orders', row: { id: 'WT_link', orderId: 'original-order' } }]]) assert.throws(() => validateRows(value));
});
