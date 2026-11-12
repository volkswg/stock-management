/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic loopback and private temporary-file tests only. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const plan = require('../hosted-acceptance-plan.json');
const { inspectBinding, assertExecution, sha } = require('./policy.cjs');
const { assessProfile, measurePayload, TrafficBudget } = require('./feasibility.cjs');
const { createOfflineDriver, createHostedDriver } = require('./driver.cjs');
const { openCoordinator } = require('./coordinator.cjs');
const binding = () => ({ version: 1, projectRef: 'abcdefghijklmnopqrst', isolationId: '11111111-2222-4333-8444-555555555555', appProjectId: 'prj_WTOnly', deploymentId: 'dpl_WTOnly', appOrigin: 'https://wt-only.vercel.app', environment: 'preview', productionDomains: false, region: 'ap-northeast-1', postgresMajor: 17, stage: 'F', runtimeUser: 'stock_ha_runtime', database: 'postgres', providerMode: 'fake-only', connectionMode: 'direct', databaseHost: 'db.abcdefghijklmnopqrst.supabase.co', databasePort: 5432, sourceCommit: 'a'.repeat(40), adapterSha256: 'b'.repeat(64), fixtureSha256: 'c'.repeat(64), baselineSha256: 'd'.repeat(64) });
function fixture() {
  const target = binding(), now = 100000;
  return { target, now, enabled: { ...structuredClone(plan), authorization: { executionEnabled: true, resourceCreationApproved: true, hostedWritesApproved: true }, applicationProposal: { harnessStatus: 'REVIEWED_HOSTED_RUNTIME_AND_CAMPAIGN' } }, approval: { bindingSha256: sha(JSON.stringify(target)), sourceCommit: target.sourceCommit, stage: 'F', hostedWritesApproved: true, paidResourcesApproved: false, productionCutoverApproved: false, expiresAtMs: now + 60000 }, env: { VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: target.appProjectId, VERCEL_DEPLOYMENT_ID: target.deploymentId, STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_TARGET_ISOLATION_ID: target.isolationId, STOCK_DATABASE_URL: 'postgresql://stock_ha_runtime:WT_fake_only@' + target.databaseHost + ':5432/postgres', STOCK_STAGING_AUTH_TOKEN: 'WT_' + 'x'.repeat(40) } };
}
function profile() {
  return { telemetry: { entitlementVerified: true, sampleIntervalMs: 1000, seriesFreshnessMs: 1000, cpuWindowMs: 10000, databaseMemory: true, databaseCpu: true, allAppInstances: true, driver: true, restartsAndOom: true, diskAndWal: true }, limits: { databaseMemoryBytes: 500000000, appCombinedRssBytes: 1073741824, driverRssBytes: 536870912, databaseDiskBytes: 500000000 }, connections: { poolPerInstance: 2, runtimeLoginLimit: 6, runtimeBackendsMaximum: 4, providerMaximum: 60, observedTotal: 20 }, budget: { remainingOrganizationBytes: 4500000000, protectedSourceReserveBytes: 2000000000, campaignCapBytes: 1000000000, completeForecastBytes: 500000000, observedAtMs: 100000, includesAllCampaignTraffic: true, providerMeterIndependent: true, incrementalSpendApproved: 0, existingHostingAllowanceVerified: true, offsiteAllowanceVerified: true } };
}
test('checked-in packet cannot construct a hosted driver or authorize an execution', () => {
  const f = fixture();
  assert.throws(() => assertExecution(plan, f.target, f.approval, f.env, f.now), { code: 'EXECUTION_DISABLED' });
  assert.throws(() => createHostedDriver({ plan, binding: f.target, approval: f.approval, env: f.env, profile: profile() }), { code: 'EXECUTION_DISABLED' });
  assert.equal(plan.authorization.executionEnabled, false);
  assert.equal(plan.authorization.hostedWritesApproved, false);
});
for (const [name, delta] of Object.entries({ sourceProject: { projectRef: 'orjnazrothkdgmzlsuto' }, sourceUuid: { isolationId: '160669bd-2f6f-4490-9259-bada5a1d02c4' }, productionApp: { appProjectId: 'prj_XH4nEje5cicuBuucGumuHgr73l1E' }, production: { environment: 'production' }, customDomain: { appOrigin: 'https://inventra-beta-one.example' }, userinfo: { appOrigin: 'https://user:password@wt-only.vercel.app' }, pathname: { appOrigin: 'https://wt-only.vercel.app/api' }, transactionPooler: { databasePort: 6543 }, wrongPoolerRegion: { connectionMode: 'session', databaseHost: 'aws-0-us-east-1.pooler.supabase.com' }, ownerLogin: { runtimeUser: 'postgres' }, unsealed: { baselineSha256: null } })) {
  test('target binding rejects ' + name + ' even if supplied protected lists are removed', () => assert.throws(() => inspectBinding({ ...plan, protectedTargets: {} }, { ...binding(), ...delta })));
}
test('session mode binds exact target-specific runtime user and Tokyo pooler', () => {
  const f = fixture(); f.target.connectionMode = 'session'; f.target.databaseHost = 'aws-0-ap-northeast-1.pooler.supabase.com';
  f.env.STOCK_DATABASE_URL = 'postgresql://stock_ha_runtime.abcdefghijklmnopqrst:WT_only@' + f.target.databaseHost + ':5432/postgres';
  f.approval.bindingSha256 = sha(JSON.stringify(f.target));
  assert.equal(assertExecution(f.enabled, f.target, f.approval, f.env, f.now).projectRef, f.target.projectRef);
  f.env.STOCK_DATABASE_URL = f.env.STOCK_DATABASE_URL.replace('.abcdefghijklmnopqrst:', '.zzzzzzzzzzzzzzzzzzzz:');
  assert.throws(() => assertExecution(f.enabled, f.target, f.approval, f.env, f.now), { code: 'DATABASE_IDENTITY' });
});
test('production hostname is forbidden even with a fabricated nonproduction project ID', () => {
  assert.throws(() => inspectBinding(plan, { ...binding(), appOrigin: 'https://inventra-beta-one.vercel.app' }), { code: 'PREVIEW_ONLY' });
  assert.throws(() => inspectBinding(plan, { ...binding(), isolationId: '160669BD-2F6F-4490-9259-BADA5A1D02C4' }), { code: 'PROTECTED_ISOLATION' });
});
for (const [name, change] of Object.entries({ expired: f => { f.approval.expiresAtMs = f.now; }, changedManifest: f => { f.target.stage = 'L5'; }, tlsDisabled: f => { f.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; }, localSpoof: f => { f.env.STOCK_ALLOW_LOCAL_TEST_DATABASE = 'true'; }, productionRuntime: f => { f.env.VERCEL_ENV = 'production'; }, otherDeployment: f => { f.env.VERCEL_DEPLOYMENT_ID = 'dpl_other'; }, originalCredential: f => { f.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'WT_do_not_log'; }, urlTlsOverride: f => { f.env.STOCK_DATABASE_URL += '?sslmode=disable'; }, productionApproval: f => { f.approval.productionCutoverApproved = true; }, missingRuntimeReview: f => { f.enabled.applicationProposal.harnessStatus = 'OFFLINE_ONLY'; } })) {
  test('execution rejects ' + name, () => { const f = fixture(); change(f); assert.throws(() => assertExecution(f.enabled, f.target, f.approval, f.env, f.now)); });
}
test('synthetic complete profile is eligibility only, never a capacity PASS', () => {
  assert.deepEqual(assessProfile(profile(), 100000), { strictCapacity: 'PROFILE_ELIGIBLE_NOT_TESTED', blockers: [], hostedCapacityPassed: false });
});
for (const [name, change, code] of [
  ['minute metrics', p => { p.telemetry.sampleIntervalMs = 60000; }, 'METRICS_TOO_COARSE'],
  ['old underlying series even with fast polling', p => { p.telemetry.seriesFreshnessMs = 60000; }, 'METRICS_STALE'],
  ['unconfirmed Free entitlement', p => { p.telemetry.entitlementVerified = false; }, 'METRICS_ENTITLEMENT_UNVERIFIED'],
  ['per-instance memory only', p => { p.telemetry.allAppInstances = false; }, 'METRICS_MISSING_ALLAPPINSTANCES'],
  ['unknown RAM', p => { p.limits.databaseMemoryBytes = null; }, 'LIMIT_UNSEALED_DATABASEMEMORYBYTES'],
  ['global backend overflow', p => { p.connections.runtimeBackendsMaximum = 5; }, 'RUNTIME_CONNECTION_LIMIT'],
  ['managed-service connections omitted from reserve', p => { p.connections.observedTotal = 59; }, 'PROVIDER_CONNECTION_HEADROOM'],
  ['source allowance exhausted', p => { p.budget.remainingOrganizationBytes = 2100000000; }, 'CAMPAIGN_EGRESS_BUDGET'],
  ['partial traffic forecast', p => { p.budget.includesAllCampaignTraffic = false; }, 'BILLING_OBSERVATION_UNPROVEN'],
  ['stale quota', p => { p.budget.observedAtMs = 1; }, 'BILLING_OBSERVATION_UNPROVEN'],
  ['unquoted hosting', p => { p.budget.existingHostingAllowanceVerified = false; }, 'ZERO_COST_NOT_ESTABLISHED'],
]) test('capacity blocks ' + name, () => { const p = profile(); change(p); assert.ok(assessProfile(p, 100000).blockers.includes(code)); });
test('serialized multipart overhead is measured; normal fixtures fit but advertised image/file limits do not', async () => {
  for (const [size, fits] of [[262144, true], [10 * 1024 * 1024, false], [20 * 1024 * 1024, false]]) {
    const body = new FormData(); body.set('file', new Blob([Buffer.alloc(size)], { type: 'image/png' }), 'WT_fixture.png');
    const result = await measurePayload(body);
    assert.ok(result.serializedBodyBytes > size); assert.equal(result.fitsConservativePlatformBudget, fits); assert.equal(result.hostedBoundaryTested, false);
  }
});
test('traffic reserves concurrent worst cases before dispatch, accounts uncertainty and refuses reuse', () => {
  const budget = new TrafficBudget({ capBytes: 10000, responseMaximumBytes: 4000, overheadPerRequestBytes: 100 });
  const first = budget.reserve(1000); assert.throws(() => budget.reserve(1000), { code: 'TRAFFIC_CAP' });
  first(10); const second = budget.reserve(1000);
  assert.throws(() => second(null), { code: 'RESPONSE_OR_TRANSPORT_UNCERTAIN' });
  assert.equal(budget.snapshot().chargedBytes, 6210); assert.equal(budget.snapshot().stopped, true);
  assert.throws(() => budget.reserve(0), { code: 'TRAFFIC_STOPPED' });
  assert.throws(() => first(0), { code: 'DUPLICATE_TRAFFIC_SETTLEMENT' });
});
async function serverFixture(t) {
  const seen = [], server = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    seen.push({ url: request.url, auth: request.headers.authorization, key: request.headers['idempotency-key'], body: Buffer.concat(chunks).toString() });
    if (request.url === '/api/redirect') { response.writeHead(302, { location: 'https://original.invalid/api/never' }); response.end(); }
    else if (request.url === '/api/oversize') response.end(Buffer.alloc(1200));
    else if (request.url === '/api/disconnect') request.socket.destroy();
    else { response.setHeader('x-stock-revision', '"stock-v2-1"'); response.end(JSON.stringify({ fake: true })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { origin: 'http://127.0.0.1:' + server.address().port, seen };
}
const token = 'WT_' + 'x'.repeat(40), traffic = { capBytes: 100000, responseMaximumBytes: 1000 };
test('offline adapter performs real loopback HTTP with bearer, exact write key, payload and revision', async t => {
  const fixture = await serverFixture(t), driver = createOfflineDriver({ appOrigin: fixture.origin, token, budget: traffic });
  const response = await driver.api('/api/fixture?WT_variant=1', { method: 'POST', body: { value: 42 }, key: 'WT_same_intent' });
  assert.equal(response.status, 200); assert.equal(response.revision, '"stock-v2-1"'); assert.deepEqual(JSON.parse(response.body), { fake: true });
  assert.deepEqual(fixture.seen, [{ url: '/api/fixture?WT_variant=1', auth: 'Bearer ' + token, key: 'WT_same_intent', body: '{"value":42}' }]);
  assert.equal(driver.evidence().proof, 'OFFLINE_SYNTHETIC_ONLY');
  assert.ok(!JSON.stringify(driver.evidence()).includes(token));
  assert.equal(driver.evidence().traffic.requests, 1);
});
test('offline adapter denies remote mode, path escape, caller credentials and unkeyed writes before sending', async t => {
  assert.throws(() => createOfflineDriver({ appOrigin: 'https://wt-only.vercel.app', token, budget: traffic }), { code: 'OFFLINE_LOOPBACK_ONLY' });
  const fixture = await serverFixture(t), driver = createOfflineDriver({ appOrigin: fixture.origin, token, budget: traffic });
  for (const pathname of ['https://original.invalid/api/no', '//original.invalid/api/no', '/api/../../other', '/api/\\original.invalid/api/no']) await assert.rejects(driver.api(pathname));
  await assert.rejects(driver.api('/api/no', { headers: { authorization: 'Bearer secret' } }), { code: 'CALLER_CREDENTIAL_HEADER' });
  await assert.rejects(driver.api('/api/no', { method: 'POST', body: {} }), { code: 'WRITE_KEY' });
  assert.equal(fixture.seen.length, 0);
});
for (const endpoint of ['redirect', 'oversize', 'disconnect']) test('driver stops after ' + endpoint + ' without retry or foreign bearer forwarding', async t => {
  const fixture = await serverFixture(t), driver = createOfflineDriver({ appOrigin: fixture.origin, token, budget: traffic });
  await assert.rejects(driver.api('/api/' + endpoint));
  assert.equal(fixture.seen.length, 1); assert.equal(driver.evidence().traffic.stopped, true);
  assert.equal(driver.evidence().requests[0].outcome, 'REQUIRES_REVIEW');
  await assert.rejects(driver.api('/api/no'), { code: 'DRIVER_STOPPED' }); assert.equal(fixture.seen.length, 1);
});
function coordinatorFixture(t, catalog = {}) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'stock-hosted-offline-'))), directory = path.join(parent, 'private');
  const options = { runId: 'WT_RUN', targetId: 'WT_TARGET', catalog };
  const active = new Set();
  t.after(() => { for (const store of active) store.close(); fs.rmSync(parent, { recursive: true, force: true }); });
  const open = () => { const store = openCoordinator(directory, options); active.add(store); return store; };
  return { directory, open, options };
}
const upload = () => ({ requestId: 'WT_UPLOAD', operation: 'drive-upload', bytes: Buffer.from('WT_exact_image_bytes'), contentType: 'image/png' });
test('fake coordinator preserves exact bytes, provider outcomes and same-attempt response through restart', t => {
  const fixture = coordinatorFixture(t), first = fixture.open(), request = upload(), result = first.perform(request);
  assert.equal(result.outcome, 'completed'); assert.deepEqual(first.readFile(result.fileId).bytes, request.bytes);
  const before = first.evidence([result.fileId]); assert.equal(before.uploads.pass, true);
  first.close(); const next = fixture.open();
  assert.deepEqual(next.perform(request), result); assert.equal(next.evidence([result.fileId]).journalSha256, before.journalSha256);
  assert.throws(() => next.perform({ ...request, bytes: Buffer.from('WT_changed') }), { code: 'COORDINATOR_INTENT_CONFLICT' });
  assert.equal(fs.statSync(fixture.directory).mode & 0o777, 0o700); assert.equal(fs.statSync(path.join(fixture.directory, 'journal.jsonl')).mode & 0o777, 0o600);
});
test('accepted-only outcome remains unknown across restart and is never re-uploaded', t => {
  const fixture = coordinatorFixture(t), first = fixture.open(), request = { ...upload(), mode: 'accepted-only' };
  assert.equal(first.perform(request).outcome, 'unknown'); const before = first.evidence();
  first.close(); const next = fixture.open(); assert.equal(next.perform(request).outcome, 'unknown');
  const after = next.evidence(); assert.equal(after.journalSha256, before.journalSha256); assert.equal(after.pendingRequests, 1); assert.equal(after.uploads.acceptedUploads, 1); assert.equal(after.uploads.unresolvedAttempts.length, 1); assert.equal(after.uploads.pass, false);
});
test('orphan, uncertain and compensated files stay distinguishable', t => {
  const store = coordinatorFixture(t).open();
  const orphan = store.perform(upload()); assert.deepEqual(store.evidence().uploads.orphanIds, [orphan.fileId]);
  store.perform({ requestId: 'WT_DELETE', operation: 'drive-delete', fileId: orphan.fileId });
  const graph = store.evidence().uploads; assert.deepEqual(graph.compensated, [orphan.fileId]); assert.equal(graph.pass, true);
  assert.throws(() => store.readFile(orphan.fileId), { code: 'FAKE_FILE_NOT_FOUND' });
  store.perform({ ...upload(), requestId: 'WT_UNCERTAIN', mode: 'uncertain' }); assert.equal(store.evidence().uploads.unresolvedAttempts.length, 1);
  store.perform({ ...upload(), requestId: 'WT_REJECTED', mode: 'reject' }); assert.equal(store.evidence().uploads.acceptedUploads, 2);
});
test('fake coordinator serializes competing clients and refuses a second writer', async t => {
  const fixture = coordinatorFixture(t), store = fixture.open(); assert.throws(fixture.open, { code: 'EEXIST' });
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => Promise.resolve().then(() => store.perform({ ...upload(), requestId: 'WT_CLIENT_' + index }))));
  assert.equal(new Set(results.map(result => result.fileId)).size, 20); assert.equal(store.evidence(results.map(result => result.fileId)).uploads.pass, true);
});
test('fake LINE/sales permit synthetic identities and immutable catalog only', t => {
  const catalog = { WT_PAGE_A: { account: 'A', reply: { receipts: [{ id: 'WT_RECEIPT' }], cursor: null } } };
  const fixture = coordinatorFixture(t, catalog), store = fixture.open();
  assert.equal(store.perform({ requestId: 'WT_REPLY', operation: 'line-reply', recipient: 'WT_RECIPIENT', messageCount: 1 }).outcome, 'completed');
  assert.deepEqual(store.perform({ requestId: 'WT_SALES', operation: 'loyverse-page', account: 'A', catalogKey: 'WT_PAGE_A' }).reply, catalog.WT_PAGE_A.reply);
  catalog.WT_PAGE_A.reply.receipts[0].id = 'WT_CHANGED_OUTSIDE';
  assert.equal(store.perform({ requestId: 'WT_SALES_TWO', operation: 'loyverse-page', account: 'A', catalogKey: 'WT_PAGE_A' }).reply.receipts[0].id, 'WT_RECEIPT');
  assert.throws(() => store.perform({ requestId: 'WT_BAD', operation: 'line-push', recipient: 'real-recipient', messageCount: 1 }));
  assert.throws(() => store.perform({ requestId: 'WT_OTHER', operation: 'loyverse-page', account: 'B', catalogKey: 'WT_PAGE_A' }));
  assert.throws(() => store.perform({ requestId: 'WT_REALFILE', operation: 'drive-delete', fileId: 'real-file-id' }));
});
test('coordinator rejects tampering, incomplete journals, wrong identities and symlinks without repairing evidence', t => {
  const fixture = coordinatorFixture(t), store = fixture.open(); store.perform(upload()); store.close();
  const journal = path.join(fixture.directory, 'journal.jsonl'), original = fs.readFileSync(journal);
  fs.writeFileSync(journal, original.toString().replace('WT_RUN', 'WT_BAD'));
  assert.throws(fixture.open, { code: 'JOURNAL_INTEGRITY' }); assert.ok(fs.readFileSync(journal).includes('WT_BAD'));
  fs.writeFileSync(journal, original.subarray(0, original.length - 1)); assert.throws(fixture.open, { code: 'TRUNCATED_JOURNAL' });
  fs.writeFileSync(journal, original); assert.throws(() => openCoordinator(fixture.directory, { ...fixture.options, targetId: 'WT_OTHER' }), { code: 'COORDINATOR_IDENTITY' });
  fs.renameSync(journal, journal + '.original'); fs.symlinkSync(journal + '.original', journal); assert.throws(fixture.open, { code: 'PRIVATE_FILE' });
});
test('coordinator rejects fake blob tampering and closed access', t => {
  const fixture = coordinatorFixture(t), store = fixture.open(), result = store.perform(upload());
  fs.writeFileSync(path.join(fixture.directory, result.fileId), 'WT_different'); assert.throws(() => store.readFile(result.fileId), { code: 'FAKE_FILE_INTEGRITY' });
  assert.equal(store.evidence([result.fileId]).uploads.pass, false);
  store.close(); assert.throws(() => store.perform(upload()), { code: 'COORDINATOR_CLOSED' });
});
test('hosted driver rechecks live telemetry before dispatch and latches a stop without making a request', async () => {
  const f = fixture(), p = profile(); f.approval.expiresAtMs = Date.now() + 60000; p.budget.observedAtMs = Date.now(); p.budget.appHttpCapBytes = 100000; p.budget.responseMaximumBytes = 1000;
  let samples = 0, calls = 0;
  const driver = createHostedDriver({ plan: f.enabled, binding: f.target, approval: f.approval, env: f.env, readProfile() { const observation = structuredClone(p); if (++samples > 1) observation.telemetry.seriesFreshnessMs = 60000; return observation; } });
  const original = globalThis.fetch; globalThis.fetch = async () => { calls++; throw Error('Offline test must not send'); };
  try {
    await assert.rejects(driver.api('/api/fixture'), { code: 'LIVE_PROFILE_BLOCKED' });
    await assert.rejects(driver.api('/api/fixture'), { code: 'DRIVER_STOPPED' });
    assert.equal(calls, 0); assert.equal(driver.evidence().traffic.requests, 0);
  } finally { globalThis.fetch = original; }
});
