/* eslint-disable @typescript-eslint/no-require-imports -- Original WT13 case, using the hosted exact-byte browser adapter. */
const assert=require('node:assert/strict'),path=require('node:path');
const {PNG}=require('./runtime.cjs');
async function WT13() {
        const { chromium } = require(process.env.STOCK_PLAYWRIGHT_MODULE || 'playwright');
        const browser = await chromium.launch({
            executablePath: process.env.STOCK_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true
        });
        try {
            let lost = false, key, committed;
            const context = await this.browserContext(browser, { width: 390, height: 844 }, async ({ request, response, url, route }) => {
                if (request.method() === 'POST' && url.pathname === '/api/orders/with-images' && !lost) {
                    key = request.headers()['idempotency-key']; committed = await response.json();
                    assert.equal(response.status(), 201); lost = true; await route.abort('failed'); return true;
                }
                return false;
            });
            const page = await context.newPage();
            const fill = async () => {
                await page.getByPlaceholder('Seller', {
                    exact: true
                }).fill(this.prefix + '_UI');
                await page.getByPlaceholder('0.00').fill('25.25');
                const inputs = page.locator('input[type=file]');
                assert.equal(await inputs.count(), 2);
                await inputs.nth(0).setInputFiles({
                    name: 'WT_bill.png', mimeType: 'image/png', buffer: PNG
                });
                await inputs.nth(1).setInputFiles({
                    name: 'WT_product.png', mimeType: 'image/png', buffer: PNG
                });
            };
            await page.goto(this.config.origin + '/orders/create', {
                waitUntil: 'networkidle'
            });
            await fill();
            await page.locator('button[type=submit]').click();
            const deadline=Date.now()+30000;
            while(!lost&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
            assert.ok(lost && key && committed?.order?.id);
            const values = await page.evaluate(() => ({
                local: {
                    ...localStorage
                }, session: {
                    ...sessionStorage
                }
            }));
            assert.ok(!JSON.stringify(values).includes(this.env.STOCK_STAGING_AUTH_TOKEN));
            this.save('browser-pending-state.json', values);
            await page.screenshot({
                path: path.join(this.out, 'WT13-mobile-response-loss.png'), fullPage: true
            });
            await page.reload({
                waitUntil: 'networkidle'
            });
            await fill();
            await page.locator('button[type=submit]').click();
            await page.waitForURL('**/orders/' + committed.order.id);
            await page.screenshot({
                path: path.join(this.out, 'WT13-mobile-replayed-order.png'), fullPage: true
            });
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 1);
            await context.close();
            this.blocked.push({
                id: 'WT13', variant: 'Ten browser loss/restart/double-click/new-intent trials', reason: 'One mobile reload/reselection response-loss trial implemented; remaining browser repetitions are not certified.'
            });
        }
        finally {
            await browser.close();
        }
}
module.exports={WT13};
