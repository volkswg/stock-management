/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic historical contracts; protected copied rows remain immutable. */
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { AcceptanceCampaign } = require('./acceptance-coverage.cjs');
class HistoricalCampaign extends AcceptanceCampaign {
    async seedHistory(records, label) {
        const file = path.join(this.out, label + '-fixture.json'); fs.writeFileSync(file, JSON.stringify(records), { mode: 0o600 });
        const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'legacy-fixtures.cjs'), path.join(this.state, this.db + '-app-env.json'), file], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8', timeout: 30000 });
        this.save(label + '-seed-result.json', { exit: result.status, stdout: result.stdout, stderr: result.stderr }); assert.equal(result.status, 0);
    }
    async WT_HISTORICAL_CONTRACTS() {
        const ids = Object.fromEntries(['canceledOrder', 'deletedOrder', 'linkedOrder', 'canceledShipment', 'legacyShipment', 'link'].map(name => [name, this.prefix + '_HISTORY_' + name]));
        const time = '2020-01-01T01:00:00.000Z', common = { createdAt: time, updatedAt: time, createdBy: 'WT_history' };
        await this.seedHistory([
            { table: 'orders', row: { ...common, id: ids.canceledOrder, status: 'canceled', seller: this.prefix, totalPrice: 12.34 } },
            { table: 'orders', row: { ...common, id: ids.deletedOrder, status: 'draft', seller: this.prefix, totalPrice: 23.45, deletedAt: time } },
            { table: 'orders', row: { ...common, id: ids.linkedOrder, status: 'draft', seller: this.prefix, totalPrice: 34.56 } },
            { table: 'shipments', row: { ...common, id: ids.canceledShipment, status: 'canceled', carrier: 'WT old carrier', poNumber: 'WT old PO' } },
            { table: 'shipments', row: { ...common, id: ids.legacyShipment, status: 'draft', carrier: 'WT old carrier', poNumber: 'WT old PO' } },
            { table: 'shipment_orders', row: { ...common, id: ids.link, shipmentId: ids.legacyShipment, orderId: ids.linkedOrder } },
        ], 'historical-contracts');
        const before = await this.seal();
        const canceled = (await this.get('/api/orders/' + ids.canceledOrder)).order; assert.equal(canceled.status, 'canceled'); assert.equal(canceled.totalPrice, 12.34);
        await this.api('/api/orders/' + ids.deletedOrder, { status: 404 });
        const shipment = (await this.get('/api/shipments/' + ids.canceledShipment)).shipment; assert.equal(shipment.status, 'canceled');
        const linked = (await this.get('/api/shipments/' + ids.legacyShipment)).shipment;
        assert.ok(linked.orders.some(order => order.id === ids.linkedOrder));
        await this.patch('/api/orders/' + ids.linkedOrder, { remark: 'WT historical relationship retained', totalPrice: 45.67 }, { _probe: true });
        assert.equal((await this.sql('SELECT "orderId","shipmentId" FROM stock_operational.shipment_orders WHERE id=$1', [ids.link]))[0].orderId, ids.linkedOrder);
        const after = await this.seal();
        for (const table of Object.keys(before)) if (table !== 'orders') assert.deepEqual(after[table], before[table]);
        assert.equal((await this.get('/api/orders/' + ids.linkedOrder)).order.totalPrice, 45.67);
        this.save('historical-contracts-proof.json', { syntheticRows: 6, canceledHistoryReadable: true, deletedOrderExcluded: true, oldLinkRetainedAfterSupportedEdit: true, copiedOriginalRowsUnchanged: !!(await this.verifyOriginal()) });
    }
    async WT_LEGACY_ADVANCES() {
        const employeeId = this.context.employee.id, time = '2026-02-01T01:00:00.000Z';
        const common = { employeeId, shopId: this.context.shop, requestedDate: '2026-02-01', payrollMonth: '2026-02', requestedAmount: 15.25, paidAmount: 0, paidDate: '', reference: '', note: 'WT legacy', createdAt: time, updatedAt: time };
        const paidId = this.prefix + '_LEGACY_PAY', cancelId = this.prefix + '_LEGACY_CANCEL';
        const settlements = () => this.sql('SELECT id,business_cells,revision::text FROM stock_operational.payroll_settlements WHERE "employeeId"=$1 ORDER BY row_order', [employeeId]);
        const settledBefore = await settlements();
        await this.seedHistory([{ table: 'employee_advances', row: { ...common, id: paidId, status: 'requested' } }, { table: 'employee_advances', row: { ...common, id: cancelId, status: 'approved' } }], 'legacy-advances');
        const pay = { id: paidId, action: 'pay', updatedAt: time, paidDate: '2026-02-02', paidAmount: 10.01, reference: 'WT legacy paid' };
        const revision = await this.revision();
        await this.patch('/api/employees/advances', { ...pay, updatedAt: 'stale' }, { status: 409, _probe: true }); assert.equal(await this.revision(), revision);
        await this.patch('/api/employees/advances', pay, { _probe: true });
        const at = await this.revision(); await this.patch('/api/employees/advances', pay, { _probe: true }); assert.equal(await this.revision(), at);
        const cancel = { id: cancelId, action: 'cancel', updatedAt: time };
        await this.patch('/api/employees/advances', cancel, { _probe: true });
        const canceledAt = await this.revision(); await this.patch('/api/employees/advances', cancel, { _probe: true }); assert.equal(await this.revision(), canceledAt);
        const rows = (await this.get('/api/employees/advances')).advances;
        assert.equal(rows.find(row => row.id === paidId).paidAmount, 10.01); assert.equal(rows.find(row => row.id === cancelId).status, 'cancelled');
        assert.deepEqual(await settlements(), settledBefore);
        this.save('legacy-advances-proof.json', { staleRefused: 409, requestedPaid: 10.01, approvedCanceled: true, repeatedActionsNoRevisionChange: true, existingSettlementSnapshotsUnchanged: true });
    }
}
module.exports = { HistoricalCampaign };
