/* eslint-disable @typescript-eslint/no-require-imports -- Capacity fixture controls use no live services. */
const test = require('node:test'), assert = require('node:assert/strict');
const { plan, pdf, providerCatalog, block, BYTES } = require('./capacity-workload.cjs');
const { validateBlock } = require('./capacity.cjs');
test('load fixtures isolate every client/day/cursor and exhaust at the unchanged budget', () => {
    const p = plan('WT_CONTROL');
    const dates = p.clients.flatMap(c => c.blocks.map(b => b.date)); assert.equal(new Set(dates).size, 180);
    for (const c of p.clients) { c.orderId = 'WT_order_' + c.client; c.shopId = 'WT_shop_' + c.client; c.categoryId = 'WT_category_' + c.client; c.blocks.forEach((b, i) => { b.shipmentId = 'WT_ship_' + c.client + '_' + i; }); }
    const keys = [];
    for (let c = 0; c < 5; c++) for (let n = 0; n < 36; n++) {
        const tasks = block(p, c, n, 5); validateBlock(tasks.map(t => ({ ...t, run: async () => ({ status: t.expectedStatus }) })));
        keys.push(...tasks.map(t => t.key).filter(Boolean));
        assert.equal(tasks[17].body.get('billImages').size, BYTES); assert.equal(tasks[17].body.get('productImages').size, BYTES);
        assert.equal(tasks[18].body.get('shippingBill').size, BYTES);
    }
    assert.equal(new Set(keys).size, keys.length); assert.throws(() => block(p, 0, 36, 1)); assert.throws(() => block(p, 1, 0, 1));
});
test('PDF fixture has the exact approved size and a usable cross-reference offset', () => {
    const bytes = pdf(), text = bytes.toString(); assert.equal(bytes.length, BYTES);
    const offset = Number(/startxref\n(\d+)\n%%EOF/.exec(text)[1]); assert.equal(text.slice(offset, offset + 4), 'xref');
});
test('sealed provider catalog is generated through actual date/pagination code without network', async () => {
    const original = global.fetch; global.fetch = () => { throw Error('Network forbidden'); };
    try { const catalog = await providerCatalog(plan('WT_CATALOG')); assert.equal(Object.keys(catalog).length, 360); }
    finally { global.fetch = original; }
});
