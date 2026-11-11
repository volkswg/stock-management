/* eslint-disable @typescript-eslint/no-require-imports -- Fail closed on an unsealed or enlarged local capacity budget. */
const assert = require('node:assert/strict');
function validatePacket(manifest, packet) {
    assert.equal(manifest.approvedLocalExecution, true);
    assert.equal(manifest.hostedTestingAuthorized, false);
    assert.equal(manifest.productionCutoverAuthorized, false);
    assert.equal(manifest.databaseHost, '127.0.0.1');
    assert.equal(manifest.providerMode, 'fake-only');
    assert.equal(manifest.databaseNames.length, 3);
    assert.equal(new Set(manifest.databaseNames).size, 3);
    assert.ok(manifest.databaseNames.every(name => /^wt_[a-z0-9_]{1,59}$/.test(name)));
    assert.equal(packet.applicationHeapMiB, 384, 'The default Node heap exceeds the reviewed app RSS budget');
    assert.equal(packet.applicationRssBudgetBytes, 2 ** 30);
    assert.equal(packet.driverHeapMiB, 256);
    assert.equal(packet.driverRssBudgetBytes, 512 * 2 ** 20);
    assert.equal(packet.requiredResourceFreeFraction, .2);
    assert.equal(packet.databaseMemoryBytes, 2 ** 30);
    assert.equal(packet.databaseNanoCpus, 1500000000);
    assert.equal(packet.applicationPoolMax, 2);
    assert.equal(packet.resourcePollingMs, 1000);
    assert.equal(packet.diskPollingMs, 10000);
    assert.ok(packet.capacityImplementationFiles && Object.keys(packet.capacityImplementationFiles).length >= 8);
    for (const [name, hash] of Object.entries(packet.capacityImplementationFiles)) {
        assert.match(name, /^tools\/migration\/local-write\/capacity(?:-[a-z-]+)?\.(cjs|py)$/);
        assert.match(hash, /^[a-f0-9]{64}$/);
    }
    return true;
}
module.exports = { validatePacket };
