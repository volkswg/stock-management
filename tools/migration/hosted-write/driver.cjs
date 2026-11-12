/* eslint-disable @typescript-eslint/no-require-imports -- Exact-origin operator HTTP driver. No automatic retries, cloud creation or production fallback. */
const { requireGate, assertExecution } = require('./policy.cjs');
const { assessProfile, TrafficBudget } = require('./feasibility.cjs');
async function boundedBody(response, maximum) {
  const chunks = []; let length = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        requireGate(length <= maximum, 'RESPONSE_BODY_LIMIT');
        chunks.push(Buffer.from(value));
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  }
  return Buffer.concat(chunks, length);
}
function transport({ appOrigin, token, budget, proof, beforeDispatch = () => {} }) {
  budget = Object.freeze(structuredClone(budget));
  const traffic = new TrafficBudget(budget), records = [];
  let stopped = false;
  return Object.freeze({
    proof,
    async api(pathname, { method = 'GET', body, key, headers = {}, maximumMs = 10000 } = {}) {
      requireGate(!stopped, 'DRIVER_STOPPED');
      requireGate(typeof pathname === 'string' && pathname.startsWith('/api/') && !pathname.includes('\\') && !/[\r\n]/.test(pathname), 'API_PATH');
      const url = new URL(pathname, appOrigin);
      requireGate(url.origin === appOrigin && url.pathname.startsWith('/api/') && !url.username && !url.password && !url.hash, 'FOREIGN_ORIGIN');
      requireGate(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && Number.isInteger(maximumMs) && maximumMs > 0 && maximumMs <= 30000, 'REQUEST_PROFILE');
      const h = new Headers(headers);
      requireGate(!['authorization', 'host', 'cookie', 'proxy-authorization', 'x-vercel-protection-bypass'].some(name => h.has(name)), 'CALLER_CREDENTIAL_HEADER');
      requireGate(!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || /^WT_[A-Za-z0-9_-]{1,180}$/.test(key || ''), 'WRITE_KEY');
      h.set('authorization', 'Bearer ' + token);
      if (key) h.set('idempotency-key', key);
      if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && !Buffer.isBuffer(body) && typeof body !== 'string') { h.set('content-type', 'application/json'); body = JSON.stringify(body); }
      const request = new Request(url, { method, headers: h, body, redirect: 'error', signal: AbortSignal.timeout(maximumMs) });
      const requestBytes = request.body ? Buffer.from(await request.clone().arrayBuffer()).length : 0;
      let settle;
      try { beforeDispatch(); settle = traffic.reserve(requestBytes); }
      catch (error) { stopped = true; throw error; }
      const started = performance.now();
      let settled = false;
      try {
        const response = await fetch(request);
        requireGate(response.url === '' || new URL(response.url).origin === appOrigin, 'RESPONSE_ORIGIN');
        requireGate(response.status < 300 || response.status >= 400, 'REDIRECT_DENIED');
        const bytes = await boundedBody(response, budget.responseMaximumBytes);
        settled = true; settle(bytes.length);
        const record = { method, pathname: url.pathname, status: response.status, requestBytes, responseBytes: bytes.length, ms: performance.now() - started };
        records.push(record);
        return { ...record, body: bytes, revision: response.headers.get('x-stock-revision') };
      } catch (error) {
        stopped = true;
        if (!settled) { try { settle(null); } catch { /* The reservation is retained and subsequent requests stop. */ } }
        const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(error.code || '') ? error.code : 'TRANSPORT_UNCERTAIN';
        records.push({ method, pathname: url.pathname, status: null, requestBytes, responseBytes: null, ms: performance.now() - started, outcome: 'REQUIRES_REVIEW', errorCode: code });
        const safe = new Error('Hosted driver stopped; request outcome requires review.'); safe.code = code; throw safe;
      }
    },
    evidence() { return { proof, traffic: traffic.snapshot(), requests: structuredClone(records) }; },
  });
}
function createHostedDriver({ plan, binding, approval, env, readProfile }) {
  [plan, binding, approval, env] = structuredClone([plan, binding, approval, env]);
  const { appOrigin } = assertExecution(plan, binding, approval, env);
  requireGate(typeof readProfile === 'function', 'LIVE_PROFILE_REQUIRED');
  const profile = structuredClone(readProfile());
  const assessment = assessProfile(profile);
  requireGate(!assessment.blockers.length, 'HOSTED_PROFILE_BLOCKED');
  requireGate(profile.budget.appHttpCapBytes > 0 && profile.budget.appHttpCapBytes <= profile.budget.campaignCapBytes, 'APP_TRAFFIC_ALLOCATION');
  return transport({ appOrigin, token: env.STOCK_STAGING_AUTH_TOKEN, budget: { capBytes: profile.budget.appHttpCapBytes, responseMaximumBytes: profile.budget.responseMaximumBytes }, proof: 'HOSTED_REQUESTS_ONLY_NOT_ACCEPTANCE', beforeDispatch() {
    assertExecution(plan, binding, approval, env);
    requireGate(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'PROCESS_TLS_OVERRIDE');
    const current = readProfile();
    requireGate(!assessProfile(current).blockers.length && current.budget.appHttpCapBytes === profile.budget.appHttpCapBytes && current.budget.responseMaximumBytes === profile.budget.responseMaximumBytes, 'LIVE_PROFILE_BLOCKED');
  } });
}
function createOfflineDriver({ appOrigin, token, budget }) {
  const url = new URL(appOrigin);
  requireGate(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash && typeof token === 'string' && token.startsWith('WT_') && token.length >= 32, 'OFFLINE_LOOPBACK_ONLY');
  return transport({ appOrigin: url.origin, token, budget, proof: 'OFFLINE_SYNTHETIC_ONLY' });
}
module.exports = { createHostedDriver, createOfflineDriver };
