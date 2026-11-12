/* eslint-disable @typescript-eslint/no-require-imports -- Target-bound private coordinator transport; never follows redirects or retries uncertain work. */
const http = require('node:http'), https = require('node:https'), crypto = require('node:crypto');
const net = require('node:net');
const { requireGate, assertApproval, sha } = require('./policy.cjs');
const { openCoordinator } = require('./coordinator.cjs');
const MAX_BYTES = 32 * 1024 * 1024;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function validateEndpoint(value, offline) {
  const url = new URL(value);
  requireGate(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'RPC_ORIGIN');
  requireGate(offline ? url.hostname === '127.0.0.1' && url.port && ['http:', 'https:'].includes(url.protocol) : url.protocol === 'https:' && !url.port && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.vercel.app'), 'RPC_ENDPOINT');
  if (!offline) requireGate(!net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !/(^|\.)(googleapis\.com|google\.com|line\.me|loyverse\.com)$/.test(url.hostname), 'RPC_REAL_PROVIDER_OR_IP');
  return url;
}
function createClient({ origin, token, runId, targetId, offline = false, ca, timeoutMs = 10000, maximumBytes = MAX_BYTES }) {
  const url = validateEndpoint(origin, offline);
  requireGate(typeof token === 'string' && token.length >= 48 && /^WT_[\w-]+$/.test(runId) && /^WT_[\w-]+$/.test(targetId), 'RPC_IDENTITY');
  const traffic = { requestBytes: 0, responseBytes: 0, calls: 0, uncertain: 0, scope: 'RPC_BODIES_ONLY_NOT_PROVIDER_BILLING' };
  return Object.freeze({ traffic: () => structuredClone(traffic), async call(action, value = {}) {
    const payload = Buffer.from(JSON.stringify({ runId, targetId, action, value })); requireGate(payload.length <= maximumBytes, 'RPC_BODY_LIMIT');
    traffic.requestBytes += payload.length; traffic.calls++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const fail = () => { if (!finished) { finished = true; traffic.uncertain++; const error = new Error('Coordinator transport outcome requires review.'); error.code = 'RPC_UNCERTAIN'; reject(error); } };
      const request = (url.protocol === 'https:' ? https : http).request(new URL('/v1/rpc', url), { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'content-length': payload.length }, ...(url.protocol === 'https:' ? { rejectUnauthorized: true, ca } : {}) }, response => {
        const chunks = []; let length = 0;
        response.on('data', chunk => { length += chunk.length; traffic.responseBytes += chunk.length; if (length > maximumBytes) { response.destroy(); fail(); } else chunks.push(chunk); });
        response.on('error', fail);
        response.on('end', () => {
          if (finished) return;
          try {
            requireGate(response.statusCode === 200, 'RPC_STATUS'); const result = JSON.parse(Buffer.concat(chunks).toString());
            requireGate(result.runId === runId && result.targetId === targetId && result.ok === true, 'RPC_RESPONSE_IDENTITY');
            finished = true; resolve(result.value);
          } catch { fail(); }
        });
      });
      request.on('error', fail); request.setTimeout(timeoutMs, () => { request.destroy(); fail(); }); request.end(payload);
    });
  } });
}
const faultNames = new Set(['sqlBefore', 'loseCommitAck', 'exitBeforeBusinessCommit', 'exitAfterBusinessCommit', 'exitAfterEffectClaim', 'exitBeforeFakeReply', 'exitAfterFakeReply', 'exitAfterEffectRecorded']);
function createCoordinator({ directory, runId, targetId, runtimeToken, operatorToken, catalog = {}, offline = true, tls, faultTesting = true, authorization, runtimeConfigs = {} }) {
  runtimeConfigs = structuredClone(runtimeConfigs);
  if (!offline) { requireGate(authorization, 'COORDINATOR_APPROVAL'); assertApproval(authorization.plan, authorization.binding, authorization.approval); }
  catalog = Object.fromEntries(Object.entries(structuredClone(catalog)).map(([key, value]) => [key, value.reply ? value : { account: JSON.parse(key)[0], reply: value }]));
  requireGate(runtimeToken?.length >= 48 && operatorToken?.length >= 48 && !same(runtimeToken, operatorToken), 'RPC_TOKENS');
  requireGate(offline || tls?.cert && tls?.key, 'RPC_TLS_REQUIRED');
  const store = openCoordinator(directory, { runId, targetId, catalog, evidenceScope: offline ? 'OFFLINE_SYNTHETIC_ONLY' : 'APPROVED_HOSTED_FAKE_JOURNAL_ONLY_NOT_ACCEPTANCE', pageResolver(request, control) {
    if (Object.hasOwn(catalog, request.catalogKey)) return catalog[request.catalogKey].reply;
    const cursor = request.cursor || '';
    if (control.salesFailCursor === cursor) return { status: 503, body: { error: 'WT fake page failure' } };
    const pages = control.salesPages?.[request.account]; requireGate(Array.isArray(pages), 'UNSEALED_SALES_FIXTURE');
    const index = cursor ? Number(cursor) : 0; requireGate(Number.isInteger(index) && index >= 0 && index <= pages.length, 'FAKE_CURSOR');
    return { status: 200, body: { receipts: pages[index] || [], cursor: control.salesRepeatCursor ? '1' : index + 1 < pages.length ? String(index + 1) : null } };
  } });
  const handler = async (request, response) => {
    const send = (status, value) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
    try {
      if (!offline) assertApproval(authorization.plan, authorization.binding, authorization.approval);
      requireGate(request.url === '/v1/rpc' && request.method === 'POST', 'RPC_ROUTE');
      const token = request.headers.authorization?.replace(/^Bearer /, ''), operator = same(token, operatorToken);
      requireGate(operator || same(token, runtimeToken), 'RPC_AUTH');
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; requireGate(size <= MAX_BYTES, 'RPC_BODY_LIMIT'); chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString()); requireGate(input.runId === runId && input.targetId === targetId, 'RPC_REQUEST_IDENTITY');
      const value = input.value || {}; let output;
      if (input.action === 'register-preview') { requireGate(operator, 'RPC_OPERATOR_ONLY'); registerPreview(value); output = { registered: true }; }
      else if (input.action === 'manifest') { const manifest = store.preview(value.deploymentId); requireGate(manifest && manifest.binding.appProjectId === value.projectId, 'PREVIEW_NOT_APPROVED'); output = { manifest, runtimeEnv: runtimeConfigs[value.deploymentId] || {} }; }
      else if (input.action === 'ingress') { requireGate(operator && typeof value.open === 'boolean', 'RPC_OPERATOR_ONLY'); store.ingress(value.open); output = { recorded: true, open: value.open }; }
      else if (input.action === 'permit') output = store.lease(value.backendPid, value.instanceId);
      else if (input.action === 'release') { store.release(value.leaseId, value.instanceId); output = { released: true }; }
      else if (input.action === 'leases') { requireGate(operator, 'RPC_OPERATOR_ONLY'); output = { open: store.permitted(), leases: store.leases() }; }
      else if (input.action === 'reconcile-closed-backend') { requireGate(operator && value.backendAbsentVerified === true, 'RPC_OPERATOR_ONLY'); store.release(value.leaseId, value.instanceId, true); output = { reconciled: true }; }
      else if (input.action === 'control') { requireGate(operator && faultTesting, 'RPC_OPERATOR_ONLY'); requireGate(Object.keys(value).every(k => faultNames.has(k) || ['driveFailure', 'driveUncertain', 'driveDeleteFailure', 'driveDeleteUncertain', 'lineFailure', 'salesPages', 'salesFailCursor', 'salesRepeatCursor'].includes(k)), 'RPC_CONTROL_KEY'); store.control(value); output = { recorded: true }; }
      else if (input.action === 'snapshot') {
        requireGate(operator, 'RPC_OPERATOR_ONLY'); const cursor = value.cursor || 0, limit = value.limit || 4096;
        requireGate(Number.isInteger(cursor) && cursor >= 0 && cursor <= store.eventCount() && Number.isInteger(limit) && limit > 0 && limit <= 4096, 'RPC_CURSOR');
        const events = store.events(cursor, limit); output = { events, cursor: cursor + events.length, endAt: store.eventCount(), ...(value.includeEvidence === false ? {} : { evidence: store.evidence(value.references || [], value.history || []) }) };
      }
      else if (input.action === 'read-file') { requireGate(operator, 'RPC_OPERATOR_ONLY'); const file = store.readFile(value.id); output = { contentType: file.contentType, base64: file.bytes.toString('base64') }; }
      else if (input.action === 'fault') {
        requireGate(faultTesting && faultNames.has(value.name) && /^WT_[\w-]+$/.test(value.requestId || ''), 'RPC_FAULT');
        output = store.consume(value.name, value.requestId, f => value.name !== 'sqlBefore' || typeof f.match === 'string' && typeof value.sql === 'string' && value.sql.includes(f.match) && (!f.commandKey || f.commandKey === value.commandKey));
        if (output) store.record({ kind: 'injected-fault', phase: value.phase || value.name, commandKey: value.commandKey || null, match: output.match || null });
      } else if (input.action === 'event') {
        requireGate(['harness-installed', 'denied', 'runtime-sample'].includes(value.kind), 'RPC_EVENT');
        const safe = { kind: value.kind, instanceId: String(value.instanceId || '').slice(0, 80), at: new Date().toISOString() };
        if (value.kind === 'runtime-sample') for (const key of ['rssBytes', 'heapBytes', 'cpuUserMicros', 'cpuSystemMicros', 'uptimeSeconds']) { requireGate(Number.isFinite(value[key]) && value[key] >= 0, 'RPC_SAMPLE'); safe[key] = value[key]; }
        store.record(safe); output = { recorded: true };
      } else if (input.action === 'provider') {
        requireGate(store.permitted(), 'RPC_INGRESS_CLOSED');
        requireGate(!Object.hasOwn(value, 'mode'), 'RPC_OPERATOR_FAULT_ONLY');
        const c = store.controls(), provider = { ...value, ...(value.base64 ? { bytes: Buffer.from(value.base64, 'base64') } : {}) }; delete provider.base64;
        const upload = value.operation === 'drive-upload', deletion = value.operation === 'drive-delete', line = ['line-reply', 'line-push'].includes(value.operation);
        provider.mode = line && c.exitAfterFakeReply && (c.exitAfterFakeReply.remaining ?? 1) > 0 ? 'accepted-only' : upload && c.driveFailure || deletion && c.driveDeleteFailure ? 'reject' : upload && c.driveUncertain || deletion && c.driveDeleteUncertain || line && c.lineFailure ? 'uncertain' : 'complete';
        output = store.perform(provider);
      } else requireGate(false, 'RPC_ACTION');
      send(200, { ok: true, runId, targetId, value: output });
    } catch { send(403, { ok: false, error: 'Coordinator refused request.' }); }
  };
  function registerPreview(manifest) {
    requireGate(manifest.runId === runId && manifest.targetId === targetId && manifest.providerMode === 'fake-only' && /^dpl_[A-Za-z0-9]+$/.test(manifest.binding?.deploymentId || '') && /^prj_[A-Za-z0-9]+$/.test(manifest.binding?.appProjectId || ''), 'PREVIEW_NAMESPACE');
    requireGate(!Object.hasOwn(manifest, 'env') && !Object.hasOwn(manifest, 'tokens'), 'PREVIEW_NO_CREDENTIAL_PAYLOAD');
    if (offline) requireGate(manifest.offlineSynthetic === true, 'PREVIEW_OFFLINE_ONLY');
    else {
      assertApproval(manifest.plan, manifest.binding, manifest.approval); requireGate(manifest.binding.projectRef === authorization.binding.projectRef && manifest.binding.appProjectId === authorization.binding.appProjectId && manifest.coordinatorOrigin === authorization.binding.coordinatorOrigin, 'PREVIEW_APPROVED_TARGET');
      requireGate(runtimeConfigs[manifest.binding.deploymentId] && sha(JSON.stringify(runtimeConfigs[manifest.binding.deploymentId])) === manifest.binding.runtimeConfigSha256, 'PREVIEW_RUNTIME_CONFIG_SEAL');
    }
    store.registerPreview(manifest);
  }
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  const listen = server.listen;
  server.listen = function (...args) {
    const host = args[0] && typeof args[0] === 'object' ? args[0].host : args[1];
    if (offline) requireGate(host === '127.0.0.1', 'COORDINATOR_LOOPBACK_ONLY');
    else assertApproval(authorization.plan, authorization.binding, authorization.approval);
    return listen.apply(this, args);
  };
  server.on('close', () => store.close());
  return { server, store, registerPreview, registerRuntimeConfig(deploymentId, config) {
    requireGate(/^dpl_[A-Za-z0-9]+$/.test(deploymentId) && config && Object.values(config).every(value => typeof value === 'string'), 'PRIVATE_RUNTIME_CONFIG');
    const registered = store.preview(deploymentId); requireGate(!registered || registered.binding.runtimeConfigSha256 === sha(JSON.stringify(config)), 'PRIVATE_RUNTIME_CONFIG_CHANGED'); runtimeConfigs[deploymentId] = structuredClone(config);
  } };
}
module.exports = { createClient, createCoordinator, validateEndpoint };
