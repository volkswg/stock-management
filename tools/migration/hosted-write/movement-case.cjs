/* eslint-disable @typescript-eslint/no-require-imports -- Only local-worker seeding is replaced; remaining WT04 assertions match the reviewed local case. */
const assert = require('node:assert/strict');
async function WT04() {
    const identity = { masterId: this.prefix + '_MOVEMENT', userId: 'WT_seed', startedAt: '2026-01-01T01:00:00.000Z' };
    await this.seed({ kind: 'movement', identity });
        const first = (await this.get('/api/movements/' + identity.masterId)).records;
        assert.equal(first.length, 1);
        assert.equal(first[0].quantity, '3');
        const delivery = await this.patch('/api/movements/' + identity.masterId, {
            status: 'delivered'
        });
        const deliveredAt = delivery.body.movementMaster.deliverDateTime;
        this.inventoryMonth = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date(deliveredAt)).slice(0, 7);
        this.inventoryDate = this.inventoryMonth + '-02';
        assert.ok(this.inventoryDate < new Date().toISOString().slice(0, 10), 'Fixture sync date must be historical');
        const after = (await this.get('/api/movements/' + identity.masterId)).records;
        assert.equal(after[0].status, 'delivered');
        const before = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_A');
        await this.patch('/api/movements/' + identity.masterId, {
            status: 'delivered'
        });
        const repeated = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_A');
        assert.equal(before.stockIn, 3);
        assert.equal(repeated.stockIn, before.stockIn);
        this.context.movement = identity;
}
module.exports = { WT04 };
