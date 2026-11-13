/* eslint-disable @typescript-eslint/no-require-imports -- Exact-origin private browser context. No token enters browser storage or foreign requests. */
const { requireGate } = require('./policy.cjs');
const { PNG } = require('./runtime.cjs');
async function browserContext(browser, viewport, intercept) {
  requireGate(this.hostedHarnessValidated === true, 'BROWSER_BINDING_REQUIRED');
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  let failed = false, closing = false;
  const close = context.close.bind(context);
  context.close = async () => { closing = true; await close(); requireGate(!failed, 'BROWSER_INTERCEPTION_FAILED'); };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    try {
      if (url.username || url.password) return await route.abort();
      if (url.origin !== this.config.origin) return await (request.resourceType() === 'image' ? route.fulfill({ body: PNG, contentType: 'image/png' }) : route.abort());
      if (url.pathname.startsWith('/api/ha-test')) return await route.abort();
      if (url.pathname.startsWith('/__wt/images/')) {
        const id = url.pathname.split('/').pop();
        if (id === 'WT_fixture') return await route.fulfill({ body: PNG, contentType: 'image/png' });
        const file = await this.operator.call('read-file', { id }); return await route.fulfill({ body: Buffer.from(file.base64, 'base64'), contentType: file.contentType });
      }
      await this.beforeRequest?.();
      const headers = { ...request.headers() }; delete headers.authorization; delete headers.cookie;
      const access = this.env.STOCK_HA_DEPLOYMENT_ACCESS_TOKEN || this.env.VERCEL_AUTOMATION_BYPASS_SECRET; if (access) headers['x-vercel-protection-bypass'] = access;
      if (url.pathname.startsWith('/api/')) headers.authorization = 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN;
      const response = await route.fetch({ headers, maxRedirects: 0, timeout: 10000 });
      requireGate(response.status() < 300 || response.status() >= 400, 'BROWSER_REDIRECT_DENIED');
      await this.refreshLedger?.();
      if (await intercept?.({ request, response, url, route })) return;
      await route.fulfill({ response });
    } catch { if (!closing) { failed = true; this.save?.('browser-route-failure.json', { method: request.method(), failed: true }); } try { await route.abort('failed'); } catch { /* Closed context. */ } }
  });
  return context;
}
module.exports = { browserContext };
