/* eslint-disable @typescript-eslint/no-require-imports -- Approved prepared-copy load only. No project creation, fixture reset or budget increase. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { requireGate, assertExecution, sha } = require('./policy.cjs');
function taskEvidence(task) {
  const form = task.body instanceof FormData;
  return { intent: form ? Object.fromEntries([...task.body].filter(([, value]) => typeof value === 'string')) : task.body, fileBytes: form ? [...task.body].filter(([, value]) => typeof value !== 'string').map(([field, value]) => ({ field, name: value.name, type: value.type, size: value.size })) : undefined };
}
async function runLoadPacket(packet) {
  const { plan, binding, approval, env, manifest } = packet;
  assertExecution(plan, binding, approval, env); require('./seals.cjs').verifySeals(binding);
  requireGate(sha(JSON.stringify(manifest.binding)) === sha(JSON.stringify(binding)) && sha(JSON.stringify(manifest.plan)) === sha(JSON.stringify(plan)) && sha(JSON.stringify(manifest.approval)) === sha(JSON.stringify(approval)), 'LOAD_MANIFEST_BINDING');
  require('./runtime.cjs').configuration(env, manifest);
  requireGate([1, 5].includes(packet.clients) && binding.stage === (packet.clients === 1 ? 'L1' : 'L5') && manifest.mode === 'capacity', 'LOAD_PACKET_STAGE');
  requireGate(/^WT_[A-Z0-9_]+$/.test(packet.levelLabel) && !fs.existsSync(packet.evidenceDirectory), 'LOAD_NEW_EVIDENCE');
  const workloadBytes = fs.readFileSync(packet.workloadFile); requireGate(sha(workloadBytes) === binding.workloadSha256, 'LOAD_WORKLOAD_SEAL');
  const workload = JSON.parse(workloadBytes), baselineBytes = fs.readFileSync(packet.baselineRowsFile); requireGate(sha(baselineBytes) === binding.baselineRowsSha256, 'LOAD_BASELINE_SEAL');
  const originalBytes = fs.readFileSync(packet.originalRowHashesFile); requireGate(sha(originalBytes) === binding.originalRowsSha256, 'LOAD_ORIGINAL_SEAL');
  requireGate(Object.values(JSON.parse(originalBytes)).reduce((n, rows) => n + Object.keys(rows).length, 0) === plan.backup.businessRows, 'LOAD_ORIGINAL_COUNT');
  requireGate(/^[a-f0-9]{64}$/.test(binding.seedCheckpointSha256 || ''), 'LOAD_SEED_CHECKPOINT');
  const { strictObservation } = require('./protocol.cjs');
  const profile = () => JSON.parse(fs.readFileSync(packet.profileFile));
  const resourceGate = async () => { const value = profile(); strictObservation(value.profile, value.observation, binding); };
  await resourceGate();
  const clockFile = packet.combinedClockFile;
  if (packet.clients === 1) fs.writeFileSync(clockFile, JSON.stringify({ startedAtMs: Date.now(), seedCheckpointSha256: binding.seedCheckpointSha256, sourceRef: binding.projectRef }), { flag: 'wx', mode: 0o600 });
  const clockReceipt = JSON.parse(fs.readFileSync(clockFile)); requireGate(clockReceipt.seedCheckpointSha256 === binding.seedCheckpointSha256 && clockReceipt.startedAtMs <= Date.now() && Date.now() - clockReceipt.startedAtMs < 1800000, 'LOAD_SHARED_CLOCK');
  fs.mkdirSync(packet.evidenceDirectory, { mode: 0o700 });
  const save = (name, data) => fs.writeFileSync(path.join(packet.evidenceDirectory, name), JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(packet.evidenceDirectory, 'baseline-business-rows.json'), baselineBytes, { mode: 0o600 });
  save('workload-plan.json', workload); fs.writeFileSync(path.join(packet.evidenceDirectory, 'original-row-hashes.json'), originalBytes, { mode: 0o600 });
  require('../../../tests/helpers/postgres-runtime.cjs');
  const { createHostedDriver } = require('./driver.cjs'), { createClient } = require('./rpc.cjs'), { HostedCampaign } = require('./campaign.cjs'), { block } = require('../local-write/capacity-workload.cjs'), { runLevel } = require('./load.cjs');
  const driver = createHostedDriver({ plan, binding, approval, env, readProfile: () => profile().profile });
  const operator = createClient({ origin: manifest.coordinatorOrigin, token: packet.operatorToken, runId: manifest.runId, targetId: manifest.targetId, ca: manifest.coordinatorCa });
  const observer = Object.assign(Object.create(HostedCampaign.prototype), { env, manifest, ownerConfig: packet.observerConfig });
  const nativeStart = performance.now(), wallStart = Date.now(), clock = () => wallStart + performance.now() - nativeStart;
  try {
    await operator.call('ingress', { open: false });
    save('preflight-fingerprint-proof.json', require('./fingerprints.cjs').captureAndCompare(packet, { compareAll: true, directoryName: 'preflight-checkpoint' }));
    const baseline = require('./baseline-client.cjs').baselineClient(JSON.parse(baselineBytes), binding.baselineRevision), actual = await observer.owner();
    for (const name of Object.keys(require('../worksheets.json'))) {
      const sql = 'SELECT row_order::text n,business_cells,revision::text revision,archived_at FROM stock_operational.' + name + ' ORDER BY row_order';
      require('node:assert/strict').deepEqual((await actual.query(sql)).rows, (await baseline.query(sql)).rows);
    }
    const revisionSql = 'SELECT value::text v FROM stock_operational.revision WHERE singleton'; require('node:assert/strict').deepEqual((await actual.query(revisionSql)).rows, (await baseline.query(revisionSql)).rows);
    const original = JSON.parse(originalBytes), actualHashes = await observer.seal();
    for (const [name, rows] of Object.entries(original)) for (const [index, hash] of Object.entries(rows)) requireGate(actualHashes[name]?.[index] === hash, 'LOAD_ORIGINAL_ROW_CHANGED');
    await operator.call('ingress', { open: true });
    const result = await runLevel({ clients: packet.clients, clockStart: clockReceipt.startedAtMs, clock, resourceGate, block: (client, index, level) => block(workload, client, index, level),
      async execute(task) {
        const at = new Date().toISOString(), response = await driver.api(task.url, { method: task.method, body: task.body, key: task.key, maximumMs: 10000 });
        return { ...response, at, completedAt: new Date().toISOString(), method: task.method, url: task.url, key: task.key, variant: task.variant, fixture: task.fixture, ...taskEvidence(task), response: JSON.parse(response.body.toString()) };
      },
      async ledger(row, response) {
        const fd = fs.openSync(path.join(packet.evidenceDirectory, packet.levelLabel + '-http-ledger.jsonl'), 'a', 0o600);
        try { fs.writeFileSync(fd, JSON.stringify({ ...row, ...response, body: undefined }) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      },
      async oracle() {
        const drained = await require('./drain.cjs').stopAndDrain({ operator, observer: await observer.owner(), runtimeUser: binding.runtimeUser });
        save(packet.levelLabel + '-capacity-result.json', drained);
        const protectedProof = require('./fingerprints.cjs').captureAndCompare(packet); save('protected-archive-security-proof.json', protectedProof);
        const fd = fs.openSync(path.join(packet.evidenceDirectory, 'provider-ledger.jsonl'), 'wx', 0o600); let cursor = 0, snapshot;
        try { do { snapshot = await operator.call('snapshot', { cursor, includeEvidence: false }); for (const event of snapshot.events) fs.writeFileSync(fd, JSON.stringify({ ...event, ...(event.kind === 'harness-installed' ? { database: packet.levelLabel } : {}) }) + '\n'); cursor = snapshot.cursor; } while (cursor < snapshot.endAt); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        const file = path.join(packet.evidenceDirectory, 'oracle-packet.json'); save('oracle-packet.json', packet);
        const run = cp.spawnSync(process.execPath, [path.join(__dirname, 'capacity-oracle.cjs'), file], { cwd: path.resolve(__dirname, '../../..'), env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 300000 });
        requireGate(run.status === 0, 'LOAD_INDEPENDENT_ORACLE');
        const proof = JSON.parse(fs.readFileSync(path.join(packet.evidenceDirectory, packet.levelLabel + '-oracle-proof.json')));
        return { exactBusinessRows: proof.status === 'PASS', originalRowsUnchanged: proof.status === 'PASS', archiveAndMetadataUnchanged: protectedProof.archiveTables === 24 && protectedProof.metadataSections === 15 && protectedProof.environmentUnchanged, commandsAndRevisionsExact: proof.commandBodiesAndStatusesExact && proof.perRowAndGlobalRevisionsExact, providerGraphExplained: proof.fakeProviderGraph.pass };
      } });
    save('load-result.json', { ...result, completeCapacityAcceptance: 'PENDING_PAIRED_FRESH_CHECKPOINT_RECOVERY', driverTraffic: driver.evidence().traffic, coordinatorTraffic: operator.traffic() });
    require('./seals.cjs').verifySeals(binding); return result;
  } finally { try { await operator.call('ingress', { open: false }); } catch { save('ingress-stop-uncertain.json', { stopUncertain: true, manualReviewRequired: true }); } await observer.admin?.end(); }
}
module.exports = { runLoadPacket, taskEvidence };
if (require.main === module) (async () => {
  try { requireGate(require('../hosted-acceptance-plan.json').authorization.executionEnabled === true, 'EXECUTION_DISABLED'); requireGate(process.argv.length === 3, 'PRIVATE_LOAD_PACKET'); console.log(JSON.stringify(await runLoadPacket(JSON.parse(fs.readFileSync(process.argv[2]))))); }
  catch (error) { console.error('Hosted load stopped: ' + (error.code || 'PRIVATE_REVIEW_REQUIRED')); process.exitCode = 1; }
})();
