/* eslint-disable @typescript-eslint/no-require-imports -- Loopback transport, TLS, browser and fault-control integration; synthetic files only. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { createClient, createCoordinator } = require('./rpc.cjs');
const { configuration, install } = require('./runtime.cjs');
const runtimeToken = 'WT_' + 'r'.repeat(60), operatorToken = 'WT_' + 'o'.repeat(60), targetId = 'WT_11111111-2222-4333-8444-555555555555';
async function fixture(t, tls, activate = true) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ha-transport-'))), directory = path.join(parent, 'private');
  const service = createCoordinator({ directory, runId: 'WT_RPC', targetId, runtimeToken, operatorToken, tls });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const origin = (tls ? 'https' : 'http') + '://127.0.0.1:' + service.server.address().port;
  const config = { origin, runId: 'WT_RPC', targetId, offline: true, ca: tls?.cert };
  t.after(async () => { service.server.closeAllConnections(); await new Promise(resolve => service.server.close(resolve)); fs.rmSync(parent, { recursive: true, force: true }); });
  const operator = createClient({ ...config, token: operatorToken }); if (activate) await operator.call('ingress', { open: true });
  return { ...service, origin, parent, config, operator, runtime: createClient({ ...config, token: runtimeToken }) };
}
test('coordinator RPC confines identities, privileges and one-shot faults across concurrent clients', async t => {
  const f = await fixture(t);
  await assert.rejects(f.runtime.call('control', {}));
  await assert.rejects(createClient({ ...f.config, token: 'WT_' + 'z'.repeat(60) }).call('snapshot'));
  await assert.rejects(createClient({ ...f.config, targetId: 'WT_OTHER', token: operatorToken }).call('snapshot'));
  await f.operator.call('control', { sqlBefore: { match: 'INSERT INTO stock_operational.orders', commandKey: 'WT_KEY', remaining: 1 } });
  const values = await Promise.all(Array.from({ length: 10 }, (_, n) => f.runtime.call('fault', { name: 'sqlBefore', requestId: 'WT_CHECK_' + n, sql: 'INSERT INTO stock_operational.orders VALUES ($1)', commandKey: 'WT_KEY', phase: 'before-sql' })));
  assert.equal(values.filter(Boolean).length, 1);
  await assert.rejects(f.runtime.call('provider', { requestId: 'WT_BAD', operation: 'line-reply', recipient: 'real-user', messageCount: 1 }));
  const snapshot = await f.operator.call('snapshot'); assert.equal(snapshot.events.filter(e => e.kind === 'injected-fault').length, 1);
});
test('coordinator RPC preserves exact fake bytes and uncertain results without accepting runtime fault overrides', async t => {
  const f = await fixture(t), request = { requestId: 'WT_UPLOAD', operation: 'drive-upload', contentType: 'image/png', base64: Buffer.from('WT_image_bytes').toString('base64') };
  await assert.rejects(f.runtime.call('provider', { ...request, mode: 'complete' }));
  const result = await f.runtime.call('provider', request), file = await f.operator.call('read-file', { id: result.fileId }); assert.equal(Buffer.from(file.base64, 'base64').toString(), 'WT_image_bytes');
  await f.operator.call('control', { driveUncertain: true });
  const unknown = { ...request, requestId: 'WT_UNKNOWN' }; assert.equal((await f.runtime.call('provider', unknown)).outcome, 'unknown');
  assert.equal((await f.runtime.call('provider', unknown)).outcome, 'unknown');
  assert.equal((await f.operator.call('snapshot')).evidence.uploads.acceptedUploads, 2);
});
test('TLS client validates certificate trust and target name and never follows a redirect', async t => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ha-tls-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', path.join(root, 'key'), '-out', path.join(root, 'cert'), '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  const f = await fixture(t, { key: fs.readFileSync(path.join(root, 'key')), cert: fs.readFileSync(path.join(root, 'cert')) });
  assert.ok((await f.operator.call('snapshot')).evidence);
  await assert.rejects(createClient({ ...f.config, ca: undefined, token: operatorToken }).call('snapshot'));
  cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', path.join(root, 'wrong-key'), '-out', path.join(root, 'wrong-cert'), '-subj', '/CN=wrong.invalid', '-addext', 'subjectAltName=DNS:wrong.invalid'], { stdio: 'ignore' });
  const mismatch = await fixture(t, { key: fs.readFileSync(path.join(root, 'wrong-key')), cert: fs.readFileSync(path.join(root, 'wrong-cert')) }, false); await assert.rejects(mismatch.operator.call('snapshot'));
  let requests = 0; const http = require('node:http'), redirect = http.createServer((request, response) => { requests++; response.writeHead(302, { location: 'https://never.invalid' }); response.end(); });
  await new Promise(resolve => redirect.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => redirect.close(resolve)));
  await assert.rejects(createClient({ ...f.config, origin: 'http://127.0.0.1:' + redirect.address().port, token: operatorToken }).call('snapshot')); assert.equal(requests, 1);
});
function environment(origin) {
  const env = { PATH: process.env.PATH, STOCK_HA_OFFLINE_SYNTHETIC: 'true', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'false', STOCK_STAGING_AUTH_TOKEN: 'WT_' + 'a'.repeat(50), STOCK_HA_RUNTIME_TOKEN: runtimeToken, STOCK_TARGET_ISOLATION_ID: targetId.slice(3), STOCK_DATABASE_URL: 'postgresql://ha_runtime:WT_synthetic@127.0.0.1:19999/ha_synthetic_rpc', LINE_CHANNEL_SECRET: 'WT_fake_signature', LINE_CHANNEL_ACCESS_TOKEN: 'WT_fake_line' };
  const manifest = { version: 1, offlineSynthetic: true, syntheticFixtureId: 'WT_FIXTURE', providerMode: 'fake-only', mode: 'functional', runId: 'WT_RPC', targetId, appOrigin: 'http://127.0.0.1:19998', coordinatorOrigin: origin, databasePort: 19999, databaseName: 'ha_synthetic_rpc' };
  return { env, manifest };
}
test('private runtime routes fake providers to durable RPC and denies original accounts and sockets', async t => {
  const f = await fixture(t), { env, manifest } = environment(f.origin), previous = { ...process.env }; let state;
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  try {
    state = await install(manifest);
    const file = await state.drive.uploadImage({ bytes: Buffer.from('WT_exact'), contentType: 'image/png', fileName: 'WT.png' });
    assert.equal(Buffer.from((await f.operator.call('read-file', { id: file.id })).base64, 'base64').toString(), 'WT_exact');
    await fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: { authorization: 'Bearer WT_fake_line' }, body: JSON.stringify({ replyToken: 'WT_REPLY', messages: [{ type: 'text', text: 'WT' }] }) });
    await assert.rejects(fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: { authorization: 'Bearer original' }, body: '{}' }));
    await assert.rejects(fetch('https://original.invalid/never'));
    assert.throws(() => require('node:net').connect({ host: 'original.invalid', port: 443 }), { code: 'HA_ISOLATION_DENIED' });
    assert.equal((await f.operator.call('snapshot')).events.filter(e => e.provider === 'line').length, 1);
  } finally { state?.restore(); for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
});
test('offline runtime cannot be repointed to an existing copy, production mode or real provider credential', () => {
  const f = environment('http://127.0.0.1:19997'); configuration(f.env, f.manifest);
  for (const delta of [{ VERCEL_ENV: 'production' }, { STOCK_DATABASE_URL: f.env.STOCK_DATABASE_URL.replace('ha_synthetic_rpc', 'retained_real_copy') }, { STOCK_TARGET_ISOLATION_ID: '160669bd-2f6f-4490-9259-bada5a1d02c4' }, { LINE_CHANNEL_ACCESS_TOKEN: 'original' }]) assert.throws(() => configuration({ ...f.env, ...delta }, f.manifest));
});
test('WT04 retains every reviewed assertion after replacing only its local fixture worker', () => {
  const old = fs.readFileSync(path.join(__dirname, '../local-write/extra-cases.cjs'), 'utf8'), current = fs.readFileSync(path.join(__dirname, 'movement-case.cjs'), 'utf8');
  const start = old.indexOf('        const first = ', old.indexOf('Campaign.prototype.WT04')), end = old.indexOf('\n    };', start);
  assert.ok(current.includes(old.slice(start, end)));
  assert.ok(!current.includes('spawnSync'));
});
test('browser confines requests and credentials and loads exact fake file bytes', async () => {
  const { browserContext } = require('./browser-context.cjs'); let routeHandler; const actions = [];
  const context = { route: async (_, handler) => { routeHandler = handler; }, close: async () => {} };
  const receiver = { hostedHarnessValidated: true, config: { origin: 'http://127.0.0.1:12345' }, env: { STOCK_STAGING_AUTH_TOKEN: 'WT_private' }, operator: { call: async () => ({ base64: Buffer.from('WT_bytes').toString('base64'), contentType: 'image/png' }) } };
  await browserContext.call(receiver, { newContext: async () => context }, { width: 800, height: 600 });
  const route = (url, type) => ({ request: () => ({ url: () => url, method: () => 'GET', resourceType: () => type, headers: () => ({}) }), fulfill: async value => actions.push(value), abort: async () => actions.push('aborted'), fetch: async options => { actions.push(options); return { status: () => 200 }; } });
  await routeHandler(route('https://original.invalid/data', 'fetch')); assert.equal(actions.pop(), 'aborted');
  await routeHandler(route(receiver.config.origin + '/__wt/images/WT_FILE_id', 'image')); assert.equal(actions.pop().body.toString(), 'WT_bytes');
  await routeHandler(route(receiver.config.origin + '/api/orders', 'fetch')); actions.pop(); const request = actions.pop(); assert.equal(request.headers.authorization, 'Bearer WT_private'); assert.equal(request.maxRedirects, 0);
  await context.close();
});
test('coordinator is loopback-only without hosted approval and rejects real provider endpoints', async t => {
  const f = await fixture(t); assert.throws(() => f.server.listen(0, '0.0.0.0'), { code: 'COORDINATOR_LOOPBACK_ONLY' });
  const { validateEndpoint } = require('./rpc.cjs'); for (const origin of ['https://api.line.me', 'https://api.loyverse.com', 'https://www.googleapis.com', 'https://127.0.0.2']) assert.throws(() => validateEndpoint(origin, false));
  assert.throws(() => createCoordinator({ offline: false }), { code: 'COORDINATOR_APPROVAL' });
});
test('incremental provider snapshots transfer each event once and expose separate RPC body counters', async t => {
  const f = await fixture(t); const first = await f.operator.call('snapshot', { includeEvidence: false });
  await f.runtime.call('provider', { requestId: 'WT_INCREMENTAL', operation: 'line-reply', recipient: 'WT_RECIPIENT', messageCount: 1 });
  const next = await f.operator.call('snapshot', { cursor: first.cursor, includeEvidence: false });
  assert.equal(next.events.filter(e => e.kind === 'fake-provider').length, 1); assert.equal(next.evidence, undefined);
  const empty = await f.operator.call('snapshot', { cursor: next.cursor, includeEvidence: false }); assert.equal(empty.events.length, 0); assert.ok(f.operator.traffic().responseBytes > 0);
});
test('durable admission closes globally and pending transaction leases never expire silently', async t => {
  const f = await fixture(t, undefined, false); assert.equal((await f.runtime.call('permit', { backendPid: 123, instanceId: 'WT_INSTANCE' })).permitted, false);
  await f.operator.call('ingress', { open: true }); const lease = await f.runtime.call('permit', { backendPid: 123, instanceId: 'WT_INSTANCE' }); assert.equal(lease.permitted, true);
  await f.operator.call('ingress', { open: false }); assert.equal((await f.runtime.call('permit', { backendPid: 124, instanceId: 'WT_OTHER' })).permitted, false);
  assert.equal((await f.operator.call('leases')).leases.length, 1);
  await assert.rejects(f.runtime.call('reconcile-closed-backend', { ...lease, instanceId: 'WT_INSTANCE', backendAbsentVerified: true }));
  await f.operator.call('reconcile-closed-backend', { ...lease, instanceId: 'WT_INSTANCE', backendAbsentVerified: true }); assert.equal((await f.operator.call('leases')).leases.length, 0);
});
test('deployment registry returns configuration only for its approved namespace and never journals credentials', async t => {
  const f = await fixture(t), { sha } = require('./policy.cjs');
  const config = { STOCK_STAGING_AUTH_TOKEN: 'WT_do_not_journal_private_value' };
  f.registerRuntimeConfig('dpl_WTRegistered', config);
  const manifest = { version: 1, offlineSynthetic: true, providerMode: 'fake-only', runId: 'WT_RPC', targetId, coordinatorOrigin: f.origin, binding: { appProjectId: 'prj_WTRegistered', deploymentId: 'dpl_WTRegistered', runtimeConfigSha256: sha(JSON.stringify(config)) } };
  await f.operator.call('register-preview', manifest);
  const selected = await f.runtime.call('manifest', { projectId: 'prj_WTRegistered', deploymentId: 'dpl_WTRegistered' }); assert.equal(selected.runtimeEnv.STOCK_STAGING_AUTH_TOKEN, config.STOCK_STAGING_AUTH_TOKEN);
  await assert.rejects(f.runtime.call('manifest', { projectId: 'prj_Other', deploymentId: 'dpl_WTRegistered' }));
  assert.ok(!JSON.stringify(f.store.events()).includes(config.STOCK_STAGING_AUTH_TOKEN));
});
test('bootstrap binds actual identity and refuses production or system-variable overrides before installing configuration', async () => {
  const { selectRuntimeConfiguration } = require('./runtime.cjs'), { sha } = require('./policy.cjs');
  const env = { STOCK_HA_OFFLINE_SYNTHETIC: 'true', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_HA_SYNTHETIC_PROJECT_ID: 'prj_WTBoot', STOCK_HA_SYNTHETIC_DEPLOYMENT_ID: 'dpl_WTBoot' };
  const bootstrap = { version: 1, offlineSynthetic: true, projectId: 'prj_WTBoot', runId: 'WT_BOOT', targetId, coordinatorOrigin: 'http://127.0.0.1:12345' }, runtimeEnv = { STOCK_STORAGE: 'supabase' };
  const result = { manifest: { ...bootstrap, binding: { appProjectId: 'prj_WTBoot', deploymentId: 'dpl_WTBoot', runtimeConfigSha256: sha(JSON.stringify(runtimeEnv)) } }, runtimeEnv };
  assert.equal((await selectRuntimeConfiguration(env, bootstrap, async () => result)).runtimeEnv.STOCK_STORAGE, 'supabase');
  let called = false; await assert.rejects(selectRuntimeConfiguration({ ...env, VERCEL_ENV: 'production' }, bootstrap, async () => { called = true; return result; })); assert.equal(called, false);
  await assert.rejects(selectRuntimeConfiguration(env, bootstrap, async () => ({ ...result, runtimeEnv: { VERCEL_ENV: 'preview' } })), { code: 'HOSTED_RUNTIME_CONFIG_KEYS' });
});
test('a forged credential-free build phase still disables both business storage paths', async () => {
  const previous = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) delete process.env[key]; process.env.NEXT_PHASE = 'phase-production-build'; process.env.STOCK_STORAGE = 'google-sheets';
    assert.equal(await install(null), null); assert.equal(process.env.STOCK_STORAGE, 'supabase'); assert.equal(process.env.STOCK_STAGING_ENABLED, 'false');
    require('../../../tests/helpers/postgres-runtime.cjs'); assert.throws(() => require('../../../src/infrastructure/persistence/postgres/database.ts').stagingSettings());
  } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
});
