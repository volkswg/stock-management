/* eslint-disable @typescript-eslint/no-require-imports -- Sealed synthetic workload for the approved disposable local capacity protocol. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { sizedPng } = require('./binary-fixtures.cjs');
const { catalogKey } = require('./provider-outcomes.cjs');
const BYTES = 256 * 1024, BLOCKS = 36, CLIENTS = 5;
function uuid(label) {
    const h = crypto.createHash('sha256').update(label).digest('hex');
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
}
function pdf() {
    function create(padding) {
        const header = '%PDF-1.4\n%WT' + 'x'.repeat(padding) + '\n';
        const objects = ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>\nendobj\n'];
        let body = header; const offsets = objects.map(object => { const at = body.length; body += object; return at; });
        return Buffer.from(body + 'xref\n0 4\n0000000000 65535 f \n' + offsets.map(at => String(at).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + body.length + '\n%%EOF\n');
    }
    // The decimal startxref field grows with the padding; solve the exact size.
    let padding = BYTES - create(0).length;
    for (let i = 0; i < 3; i++) padding += BYTES - create(padding).length;
    const result = create(padding); assert.equal(result.length, BYTES); return result;
}
function plan(prefix) {
    assert.match(prefix, /^WT_[A-Z0-9_]{1,28}$/);
    return { version: 1, prefix, clients: Array.from({ length: CLIENTS }, (_, client) => ({
        client, month: '2020-' + String(client + 1).padStart(2, '0'), accountId: 'WT_ACCOUNT_A',
        blocks: Array.from({ length: BLOCKS }, (_, block) => ({
            block, label: prefix + '_C' + client + '_B' + block,
            date: new Date(Date.UTC(2019 + client, 5, block + 1)).toISOString().slice(0, 10),
            cursor: prefix + '_C' + client + '_B' + block + '_PAGE2',
        })),
    })) };
}
function receipts(fixture) {
    return [['SALE', 100, 2], ['REFUND', 20, 1]].map(([type, total, quantity]) => {
        const id = fixture.label + '_' + type, time = fixture.date + 'T01:00:00.000Z';
        return { receipt_number: id, receipt_type: type, receipt_date: time, created_at: time, updated_at: time, store_id: 'WT_STORE_A', total_money: total, total_tax: 0, total_discount: 0,
            line_items: [{ id: id + '_item', item_name: 'WT capacity item', quantity, price: total / quantity, gross_total_money: total, total_discount: 0, total_money: total, cost: 1, cost_total: quantity }], payments: [{ money_amount: total, name: 'Cash' }] };
    });
}
async function providerCatalog(workload) {
    require('../../../tests/helpers/postgres-runtime.cjs');
    const { LoyverseService } = require('../../../src/infrastructure/external/loyverse/LoyverseService.ts');
    const { getLoyverseReceiptsForSalesDate } = require('../../../src/modules/sales/application/receipts-for-date.ts');
    const catalog = {};
    for (const client of workload.clients) for (const fixture of client.blocks) {
        const pages = receipts(fixture), service = new LoyverseService({ accessToken: 'WT_fake_only_A' }); let calls = 0;
        service.request = async pathname => {
            const url = new URL('https://api.loyverse.com/v1.0' + pathname), cursor = url.searchParams.get('cursor');
            assert.ok(!cursor || cursor === fixture.cursor); assert.ok(calls++ < 2);
            const key = catalogKey('A', url); assert.ok(!Object.hasOwn(catalog, key));
            const body = cursor ? { receipts: pages, cursor: null } : { receipts: [pages[0]], cursor: fixture.cursor };
            catalog[key] = { status: 200, body }; return structuredClone(body);
        };
        const actual = await getLoyverseReceiptsForSalesDate({ loyverseService: service, salesDate: fixture.date, storeId: 'WT_STORE_A' });
        assert.equal(calls, 2); assert.deepEqual(actual, pages);
    }
    assert.equal(Object.keys(catalog).length, CLIENTS * BLOCKS * 2); return catalog;
}
function block(workload, clientIndex, blockIndex, level) {
    assert.ok([1, 5].includes(level)); assert.ok(clientIndex >= 0 && clientIndex < level);
    const client = workload.clients[clientIndex], fixture = client?.blocks[blockIndex];
    assert.ok(fixture && client.orderId && fixture.shipmentId && client.shopId && client.categoryId, 'Unprepared or exhausted capacity fixture');
    const tasks = [], add = (variant, classification, url, method = 'GET', body, expectedStatus = 200) => tasks.push({ variant: 'client-' + clientIndex + ':' + variant, class: classification, url, method, body, expectedStatus,
        key: method === 'GET' ? undefined : workload.prefix + '_L' + level + '_C' + clientIndex + '_B' + blockIndex + '_OP' + tasks.length,
        fixture: { client: clientIndex, block: blockIndex, label: fixture.label, month: client.month, date: fixture.date, accountId: client.accountId } });
    for (let i = 0; i < 2; i++) {
        add('orders-list', 'read', '/api/orders');
        add('order-detail', 'read', '/api/orders/' + client.orderId);
    }
    add('stock-counts', 'read', '/api/stock-counts?month=' + client.month);
    add('stock-adjustments', 'read', '/api/stock-adjustments?month=' + client.month);
    add('movements', 'read', '/api/movements');
    add('sales-dashboard', 'read', '/api/sales/dashboard?accounts=' + client.accountId + '&from=' + fixture.date.slice(0, 7) + '-01&to=' + fixture.date);
    add('profit-summary', 'read', '/api/sales/profit-summary?year=' + fixture.date.slice(0, 4));
    add('payroll', 'read', '/api/employees/payroll?month=' + client.month);
    add('advances', 'read', '/api/employees/advances?month=' + client.month);
    add('expenses', 'read', '/api/expenses?month=' + client.month);
    for (let i = 0; i < 2; i++) add('create-order', 'simpleWrite', '/api/orders', 'POST', { seller: fixture.label + '_ORDER' + i, totalPrice: 12.34, remark: 'WT capacity' }, 201);
    add('create-expense', 'simpleWrite', '/api/expenses', 'POST', { requestId: uuid(fixture.label + '_expense'), month: client.month, expenseDate: client.month + '-02', scope: 'SHOP', shopId: client.shopId, categoryId: client.categoryId, name: fixture.label + '_expense', amount: 12.34, note: 'WT capacity' });
    add('save-stock-count', 'simpleWrite', '/api/stock-counts', 'PUT', { month: client.month, accountId: client.accountId, physicalCount: 1001 + blockIndex, note: fixture.label });
    add('save-cost-override', 'simpleWrite', '/api/sales/profit-summary/cost-overrides', 'POST', { month: client.month, accountId: client.accountId, averageItemCost: (251 + blockIndex) / 100, note: fixture.label });
    const png = sizedPng(BYTES), order = new FormData();
    order.set('seller', fixture.label + '_IMAGES'); order.set('totalPrice', '42.13');
    order.set('billImages', new Blob([png], { type: 'image/png' }), 'WT-bill.png');
    order.set('productImages', new Blob([png], { type: 'image/png' }), 'WT-product.png');
    add('create-multipart-order', 'compoundWrite', '/api/orders/with-images', 'POST', order, 201);
    const shipping = new FormData(); shipping.set('status', 'shipping'); shipping.set('poNumber', fixture.label);
    shipping.set('shippingBill', new Blob([pdf()], { type: 'application/pdf' }), 'WT-shipping.pdf');
    add('advance-shipping-bill', 'compoundWrite', '/api/shipments/' + fixture.shipmentId, 'PATCH', shipping);
    add('sync-sales', 'compoundWrite', '/api/loyverse/daily-sales/sync', 'POST', { account: client.accountId, date: fixture.date });
    assert.equal(tasks.length, 20); return tasks;
}
module.exports = { BYTES, BLOCKS, CLIENTS, uuid, pdf, plan, receipts, providerCatalog, block };
