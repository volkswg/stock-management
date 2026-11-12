/* eslint-disable @typescript-eslint/no-require-imports -- Actual private production build, loopback API/browser, fresh synthetic PostgreSQL and durable fakes. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), net = require('node:net'), assert = require('node:assert/strict');
require('../../../tests/helpers/postgres-runtime.cjs');
const { Client } = require('pg'), { createCoordinator, createClient } = require('./rpc.cjs'), { createCampaign } = require('./campaign.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const result = server.address().port; await new Promise(resolve => server.close(resolve)); return result; }
(async () => {
  const directory = process.env.STOCK_HA_SMOKE_DIRECTORY, app = process.env.STOCK_HA_TEST_BUILD, cert = fs.readFileSync(path.join(directory, 'cert'));
  const dbUrl = process.env.STOCK_HA_SYNTHETIC_DATABASE_URL, db = new URL(dbUrl);
  assert.equal(db.hostname, '127.0.0.1'); assert.equal(db.pathname, '/ha_synthetic_app'); assert.equal(db.username, 'ha_runtime');
  const ownerUrl = new URL(db); ownerUrl.username = 'postgres'; ownerUrl.password = '';
  const observer = new Client({ connectionString: ownerUrl.toString(), ssl: { rejectUnauthorized: true, ca: cert } }); await observer.connect();
  const target = (await observer.query('SELECT isolation_id::text FROM stock_operational.environment')).rows[0].isolation_id;
  assert.notEqual(target, '160669bd-2f6f-4490-9259-bada5a1d02c4');
  assert.equal((await observer.query('SELECT count(*)::int AS n FROM stock_operational.orders')).rows[0].n, 0);
  const appPort = await port(), origin = 'http://127.0.0.1:' + appPort, runId = 'WT_HOSTED_SMOKE', targetId = 'WT_' + target;
  const runtimeToken = 'WT_' + crypto.randomBytes(32).toString('hex'), operatorToken = 'WT_' + crypto.randomBytes(32).toString('hex'), apiToken = 'WT_' + crypto.randomBytes(32).toString('hex'), seedToken = 'WT_' + crypto.randomBytes(32).toString('hex');
  const coordinator = createCoordinator({ directory: path.join(directory, 'coordinator'), runId, targetId, runtimeToken, operatorToken });
  await new Promise(resolve => coordinator.server.listen(0, '127.0.0.1', resolve));
  const coordinatorOrigin = 'http://127.0.0.1:' + coordinator.server.address().port;
  const operator = createClient({ origin: coordinatorOrigin, token: operatorToken, runId, targetId, offline: true });
  const manifest = { version: 1, offlineSynthetic: true, syntheticFixtureId: 'WT_NEW_EMPTY_DATABASE', mode: 'functional', providerMode: 'fake-only', runId, targetId, appOrigin: origin, databasePort: Number(db.port), databaseName: db.pathname.slice(1), coordinatorOrigin };
  const appEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_OPTIONS: '--max-old-space-size=384', NEXT_TELEMETRY_DISABLED: '1', STOCK_HA_MANIFEST_JSON: JSON.stringify(manifest), STOCK_HA_RUNTIME_TOKEN: runtimeToken, STOCK_HA_SEED_TOKEN: seedToken, STOCK_HA_OFFLINE_SYNTHETIC: 'true', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'false', STOCK_STAGING_AUTH_TOKEN: apiToken, STOCK_TARGET_ISOLATION_ID: target, STOCK_DATABASE_URL: dbUrl, LINE_CHANNEL_SECRET: 'WT_fake_signature', LINE_CHANNEL_ACCESS_TOKEN: 'WT_fake_line', LOYVERSE_ACCOUNT_SOURCE: 'env', LOYVERSE_ACCOUNTS_JSON: JSON.stringify(['A', 'B'].map(id => ({ id: 'WT_ACCOUNT_' + id, shopName: 'WT Shop ' + id, accessToken: 'WT_fake_only_' + id }))) };
  appEnv.STOCK_DATABASE_CA = cert.toString();
  const syntheticProjectId = 'prj_WTLocalSynthetic', syntheticDeploymentId = 'dpl_WTLocalSynthetic';
  const runtimeEnv = Object.fromEntries(Object.entries(appEnv).filter(([key]) => /^(STOCK_DATABASE_|STOCK_STORAGE$|STOCK_STAGING_|STOCK_TARGET_|STOCK_HA_SEED_TOKEN$|LINE_CHANNEL_|LOYVERSE_)/.test(key)));
  const registeredManifest = { ...manifest, binding: { appProjectId: syntheticProjectId, deploymentId: syntheticDeploymentId, runtimeConfigSha256: require('./policy.cjs').sha(JSON.stringify(runtimeEnv)) } };
  coordinator.registerRuntimeConfig(syntheticDeploymentId, runtimeEnv); coordinator.registerPreview(registeredManifest);
  const bootstrapEnv = { PATH: appEnv.PATH, HOME: appEnv.HOME, NODE_OPTIONS: appEnv.NODE_OPTIONS, NEXT_TELEMETRY_DISABLED: '1', STOCK_HA_OFFLINE_SYNTHETIC: 'true', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_HA_RUNTIME_TOKEN: runtimeToken, STOCK_HA_SYNTHETIC_PROJECT_ID: syntheticProjectId, STOCK_HA_SYNTHETIC_DEPLOYMENT_ID: syntheticDeploymentId, STOCK_HA_BOOTSTRAP_JSON: JSON.stringify({ version: 1, offlineSynthetic: true, projectId: syntheticProjectId, coordinatorOrigin, runId, targetId }) };
  let child, campaign, browser, activePage, launches = 0, stage = 'startup'; const proofs = [], browserResponses = [], inheritedCaseLabels = [];
  const request = async (url, options = {}) => { assert.ok(url.startsWith('/api/')); return fetch(origin + url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) }); };
  const start = async () => {
    const fd = fs.openSync(path.join(directory, 'app-' + (++launches) + '.log'), 'wx', 0o600);
    child = cp.spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], { cwd: app, env: bootstrapEnv, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
    child.on('error', () => {});
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) throw Error('PRIVATE_APP_EXITED');
      try { const response = await request('/api/ha-test', { headers: { authorization: 'Bearer ' + seedToken } }); if (response.status === 200) return; } catch { /* Startup has no request retry semantics. */ }
      await pause(250);
    }
    throw Error('PRIVATE_APP_NOT_READY');
  };
  try {
    await start();
    proofs.push('deployment-bound-bootstrap-without-build-database-secrets');
    await operator.call('ingress', { open: true });
    campaign = createCampaign({ manifest, env: appEnv, output: path.join(directory, 'cases'), ownerConfig: { connectionString: ownerUrl.toString(), ssl: { rejectUnauthorized: true, ca: cert } }, operatorToken, seedToken, sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), profileGate: async () => {}, lifecycle: { restart: async () => { throw Error('Unexpected lifecycle call'); } } });
    stage = 'inherited-api-cases'; await campaign.run(['WT00', 'WT01', 'WT02', 'WT03', 'WT09']); inheritedCaseLabels.push(...campaign.results.map(({id,status})=>({id,status}))); proofs.push('reviewed-base-api-and-access-cases');
    stage = 'movement-fixture'; await campaign.WT04(); proofs.push('movement-seeded-through-actual-private-app-owner');
    stage = 'browser';
    const { chromium } = require(process.env.STOCK_PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ executablePath: process.env.STOCK_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-networking'] });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await campaign.browserContext(browser, viewport), page = await context.newPage(); activePage = page;
      page.on('response', response => { const url = new URL(response.url()); if (url.pathname.startsWith('/api/')) browserResponses.push({ path: url.pathname, status: response.status() }); });
      stage = 'browser-' + viewport.width + '-fill'; await campaign.openOrderForm(page, campaign.key('BROWSER'));
      stage = 'browser-' + viewport.width + '-submit';
      await page.locator('button[type=submit]').evaluate(button => { button.click(); button.click(); });
      await page.waitForURL(url => url.pathname.startsWith('/orders/') && url.pathname !== '/orders/create'); await campaign.assertBrowserStorage(page); await context.close();
    }
    await browser.close(); browser = null; proofs.push('desktop-mobile-real-forms-double-click-byte-backed-fakes');
    stage = 'sql-rollback';
    await operator.call('control', { sqlBefore: { match: 'INSERT INTO stock_operational.orders', commandKey: 'WT_ROLLBACK', remaining: 1 } });
    const options = { method: 'POST', headers: { authorization: 'Bearer ' + apiToken, 'content-type': 'application/json', 'idempotency-key': 'WT_ROLLBACK' }, body: JSON.stringify({ seller: 'WT_ROLLBACK', totalPrice: 12.34 }) };
    const failed = await request('/api/orders', options); assert.equal(failed.status, 500); await operator.call('control', {});
    assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', ['WT_ROLLBACK'])).rows[0].n, 0);
    const retried = await request('/api/orders', options); assert.equal(retried.status, 201); proofs.push('real-precommit-rollback-and-same-key-retry');
    stage = 'commit-acknowledgement-loss';
    await operator.call('control', { loseCommitAck: { remaining: 1 } });
    const commit = { ...options, headers: { ...options.headers, 'idempotency-key': 'WT_COMMIT_ACK' }, body: JSON.stringify({ seller: 'WT_COMMIT_ACK', totalPrice: 23.45 }) };
    assert.equal((await request('/api/orders', commit)).status, 503); await operator.call('control', {});
    assert.equal((await request('/api/orders', commit)).status, 201);
    assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', ['WT_COMMIT_ACK'])).rows[0].n, 1); proofs.push('actual-commit-ack-loss-exact-replay');
    stage = 'durable-ingress-stop'; await operator.call('ingress', { open: false });
    const stopped = { ...options, headers: { ...options.headers, 'idempotency-key': 'WT_STOPPED' }, body: JSON.stringify({ seller: 'WT_STOPPED', totalPrice: 1 }) };
    assert.equal((await request('/api/orders', stopped)).status, 503); assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', ['WT_STOPPED'])).rows[0].n, 0);
    await operator.call('ingress', { open: true }); proofs.push('durable-global-admission-before-database-begin');
    await campaign.close(); campaign = null;
    const boundaries = [
      { name: 'exitBeforeBusinessCommit', code: 89, attempts: 1 },
      { name: 'exitAfterBusinessCommit', code: 90, attempts: 1 },
      { name: 'exitAfterEffectClaim', code: 88, attempts: 0 },
      { name: 'exitBeforeFakeReply', code: 86, attempts: 0 },
      { name: 'exitAfterFakeReply', code: 87, attempts: 1 },
      { name: 'exitAfterEffectRecorded', code: 91, attempts: 1 },
    ];
    const snapshotAll = async () => {
      const events = []; let cursor = 0, part, evidence;
      do { part = await operator.call('snapshot', { cursor, includeEvidence: cursor === 0 }); evidence ||= part.evidence; events.push(...part.events); cursor = part.cursor; } while (cursor < part.endAt);
      return { events, evidence };
    };
    const sendLine = async value => { const body = JSON.stringify({ events: [value] }); return request('/api/line/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': crypto.createHmac('sha256', 'WT_fake_signature').update(body).digest('base64') }, body }); };
    for (const boundary of boundaries) {
      stage = 'process-crash-' + boundary.name;
      const before = (await snapshotAll()).events.length;
      await operator.call('control', { [boundary.name]: { remaining: 1 } });
      const event = { type: 'message', webhookEventId: 'WT_EVENT_' + boundary.name, timestamp: Date.now(), replyToken: 'WT_REPLY_' + boundary.name, source: { type: 'user', userId: 'WT_USER_' + boundary.name }, message: { type: 'text', id: 'WT_MESSAGE_' + boundary.name, text: 'create:order' } };
      await assert.rejects(sendLine(event));
      for (let n = 0; n < 40 && child.exitCode === null; n++) await pause(50); assert.equal(child.exitCode, boundary.code);
      await operator.call('control', {}); await start(); assert.equal((await sendLine({ ...event, replyToken: 'WT_REDELIVERY_' + boundary.name })).status, 200);
      const phases = (await snapshotAll()).events.slice(before), replies = phases.filter(e => e.kind === 'fake-provider' && e.provider === 'line' && e.operation === 'reply'); assert.equal(replies.length, boundary.attempts);
      if (boundary.code === 87) assert.deepEqual(phases.filter(e => e.kind === 'fake-provider-outcome' && e.attemptId === replies[0].attemptId).map(e => e.phase), ['accepted']);
      assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1', [event.source.userId])).rows[0].n, 1);
    }
    proofs.push('all-six-real-process-exits-external-witnesses-and-correct-replay');
    const drained = await require('./drain.cjs').stopAndDrain({ operator, observer, runtimeUser: 'ha_runtime' }); assert.equal(drained.ingressDrained, true); proofs.push('actual-backend-and-durable-lease-drain');
    const snapshot = await snapshotAll();
    stage = 'fake-file-bytes';
    assert.ok(snapshot.evidence.uploads.acceptedUploads >= 4); assert.deepEqual(snapshot.evidence.corruptBlobIds, []); proofs.push('external-fake-file-byte-integrity');
    fs.writeFileSync(path.join(directory, 'smoke-result.json'), JSON.stringify({ status: 'PASS', scope: 'OFFLINE_SYNTHETIC_PRIVATE_APP_ONLY', proofs, inheritedCaseLabels, realCrashBoundariesVerified: 6, realProcessLaunches: launches, hostedRequests: 0, existingDataAccessed: false }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ privateAppSmoke: 'PASS', proofs: proofs.length, hostedRequests: 0 }));
  } catch (error) { fs.writeFileSync(path.join(directory, 'smoke-failure.json'), JSON.stringify({ stage, errorClass: error.name, code: error.code || null, actual: typeof error.actual === 'number' ? error.actual : null, expected: typeof error.expected === 'number' ? error.expected : null, browserResponses }), { mode: 0o600 }); if (activePage && !activePage.isClosed()) fs.writeFileSync(path.join(directory, 'browser-failure.html'), await activePage.content(), { mode: 0o600 }); console.error('Private app smoke failed at: ' + stage); process.exitCode = 1; }
  finally { await campaign?.close(); await browser?.close(); if (child?.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); } coordinator.server.closeAllConnections(); await new Promise(resolve => coordinator.server.close(resolve)); await observer.end(); }
})().catch(error => { fs.writeFileSync(path.join(process.env.STOCK_HA_SMOKE_DIRECTORY, 'setup-failure.json'), JSON.stringify({ name: error.name, message: error.message, code: error.code || null }), { mode: 0o600 }); console.error('Private app smoke setup failed: ' + error.name); process.exitCode = 1; });
