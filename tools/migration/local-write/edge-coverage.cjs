/* eslint-disable @typescript-eslint/no-require-imports -- Remaining bounded HTTP edge variants with independently checked SQL deltas. */
const assert = require('node:assert/strict');
const { BrowserCampaign } = require('./browser-coverage.cjs');
const { PNG } = require('./runtime.cjs');
class EdgeCampaign extends BrowserCampaign {
    receipt(id, when, total, extra = {}) {
        return { receipt_number: id, receipt_type: 'SALE', receipt_date: when, created_at: when, updated_at: when, store_id: 'WT_STORE_A', total_money: total, total_tax: 0, total_discount: 0, line_items: [{ id: id + '_item', item_name: 'WT item', quantity: 1, price: total, gross_total_money: total, total_discount: 0, total_money: total, cost: 1, cost_total: 1 }], payments: [{ money_amount: total, name: 'Cash' }], ...extra };
    }
    async WT_SALES_EDGES() {
        const date = '2025-03-02', prefix = this.key('SALES_EDGE');
        const fixtures = [this.receipt(prefix + '_start', '2025-03-01T17:00:00.000Z', 10), this.receipt(prefix + '_end', '2025-03-02T16:59:59.999Z', 20), this.receipt(prefix + '_cancel', '2025-03-02T06:00:00.000Z', 50, { cancelled_at: '2025-03-02T07:00:00.000Z' }), this.receipt(prefix + '_before', '2025-03-01T16:59:59.999Z', 70), this.receipt(prefix + '_after', '2025-03-02T17:00:00.000Z', 80)];
        const start = this.ledger().length; this.control({ salesPages: { A: [fixtures] } });
        const synced = await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date }); assert.equal(synced.body.receiptCount, 3);
        const report = await this.get('/api/sales/dashboard?accounts=WT_ACCOUNT_A&from=2025-03-02&to=2025-03-02'); assert.equal(report.report.totals.netSales, 30);
        const stored = await this.sql('SELECT "receiptNumber","cancelledAt" FROM stock_operational.sales_receipts WHERE "accountId"=$1 AND "salesDate"=$2 ORDER BY "receiptNumber"', ['WT_ACCOUNT_A', date]);
        assert.equal(stored.length, 3); assert.ok(stored.find(row => row.receiptNumber === prefix + '_cancel').cancelledAt);
        const requests = this.ledger().slice(start).filter(e => e.kind === 'fake-provider' && e.provider === 'loyverse');
        assert.ok(requests.length && requests.every(e => e.query.store_id === 'WT_STORE_A' && e.query.created_at_min === '2025-03-01T17:00:00.000Z'));
        this.control({ salesPages: { B: [[this.receipt(prefix + '_B', '2025-03-02T06:00:00.000Z', 40, { store_id: 'WT_STORE_B' })]] } });
        await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_B', date });
        assert.equal((await this.get('/api/sales/dashboard?accounts=WT_ACCOUNT_B&from=2025-03-02&to=2025-03-02')).report.totals.netSales, 40);
        const repeated = this.receipt(prefix + '_cursor', '2025-03-03T01:00:00.000Z', 15), key = this.key('repeat-cursor');
        const before = await this.seal(), revision = await this.revision();
        this.control({ salesPages: { A: [[repeated], [repeated]] }, salesRepeatCursor: true });
        await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: '2025-03-03' }, { key, status: 502 });
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
        this.control({ salesPages: { A: [[repeated]] } }); await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: '2025-03-03' }, { key }); this.control({});
        const target = '/api/sales/profit-summary/cost-overrides', input = { month: '2025-03', accountId: 'WT_ACCOUNT_B', averageItemCost: 2.5, note: 'WT old override' };
        const first = (await this.post(target, input)).body.costOverride;
        const edited = (await this.post(target, { ...input, averageItemCost: 3.25, note: 'WT edited override' })).body.costOverride; assert.equal(edited.id, first.id);
        await this.api(target, { method: 'DELETE', key: this.key('delete-override'), body: input });
        const archived = (await this.sql('SELECT business_cells,archived_at FROM stock_operational.sales_profit_cost_overrides WHERE id=$1', [first.id]))[0]; assert.ok(archived.archived_at);
        const replacement = (await this.post(target, { ...input, averageItemCost: 4.75, note: 'WT replacement override' })).body.costOverride; assert.notEqual(replacement.id, first.id);
        assert.deepEqual((await this.sql('SELECT business_cells FROM stock_operational.sales_profit_cost_overrides WHERE id=$1', [first.id]))[0].business_cells, archived.business_cells);
        this.save('sales-edge-proof.json', { inclusiveBangkokBoundaries: true, outsideDateExcluded: 2, canceledReceiptRetainedAndExcludedFromNet: true, isolatedStoreQueryVerified: true, netA: 30, netB: 40, repeatedCursorRollback: true, correctedSameKeyRetry: true, overrideEditArchiveReplacementHistory: true });
    }
    async WT_HR_DATE_EDGES() {
        const employee = await this.seedEmployee();
        await this.patch('/api/employees/' + employee.id, { baseSalary: 120, compensationEffectiveFrom: '2026-01-31' }, { _probe: true });
        await this.patch('/api/employees/' + employee.id, { baseSalary: 130, compensationEffectiveFrom: '2026-02-01' }, { _probe: true });
        const create = (date, shopId, status, workdayType = 'full', expected = 201) => this.post('/api/employees/timesheets', { date, employeeId: employee.id, shopId, status, workdayType }, { status: expected, _probe: true });
        const shifts = [await create('2026-01-31', 'WT_ACCOUNT_A', 'work', 'half'), await create('2026-01-31', 'WT_ACCOUNT_B', 'work')];
        await create('2026-01-31', 'WT_ACCOUNT_A', 'leave', 'full', 409);
        await create('2026-02-01', 'WT_ACCOUNT_A', 'leave'); await create('2026-02-01', 'WT_ACCOUNT_B', 'work', 'full', 409);
        for (const shift of shifts) await this.patch('/api/employees/timesheets/' + shift.body.timesheet.id, {}, { _probe: true });
        const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
        assert.ok(shifts.every(row => day(row.body.timesheet.createdAt) === '2026-01-31'));
        const january = (await this.get('/api/employees/payroll?month=2026-01')).payroll.find(row => row.employeeId === employee.id);
        const february = (await this.get('/api/employees/payroll?month=2026-02')).payroll.find(row => row.employeeId === employee.id);
        // Multiple valid shifts on one calendar day are capped at one payable
        // day by the existing payroll rule: min(1, half + full) * 120 = 120.
        assert.equal(january.basePay, 120); assert.equal(february.basePay, 0);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.employee_compensations WHERE "employeeId"=$1', [employee.id]))[0].n, 3);
        const before = await this.seal(), revision = await this.revision(); await create('2099-01-01', 'WT_ACCOUNT_A', 'work', 'full', 400); assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        this.save('hr-date-edge-proof.json', { bangkokJan31Attribution: true, validSameDayMultipleWorkShifts: 2, payableDaysCappedPerDate: 1, workLeaveConflicts: 2, compensationHistoryRows: 3, existingMonthSelectedPayRulePreserved: true, januaryBasePay: 120, februaryLeaveBasePay: 0, futureDateRejectedAtomically: true });
    }
    async WT_UPLOAD_MULTIPLE_AND_CLEANUP_FAILURE() {
        const make = (bills, products, invalid = false) => { const form = new FormData(); form.set('seller', this.key('MULTI')); for (let i = 0; i < bills; i++) form.append('billImages', new Blob([PNG], { type: invalid && i === bills - 1 ? 'text/plain' : 'image/png' }), 'WT-bill-' + i + '.png'); for (let i = 0; i < products; i++) form.append('productImages', new Blob([PNG], { type: 'image/png' }), 'WT-product-' + i + '.png'); return form; };
        for (const [bills, products, invalid] of [[2, 2, true], [11, 1, false], [1, 11, false]]) {
            const before = await this.seal(), revision = await this.revision(), uploads = this.ledger().filter(e => e.kind === 'fake-provider' && e.provider === 'drive').length;
            await this.post('/api/orders/with-images', make(bills, products, invalid), { status: 400, _probe: true });
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); assert.equal(this.ledger().filter(e => e.kind === 'fake-provider' && e.provider === 'drive').length, uploads);
        }
        const created = (await this.post('/api/orders/with-images', make(10, 10), { status: 201, _probe: true })).body.order;
        const detail = (await this.get('/api/orders/' + created.id)).order; assert.equal(detail.billImages.length, 10); assert.equal(detail.productImages.length, 10);
        await this.fileGraph('multi-upload-owned-file-graph');
        // Cleanup rejection is expected to leave a visible, blocked operation,
        // rather than automatically upload or delete the same file again.
        const key = this.key('cleanup-failure'), before = await this.seal(), revision = await this.revision(), start = this.ledger().length;
        this.control({ deleteFailure: true });
        try { await this.api('/api/movements/WT_missing/items/WT_missing/image', { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 500, _probe: true }); } finally { this.control({}); }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        await this.api('/api/movements/WT_missing/items/WT_missing/image', { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 503, _probe: true });
        const events = this.ledger().slice(start), uploads = events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'upload'), deletes = events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'delete');
        assert.equal(uploads.length, 1); assert.equal(deletes.length, 1);
        this.save('cleanup-reconciliation-proof.json', { acceptedNewFile: uploads[0].id, cleanupAttempts: 1, cleanupRejected: true, newUploadAttemptsAfterRetry: 0, retryStatus: 503, requiresReconciliation: true, noBusinessOrRevisionChange: true });
        this.save('upload-multiple-proof.json', { invalidMixedFilesRejectedBeforeProvider: true, elevenFilesPerGroupRejected: true, tenBillsAndTenProductsAccepted: true });
    }
    async WT_EXPENSE_REFERENCE_EDGES() {
        const before = await this.seal(), revision = await this.revision();
        await this.post('/api/expenses/masters/shops', { name: this.key('invalid-mapping'), active: true, loyverseAccountId: 'WT_missing_account' }, { status: 400, _probe: true });
        await this.post('/api/expenses', { ...this.expenseInput(), categoryId: 'WT_missing_category' }, { status: 400, _probe: true });
        await this.post('/api/expenses', { ...this.expenseInput(), shopId: 'WT_missing_shop' }, { status: 400, _probe: true });
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        const shop = (await this.post('/api/expenses/masters/shops', { name: this.key('sum-shop'), active: true })).body.id;
        const ids = [];
        for (const amount of [12.34, 23.45]) ids.push((await this.post('/api/expenses', { ...this.expenseInput(), shopId: shop, amount })).body.id);
        const read = async () => (await this.get('/api/expenses?month=' + this.month)).expenses.filter(row => row.shopId === shop);
        assert.equal(Math.round((await read()).reduce((total, row) => total + row.amount, 0) * 100), 3579);
        await this.api('/api/expenses', { method: 'DELETE', key: this.key('delete-sum-expense'), body: { id: ids[0] }, _probe: true });
        assert.equal(Math.round((await read()).reduce((total, row) => total + row.amount, 0) * 100), 2345);
        assert.ok((await this.sql('SELECT "deletedAt" FROM stock_operational.expenses WHERE id=$1', [ids[0]]))[0].deletedAt);
        this.save('expense-reference-edge-proof.json', { invalidMappingShopAndCategoryAtomic: true, initialCents: 3579, retainedAfterDeleteCents: 2345, deletedHistoryRetained: true });
    }
    async WT_MOVEMENT_INVALID_QUANTITIES() {
        const id = await this.seedMovement(), url = '/api/movements/' + id, item = url + '/items/' + id + '_ITEM';
        for (const quantity of ['0', '-1']) {
            await this.patch(item, { quantity }, { _probe: true });
            const before = await this.seal(), revision = await this.revision();
            await this.patch(url, { status: 'delivered' }, { status: 409, _probe: true }); assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        }
        const before = await this.seal(), revision = await this.revision(); await this.patch(item, { quantity: '' }, { status: 400, _probe: true }); assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        await this.patch(item, { quantity: '2' }, { _probe: true }); await this.patch(url, { status: 'delivered' }, { _probe: true });
        this.save('movement-invalid-quantity-proof.json', { zeroAndNegativeDeliveryRejected: 409, emptyQuantityRejected: 400, correctedQuantityDelivered: 2, allRejectionsAtomic: true });
    }
    async WT_LINE_SESSION_EDGES() {
        const before = await this.seal(), start = this.ledger().length;
        const unknownUser = 'WT_NO_SESSION_' + this.prefix, clearedUser = 'WT_ORDER_JOURNEY_' + this.prefix;
        await this.line([this.event(unknownUser, 'unknown-command', 'WT not a command'), this.event(unknownUser, 'no-session-image', '', true), this.event(clearedUser, 'cleared-session-image', '', true)]);
        assert.deepEqual(await this.seal(), before);
        assert.equal(this.ledger().slice(start).filter(e => e.kind === 'fake-provider' && e.provider === 'drive').length, 0);
        const missingId = this.event(unknownUser, 'missing-event-id', 'create:order'); delete missingId.webhookEventId;
        await this.line([missingId], 428); assert.deepEqual(await this.seal(), before);
        const masterId = await this.seedMovement(), user = 'WT_BAD_SESSION_' + this.prefix;
        await this.seedHistory([{ table: 'user_state', row: { id: this.key('BAD_STATE'), userId: user, flowname: 'MovementCreate', referenceId: masterId, state: 'quantity', createdAt: '2026-01-01T01:00:00.000Z', updatedAt: '2026-01-01T01:00:00.000Z', context: '{}' } }], 'malformed-synthetic-session');
        const failedBefore = await this.seal(), keyEvent = this.event(user, 'invalid-state', 'resume:movement'), attempts = this.ledger().length;
        await this.line([keyEvent], 503); await this.line([keyEvent], 503);
        assert.deepEqual(await this.seal(), failedBefore);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [keyEvent.webhookEventId]))[0].n, 0);
        assert.equal(this.ledger().slice(attempts).filter(e => e.kind === 'fake-provider').length, 0);
        this.save('line-session-edge-proof.json', { unknownCommandAndUnroutedImagesNoBusinessDelta: true, clearedSessionDidNotUpload: true, stableEventIdRequired: 428, malformedSyntheticStateRefused: 503, failedEventNotJournaledComplete: true, noAutomaticProviderAttempt: true });
    }
}
module.exports = { EdgeCampaign };
