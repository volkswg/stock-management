/* eslint-disable @typescript-eslint/no-require-imports -- Shared guarded private browser transport; no raw request logs. */
const { PNG } = require('./runtime.cjs');
async function browserContext(browser, viewport, intercept) {
        const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
        let closing = false, interceptionFailed = false, budgetStopped = false;
        const close = context.close.bind(context);
        context.close = async (...args) => {
            closing = true;
            await close(...args);
            if (interceptionFailed) { const error = new Error('Local browser interception failed; see sanitized route witness.'); if (budgetStopped) error.code = 'WT_BUDGET'; throw error; }
        };
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            try {
            if (url.origin !== this.config.origin) return await (request.resourceType() === 'image' ? route.fulfill({ body: PNG, contentType: 'image/png' }) : route.abort());
            if (url.pathname.startsWith('/__wt/images/')) return await route.fulfill({ body: PNG, contentType: 'image/png' });
            if (url.pathname.startsWith('/api/')) {
                await this.beforeRequest?.();
                const response = await route.fetch({ headers: { ...request.headers(), authorization: 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN }, maxRedirects: 0 });
                if (await intercept?.({ request, response, url, route })) return;
                return await route.fulfill({ response });
            }
            return await route.continue();
            } catch (error) {
                // Context shutdown cancels outstanding fetches. Never propagate
                // Playwright's raw request log, which contains the private token.
                if (!closing) {
                    interceptionFailed = true; budgetStopped ||= error.code === 'WT_BUDGET';
                    this.save('browser-route-failure.json', { method: request.method(), path: url.pathname, unexpectedInterceptionFailure: true, ...(budgetStopped ? { budgetStopped: true } : {}) });
                }
                try { await route.abort('failed'); } catch { /* Already closed. */ }
            }
        });
        return context;
    }
module.exports = { browserContext };
