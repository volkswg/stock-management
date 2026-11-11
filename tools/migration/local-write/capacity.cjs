/* eslint-disable @typescript-eslint/no-require-imports -- Bounded load engine; isolated execution must supply reviewed work and live resource observations. */
const assert = require('node:assert/strict');
const LIMITS = Object.freeze({ warmupMs: 120000, measuredMs: 600000, intervalMs: 1000, timeoutMs: 10000, minimumSamples: 20, p95Ms: { read: 2000, simpleWrite: 3000, compoundWrite: 5000 } });
const MIX = Object.freeze({ read: 12, simpleWrite: 5, compoundWrite: 3 });
async function boundedControl(operation) {
    let timer;
    try {
        return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Capacity control deadline exceeded')), 2000);
        })]);
    } finally { clearTimeout(timer); }
}
function percentile(values, p) {
    if (!values.length) return null;
    return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
}
function validateCorrectness(proof, packet) {
    assert.equal(proof?.status, 'LOCAL CORRECTNESS PASS', 'Capacity requires completed local correctness');
    for (const key of ['sourceHash', 'harnessHash', 'inventoryHash']) assert.match(packet[key], /^[a-f0-9]{64}$/);
    assert.ok(packet.correctnessVariants?.length > 0);
    const required = new Map(packet.correctnessVariants.map(c => [c.id, c.repetitions]));
    assert.equal(required.size, packet.correctnessVariants.length);
    for (const count of required.values()) assert.ok(Number.isInteger(count) && count > 0);
    assert.equal(proof.campaigns?.length, 2);
    assert.equal(new Set(proof.campaigns.map(c => c.checkpointId)).size, 2);
    assert.equal(proof.sourceHash, packet.sourceHash); assert.equal(proof.harnessHash, packet.harnessHash);
    assert.equal(proof.inventoryHash, packet.inventoryHash);
    assert.ok(proof.scopeDispositionsReviewed && proof.protectedStateVerified && proof.harnessControlsPassed);
    for (const campaign of proof.campaigns) {
        assert.ok(campaign.freshCheckpointVerified && campaign.originalRowsUnchanged && campaign.archiveAndMetadataUnchanged);
        assert.deepEqual(campaign.cases.map(c => c.id).sort(), [...required.keys()].sort());
        assert.ok(campaign.cases.every(c => c.status === 'PASS' && c.completed >= required.get(c.id)));
    }
    return true;
}
function validateBlock(block) {
    assert.equal(block.length, 20);
    const counts = { read: 0, simpleWrite: 0, compoundWrite: 0 };
    for (const task of block) {
        assert.ok(Object.hasOwn(counts, task.class)); counts[task.class]++;
        assert.equal(typeof task.variant, 'string'); assert.ok(task.variant.length);
        assert.equal(typeof task.run, 'function');
        assert.ok(Number.isInteger(task.expectedStatus) && task.expectedStatus >= 200 && task.expectedStatus < 400);
    }
    assert.deepEqual(counts, MIX);
}
// The observer collects sanitized aggregate data outside the timed HTTP driver.
// Missing/stale telemetry blocks the run; it is never treated as zero usage.
function resourceGate(sample, now) {
    const reasons = [];
    if (!sample || !Number.isFinite(sample.atMs) || now - sample.atMs > 2000 || sample.atMs > now) return ['missing-or-stale-resource-observation'];
    const maximum = { databaseMemoryBytes: .8 * 2 ** 30, applicationRssBytes: .8 * 2 ** 30, driverRssBytes: .8 * 512 * 2 ** 20, totalClientBackends: 19, runtimeBackends: 4, storageGrowthBytes: 4 * 2 ** 30 };
    for (const [key, limit] of Object.entries(maximum)) if (!Number.isFinite(sample[key]) || sample[key] < 0 || sample[key] > limit) reasons.push(key);
    for (const key of ['hostMemoryFreeFraction', 'vmMemoryFreeFraction', 'hostDiskFreeFraction', 'vmDiskFreeFraction']) if (!Number.isFinite(sample[key]) || sample[key] < .2 || sample[key] > 1) reasons.push(key);
    if (!Number.isFinite(sample.hostFreeDiskBytes) || sample.hostFreeDiskBytes < 5 * 2 ** 30) reasons.push('hostFreeDiskBytes');
    if (!Number.isFinite(sample.cpuQuotaFraction) || sample.cpuQuotaFraction < 0 || sample.cpuQuotaFraction > 1 || !Number.isFinite(sample.cpuOver80PercentMs) || sample.cpuOver80PercentMs >= 10000) reasons.push('cpu-headroom');
    if (sample.oom !== false || sample.unplannedRestart !== false || sample.counterReset !== false || sample.limitsMatch !== true) reasons.push('resource-identity-or-restart');
    return reasons;
}
function summarize(samples, variants) {
    const distributions = {}, failures = [];
    for (const variant of variants) {
        const group = samples.filter(s => s.variant === variant), values = group.filter(s => !s.error && s.expectedStatus === s.status).map(s => s.ms);
        const classes = new Set(group.map(s => s.class));
        if (classes.size !== 1 && group.length) failures.push(variant + ':ambiguous-class');
        const classification = group[0]?.class, limit = LIMITS.p95Ms[classification];
        const distribution = { successful: values.length, attempted: group.length, p50: percentile(values, .5), p95: percentile(values, .95), p99: percentile(values, .99), max: values.length ? Math.max(...values) : null };
        distributions[variant] = distribution;
        if (group.some(s => s.error || s.expectedStatus !== s.status || !Number.isFinite(s.ms) || s.ms > LIMITS.timeoutMs)) failures.push(variant + ':request-failure');
        if (distribution.p95 !== null && distribution.p95 > limit) failures.push(variant + ':p95');
    }
    const undersampled = variants.filter(v => distributions[v].successful < LIMITS.minimumSamples);
    const classes = {};
    for (const classification of Object.keys(MIX)) {
        const values = samples.filter(s => s.class === classification && !s.error && s.expectedStatus === s.status).map(s => s.ms);
        classes[classification] = { successful: values.length, p50: percentile(values, .5), p95: percentile(values, .95), p99: percentile(values, .99), max: values.length ? Math.max(...values) : null };
        if (classes[classification].p95 !== null && classes[classification].p95 > LIMITS.p95Ms[classification]) failures.push(classification + ':aggregate-p95');
    }
    return { status: failures.length ? 'FAIL' : undersampled.length ? 'INCONCLUSIVE' : 'PASS', distributions, classes, failures, undersampled };
}
// No catch-up queue: when a request occupies several slots, those slots remain
// unstarted. One worker represents one client and never has two requests in flight.
async function runLevel({ clients, makeBlock, observe, correctness, packet, clock = () => performance.now(), sleep = ms => new Promise(r => setTimeout(r, ms)), emit = () => {}, warmupMs = LIMITS.warmupMs, measuredMs = LIMITS.measuredMs, intervalMs = LIMITS.intervalMs, timeoutMs = LIMITS.timeoutMs, controlTest = false }) {
    assert.ok([1, 5].includes(clients));
    if (!controlTest) {
        validateCorrectness(correctness, packet);
        assert.deepEqual({ warmupMs, measuredMs, intervalMs, timeoutMs }, { warmupMs: LIMITS.warmupMs, measuredMs: LIMITS.measuredMs, intervalMs: LIMITS.intervalMs, timeoutMs: LIMITS.timeoutMs });
    }
    const start = clock(), measureStart = start + warmupMs, end = measureStart + measuredMs;
    const samples = [], variants = new Set(), controllers = new Set(); let stopped = false, stopReason, started = 0, warmupStarted = 0;
    const stop = reason => { if (!stopped) { stopped = true; stopReason = reason; for (const controller of controllers) controller.abort(); } };
    await Promise.all(Array.from({ length: clients }, async (_, client) => {
      try {
        let slot = 0, block = [], offset = 0, blockIndex = 0;
        while (!stopped) {
            const due = start + slot * intervalMs;
            if (due >= end) break;
            if (clock() < due) await sleep(due - clock());
            if (stopped || clock() >= end) break;
            slot = Math.max(slot, Math.floor((clock() - start) / intervalMs));
            const problems = resourceGate(await boundedControl(observe), Date.now());
            if (problems.length) { stop(problems.join(',')); break; }
            if (offset === block.length) {
                block = await boundedControl(() => makeBlock(client, blockIndex++)); validateBlock(block); offset = 0;
                block.forEach(task => variants.add(task.variant));
            }
            if (stopped || clock() >= end) break;
            const task = block[offset++], at = clock(), measured = at >= measureStart;
            const controller = new AbortController(); controllers.add(controller);
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            let result, error, onAbort;
            if (measured) started++; else warmupStarted++;
            try {
                result = await Promise.race([Promise.resolve().then(() => task.run(controller.signal)), new Promise((_, reject) => {
                    onAbort = () => { const error = new Error('Load request aborted'); error.name = 'AbortError'; reject(error); };
                    controller.signal.addEventListener('abort', onAbort, { once: true });
                    if (controller.signal.aborted) onAbort();
                })]);
            } catch (cause) { error = cause.name || 'Error'; }
            finally { clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort); controllers.delete(controller); }
            // task.run must await complete body consumption and return actual HTTP
            // status. The independent final oracle is still a mandatory exit gate.
            const record = { client, variant: task.variant, class: task.class, expectedStatus: task.expectedStatus, status: result?.status, ms: clock() - at, error, measured };
            emit(record); if (measured) samples.push(record);
            if (error || result?.status !== task.expectedStatus || record.ms > timeoutMs) stop('normal-request-failed');
            slot++;
        }
      } catch {
        stop('driver-or-observer-failed');
      }
    }));
    const offeredSlots = clients * Math.ceil(measuredMs / intervalMs);
    const report = summarize(samples, [...variants]);
    return { ...report, status: stopped ? 'FAIL' : report.status, stopReason, clients, offeredSlots, started, completed: samples.filter(s => !s.error).length, timedOut: samples.filter(s => s.error === 'TimeoutError' || s.error === 'AbortError').length, unstartedSlots: offeredSlots - started, warmupStarted, actualThroughputPerSecond: samples.filter(s => !s.error).length / (measuredMs / 1000), samples, finalOracleRequired: true, capacityAcceptance: 'INCOMPLETE until original-row, archive/metadata, workload-delta and recovery checks pass' };
}
module.exports = { LIMITS, MIX, percentile, validateCorrectness, validateBlock, resourceGate, summarize, runLevel };
