/* eslint-disable @typescript-eslint/no-require-imports -- Reuses reviewed case bodies without constructing or weakening the local-only Campaign. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { Client } = require('pg');
const { UploadSupplementCampaign } = require('../local-write/upload-supplement-coverage.cjs');
const { requireGate, assertExecution, sha } = require('./policy.cjs');
const { configuration } = require('./runtime.cjs');
const { createClient } = require('./rpc.cjs');
const { browserContext } = require('./browser-context.cjs');
const { installFetch } = require('./network.cjs');
const { memoryService } = require('../local-write/oracle.cjs');
class HostedCampaign extends UploadSupplementCampaign {
  // No super(): that constructor deliberately rejects every hosted environment.
  constructor() { throw new Error('Use the validated hosted campaign factory.'); }
  async owner() {
    if (this.admin) return this.admin;
    const config = this.ownerConfig, url = new URL(config.connectionString), runtime = new URL(this.env.STOCK_DATABASE_URL);
    requireGate(url.hostname === runtime.hostname && url.port === runtime.port && url.pathname === runtime.pathname && !url.search && !url.hash && config.ssl?.rejectUnauthorized === true, 'OBSERVER_TARGET_TLS');
    requireGate(this.manifest.offlineSynthetic || url.username.startsWith('stock_ha_observer'), 'NONPRIVILEGED_OBSERVER_REQUIRED');
    if (!this.manifest.offlineSynthetic) requireGate(this.manifest.binding.connectionMode === 'session' ? decodeURIComponent(url.username).endsWith('.' + this.manifest.binding.projectRef) : !decodeURIComponent(url.username).includes('.'), 'OBSERVER_POOLER_PROJECT');
    this.admin = new Client({ connectionString: config.connectionString, ssl: { rejectUnauthorized: true, ca: config.ssl.ca }, connectionTimeoutMillis: 5000 }); await this.admin.connect();
    if (!this.manifest.offlineSynthetic) {
      const role = (await this.admin.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
      requireGate(role && [role.rolsuper, role.rolbypassrls, role.rolcreatedb, role.rolcreaterole].every(value => value === false), 'OBSERVER_PRIVILEGES');
    }
    const result = await this.admin.query('SELECT current_database() AS name,(SELECT isolation_id::text FROM stock_operational.environment WHERE singleton) AS target');
    requireGate(result.rows[0]?.target === this.env.STOCK_TARGET_ISOLATION_ID && result.rows[0]?.name === runtime.pathname.slice(1), 'OBSERVER_IDENTITY');
    await this.admin.query('SET default_transaction_read_only=on'); return this.admin;
  }
  control(value) { this.pendingControl = structuredClone(value); }
  async baseline() {
    await super.baseline();
    if (!this.manifest.offlineSynthetic) {
      requireGate(sha(fs.readFileSync(path.join(this.out, 'original-row-hashes.json'))) === this.manifest.binding.originalRowsSha256, 'ORIGINAL_ROW_SEAL');
      requireGate(Object.values(this.original).reduce((sum, rows) => sum + Object.keys(rows).length, 0) === this.manifest.plan.backup.businessRows, 'ORIGINAL_ROW_COUNT');
    }
  }
  ledger() { return structuredClone(this.providerEvents); }
  async refreshLedger() {
    let result;
    do { result = await this.operator.call('snapshot', { cursor: this.providerEvents.length, includeEvidence: false }); this.providerEvents.push(...result.events); } while (result.cursor < result.endAt);
  }
  async flush() { await this.profileGate(); if (this.pendingControl) { await this.operator.call('control', this.pendingControl); this.pendingControl = null; } }
  async api(...args) { try { return await super.api(...args); } finally { await this.refreshLedger(); } }
  async seedHistory(records) { await this.seed({ kind: 'history', records }); }
  async WT04() { return require('./movement-case.cjs').WT04.call(this); }
  async WT13() { return require('./browser-case.cjs').WT13.call(this); }
  async seed(input) {
    await this.flush();
    const result = await fetch(this.config.origin + '/api/ha-test', { method: 'POST', headers: { authorization: 'Bearer ' + this.seedToken, 'content-type': 'application/json' }, body: JSON.stringify(input), redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(result.status, 200); assert.equal((await result.json()).seeded, true);
  }
  async browserContext(...args) { return browserContext.call(this, ...args); }
  async WT00() {
    await this.checkGuards();
    const client = new Client({ connectionString: this.env.STOCK_DATABASE_URL, ssl: { rejectUnauthorized: true, ca: this.env.STOCK_DATABASE_CA || undefined } }); await client.connect();
    try {
      const role = (await client.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolconnlimit FROM pg_roles WHERE rolname=current_user')).rows[0];
      assert.deepEqual([role.rolsuper, role.rolbypassrls, role.rolcreatedb, role.rolcreaterole], [false, false, false, false]); assert.equal(role.rolconnlimit, 6);
      await assert.rejects(client.query('SELECT * FROM stock_migration.orders LIMIT 1'));
      await assert.rejects(client.query('SELECT * FROM stock_operational.orders LIMIT 1'));
      await assert.rejects(client.query('SET ROLE postgres')); await client.query('SET ROLE stock_runtime');
      assert.equal((await client.query('SELECT count(*) FROM stock_operational.orders')).rowCount, 1);
    } finally { await client.end(); }
  }
  summary(status) { return { scope: this.manifest.offlineSynthetic ? 'OFFLINE_SYNTHETIC_HOSTED_ADAPTER' : 'APPROVED_HOSTED_COPY_ONLY', status, sourceCommit: this.sourceCommit, cases: this.results, requests: this.requests.length, hostedAcceptance: this.manifest.offlineSynthetic ? 'NOT_RUN' : 'INCOMPLETE_UNTIL_FULL_ORACLE_AND_RECOVERY', productionCutoverPerformed: false }; }
  async restartApp() {
    // A service restart is explicit, never a hidden deployment or provider retry.
    await this.lifecycle.restart(this.env.MOVEMENT_CREATE_MODE || 'quantity_photo'); await this.refreshLedger();
    const count = this.providerEvents.filter(e => e.kind === 'injected-fault').length;
    this.network.resumeAfterReviewedFault({ phaseVerified: count > (this.lastResumedFaultCount || 0) }); this.lastResumedFaultCount = count;
  }
  async restartMode(mode) { requireGate(['quantity_photo', 'photo_only'].includes(mode), 'MOVEMENT_MODE'); const next = await this.lifecycle.restart(mode); if (next) this.applyPreview(next); this.env.MOVEMENT_CREATE_MODE = mode; }
  applyPreview(next) {
    configuration(next.env, next.manifest);
    requireGate(next.env.STOCK_DATABASE_URL === this.env.STOCK_DATABASE_URL && next.manifest.targetId === this.manifest.targetId && next.manifest.coordinatorOrigin === this.manifest.coordinatorOrigin && next.manifest.runId === this.manifest.runId, 'PREVIEW_COPY_MISMATCH');
    this.env = { ...next.env }; this.manifest = next.manifest; this.config.origin = next.manifest.appOrigin; this.seedToken = next.seedToken;
  }
  async close() { this.network?.restore(); await this.admin?.end(); }
}
function createCampaign(options) {
  const { manifest, env, output, ownerConfig, operatorToken, seedToken, sourceCommit, profileGate, lifecycle } = options;
  configuration(env, manifest);
  if (!manifest.offlineSynthetic) assertExecution(manifest.plan, manifest.binding, manifest.approval, env);
  requireGate(!fs.existsSync(output) && typeof profileGate === 'function' && typeof lifecycle?.restart === 'function', 'CAMPAIGN_CONFIGURATION'); fs.mkdirSync(output, { mode: 0o700 });
  const campaign = Object.create(HostedCampaign.prototype);
  Object.assign(campaign, { state: path.dirname(output), manifest, env: { ...env }, config: { origin: manifest.appOrigin }, db: new URL(env.STOCK_DATABASE_URL).pathname.slice(1), out: output, prefix: manifest.runId, requests: [], results: [], seq: 0, blocked: [], oracle: memoryService(), accounts: [{ id: 'WT_ACCOUNT_A', shopName: 'WT Shop A' }, { id: 'WT_ACCOUNT_B', shopName: 'WT Shop B' }], month: '2026-01', date: '2026-01-01', context: {}, harnessCommit: sourceCommit, sourceCommit, probedRoutes: new Set(), methodProofs: [], providerEvents: [], pendingControl: {}, profileGate, ownerConfig, seedToken, lifecycle, hostedHarnessValidated: true });
  campaign.operator = createClient({ origin: manifest.coordinatorOrigin, token: operatorToken, runId: manifest.runId, targetId: manifest.targetId, offline: manifest.offlineSynthetic, ca: manifest.coordinatorCa });
  campaign.beforeRequest = () => campaign.flush();
  campaign.network = installFetch({ origin: () => campaign.config.origin, deploymentAccessToken: () => campaign.env.STOCK_HA_DEPLOYMENT_ACCESS_TOKEN || campaign.env.VERCEL_AUTOMATION_BYPASS_SECRET, beforeRequest: () => campaign.flush(), afterRequest: () => campaign.refreshLedger() });
  return campaign;
}
module.exports = { createCampaign, HostedCampaign };
