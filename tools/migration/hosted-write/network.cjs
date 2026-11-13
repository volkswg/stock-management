/* eslint-disable @typescript-eslint/no-require-imports -- Operator-process request confinement for inherited case code, including negative auth/key probes. */
const { requireGate } = require('./policy.cjs');
const { TrafficBudget } = require('./feasibility.cjs');
function installFetch({ origin, deploymentAccessToken, beforeRequest, afterRequest, capBytes = 1000000000, responseMaximumBytes = 4500000 }) {
  const original = globalThis.fetch, budget = new TrafficBudget({ capBytes, responseMaximumBytes }), attempts = [];
  let stopped = false;
  globalThis.fetch = async (input, options = {}) => {
    requireGate(!stopped, 'OPERATOR_STOPPED');
    const url = new URL(input instanceof Request ? input.url : input);
    requireGate(url.origin === (typeof origin === 'function' ? origin() : origin) && !url.username && !url.password && ['manual', 'error'].includes(options.redirect || (input instanceof Request ? input.redirect : 'follow')), 'OPERATOR_ORIGIN');
    await beforeRequest?.();
    let request = new Request(input, options); const access = deploymentAccessToken?.();
    if (access) { const headers = new Headers(request.headers); headers.set('x-vercel-protection-bypass', access); request = new Request(request, { headers }); }
    const size = request.body ? (await request.clone().arrayBuffer()).byteLength : 0;
    const settle = budget.reserve(size); let settled = false;
    try {
      const response = await original(request); requireGate(response.status < 300 || response.status >= 400, 'OPERATOR_REDIRECT');
      const reader = response.clone().body?.getReader(); let bytes = 0;
      if (reader) { try { for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; requireGate(bytes <= responseMaximumBytes, 'OPERATOR_RESPONSE_LIMIT'); } } catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); } }
      settled = true; settle(bytes); attempts.push({ method: request.method, status: response.status, requestBytes: size, responseBytes: bytes }); return response;
    } catch (error) { stopped = true; if (!settled) { try { settle(null); } catch { /* Retain maximum uncertain reservation. */ } } attempts.push({ method: request.method, status: null, outcome: 'uncertain' }); throw error; }
    finally { await afterRequest?.(); }
  };
  return { evidence: () => ({ attempts: structuredClone(attempts), traffic: budget.snapshot() }), resumeAfterReviewedFault(proof) { requireGate(attempts.at(-1)?.outcome === 'uncertain' && proof?.phaseVerified === true, 'NO_REVIEWABLE_FAULT'); stopped = false; budget.stopped = false; }, restore() { globalThis.fetch = original; } };
}
module.exports = { installFetch };
