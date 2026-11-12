/* eslint-disable @typescript-eslint/no-require-imports -- Fresh synthetic restore, SELECT-only login, actual read-only app and no provider replay. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), net = require('node:net'), assert = require('node:assert/strict');
const { Client } = require('pg'), { createCoordinator } = require('./rpc.cjs');
(async () => {
  const directory = process.env.STOCK_HA_SMOKE_DIRECTORY, app = process.env.STOCK_HA_TEST_BUILD, url = new URL(process.env.STOCK_HA_SYNTHETIC_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/ha_synthetic_checkpoint'); assert.equal(url.username, 'ha_readonly');
  const reader = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ca: fs.readFileSync(path.join(directory, 'cert')) } }); await reader.connect();
  await assert.rejects(reader.query('UPDATE stock_operational.revision SET value=value'), error => error.code === '42501');
  await assert.rejects(reader.query('SET ROLE stock_runtime'), error => error.code === '42501');
  const target = (await reader.query('SELECT isolation_id::text FROM stock_operational.environment')).rows[0].isolation_id; await reader.end();
  const runtimeToken = 'WT_' + crypto.randomBytes(32).toString('hex'), operatorToken = 'WT_' + crypto.randomBytes(32).toString('hex'), apiToken = 'WT_' + crypto.randomBytes(32).toString('hex');
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const coordinator = createCoordinator({ directory: path.join(directory, 'recovery-coordinator'), runId: 'WT_RECOVERY', targetId: 'WT_' + target, runtimeToken, operatorToken, faultTesting: false }); await new Promise(resolve => coordinator.server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + port, manifest = { version: 1, offlineSynthetic: true, syntheticFixtureId: 'WT_FRESH_RESTORE', mode: 'recovery', providerMode: 'fake-only', runId: 'WT_RECOVERY', targetId: 'WT_' + target, appOrigin: origin, databasePort: Number(url.port), databaseName: url.pathname.slice(1), coordinatorOrigin: 'http://127.0.0.1:' + coordinator.server.address().port };
  const fd = fs.openSync(path.join(directory, 'recovery-app.log'), 'wx', 0o600);
  const child = cp.spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: app, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_OPTIONS: '--max-old-space-size=384', NEXT_TELEMETRY_DISABLED: '1', STOCK_HA_MANIFEST_JSON: JSON.stringify(manifest), STOCK_HA_OFFLINE_SYNTHETIC: 'true', STOCK_HA_RUNTIME_TOKEN: runtimeToken, STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_DATABASE_URL: url.toString(), STOCK_TARGET_ISOLATION_ID: target, STOCK_STAGING_AUTH_TOKEN: apiToken, STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'true' }, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
  try {
    let ready = false;
    for (let n = 0; n < 120; n++) {
      try { const response = await fetch(origin + '/api/orders', { headers: { authorization: 'Bearer ' + apiToken }, redirect: 'error', signal: AbortSignal.timeout(5000) }); if (response.status === 200) { ready = true; break; } } catch { /* Read-only startup probe only. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(ready, true);
    const denied = await fetch(origin + '/api/orders', { method: 'POST', headers: { authorization: 'Bearer ' + apiToken, 'content-type': 'application/json', 'idempotency-key': 'WT_RESTORE_DENIED' }, body: '{}', redirect: 'error' }); assert.equal(denied.status, 405);
    assert.equal(coordinator.store.events().filter(e => e.kind === 'fake-provider').length, 0);
    fs.writeFileSync(path.join(directory, 'recovery-app-result.json'), JSON.stringify({ status: 'PASS', loginSelectOnly: true, writeDenied: true, writerRoleMembershipDenied: true, actualReadOnlyAppReady: true, providerReplays: 0, scope: 'FRESH_SYNTHETIC_RESTORE_ONLY' }), { mode: 0o600 });
    console.log('PASS: fresh restore SELECT-only login and provider-denied read-only application');
  } finally { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); coordinator.server.closeAllConnections(); await new Promise(resolve => coordinator.server.close(resolve)); }
})().catch(error => { console.error('Recovery app smoke failed: ' + error.name); process.exitCode = 1; });
