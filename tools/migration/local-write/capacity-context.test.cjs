/* eslint-disable @typescript-eslint/no-require-imports -- Regression for an unconstrained Node heap and source/budget drift. */
const test = require('node:test'), assert = require('node:assert/strict');
const { validatePacket } = require('./capacity-context.cjs');
function fixture() {
    return [{ approvedLocalExecution: true, hostedTestingAuthorized: false, productionCutoverAuthorized: false, databaseHost: '127.0.0.1', providerMode: 'fake-only', databaseNames: ['wt_seed', 'wt_one', 'wt_five'] }, {
        applicationHeapMiB: 384, applicationRssBudgetBytes: 2 ** 30, driverHeapMiB: 256, driverRssBudgetBytes: 512 * 2 ** 20, requiredResourceFreeFraction: .2,
        databaseMemoryBytes: 2 ** 30, databaseNanoCpus: 1500000000, applicationPoolMax: 2, resourcePollingMs: 1000, diskPollingMs: 10000,
        capacityImplementationFiles: Object.fromEntries(['capacity.cjs', 'capacity-workload.cjs', 'capacity-context.cjs', 'capacity-execution.cjs', 'capacity-oracle.cjs', 'capacity-observer.py', 'capacity-recovery.py', 'capacity-start-app.py'].map(name => ['tools/migration/local-write/' + name, 'a'.repeat(64)])),
    }];
}
test('an implicit/default app heap cannot enter the bounded capacity protocol', () => {
    const [manifest, packet] = fixture(); assert.equal(validatePacket(manifest, packet), true);
    delete packet.applicationHeapMiB; assert.throws(() => validatePacket(manifest, packet));
    packet.applicationHeapMiB = 2240; assert.throws(() => validatePacket(manifest, packet));
});
test('heap control does not permit enlarged RSS, database, pool or headroom budgets', () => {
    for (const change of [{ applicationHeapMiB: 512 }, { applicationRssBudgetBytes: 2 * 2 ** 30 }, { databaseMemoryBytes: 2 * 2 ** 30 }, { applicationPoolMax: 3 }, { requiredResourceFreeFraction: .1 }, { resourcePollingMs: 5000 }]) {
        const [manifest, packet] = fixture(); assert.throws(() => validatePacket(manifest, { ...packet, ...change }));
    }
});
test('missing source identities and hosted/original targets are refused before startup', () => {
    const [manifest, packet] = fixture(); assert.throws(() => validatePacket(manifest, { ...packet, capacityImplementationFiles: {} }));
    for (const change of [{ hostedTestingAuthorized: true }, { databaseHost: 'db.example.com' }, { providerMode: 'real' }, { databaseNames: ['postgres', 'wt_one', 'wt_five'] }]) assert.throws(() => validatePacket({ ...manifest, ...change }, packet));
});
