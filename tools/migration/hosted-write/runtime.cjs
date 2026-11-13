/* eslint-disable @typescript-eslint/no-require-imports -- Installed only in an attested private test build. Production source never imports this module. */
const net = require('node:net'), crypto = require('node:crypto');
const { requireGate, assertExecution } = require('./policy.cjs');
const { createClient, validateEndpoint } = require('./rpc.cjs');
const { catalogKey } = require('./provider-outcomes.cjs');
const STATE = Symbol.for('stock.hostedWriteHarness');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9N8AAAAASUVORK5CYII=', 'base64');
const nonce = () => 'WT_' + crypto.randomUUID();
const RUNTIME_KEYS = new Set(['STOCK_DATABASE_URL', 'STOCK_DATABASE_CA', 'STOCK_STORAGE', 'STOCK_STAGING_ENABLED', 'STOCK_STAGING_READ_ONLY', 'STOCK_STAGING_AUTH_TOKEN', 'STOCK_TARGET_ISOLATION_ID', 'STOCK_HA_SEED_TOKEN', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LOYVERSE_ACCOUNT_SOURCE', 'LOYVERSE_ACCOUNTS_JSON', 'MOVEMENT_CREATE_MODE']);
async function selectRuntimeConfiguration(env, value, requestConfiguration) {
  const offline = value?.offlineSynthetic === true, projectId = offline ? env.STOCK_HA_SYNTHETIC_PROJECT_ID : env.VERCEL_PROJECT_ID, deploymentId = offline ? env.STOCK_HA_SYNTHETIC_DEPLOYMENT_ID : env.VERCEL_DEPLOYMENT_ID;
  requireGate(value?.version === 1 && projectId === value.projectId && projectId !== 'prj_XH4nEje5cicuBuucGumuHgr73l1E' && /^dpl_[A-Za-z0-9]+$/.test(deploymentId || '') && env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'HOSTED_BOOTSTRAP');
  requireGate(offline ? !env.VERCEL_ENV && env.STOCK_HA_OFFLINE_SYNTHETIC === 'true' && env.STOCK_ALLOW_LOCAL_TEST_DATABASE === 'true' : env.VERCEL_ENV === 'preview' && !env.STOCK_ALLOW_LOCAL_TEST_DATABASE && !env.STOCK_HA_OFFLINE_SYNTHETIC, 'HOSTED_BOOTSTRAP_ENVIRONMENT');
  const result = await requestConfiguration({ deploymentId, projectId }), manifest = result.manifest;
  requireGate((manifest?.offlineSynthetic === true) === offline && manifest?.coordinatorOrigin === value.coordinatorOrigin && manifest?.runId === value.runId && manifest?.targetId === value.targetId && manifest?.binding?.deploymentId === deploymentId && manifest?.binding?.appProjectId === projectId, 'HOSTED_BOOTSTRAP_MANIFEST');
  requireGate(result.runtimeEnv && Object.entries(result.runtimeEnv).every(([key, val]) => RUNTIME_KEYS.has(key) && typeof val === 'string'), 'HOSTED_RUNTIME_CONFIG_KEYS');
  requireGate(require('./policy.cjs').sha(JSON.stringify(result.runtimeEnv)) === manifest.binding.runtimeConfigSha256, 'HOSTED_RUNTIME_CONFIG_SEAL');
  return result;
}
async function bootstrap(env) {
  const value = JSON.parse(env.STOCK_HA_BOOTSTRAP_JSON || 'null');
  requireGate(value?.version === 1, 'HOSTED_BOOTSTRAP');
  const client = createClient({ origin: value.coordinatorOrigin, token: env.STOCK_HA_RUNTIME_TOKEN, runId: value.runId, targetId: value.targetId, ca: value.coordinatorCa, offline: value.offlineSynthetic === true });
  return selectRuntimeConfiguration(env, value, identity => client.call('manifest', identity));
}
function configuration(env, manifest) {
  requireGate(manifest?.version === 1 && manifest.providerMode === 'fake-only' && ['functional', 'capacity', 'recovery'].includes(manifest.mode), 'RUNTIME_MANIFEST');
  requireGate(manifest.runId?.startsWith('WT_') && manifest.targetId === 'WT_' + env.STOCK_TARGET_ISOLATION_ID && env.STOCK_TARGET_ISOLATION_ID?.toLowerCase() !== '160669bd-2f6f-4490-9259-bada5a1d02c4', 'RUNTIME_TARGET');
  const offline = manifest.offlineSynthetic === true, db = new URL(env.STOCK_DATABASE_URL), app = new URL(manifest.appOrigin);
  if (offline) {
    requireGate(env.STOCK_HA_OFFLINE_SYNTHETIC === 'true' && !env.VERCEL_ENV && !env.STOCK_LOCAL_WRITE_HARNESS && env.STOCK_ALLOW_LOCAL_TEST_DATABASE === 'true' && manifest.syntheticFixtureId?.startsWith('WT_'), 'OFFLINE_RUNTIME');
    requireGate(db.hostname === '127.0.0.1' && Number(db.port) === manifest.databasePort && /^ha_synthetic_[a-z0-9_]+$/.test(db.pathname.slice(1)) && db.pathname.slice(1) === manifest.databaseName && db.username === (manifest.mode === 'recovery' ? 'ha_readonly' : 'ha_runtime') && db.password && !db.search && !db.hash, 'OFFLINE_DATABASE');
    requireGate(app.protocol === 'http:' && app.hostname === '127.0.0.1' && app.port && app.pathname === '/' && !app.username && !app.password && !app.search && !app.hash, 'OFFLINE_APP');
  } else {
    assertExecution(manifest.plan, manifest.binding, manifest.approval, env);
    requireGate(manifest.appOrigin === manifest.binding.appOrigin && manifest.coordinatorOrigin === manifest.binding.coordinatorOrigin && !env.STOCK_HA_OFFLINE_SYNTHETIC, 'HOSTED_RUNTIME');
  }
  requireGate(['postgres:', 'postgresql:'].includes(db.protocol) && env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' && env.STOCK_STORAGE === 'supabase' && env.STOCK_STAGING_ENABLED === 'true' && env.STOCK_STAGING_AUTH_TOKEN?.length >= 32, 'RUNTIME_STORAGE');
  requireGate((env.STOCK_STAGING_READ_ONLY === 'true') === (manifest.mode === 'recovery'), 'RUNTIME_READ_ONLY');
  const allowed = { LINE_CHANNEL_SECRET: 'WT_fake_signature', LINE_CHANNEL_ACCESS_TOKEN: 'WT_fake_line', LOYVERSE_ACCOUNT_SOURCE: 'env' };
  for (const [name, value] of Object.entries(env)) {
    if (/^(GOOGLE_|LINE_CHANNEL_|LOYVERSE_)/.test(name) && value) {
      if (name === 'LOYVERSE_ACCOUNTS_JSON') {
        const accounts = JSON.parse(value); requireGate(Array.isArray(accounts) && accounts.length === 2 && accounts.every((a, i) => a.id === 'WT_ACCOUNT_' + ['A', 'B'][i] && a.shopName === 'WT Shop ' + ['A', 'B'][i] && a.accessToken === 'WT_fake_only_' + ['A', 'B'][i]), 'RUNTIME_PROVIDER_ACCOUNTS');
      } else requireGate(allowed[name] === value, 'RUNTIME_REAL_CREDENTIAL');
    }
  }
  const coordinator = validateEndpoint(manifest.coordinatorOrigin, offline);
  return { offline, db, app, coordinator };
}
async function install(manifest = JSON.parse(process.env.STOCK_HA_MANIFEST_JSON || 'null')) {
  if (globalThis[STATE]) return globalThis[STATE];
  if (!manifest && Reflect.get(process, 'env').NEXT_PHASE === 'phase-production-build' && !process.env.STOCK_DATABASE_URL && !Object.keys(process.env).some(key => /^(GOOGLE_|LINE_CHANNEL_|LOYVERSE_)/.test(key) && process.env[key])) {
    // Even a forged build-phase flag leaves the private app unable to access either storage backend.
    process.env.STOCK_STORAGE = 'supabase'; process.env.STOCK_STAGING_ENABLED = 'false'; return null;
  }
  if (!manifest) { const selected = await bootstrap(process.env); Object.assign(process.env, selected.runtimeEnv); manifest = selected.manifest; }
  const config = configuration(process.env, manifest), originalFetch = globalThis.fetch, connect = net.Socket.prototype.connect;
  const rpc = createClient({ origin: manifest.coordinatorOrigin, token: process.env.STOCK_HA_RUNTIME_TOKEN, runId: manifest.runId, targetId: manifest.targetId, offline: config.offline, ca: manifest.coordinatorCa });
  const { Client } = require('pg'), query = Client.prototype.query, tags = new WeakMap(), keys = new WeakMap(), leases = new WeakMap();
  const state = { config, manifest, rpc, instanceId: crypto.randomUUID(), lastSample: 0, restored: false };
  const fault = async (name, phase, extra = {}) => manifest.mode === 'functional' && await rpc.call('fault', { name, phase, requestId: nonce(), ...extra });
  const die = async (name, phase, code) => { if (await fault(name, phase)) process.exit(code); };
  async function sample() {
    if (Date.now() - state.lastSample < 1000) return; state.lastSample = Date.now();
    const usage = process.cpuUsage(), memory = process.memoryUsage();
    await rpc.call('event', { kind: 'runtime-sample', instanceId: state.instanceId, rssBytes: memory.rss, heapBytes: memory.heapUsed, cpuUserMicros: usage.user, cpuSystemMicros: usage.system, uptimeSeconds: process.uptime() });
  }
  function denied() { const error = new Error('Private hosted test isolation denied access.'); error.code = 'HA_ISOLATION_DENIED'; throw error; }
  net.Socket.prototype.connect = function (...args) {
    let a = args[0]; if (Array.isArray(a)) a = a[0];
    const object = a && typeof a === 'object', host = object ? a.host || a.hostname || 'localhost' : typeof args[1] === 'string' ? args[1] : 'localhost', port = Number(object ? a.port : a);
    if (object && a.path || !(host === config.db.hostname && port === Number(config.db.port || 5432) || host === config.coordinator.hostname && port === Number(config.coordinator.port || 443))) return denied();
    return connect.apply(this, args);
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input), method = init.method || (input instanceof Request ? input.method : 'GET'), headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (url.username || url.password || url.port || url.protocol !== 'https:' || manifest.mode === 'recovery') return denied();
    if (url.hostname === 'api.loyverse.com' && url.pathname === '/v1.0/receipts' && method === 'GET') {
      const account = headers.get('authorization') === 'Bearer WT_fake_only_A' ? 'A' : headers.get('authorization') === 'Bearer WT_fake_only_B' ? 'B' : null; if (!account) return denied();
      const result = await rpc.call('provider', { requestId: nonce(), operation: 'loyverse-page', account, cursor: url.searchParams.get('cursor') || '', catalogKey: catalogKey(account, url) });
      return Response.json(result.reply.body, { status: result.reply.status });
    }
    if (headers.get('authorization') !== 'Bearer WT_fake_line') return denied();
    if (url.hostname === 'api-data.line.me' && /^\/v2\/bot\/message\/WT_[\w-]+\/content$/.test(url.pathname) && method === 'GET') {
      await rpc.call('provider', { requestId: nonce(), operation: 'line-download', recipient: url.pathname.split('/')[4], messageCount: 1 });
      return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    }
    if (url.hostname === 'api.line.me' && ['/v2/bot/message/reply', '/v2/bot/message/push'].includes(url.pathname) && method === 'POST') {
      const payload = JSON.parse(init.body ?? await input.text()); requireGate(String(payload.replyToken || payload.to || '').startsWith('WT_'), 'FAKE_LINE_RECIPIENT');
      await die('exitBeforeFakeReply', 'before-fake-reply', 86);
      const result = await rpc.call('provider', { requestId: nonce(), operation: url.pathname.endsWith('/reply') ? 'line-reply' : 'line-push', recipient: payload.replyToken || payload.to, messageCount: payload.messages.length });
      await die('exitAfterFakeReply', 'after-fake-reply', 87); requireGate(result.outcome === 'completed', 'FAKE_LINE_UNCERTAIN'); return Response.json({});
    }
    return denied();
  };
  Client.prototype.query = async function (...args) {
    const text = typeof args[0] === 'string' ? args[0] : args[0]?.text || '', values = typeof args[0] === 'string' ? args[1] : args[0]?.values;
    requireGate(!args.some(value => typeof value === 'function'), 'PRIVATE_CALLBACK_QUERY_UNSUPPORTED');
      if (text.startsWith('BEGIN')) {
        if (!config.offline) assertExecution(manifest.plan, manifest.binding, manifest.approval, process.env);
        if (manifest.mode !== 'recovery') { const lease = await rpc.call('permit', { backendPid: this.processID, instanceId: state.instanceId }); requireGate(lease.permitted === true, 'TEST_INGRESS_CLOSED'); leases.set(this, lease.leaseId); }
        keys.delete(this); tags.delete(this); await sample();
      }
      if (text.startsWith('SELECT intent,response,state FROM stock_operational.commands')) keys.set(this, values?.[2]);
      if (await fault('sqlBefore', 'before-sql', { sql: text, commandKey: keys.get(this) })) throw new Error('HA injected pre-commit failure');
      if (text.startsWith('INSERT INTO stock_operational.side_effects')) tags.set(this, 'effect-claim');
      if (text.startsWith('UPDATE stock_operational.commands SET state=')) tags.set(this, 'business');
      if (text.startsWith('UPDATE stock_operational.side_effects SET state=')) tags.set(this, 'effect-record');
      if (text === 'COMMIT' && tags.get(this) === 'business') await die('exitBeforeBusinessCommit', 'before-business-commit', 89);
      const result = await query.apply(this, args);
      if (['COMMIT', 'ROLLBACK'].includes(text) && leases.has(this)) { await rpc.call('release', { leaseId: leases.get(this), instanceId: state.instanceId }); leases.delete(this); }
      if (text === 'COMMIT') {
        const tag = tags.get(this); tags.delete(this);
        if (tag === 'business') {
          await die('exitAfterBusinessCommit', 'after-business-commit-before-effect', 90);
          if (await fault('loseCommitAck', 'committed-ack-loss')) throw new Error('HA injected committed acknowledgement loss');
        }
        if (tag === 'effect-claim') await die('exitAfterEffectClaim', 'after-effect-claim', 88);
        if (tag === 'effect-record') await die('exitAfterEffectRecorded', 'after-effect-recorded', 91);
      }
      return result;
  };
  state.drive = {
    async uploadImage(input) {
      requireGate(manifest.mode !== 'recovery', 'RECOVERY_PROVIDER_DENIED');
      const result = await rpc.call('provider', { requestId: nonce(), operation: 'drive-upload', contentType: input.contentType, base64: Buffer.from(input.bytes).toString('base64') });
      requireGate(result.outcome === 'completed', 'FAKE_DRIVE_UNCERTAIN');
      return { id: result.fileId, name: input.fileName, webViewLink: manifest.appOrigin + '/__wt/images/' + result.fileId, webContentLink: manifest.appOrigin + '/__wt/images/' + result.fileId };
    },
    async deleteFile(id) { requireGate(manifest.mode !== 'recovery', 'RECOVERY_PROVIDER_DENIED'); requireGate((await rpc.call('provider', { requestId: nonce(), operation: 'drive-delete', fileId: id })).outcome === 'completed', 'FAKE_DRIVE_DELETE_UNCERTAIN'); },
    async makeFileReadableByLink(id) { requireGate(manifest.mode !== 'recovery', 'RECOVERY_PROVIDER_DENIED'); requireGate((await rpc.call('provider', { requestId: nonce(), operation: 'drive-share', fileId: id })).outcome === 'completed', 'FAKE_DRIVE_SHARE_UNCERTAIN'); },
    async checkConnection() { return manifest.mode !== 'recovery'; },
  };
  state.restore = () => { if (!state.restored) { state.restored = true; globalThis.fetch = originalFetch; net.Socket.prototype.connect = connect; Client.prototype.query = query; delete globalThis[STATE]; } };
  try { await rpc.call('event', { kind: 'harness-installed', instanceId: state.instanceId }); globalThis[STATE] = state; return state; }
  catch (error) { state.restore(); throw error; }
}
module.exports = { configuration, install, bootstrap, selectRuntimeConfiguration, STATE, PNG };
