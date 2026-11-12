/* eslint-disable @typescript-eslint/no-require-imports -- Original fixed schedule/mix; target execution and live strict observation are supplied by the approved packet. */
const { requireGate } = require('./policy.cjs');
const { percentile } = require('../local-write/capacity.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function runLevel({ clients, block, execute, resourceGate, clockStart, clock = () => performance.now(), sleep = wait, ledger, oracle }) {
  requireGate([1, 5].includes(clients) && Number.isFinite(clockStart), 'LOAD_PROFILE');
  const began = clock(), rows = []; let stopped = false; requireGate(clockStart >= 0 && clockStart <= began, 'LOAD_CLOCK');
  const guard = async () => { requireGate(!stopped && clock() - clockStart <= 1800000, 'LOAD_COMBINED_BUDGET'); await resourceGate(); };
  const outcomes = await Promise.allSettled(Array.from({ length: clients }, async (_, client) => {
    let currentBlock, currentIndex = -1;
    try {
      for (let slot = 0; slot < 720; slot++) {
        const scheduled = began + slot * 1000; if (clock() < scheduled) await sleep(scheduled - clock());
        requireGate(clock() - scheduled < 1000, 'LOAD_MISSED_SLOT'); await guard();
        const index = Math.floor(slot / 20);
        if (index !== currentIndex) {
          currentBlock = await block(client, index, clients); currentIndex = index;
          requireGate(currentBlock.length === 20 && currentBlock.filter(t => t.class === 'read').length === 12 && currentBlock.filter(t => t.class === 'simpleWrite').length === 5 && currentBlock.filter(t => t.class === 'compoundWrite').length === 3, 'LOAD_MIX');
        }
        const task = currentBlock[slot % 20], started = clock(); let timer;
        const signal = AbortSignal.timeout(10000);
        try {
          const result = await Promise.race([execute(task, signal), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('LOAD_TIMEOUT')), 10000); })]);
          const row = { client, slot, phase: slot < 120 ? 'warmup' : 'measured', variant: task.variant, class: task.class, status: result.status, ms: clock() - started, expectedStatus: task.expectedStatus };
          rows.push(row); await ledger(row, result);
          requireGate(result.status === task.expectedStatus && row.ms <= 10000, 'LOAD_REQUEST');
        } finally { clearTimeout(timer); }
      }
    } catch (error) { stopped = true; throw error; }
  }));
  const failed = outcomes.find(result => result.status === 'rejected'); if (failed) throw failed.reason;
  const measured = rows.filter(r => r.phase === 'measured'); requireGate(measured.length === 600 * clients, 'LOAD_SAMPLE_COUNT');
  const variants = new Map(); for (const row of measured) { const key = row.client + ':' + row.variant; variants.set(key, (variants.get(key) || 0) + 1); }
  requireGate([...variants.values()].every(count => count >= 20), 'LOAD_VARIANT_COVERAGE');
  const classes = {};
  for (const [kind, maximum] of Object.entries({ read: 2000, simpleWrite: 3000, compoundWrite: 5000 })) {
    const times = measured.filter(r => r.class === kind).map(r => r.ms); requireGate(times.length > 0 && percentile(times, .95) <= maximum, 'LOAD_P95_' + kind.toUpperCase());
    classes[kind] = { count: times.length, p50: percentile(times, .5), p95: percentile(times, .95), p99: percentile(times, .99), max: Math.max(...times) };
  }
  await guard(); const exact = await oracle(); requireGate(exact.exactBusinessRows && exact.originalRowsUnchanged && exact.archiveAndMetadataUnchanged && exact.commandsAndRevisionsExact && exact.providerGraphExplained, 'LOAD_ORACLE');
  return { status: 'PASS', clients, warmupRequests: 120 * clients, measuredRequests: measured.length, variants: variants.size, classes, scope: 'APPROVED_PROFILE_ONLY_NOT_PRODUCTION_CERTIFICATION' };
}
module.exports = { runLevel };
