/* eslint-disable @typescript-eslint/no-require-imports -- Actual desktop/mobile UI and pending raw-image requests; fake providers only. */
const assert = require('node:assert/strict'), path = require('node:path');
const { CrashCampaign } = require('./crash-coverage.cjs');
const { PNG } = require('./runtime.cjs');
const { collisionPngPair } = require('./binary-fixtures.cjs');
class BrowserCampaign extends CrashCampaign {
    async browserContext(browser, viewport, intercept) {
        const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
        let closing = false, interceptionFailed = false;
        const close = context.close.bind(context);
        context.close = async (...args) => {
            closing = true;
            await close(...args);
            if (interceptionFailed) throw new Error('Local browser interception failed; see sanitized route witness.');
        };
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            try {
            if (url.origin !== this.config.origin) return await (request.resourceType() === 'image' ? route.fulfill({ body: PNG, contentType: 'image/png' }) : route.abort());
            if (url.pathname.startsWith('/__wt/images/')) return await route.fulfill({ body: PNG, contentType: 'image/png' });
            if (url.pathname.startsWith('/api/')) {
                const response = await route.fetch({ headers: { ...request.headers(), authorization: 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN }, maxRedirects: 0 });
                if (await intercept?.({ request, response, url, route })) return;
                return await route.fulfill({ response });
            }
            return await route.continue();
            } catch {
                // Context shutdown cancels outstanding fetches. Never propagate
                // Playwright's raw request log, which contains the private token.
                if (!closing) {
                    interceptionFailed = true;
                    this.save('browser-route-failure.json', { method: request.method(), path: url.pathname, unexpectedInterceptionFailure: true });
                }
                try { await route.abort('failed'); } catch { /* Already closed. */ }
            }
        });
        return context;
    }
    async assertBrowserStorage(page) {
        const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
        assert.ok(!stored.includes(this.env.STOCK_STAGING_AUTH_TOKEN)); return JSON.parse(stored);
    }
    async openOrderForm(page, seller) {
        await page.goto(this.config.origin + '/orders/create', { waitUntil: 'networkidle' });
        await page.getByPlaceholder('Seller', { exact: true }).fill(seller); await page.getByPlaceholder('0.00').fill('25.25');
        const inputs = page.locator('input[type=file]'); assert.equal(await inputs.count(), 2);
        await inputs.nth(0).setInputFiles({ name: 'WT_bill.png', mimeType: 'image/png', buffer: PNG });
        await inputs.nth(1).setInputFiles({ name: 'WT_product.png', mimeType: 'image/png', buffer: PNG });
    }
    async waitUntil(check, label) {
        const deadline = Date.now() + 30000;
        while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
        assert.ok(check(), label);
    }
    async WT_BROWSER_MATRIX() {
        const { chromium } = require(process.env.STOCK_PLAYWRIGHT_MODULE || 'playwright');
        const browser = await chromium.launch({ executablePath: process.env.STOCK_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
        const results = [];
        try {
            for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
                for (const boundary of ['response-loss-reload', 'commit-ack-loss', 'process-restart', 'double-click']) for (let trial = 0; trial < 10; trial++) {
                    const seller = this.key('UI_' + device + '_' + boundary), calls = []; let injected = false, injectionComplete = false, originalKey, originalOrder;
                    const context = await this.browserContext(browser, viewport, async ({ request, response, url, route }) => {
                        if (request.method() !== 'POST' || url.pathname !== '/api/orders/with-images') return false;
                        calls.push({ key: request.headers()['idempotency-key'], status: response.status() });
                        if (injected || boundary === 'double-click') return false;
                        injected = true; originalKey = request.headers()['idempotency-key'];
                        if (boundary === 'commit-ack-loss') { assert.equal(response.status(), 503); injectionComplete = true; return false; }
                        assert.equal(response.status(), 201); originalOrder = (await response.json()).order.id;
                        if (boundary === 'process-restart') await this.restartMode('quantity_photo');
                        await route.abort('failed'); injectionComplete = true; return true;
                    });
                    try {
                        const page = await context.newPage(); await this.openOrderForm(page, seller);
                        if (boundary === 'commit-ack-loss') this.control({ loseCommitAck: { remaining: 1 } });
                        if (boundary === 'double-click') await page.locator('button[type=submit]').evaluate(button => { button.click(); button.click(); });
                        else await page.locator('button[type=submit]').click();
                        if (boundary !== 'double-click') {
                            await this.waitUntil(() => injected && injectionComplete, 'Browser failure was not completed');
                            if (boundary === 'process-restart') await this.waitUntil(() => calls.length > 0 && originalOrder, 'Restart boundary did not capture committed order');
                            this.control({}); await this.assertBrowserStorage(page);
                            // Reload and file reselection use the original pending operation.
                            await this.openOrderForm(page, seller); await page.locator('button[type=submit]').click();
                        }
                        await page.waitForURL(url => url.pathname.startsWith('/orders/') && url.pathname !== '/orders/create');
                        if (boundary === 'double-click') originalKey = calls[0].key;
                        const stored = (await this.sql('SELECT response FROM stock_operational.commands WHERE key=$1 AND state=\'complete\'', [originalKey]));
                        assert.equal(stored.length, 1);
                        const body = JSON.parse(Buffer.from(stored[0].response.value.body, 'base64').toString('utf8'));
                        originalOrder ||= body.order.id; assert.ok(page.url().endsWith('/orders/' + originalOrder));
                        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', [seller]))[0].n, 1);
                        assert.ok(calls.every(call => call.key === originalKey));
                        // An explicitly new, identical action must not be trapped in replay.
                        await this.openOrderForm(page, seller); await page.locator('button[type=submit]').click(); await page.waitForURL(url => url.pathname.startsWith('/orders/') && url.pathname !== '/orders/create');
                        assert.notEqual(calls.at(-1).key, originalKey); assert.ok(!page.url().endsWith('/orders/' + originalOrder));
                        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE seller=$1', [seller]))[0].n, 2);
                        await this.assertBrowserStorage(page);
                        if (trial === 0) await page.screenshot({ path: path.join(this.out, 'browser-' + device + '-' + boundary + '.png'), fullPage: true });
                        results.push({ device, boundary, trial: trial + 1, oneOriginalCommand: true, pendingKeyPreserved: true, intentionalIdenticalActionNewKey: true, actualUi: 'Orders create with two image inputs' });
                        this.save('browser-matrix.json', results);
                    } finally { this.control({}); await context.close(); }
                }
                // A distinct actual page exercises the shared key transport for
                // JSON writes, not only the multipart Orders form.
                for (let trial = 0; trial < 10; trial++) {
                    const name = this.key('UI_CATEGORY_' + device), calls = []; let lost = false;
                    const context = await this.browserContext(browser, viewport, async ({ request, response, url, route }) => {
                        if (request.method() !== 'POST' || url.pathname !== '/api/expenses/masters/categories') return false;
                        calls.push(request.headers()['idempotency-key']); assert.equal(response.status(), 200);
                        if (!lost) { lost = true; await route.abort('failed'); return true; } return false;
                    });
                    try {
                        const page = await context.newPage();
                        const fill = async () => { await page.goto(this.config.origin + '/expenses/categories', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'Add category', exact: true }).click(); await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(name); };
                        await fill(); await page.getByRole('button', { name: 'Save category', exact: true }).click();
                        await this.waitUntil(() => lost, 'Category response was not lost'); await fill(); await page.getByRole('button', { name: 'Save category', exact: true }).click();
                        await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(calls.length, 2); assert.equal(calls[0], calls[1]);
                        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.expense_categories WHERE name=$1', [name]))[0].n, 1);
                        await this.assertBrowserStorage(page); results.push({ device, boundary: 'category-response-loss-reload', trial: trial + 1, exactlyOneCategory: true, pendingKeyPreserved: true, actualUi: 'Expense category modal' }); this.save('browser-matrix.json', results);
                    } finally { await context.close(); }
                }
            }
            assert.equal(results.length, 100); await this.verifyOriginal();
        } finally { await browser.close(); }
    }
    async WT_BROWSER_RAW_BYTES() {
        const { chromium } = require(process.env.STOCK_PLAYWRIGHT_MODULE || 'playwright'), [first, changed] = collisionPngPair();
        const browser = await chromium.launch({ executablePath: process.env.STOCK_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), results = [];
        try {
            for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) for (let trial = 0; trial < 10; trial++) {
                const id = await this.seedMovement(), url = '/api/movements/' + id + '/items/' + id + '_ITEM/image', calls = []; let lost = false;
                const context = await this.browserContext(browser, viewport, async ({ request, response, url: requested, route }) => {
                    if (request.method() !== 'PATCH' || requested.pathname !== url) return false;
                    calls.push({ key: request.headers()['idempotency-key'], status: response.status() });
                    if (!lost) { assert.equal(response.status(), 200); lost = true; await route.abort('failed'); return true; } return false;
                });
                try {
                    const page = await context.newPage(); await page.goto(this.config.origin + '/orders/create', { waitUntil: 'networkidle' });
                    const upload = (bytes, type) => page.evaluate(async ({ url, bytes, type }) => { try { const response = await fetch(url, { method: 'PATCH', headers: { 'content-type': type }, body: new Uint8Array(bytes) }); return { status: response.status, body: await response.json() }; } catch { return { connectionLost: true }; } }, { url, bytes: [...bytes], type });
                    assert.equal((await upload(first, 'image/png')).connectionLost, true);
                    await page.reload({ waitUntil: 'networkidle' });
                    await page.evaluate(async url => { await (await fetch(url)).json(); }, '/api/movements/' + id);
                    assert.equal((await upload(changed, 'image/png')).status, 200); assert.notEqual(calls[0].key, calls[1].key);
                    assert.equal((await upload(first, 'image/png')).status, 200); assert.equal(calls[0].key, calls[2].key);
                    await page.evaluate(async url => { await (await fetch(url)).json(); }, '/api/movements/' + id);
                    assert.equal((await upload(first, 'image/webp')).status, 200); assert.notEqual(calls[0].key, calls[3].key);
                    await this.assertBrowserStorage(page); results.push({ device, trial: trial + 1, changedBytesNewKey: true, oldBytesReplayOriginalKey: true, changedMediaTypeNewKey: true, responseLossAndReload: true }); this.save('browser-raw-byte-matrix.json', results);
                } finally { await context.close(); }
            }
            assert.equal(results.length, 20); await this.verifyOriginal();
        } finally { await browser.close(); }
    }
}
module.exports = { BrowserCampaign };
