/* eslint-disable @typescript-eslint/no-require-imports -- Append-only synthetic historical fixtures on a validated disposable local target. */
const assert = require('node:assert/strict'), fs = require('node:fs');
const catalog = require('../worksheets.json');
const properties = Object.freeze({ orders: 'orders', shipments: 'shipments', shipment_orders: 'shipmentOrders', employee_advances: 'employeeAdvances', user_state: 'userState' });
function validateRows(records) {
    assert.ok(Array.isArray(records) && records.length > 0 && records.length <= 12);
    for (const { table, row } of records) {
        assert.ok(Object.hasOwn(properties, table)); assert.ok(row && typeof row.id === 'string' && row.id.startsWith('WT_'));
        assert.ok(Object.keys(row).every(key => catalog[table].headers.includes(key)));
        assert.ok(Object.values(row).every(value => value === null || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean'));
        for (const key of ['orderId', 'shipmentId']) if (row[key]) assert.ok(row[key].startsWith('WT_'));
        if (table === 'user_state') assert.ok(row.userId?.startsWith('WT_') && row.referenceId?.startsWith('WT_') && row.flowname === 'MovementCreate');
    }
    return records;
}
module.exports = { validateRows };
if (require.main === module) (async () => {
    let closePool, restore;
    try {
        const env = JSON.parse(fs.readFileSync(process.argv[2])), records = validateRows(JSON.parse(fs.readFileSync(process.argv[3])));
        for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
        const { validate, install } = require('./runtime.cjs'); validate(env, JSON.parse(fs.readFileSync(env.STOCK_WRITE_MANIFEST))); restore = install();
        require('../../../tests/helpers/postgres-runtime.cjs');
        const database = require('../../../src/infrastructure/persistence/postgres/database.ts'); closePool = database.closePool;
        const { createPostgresService } = require('../../../src/composition/postgres/service.ts');
        await database.transaction(true, async () => {
            const client = database.requireMutation(), service = createPostgresService();
            for (const { table, row } of records) {
                assert.equal((await client.query('SELECT id FROM stock_operational.' + table + ' WHERE id=$1', [row.id])).rowCount, 0);
                if (table === 'employee_advances') for (const [key, target] of [['employeeId', 'employees'], ['shopId', 'shops']]) {
                    const found = await client.query('SELECT business_cells FROM stock_operational.' + target + ' WHERE id=$1 AND archived_at IS NULL', [row[key]]);
                    assert.equal(found.rowCount, 1); assert.ok(found.rows[0].business_cells.some(value => typeof value === 'string' && value.startsWith('WT_')));
                }
                const headers = catalog[table].headers, values = headers.map(key => row[key] ?? '');
                await service[properties[table]].appendRows('A:' + String.fromCharCode(64 + headers.length), [values]);
            }
        });
        console.log(JSON.stringify({ syntheticHistoricalRowsAppended: records.length, existingRowsEdited: false }));
    } catch (error) { console.error('Synthetic history seed refused or failed.', error.name); process.exitCode = 1; }
    finally { await closePool?.(); restore?.(); }
})();
