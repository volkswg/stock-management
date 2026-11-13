/* eslint-disable @typescript-eslint/no-require-imports -- Explicit operator smoke uses the existing actual-owner TypeScript loader. */
// A bounded smoke, not the optional hosted capacity/fault framework. No public app,
// tunnel, provider calls, production credentials, schema changes or row cleanup.
// Clean-environment invocation requires STOCK_SMOKE_CONFIG_FILE (0600 JSON:
// projectRef, isolationId, runtimeUrl, observerUrl, ca, sourceCommit) and a new
// STOCK_SMOKE_OUTPUT path. Only the exact already approved disposable target is
// accepted; this entrypoint must never run automatically in CI or on production.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), net = require('node:net');
const target = { projectRef: 'dcwyiayubrqdrloergax', isolationId: '5f63d064-9658-4440-bf87-b4279b08c806' };
const configFile = process.env.STOCK_SMOKE_CONFIG_FILE, output = process.env.STOCK_SMOKE_OUTPUT;
assert.ok(configFile && output && !fs.existsSync(output));
assert.equal(fs.statSync(configFile).mode & 0o777, 0o600);
const host = `db.${target.projectRef}.supabase.co`;
let config;
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(config.projectRef, target.projectRef); assert.equal(config.isolationId, target.isolationId);
  for (const [key, user] of [['runtimeUrl', 'stock_ha_runtime'], ['observerUrl', 'stock_ha_observer']]) {
    const url = new URL(config[key]);
    assert.equal(url.protocol, 'postgres:'); assert.equal(url.hostname, host);
    assert.equal(url.port, '5432'); assert.equal(url.pathname, '/postgres');
    assert.equal(url.username, user); assert.ok(url.password); assert.equal(url.search, ''); assert.equal(url.hash, '');
  }
} catch {
  // URL/JSON parser diagnostics can contain the credential-bearing input.
  throw Error('Invalid private smoke configuration; no connection attempted.');
}
// The launcher must provide a clean environment; reject inherited integration/configuration.
assert.equal(Object.keys(process.env).some(k => /^(PG|GOOGLE_|LOYVERSE_|LINE_|VERCEL_|STOCK_DATABASE_|STOCK_HA_|STOCK_PRODUCTION_)/.test(k)), false);
let deniedNetwork = 0;
const deny = () => { deniedNetwork++; throw Error('Provider network prohibited'); };
global.fetch = deny;
for (const name of ['node:http', 'node:https']) { const mod = require(name); mod.request = deny; mod.get = deny; }
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const allowed = typeof options === 'number' ? options === 5432 && args[1] === host : options && typeof options === 'object' && options.host === host && Number(options.port) === 5432;
  if (!allowed) return deny();
  return originalConnect.apply(this, args);
};
require('../../tests/helpers/postgres-runtime.cjs');
const { Client } = require('pg');
const db = require('../../src/infrastructure/persistence/postgres/database.ts');
const orders = require('../../src/app/api/orders/route.ts');
const line = require('../../src/app/api/line/webhook/route.ts');
const runId = 'WT_SMOKE_' + crypto.randomBytes(8).toString('hex');
Object.assign(process.env, {
  STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'false',
  STOCK_STAGING_AUTH_TOKEN: crypto.randomBytes(32).toString('hex'),
  STOCK_DATABASE_URL: config.runtimeUrl, STOCK_DATABASE_CA: config.ca,
  STOCK_TARGET_ISOLATION_ID: target.isolationId, LINE_CHANNEL_SECRET: crypto.randomBytes(32).toString('hex'),
});
const observer = new Client({ connectionString: config.observerUrl, ssl: { rejectUnauthorized: true, ca: config.ca }, connectionTimeoutMillis: 5000, application_name: runId });
observer.on('error', () => {});
const proof = { version: 1, protocol: 'essential-managed-postgres-smoke', target, startedAt: new Date().toISOString(), runId, checks: [], applicationSource: config.sourceCommit, execution: 'Actual application route owners on operator Mac against approved hosted PostgreSQL; not a Vercel runtime/browser or capacity certificate', retainedSyntheticOrderId: null };
const originalQuery = Client.prototype.query;
Client.prototype.query = function (...args) {
  const result = originalQuery.apply(this, args);
  if (!result || typeof result.catch !== 'function') return result;
  return result.catch(error => {
    (proof.sqlErrorCodes ||= []).push(/^[A-Z0-9]{5}$/.test(error.code || '') ? error.code : 'DRIVER_ERROR');
    throw error;
  });
};
const check = async (name, fn) => { proof.currentCheck = name; const start = performance.now(); await fn(); proof.checks.push({ name, pass: true, milliseconds: Math.round(performance.now() - start) }); };
const request = (method = 'GET', body, key = runId, authorized = true) => new Request('https://example.test/api/orders', { method, headers: { ...(authorized ? { authorization: 'Bearer ' + process.env.STOCK_STAGING_AUTH_TOKEN } : {}), 'content-type': 'application/json', 'idempotency-key': key }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function inventory(exclude) {
  await observer.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await observer.query("SET LOCAL statement_timeout='30s'");
    const tables = (await observer.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema IN ('stock_migration','stock_operational') AND table_type='BASE TABLE' ORDER BY 1,2")).rows;
    assert.equal(tables.length, 51);
    const result = {};
    for (const t of tables) {
      if (['environment', 'revision', 'commands', 'side_effects'].includes(t.table_name) && t.table_schema === 'stock_operational') continue;
      assert.match(t.table_name, /^[a-z_]+$/);
      const filter = t.table_schema === 'stock_operational' && t.table_name === 'orders' && exclude ? ' WHERE id <> $1' : '';
      const sql = `SELECT count(*)::int AS count,encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') AS digest FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS h FROM ${t.table_schema}.${t.table_name} t${filter}) hashes`;
      result[t.table_schema + '.' + t.table_name] = (await observer.query(sql, filter ? [exclude] : [])).rows[0];
    }
    await observer.query('COMMIT'); return result;
  } catch (e) { await observer.query('ROLLBACK'); throw e; }
}
async function main() {
  await observer.connect();
  await check('exact target, expiry, private grants, database and connection headroom', async () => {
    const row = (await observer.query("SELECT isolation_id::text,purpose,pg_database_size(current_database())::text AS bytes,(SELECT count(*)::int FROM pg_stat_activity) AS connections,current_setting('max_connections')::int AS maximum FROM stock_operational.environment WHERE singleton")).rows;
    assert.equal(row.length, 1); assert.equal(row[0].isolation_id, target.isolationId); assert.equal(row[0].purpose, 'isolated-staging');
    assert.ok(Number(row[0].bytes) < 400000000); assert.ok(row[0].maximum - row[0].connections >= 5); proof.databaseBefore = row[0];
    const roles = (await observer.query("SELECT rolname,rolconnlimit,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,rolreplication,rolvaliduntil>now()+interval '15 minutes' AS valid FROM pg_roles WHERE rolname IN ('stock_ha_runtime','stock_ha_observer') ORDER BY rolname")).rows;
    assert.equal(roles.length, 2); for (const r of roles) { for (const k of ['rolsuper','rolcreatedb','rolcreaterole','rolinherit','rolbypassrls','rolreplication']) assert.equal(r[k], false); assert.equal(r.valid, true); assert.equal(r.rolconnlimit, r.rolname === 'stock_ha_runtime' ? 6 : 2); }
    const grants = (await observer.query("SELECT has_schema_privilege('anon','stock_operational','USAGE') AS anon,has_schema_privilege('authenticated','stock_operational','USAGE') AS authenticated,has_schema_privilege('stock_ha_runtime','stock_migration','USAGE') AS runtime_archive")).rows[0];
    assert.deepEqual(grants, { anon: false, authenticated: false, runtime_archive: false });
  });
  proof.before = await inventory();
  proof.revisionBefore = (await observer.query('SELECT value::text FROM stock_operational.revision')).rows[0].value;
  await check('missing staging bearer denied', async () => assert.equal((await orders.GET(request('GET', undefined, runId, false))).status, 401));
  await check('actual runtime socket verifies hostname/CA, server TLS and bounded pool', async () => {
    await db.transaction(false, async () => {
      const client = db.currentTransaction(), socket = client.connection.stream;
      proof.tlsObservation = { encrypted: socket.encrypted, authorized: socket.authorized, hostnameVerified: !require('node:tls').checkServerIdentity(host, socket.getPeerCertificate()) };
      assert.equal(socket.encrypted, true); assert.equal(socket.authorized, true);
      assert.equal(require('node:tls').checkServerIdentity(host, socket.getPeerCertificate()), undefined);
      const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      // SET ROLE intentionally does not inherit diagnostic access. Use the
      // separately approved pg_monitor observer for that exact backend only.
      const ssl = (await observer.query("SELECT s.ssl FROM pg_stat_ssl s JOIN pg_stat_activity a USING(pid) WHERE a.pid=$1 AND a.usename='stock_ha_runtime'", [pid])).rows;
      assert.deepEqual(ssl, [{ ssl: true }]);
    });
    assert.equal(db.connectionPool().options.max, 2);
  });
  await check('LINE raw-body signatures missing/wrong/tampered denied; signed empty event accepted', async () => {
    const raw = JSON.stringify({ events: [] }), signature = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(raw).digest('base64');
    const send = (body, sig) => line.POST(new Request('https://example.test/api/line/webhook', { method: 'POST', body, headers: sig ? { 'x-line-signature': sig } : {} }));
    assert.equal((await send(raw)).status, 401); assert.equal((await send(raw, 'invalid')).status, 401);
    assert.equal((await send(raw + ' ', signature)).status, 401); assert.equal((await send(raw, signature)).status, 200);
  });
  await check('business row and command journal roll back atomically', async () => {
    const rollbackKey = runId + '_rollback';
    await assert.rejects(db.transaction(true, async () => {
      assert.equal((await orders.POST(request('POST', { seller: rollbackKey, totalPrice: 12.34 }, rollbackKey))).status, 201);
      throw Error('Intentional rollback');
    }));
    assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', [rollbackKey])).rows[0].n, 0);
    assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [rollbackKey])).rows[0].n, 0);
    assert.equal((await observer.query('SELECT value::text FROM stock_operational.revision')).rows[0].value, proof.revisionBefore);
  });
  const body = { seller: runId, totalPrice: 12.34, remark: 'Approved disposable hosted PostgreSQL smoke only' };
  await check('five overlapping identical application requests commit exactly once', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => orders.POST(request('POST', body))));
    for (const response of responses) assert.equal(response.status, 201);
    const values = await Promise.all(responses.map(r => r.text())); for (const value of values) assert.equal(value, values[0]);
    proof.retainedSyntheticOrderId = JSON.parse(values[0]).order.id;
    assert.equal((await observer.query('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', [runId])).rows[0].n, 1);
    const journal = (await observer.query('SELECT state FROM stock_operational.commands WHERE key=$1', [runId])).rows;
    assert.deepEqual(journal, [{ state: 'complete' }]);
    assert.equal(BigInt((await observer.query('SELECT value::text FROM stock_operational.revision')).rows[0].value), BigInt(proof.revisionBefore) + 1n);
  });
  await check('changed intent rejected, original record readable through actual GET', async () => {
    assert.equal((await orders.POST(request('POST', { ...body, totalPrice: 56.78 }))).status, 409);
    const response = await orders.GET(request()); assert.equal(response.status, 200);
    const found = (await response.json()).orders.filter(o => o.id === proof.retainedSyntheticOrderId);
    assert.equal(found.length, 1); assert.equal(found[0].totalPrice, 12.34); assert.equal(found[0].seller, runId);
  });
  await check('read-only switch denies writes and wrong UUID fails closed', async () => {
    process.env.STOCK_STAGING_READ_ONLY = 'true';
    assert.equal((await orders.POST(request('POST', body, runId + '_readonly'))).status, 405);
    process.env.STOCK_STAGING_READ_ONLY = 'false'; await db.closePool();
    process.env.STOCK_TARGET_ISOLATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    assert.equal((await orders.GET(request())).status, 503);
    await db.closePool(); process.env.STOCK_TARGET_ISOLATION_ID = target.isolationId;
  });
  await check('runtime archive read, DELETE and owner assumption denied', async () => {
    for (const sql of ['SELECT * FROM stock_migration.orders LIMIT 0', 'DELETE FROM stock_operational.orders WHERE false', 'SET LOCAL ROLE postgres']) {
      const previous = (proof.sqlErrorCodes || []).length;
      await assert.rejects(db.transaction(true, () => db.currentTransaction().query(sql)));
      assert.equal(proof.sqlErrorCodes[previous], '42501');
    }
  });
  await db.closePool();
  proof.after = await inventory(proof.retainedSyntheticOrderId); assert.deepEqual(proof.after, proof.before);
  proof.originalTableFingerprintsUnchanged = Object.keys(proof.before).length;
  proof.originalBusinessRows = Object.entries(proof.before).filter(([name]) => name.startsWith('stock_operational.')).reduce((sum, [,r]) => sum + r.count, 0);
  proof.databaseAfter = (await observer.query('SELECT pg_database_size(current_database())::text AS bytes,(SELECT count(*)::int FROM pg_stat_activity WHERE usename=\'stock_ha_runtime\') AS "runtimeSessions"')).rows[0];
  assert.ok(Number(proof.databaseAfter.bytes) < 400000000); assert.equal(proof.databaseAfter.runtimeSessions, 0);
  assert.equal(deniedNetwork, 0); proof.providerCalls = 0; proof.pass = true;
}
main().catch(error => { proof.pass = false; proof.failureCode = /^[A-Z0-9_]{3,40}$/.test(error.code || '') ? error.code : 'CHECK_FAILED'; process.exitCode = 1; }).finally(async () => {
  await db.closePool().catch(() => {}); await observer.end().catch(() => {});
  proof.finishedAt = new Date().toISOString(); proof.deniedNetworkAttempts = deniedNetwork;
  fs.writeFileSync(path.resolve(output), JSON.stringify(proof, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ pass: proof.pass, checks: proof.checks.length, originalBusinessRows: proof.originalBusinessRows, unchangedTableFingerprints: proof.originalTableFingerprintsUnchanged, providerCalls: proof.providerCalls, retainedSyntheticOrders: proof.retainedSyntheticOrderId ? 1 : 0 }));
});
