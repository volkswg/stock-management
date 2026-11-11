/* eslint-disable @typescript-eslint/no-require-imports -- Negative controls for capacity reporting and bounded scheduling. */
const test = require('node:test'), assert = require('node:assert/strict');
const { percentile, validateCorrectness, validateBlock, resourceGate, summarize, runLevel } = require('./capacity.cjs');
const sample = () => ({ atMs: Date.now(), databaseMemoryBytes: 1000000, applicationRssBytes: 1000000, driverRssBytes: 1000000, totalClientBackends: 3, runtimeBackends: 2, storageGrowthBytes: 1000, hostMemoryFreeFraction: .5, vmMemoryFreeFraction: .5, hostDiskFreeFraction: .5, vmDiskFreeFraction: .5, hostFreeDiskBytes: 10 * 2 ** 30, cpuQuotaFraction: .2, cpuOver80PercentMs: 0, oom: false, unplannedRestart: false, counterReset: false, limitsMatch: true });
const block = run => Array.from({ length: 20 }, (_, i) => ({ variant: 'route-' + i, class: i < 12 ? 'read' : i < 17 ? 'simpleWrite' : 'compoundWrite', expectedStatus: 200, run }));
test('capacity stays closed when correctness has failed or only inherited narrow checks passed', () => {
    for (const status of ['FAIL', 'BLOCKED', 'PASS', 'NOT RUN', 'LOCAL PASS']) assert.throws(() => validateCorrectness({ status }, {}));
    assert.throws(() => validateCorrectness({ status: 'LOCAL CORRECTNESS PASS', campaigns: [] }, {}));
});
test('correctness gate checks exact inventory, repetitions, checkpoint independence and version hashes', () => {
    const packet = { sourceHash: 'a'.repeat(64), harnessHash: 'b'.repeat(64), inventoryHash: 'c'.repeat(64), correctnessVariants: [{ id: 'case-a', repetitions: 20 }] };
    const campaign = id => ({ checkpointId: id, freshCheckpointVerified: true, originalRowsUnchanged: true, archiveAndMetadataUnchanged: true, cases: [{ id: 'case-a', status: 'PASS', completed: 20 }] });
    const proof = { ...packet, status: 'LOCAL CORRECTNESS PASS', scopeDispositionsReviewed: true, protectedStateVerified: true, harnessControlsPassed: true, campaigns: [campaign('fresh-1'), campaign('fresh-2')] };
    assert.equal(validateCorrectness(proof, packet), true);
    for (const change of [p => { p.campaigns[1].checkpointId = 'fresh-1'; }, p => { p.campaigns[0].cases = []; }, p => { p.campaigns[0].cases[0].completed = 19; }, p => { p.harnessHash = 'd'.repeat(64); }]) {
        const changed = structuredClone(proof); change(changed); assert.throws(() => validateCorrectness(changed, packet));
    }
});
test('capacity requires fresh complete resource observations and 20 percent headroom', () => {
    assert.deepEqual(resourceGate(sample(), Date.now()), []);
    for (const changed of [{ atMs: Date.now() - 2001 }, { runtimeBackends: 5 }, { totalClientBackends: 20 }, { driverRssBytes: 512 * 2 ** 20 }, { hostMemoryFreeFraction: .19 }, { vmDiskFreeFraction: .19 }, { cpuOver80PercentMs: 10000 }, { oom: true }, { limitsMatch: false }, { counterReset: true }]) assert.ok(resourceGate({ ...sample(), ...changed }, Date.now()).length);
    const missing = sample(); delete missing.vmMemoryFreeFraction;
    assert.ok(resourceGate(missing, Date.now()).length);
});
test('load mix and per-route percentiles cannot hide slow routes or inadequate sampling', () => {
    validateBlock(block(async () => ({ status: 200 })));
    assert.throws(() => validateBlock(block(async () => ({})).slice(1)));
    const rows = Array.from({ length: 20 }, () => ({ variant: 'slow', class: 'read', status: 200, expectedStatus: 200, ms: 2001 }));
    const cheap = Array.from({ length: 500 }, () => ({ variant: 'cheap', class: 'read', status: 200, expectedStatus: 200, ms: 1 }));
    assert.equal(percentile([1, 2, 3, 4, 100], .95), 100);
    assert.equal(summarize([...cheap, ...rows], ['cheap', 'slow']).status, 'FAIL');
    assert.equal(summarize(cheap.slice(0, 19), ['cheap']).status, 'INCONCLUSIVE');
    assert.equal(summarize([...cheap, { ...cheap[0], status: 503 }], ['cheap']).status, 'FAIL');
    assert.equal(summarize(cheap, ['cheap']).status, 'PASS');
});
test('one- and five-client controls never overlap a client or accumulate catch-up requests', async () => {
    for (const clients of [1, 5]) {
        const active = Array(clients).fill(0); let peak = 0;
        const result = await runLevel({ clients, controlTest: true, warmupMs: 0, measuredMs: 100, intervalMs: 5, timeoutMs: 50, observe: async () => sample(), makeBlock: async client => block(async () => {
            assert.equal(++active[client], 1); peak = Math.max(peak, active.reduce((a, b) => a + b, 0));
            await new Promise(r => setTimeout(r, 11)); active[client]--; return { status: 200 };
        }) });
        assert.ok(peak <= clients); assert.ok(result.started <= result.offeredSlots);
        assert.ok(result.unstartedSlots > 0); assert.equal(active.reduce((a, b) => a + b, 0), 0);
        assert.equal(result.finalOracleRequired, true); assert.notEqual(result.capacityAcceptance, 'PASS');
    }
});
test('a normal request failure stops new ingress and is retained without retries', async () => {
    let calls = 0;
    const report = await runLevel({ clients: 1, controlTest: true, warmupMs: 0, measuredMs: 100, intervalMs: 1, timeoutMs: 30, observe: async () => sample(), makeBlock: async () => block(async () => { calls++; return { status: 503 }; }) });
    assert.equal(calls, 1); assert.equal(report.status, 'FAIL'); assert.equal(report.stopReason, 'normal-request-failed');
});
test('missing telemetry refuses load before the first request', async () => {
    let called = false;
    const report = await runLevel({ clients: 1, controlTest: true, warmupMs: 0, measuredMs: 100, intervalMs: 1, timeoutMs: 30, observe: async () => null, makeBlock: async () => { called = true; return []; } });
    assert.equal(called, false); assert.equal(report.started, 0); assert.equal(report.status, 'FAIL');
});
test('a hung driver callback is bounded and leaves no new request ingress', async () => {
    let calls = 0;
    const report = await runLevel({ clients: 1, controlTest: true, warmupMs: 0, measuredMs: 100, intervalMs: 1, timeoutMs: 10, observe: async () => sample(), makeBlock: async () => block(() => { calls++; return new Promise(() => {}); }) });
    assert.equal(calls, 1); assert.equal(report.status, 'FAIL'); assert.equal(report.timedOut, 1);
    let constructed = false;
    const blocked = await runLevel({ clients: 1, controlTest: true, warmupMs: 0, measuredMs: 100, intervalMs: 1, timeoutMs: 10, observe: () => new Promise(() => {}), makeBlock: async () => { constructed = true; return []; } });
    assert.equal(constructed, false); assert.equal(blocked.started, 0); assert.equal(blocked.stopReason, 'driver-or-observer-failed');
});
