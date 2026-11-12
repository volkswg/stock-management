/* eslint-disable @typescript-eslint/no-require-imports -- Fresh real mutations for every ordinary method; no replay-only repetition counts. */
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { HistoricalCampaign } = require('./historical-coverage.cjs');
const { PNG } = require('./runtime.cjs');
class MethodCampaign extends HistoricalCampaign {
    form(field = 'image', kind) {
        const value = new FormData(); value.set(field, new Blob([PNG], { type: 'image/png' }), 'WT.png');
        if (kind) value.set('imageType', kind); return value;
    }
    orderForm() {
        const form = this.form('billImages'); form.set('seller', this.key('seller')); form.set('totalPrice', '12.34');
        form.set('productImages', new Blob([PNG], { type: 'image/png' }), 'WT-product.png'); return form;
    }
    async seedOrder(images = false) {
        return (await this.api(images ? '/api/orders/with-images' : '/api/orders', { method: 'POST', key: this.key('prepare-order'), body: images ? this.orderForm() : { seller: this.key('seller'), totalPrice: 12.34 }, status: 201, _probe: true })).body.order;
    }
    async seedEmployee() {
        return (await this.api('/api/employees', { method: 'POST', key: this.key('prepare-employee'), status: 201, _probe: true, body: this.employeeInput() })).body.employee;
    }
    employeeInput() { return { name: this.key('Employee'), phone: '', status: 'active', hiredDate: '2020-01-01', terminatedDate: '', baseSalary: 100, commission: 0, compensationEffectiveFrom: '2020-01-01', compensationType: 'daily', commissionType: 'none' }; }
    async seedShift(employee) {
        return (await this.api('/api/employees/timesheets', { method: 'POST', key: this.key('prepare-shift'), status: 201, _probe: true, body: { date: this.date, employeeId: employee.id, shopId: 'WT_ACCOUNT_A', status: 'work', workdayType: 'full' } })).body.timesheet;
    }
    async seedMovement() {
        const identity = { masterId: this.key('MOVEMENT'), userId: 'WT_seed', startedAt: '2026-01-01T01:00:00.000Z' }, file = path.join(this.out, identity.masterId + '.json');
        fs.writeFileSync(file, JSON.stringify(identity), { mode: 0o600 });
        const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'seed.cjs'), path.join(this.state, this.db + '-app-env.json'), file], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8', timeout: 30000 });
        assert.equal(result.status, 0, 'Fresh movement preparation failed'); return identity.masterId;
    }
    async seedExpense() {
        return (await this.api('/api/expenses', { method: 'POST', key: this.key('prepare-expense'), _probe: true, body: this.expenseInput() })).body.id;
    }
    expenseInput() { return { requestId: crypto.randomUUID(), month: this.month, expenseDate: this.date, scope: 'SHOP', shopId: this.context.shop, categoryId: this.context.category, name: this.key('expense'), amount: 12.34, note: 'WT repetitions' }; }
    async scenario(route) {
        const method = route.slice(0, route.indexOf(':')), pattern = route.slice(route.indexOf(':') + 1);
        const result = (url, body, status = 200, headers) => ({ url, method, body, status, headers, _probe: true });
        switch (route) {
            case 'POST:/api/orders': return result(pattern, { seller: this.key('seller'), totalPrice: 12.34 }, 201);
            case 'POST:/api/orders/with-images': return result(pattern, this.orderForm(), 201);
            case 'PATCH:/api/orders/[id]': { const order = await this.seedOrder(); return result('/api/orders/' + order.id, { totalPrice: 23.45, remark: this.key('edit') }); }
            case 'POST:/api/orders/[id]/images': { const order = await this.seedOrder(); return result('/api/orders/' + order.id + '/images', this.form('image', 'product'), 201); }
            case 'PATCH:/api/orders/[id]/items/[itemId]/image':
            case 'PATCH:/api/orders/[id]/items/[itemId]':
            case 'PATCH:/api/orders/[id]/items': {
                const order = await this.seedOrder(true), detail = (await this.get('/api/orders/' + order.id)).order, item = detail.productImages[0].id;
                if (pattern.endsWith('/image')) return result('/api/orders/' + order.id + '/items/' + item + '/image', this.form());
                if (pattern.endsWith('/[itemId]')) return result('/api/orders/' + order.id + '/items/' + item, { quantityType: 'quote', quantity: 3 });
                return result('/api/orders/' + order.id + '/items', { items: [{ id: item, productCode: this.key('PRODUCT'), quoteQuantity: 3, deliveredQuantity: 2 }] });
            }
            case 'POST:/api/shipments': return result(pattern, { poNumber: this.key('PO'), carrier: 'WT Carrier' }, 201);
            case 'PATCH:/api/shipments/[id]':
            case 'POST:/api/shipments/[id]/orders': {
                const shipment = (await this.api('/api/shipments', { method: 'POST', key: this.key('prepare-shipment'), body: { poNumber: this.key('PO'), carrier: 'WT Carrier' }, status: 201, _probe: true })).body.shipment;
                if (method === 'PATCH') return result('/api/shipments/' + shipment.id, { status: 'ready_to_ship' });
                const order = await this.seedOrder(); return result('/api/shipments/' + shipment.id + '/orders', { orderId: order.id }, 201);
            }
            case 'PATCH:/api/movements/[id]':
            case 'PATCH:/api/movements/[id]/items/[itemId]':
            case 'DELETE:/api/movements/[id]/items/[itemId]':
            case 'PATCH:/api/movements/[id]/items/[itemId]/image': {
                const id = await this.seedMovement(), base = '/api/movements/' + id;
                if (pattern.endsWith('/[id]')) return result(base, { status: 'delivered' });
                if (pattern.endsWith('/image')) return result(base + '/items/' + id + '_ITEM/image', PNG, 200, { 'content-type': 'image/png' });
                return result(base + '/items/' + id + '_ITEM', method === 'DELETE' ? undefined : { quantity: '4', remark: this.key('movement-edit') });
            }
            case 'PUT:/api/stock-counts': return result(pattern, { month: '2025-06', accountId: 'WT_ACCOUNT_B', physicalCount: ++this.seq + 1000, note: this.key('count') });
            case 'POST:/api/stock-adjustments':
            case 'PATCH:/api/stock-adjustments': {
                const input = { requestId: crypto.randomUUID(), accountId: 'WT_ACCOUNT_B', date: '2025-06-02', direction: 'in', reason: 'employee_return', employeeId: this.context.employee.id, quantity: 1, itemDescription: 'WT return', photoUrl: '', note: 'WT repetitions', notInLoyverse: true };
                if (method === 'POST') return result(pattern, input, 201);
                const record = (await this.api(pattern, { method: 'POST', key: this.key('prepare-adjustment'), body: input, status: 201, _probe: true })).body.record;
                return result(pattern, { action: 'reverse', id: record.id, note: 'WT reversal' });
            }
            case 'POST:/api/loyverse/daily-sales/sync': {
                this.salesScenarioDate = (this.salesScenarioDate || 0) + 1;
                const date = new Date(Date.UTC(2024, 0, this.salesScenarioDate)).toISOString().slice(0, 10), id = this.key('RECEIPT');
                const receipt = { receipt_number: id, receipt_type: 'SALE', receipt_date: date + 'T01:00:00.000Z', created_at: date + 'T01:00:00.000Z', updated_at: date + 'T01:00:00.000Z', store_id: 'WT_STORE_A', total_money: 10, total_tax: 0, total_discount: 0, line_items: [{ id: id + '_item', item_name: 'WT item', quantity: 1, price: 10, gross_total_money: 10, total_discount: 0, total_money: 10, cost: 1, cost_total: 1 }], payments: [{ money_amount: 10, name: 'Cash' }] };
                this.control({ salesPages: { A: [[receipt]] } }); return result(pattern, { account: 'WT_ACCOUNT_A', date });
            }
            case 'POST:/api/sales/profit-summary/cost-overrides': return result(pattern, { month: '2025-06', accountId: 'WT_ACCOUNT_B', averageItemCost: 2.5, note: this.key('override') });
            case 'DELETE:/api/sales/profit-summary/cost-overrides': {
                const body = { month: '2025-06', accountId: 'WT_ACCOUNT_B' };
                await this.api(pattern, { method: 'POST', key: this.key('prepare-override'), body: { ...body, averageItemCost: 2.5, note: this.key('override') }, _probe: true }); return result(pattern, body);
            }
            case 'POST:/api/employees': return result(pattern, this.employeeInput(), 201);
            case 'PATCH:/api/employees/[id]': { const employee = await this.seedEmployee(); return result('/api/employees/' + employee.id, { phone: 'WT local change' }); }
            case 'POST:/api/employees/timesheets': { const employee = await this.seedEmployee(); return result(pattern, { date: this.date, employeeId: employee.id, shopId: 'WT_ACCOUNT_A', status: 'work', workdayType: 'full' }, 201); }
            case 'PATCH:/api/employees/timesheets/[id]':
            case 'PUT:/api/employees/timesheets/[id]': {
                const employee = await this.seedEmployee(), shift = await this.seedShift(employee);
                return result('/api/employees/timesheets/' + shift.id, method === 'PATCH' ? {} : { date: this.date, employeeId: employee.id, shopId: 'WT_ACCOUNT_A', status: 'work', workdayType: 'half' });
            }
            case 'POST:/api/employees/advances': { const employee = await this.seedEmployee(); return result(pattern, { requestId: crypto.randomUUID(), employeeId: employee.id, shopId: this.context.shop, paidDate: this.date, payrollMonth: this.month, paidAmount: 10.01, reference: 'WT repetition', note: '' }, 201); }
            case 'PATCH:/api/employees/advances': {
                const employee = await this.seedEmployee(), id = this.key('LEGACY_ADVANCE'), time = '2026-01-01T01:00:00.000Z';
                await this.seedHistory([{ table: 'employee_advances', row: { id, employeeId: employee.id, shopId: this.context.shop, requestedDate: this.date, payrollMonth: this.month, requestedAmount: 10.01, paidAmount: 0, status: 'requested', paidDate: '', reference: '', note: 'WT legacy', createdAt: time, updatedAt: time } }], id);
                return result(pattern, { id, action: 'pay', updatedAt: time, paidDate: this.date, paidAmount: 10.01, reference: 'WT repetition' });
            }
            case 'POST:/api/employees/payroll/settle': {
                const employee = await this.seedEmployee(); await this.seedShift(employee);
                const payroll = (await this.get('/api/employees/payroll?month=' + this.month)).payroll.find(row => row.employeeId === employee.id);
                return result(pattern, { employeeId: employee.id, month: this.month, paidDate: '2026-01-31', reference: 'WT repetition', revision: payroll.revision });
            }
            case 'POST:/api/expenses': return result(pattern, this.expenseInput());
            case 'DELETE:/api/expenses': return result(pattern, { id: await this.seedExpense() });
            case 'POST:/api/expenses/masters/[kind]': return result('/api/expenses/masters/categories', { name: this.key('category'), active: true });
            case 'POST:/api/expenses/masters/shops': return result('/api/expenses/masters/shops', { name: this.key('shop'), active: true, loyverseAccountId: '' });
            default: assert.fail('No fresh state-changing scenario for ' + route);
        }
    }
    methodRoutes() {
        const routes = this.exportedMethods.filter(row => row.route !== '/api/line/webhook').map(row => row.method + ':' + row.route).sort();
        assert.equal(routes.length, 31); return [...routes, 'POST:/api/expenses/masters/shops'];
    }
    async WT_METHOD_FACTORY_SMOKE() {
        const proofs = [];
        for (const route of this.methodRoutes()) {
            const input = await this.scenario(route), revision = await this.revision();
            const response = await this.api(input.url, { ...input, key: this.key('factory-smoke') });
            assert.ok(Number(await this.revision()) > Number(revision), 'Smoke preparation produced a no-op: ' + route);
            proofs.push({ route, status: response.status, stateChanged: true }); this.save('method-factory-smoke.json', proofs);
        }
        this.control({}); await this.verifyOriginal();
    }
    async ordinaryMethodRepetitions() {
        // WT01 populated the physical export inventory. LINE uses its signed
        // logical-event protocol and is checked by its own journey/fault matrix.
        const routes = this.methodRoutes(), proof = [];
        for (const route of routes) {
            const item = { route, sameKeyPairs: 0, staleStatePairs: 0, postUnrelatedWriteReplays: 0, preCommitRollbacks: 0 };
            for (let trial = 0; trial < 20; trial++) {
                const fresh = await this.scenario(route), key = this.key('fresh-pair'), before = await this.revision();
                const request = { ...fresh, key };
                const pair = await Promise.all([this.api(fresh.url, request), this.api(fresh.url, request)]);
                assert.equal(pair[0].text, pair[1].text); assert.equal(pair[0].revision, pair[1].revision);
                assert.ok(Number(await this.revision()) > Number(before), 'Fresh scenario did not change state: ' + route);
                assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1 AND state=\'complete\'', [key]))[0].n, 1);
                await this.seedOrder();
                const at = await this.revision(), calls = this.ledger().filter(e => e.kind === 'fake-provider').length;
                const replay = await this.api(fresh.url, request); assert.equal(replay.text, pair[0].text); assert.equal(replay.revision, pair[0].revision);
                assert.equal(await this.revision(), at); assert.equal(this.ledger().filter(e => e.kind === 'fake-provider').length, calls);
                await this.api(fresh.url + '?WT_changed_query=1', { ...request, status: 409 });
                item.sameKeyPairs++; item.postUnrelatedWriteReplays++;
                const stale = await this.scenario(route), expected = '"stock-v2-' + await this.revision() + '"';
                const raced = await Promise.all([1, 2].map(() => this.api(stale.url, { ...stale, status: [stale.status, 409], key: this.key('stale-pair'), headers: { ...stale.headers, 'If-Match': expected } })));
                assert.deepEqual(raced.map(response => response.status).sort((a, b) => a - b), [stale.status, 409].sort((a, b) => a - b));
                item.staleStatePairs++;
                this.save('all-method-repetitions-running.json', { completed: proof, current: item, trial: trial + 1 });
            }
            const fault = await this.scenario(route), key = this.key('method-finalize-fault'), before = await this.seal(), revision = await this.revision();
            const priorControl = JSON.parse(fs.readFileSync(this.env.STOCK_WRITE_CONTROL));
            this.control({ ...priorControl, sqlBefore: { commandKey: key, match: "UPDATE stock_operational.commands SET state='complete'", remaining: 1 } });
            try { await this.api(fault.url, { ...fault, key, status: 503 }); } finally { this.control({}); }
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
            assert.equal(this.ledger().filter(e => e.kind === 'injected-fault' && e.commandKey === key).length, 1);
            item.preCommitRollbacks++; proof.push(item); this.save('all-method-repetitions.json', proof);
            await this.verifyOriginal();
        }
        await this.fileGraph('all-method-file-graph');
        assert.ok(proof.every(row => row.sameKeyPairs === 20 && row.staleStatePairs === 20 && row.postUnrelatedWriteReplays === 20 && row.preCommitRollbacks === 1));
    }
    async WT_ALL_METHOD_REPETITIONS() { await this.ordinaryMethodRepetitions(); }
    async WT_COMPOUND_ROLLBACK_REPETITIONS() {
        const routes = ['POST:/api/orders/with-images', 'PATCH:/api/movements/[id]/items/[itemId]', 'PATCH:/api/movements/[id]', 'POST:/api/employees', 'PATCH:/api/employees/[id]', 'POST:/api/loyverse/daily-sales/sync', 'POST:/api/shipments/[id]/orders', 'POST:/api/employees/payroll/settle'], proofs = [];
        for (const route of routes) for (let trial = 0; trial < 10; trial++) {
            const fault = await this.scenario(route), key = this.key('compound-rollback');
            if (route === 'PATCH:/api/employees/[id]') fault.body = { baseSalary: 130, compensationEffectiveFrom: '2026-01-02' };
            const before = await this.seal(), revision = await this.revision(), control = JSON.parse(fs.readFileSync(this.env.STOCK_WRITE_CONTROL));
            this.control({ ...control, sqlBefore: { commandKey: key, match: "UPDATE stock_operational.commands SET state='complete'", remaining: 1 } });
            try { await this.api(fault.url, { ...fault, key, status: 503 }); } finally { this.control({}); }
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
            assert.equal(this.ledger().filter(e => e.kind === 'injected-fault' && e.commandKey === key).length, 1);
            proofs.push({ route, trial: trial + 1, faultAfterBusinessWorkBeforeCommit: true, allBusinessRowsRevisionAndCommandRolledBack: true }); this.save('compound-rollback-repetitions.json', proofs);
        }
        assert.equal(proofs.length, 80); await this.verifyOriginal(); await this.fileGraph('compound-rollback-file-graph');
    }
}
module.exports = { MethodCampaign };
