/* eslint-disable @typescript-eslint/no-require-imports -- Virtual-time tests never create a cloud target or run a real load campaign. */
const test = require('node:test'), assert = require('node:assert/strict');
const { CASES, forecastTraffic, checkpointRecovery } = require('./protocol.cjs');
const { runLevel } = require('./load.cjs');
test('full hosted inventory retains 45 unique reviewed entries', () => {
  require('../../../tests/helpers/postgres-runtime.cjs');
  const { HostedCampaign } = require('./campaign.cjs'); assert.equal(CASES.length, 45); assert.equal(new Set(CASES).size, 45);
  assert.ok(CASES.every(name => typeof HostedCampaign.prototype[name] === 'function'));
});
const components = () => ['functional', 'browser', 'load', 'database-wire', 'backup-recovery', 'coordinator-monitoring'].map(phase => ({ phase, count: 100, upperBytesEach: 1000, pilotMeasured: true }));
test('traffic includes all channels, doubles the forecast and adds wire allowance without authorizing execution', () => {
  const result = forecastTraffic({ components: components(), complete: true, remainingOrganizationBytes: 4000000000 }); assert.equal(result.forecastBytes, 1500000); assert.equal(result.hostedRunAuthorized, false);
});
for (const [name, change] of [['missing database wire', value => value.components.splice(3, 1)], ['unmeasured pilot', value => { value.components[0].pilotMeasured = false; }], ['insufficient source reserve', value => { value.remainingOrganizationBytes = 2000000000; }], ['forecast over cap', value => { value.components[0].upperBytesEach = 10000000; }]]) test('traffic blocks ' + name, () => {
  const value = { components: components(), complete: true, remainingOrganizationBytes: 4000000000 }; change(value); assert.throws(() => forecastTraffic(value));
});
test('generated checkpoint timer includes retrieval/provision/restore/readiness and complete metadata proof', async () => {
  let now = 0, written;
  const result = await checkpointRecovery({ sourceRef: 'WT_source', targetRef: 'WT_new', clock: () => now,
    retrieveAndDecrypt: async () => { now += 70000; return { independentlyDownloaded: true, decryptionVerified: true, checksumsVerified: true, dumpReadable: true, acknowledgedCommandsSealed: true }; },
    provision: async () => { now += 100000; }, restore: async () => { now += 60000; }, fingerprint: async () => ({ tables: 51, metadataSections: 15, matchesCheckpoint: true, digest: 'WT_exact' }),
    denyRuntimeWrite: async () => ({ writeDenied: true, writerRoleMembershipDenied: true }), readOnlyApp: async () => { now += 20000; return { ready: true, providerCalls: 0, businessWrites: 0 }; }, evidence: async value => { written = value; } });
  assert.equal(result.seconds, 250); assert.equal(written.tables, 51); assert.equal(result.acknowledgedCheckpointCommandsLost, 0);
});
test('recovery refuses the original project and same-target restore before retrieval', async () => {
  for (const [sourceRef, targetRef] of [['orjnazrothkdgmzlsuto', 'WT_new'], ['WT_source', 'WT_source']]) await assert.rejects(checkpointRecovery({ sourceRef, targetRef }));
});
test('virtual schedule retains warmup, measured count, mix, minimum variants and exact oracle gate', async () => {
  let now = 0, ledger = 0;
  const result = await runLevel({ clients: 1, clockStart: 0, clock: () => now, sleep: async ms => { now += ms; }, resourceGate: async () => {},
    block: async () => Array.from({ length: 20 }, (_, index) => ({ variant: 'WT_' + index, class: index < 12 ? 'read' : index < 17 ? 'simpleWrite' : 'compoundWrite', expectedStatus: 200 })),
    execute: async () => { now += 5; return { status: 200 }; }, ledger: async () => { ledger++; }, oracle: async () => ({ exactBusinessRows: true, originalRowsUnchanged: true, archiveAndMetadataUnchanged: true, commandsAndRevisionsExact: true, providerGraphExplained: true }) });
  assert.equal(result.measuredRequests, 600); assert.equal(result.warmupRequests, 120); assert.equal(result.variants, 20); assert.equal(ledger, 720); assert.equal(result.classes.read.count, 360);
});
test('load stops before dispatch when the combined clock or resource gate fails', async () => {
  let dispatched = 0;
  await assert.rejects(runLevel({ clients: 1, clockStart: 0, clock: () => 1800001, resourceGate: async () => {}, execute: async () => { dispatched++; } })); assert.equal(dispatched, 0);
});
test('execution CLI refuses its disabled packet before reading a purported secret path', async () => {
  const cp = require('node:child_process'), path = require('node:path');
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'run-packet.cjs'), '/private/never-read-secret.json'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 1); assert.match(result.stderr, /EXECUTION_DISABLED/); assert.ok(!result.stderr.includes('ENOENT'));
});
test('independent capacity oracle preserves every original business assertion and refuses disabled execution', () => {
  const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
  const original = fs.readFileSync(path.join(__dirname, '../local-write/capacity-oracle.cjs'), 'utf8'), current = fs.readFileSync(path.join(__dirname, 'capacity-oracle.cjs'), 'utf8');
  const body = value => value.slice(value.indexOf('async function table'), value.indexOf('})().catch'));
  assert.equal(body(current), body(original).replace("assert.ok(result.appStopped&&result.ingressDrained,'Stop and drain ingress before the final oracle')", "assert.ok(result.ingressStopped&&result.ingressDrained,'Close durable admission and drain every backend before the final oracle')"));
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'capacity-oracle.cjs'), '/private/never-read.json'], { encoding: 'utf8', env: { PATH: process.env.PATH } }); assert.notEqual(result.status, 0); assert.match(result.stderr, /EXECUTION_DISABLED/);
});
test('frozen baseline rehydrates archive timestamps and refuses other tables or writes', async () => {
  const { baselineClient } = require('./baseline-client.cjs'), catalog = require('../worksheets.json');
  const rows = Object.fromEntries(Object.keys(catalog).map(table => [table, []])); rows.orders.push({ n: '1', revision: '3', business_cells: [], archived_at: '2020-01-01T00:00:00.000Z' });
  const source = baselineClient(rows, '3'), result = await source.query('SELECT row_order::text n,business_cells,revision::text revision,archived_at FROM stock_operational.orders ORDER BY row_order'); assert.ok(result.rows[0].archived_at instanceof Date);
  assert.equal((await source.query('SELECT value::text v FROM stock_operational.revision WHERE singleton')).rows[0].v, '3');
  await assert.rejects(source.query('DELETE FROM stock_operational.orders')); assert.throws(() => baselineClient({ orders: [] }, '0'));
});
test('code seals reject a stale adapter before execution', () => {
  const { seals, verifySeals } = require('./seals.cjs'); const actual = seals(); assert.equal(verifySeals(actual).sourceCommit, actual.sourceCommit);
  assert.throws(() => verifySeals({ ...actual, adapterSha256: '0'.repeat(64) }), { code: 'CODE_SEAL_ADAPTERSHA256' });
});
test('drain requires complete backend visibility and reconciles only absent backend IDs', async () => {
  const { stopAndDrain } = require('./drain.cjs'); let leases = [{ leaseId: 'WT_LEASE', instanceId: 'WT_INSTANCE', backendPid: 100 }], closed = false;
  const operator = { async call(action) { if (action === 'ingress') closed = true; if (action === 'reconcile-closed-backend') leases = []; return { open: !closed, leases }; } };
  const observer = { async query(sql) { return { rows: sql.includes('pg_has_role') ? [{ visible: true }] : [] }; } };
  assert.equal((await stopAndDrain({ operator, observer, runtimeUser: 'WT_RUNTIME' })).ingressDrained, true);
  await assert.rejects(stopAndDrain({ operator, runtimeUser: 'WT_RUNTIME', observer: { query: async () => ({ rows: [{ visible: false }] }) } }), { code: 'DRAIN_VISIBILITY' });
});
test('coordinator startup also refuses disabled execution before reading a secret packet', () => {
  const cp = require('node:child_process'), path = require('node:path');
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'serve-coordinator.cjs'), '/private/never-read.json'], { encoding: 'utf8', env: { PATH: process.env.PATH } }); assert.equal(result.status, 1); assert.match(result.stderr, /EXECUTION_DISABLED/);
});
test('load CLI refuses disabled execution before reading a secret packet', () => {
  const cp = require('node:child_process'), path = require('node:path');
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'run-load.cjs'), '/private/never-read.json'], { encoding: 'utf8', env: { PATH: process.env.PATH } }); assert.equal(result.status, 1); assert.match(result.stderr, /EXECUTION_DISABLED/);
});
test('post-load protected fingerprints require all 51 tables, 15 metadata sections and unchanged archive/environment hashes', () => {
  const { compareProtected } = require('./fingerprints.cjs');
  const before = [...Array.from({ length: 24 }, (_, i) => ({ table: 'stock_migration.table_' + i, rows: 0, sha256: 'a' })), ...Array.from({ length: 26 }, (_, i) => ({ table: 'stock_operational.table_' + i, rows: 0, sha256: 'b' })), { table: 'stock_operational.environment', rows: 1, sha256: 'c' }, ...Array.from({ length: 15 }, (_, i) => ({ metadata: 'section_' + i, sha256: 'd' }))];
  assert.equal(compareProtected(before, structuredClone(before)).archiveTables, 24);
  const changed = structuredClone(before); changed[0].sha256 = 'changed'; assert.throws(() => compareProtected(before, changed)); assert.throws(() => compareProtected(before, before.slice(1)));
});
