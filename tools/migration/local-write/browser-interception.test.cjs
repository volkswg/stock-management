/* eslint-disable @typescript-eslint/no-require-imports -- Test the actual browser interception boundary without a browser, database or providers. */
const test = require('node:test'), assert = require('node:assert/strict');
require('../../../tests/helpers/postgres-runtime.cjs');
const { BrowserCampaign } = require('./browser-coverage.cjs');
function fixture(close = async () => {}) {
    let handler;
    const saved = [], context = { close, route: async (_, callback) => { handler = callback; } };
    const campaign = { config: { origin: 'http://127.0.0.1:3150' }, env: { STOCK_STAGING_AUTH_TOKEN: 'PRIVATE_TEST_SENTINEL' }, save: (...args) => saved.push(args) };
    const route = { request: () => ({ url: () => 'http://127.0.0.1:3150/api/orders?private=sentinel', method: () => 'GET', headers: () => ({}) }), fetch: async () => { throw Error('Bearer PRIVATE_TEST_SENTINEL'); }, abort: async () => {} };
    return { saved, context, campaign, route, browser: { newContext: async () => context }, handler: () => handler };
}
test('unexpected interception error is sanitized and fails the browser case at close', async () => {
    const f = fixture(); await BrowserCampaign.prototype.browserContext.call(f.campaign, f.browser, {});
    await f.handler()(f.route);
    await assert.rejects(f.context.close(), /Local browser interception failed/);
    assert.deepEqual(f.saved, [['browser-route-failure.json', { method: 'GET', path: '/api/orders', unexpectedInterceptionFailure: true }]]);
    assert.ok(!JSON.stringify(f.saved).includes('SENTINEL'));
});
test('closing context cancels in-flight routes without leaking raw errors or losing egress guards', async () => {
    let finish; const f = fixture(() => new Promise(resolve => { finish = resolve; }));
    await BrowserCampaign.prototype.browserContext.call(f.campaign, f.browser, {});
    const closing = f.context.close(); await f.handler()(f.route); finish(); await closing;
    assert.deepEqual(f.saved, []);
});

test('browser transport checks the execution guard and preserves a budget stop without sending', async () => {
    const f = fixture(); let sent = false;
    f.campaign.beforeRequest = () => { const e = Error('budget'); e.code = 'WT_BUDGET'; throw e; };
    f.route.fetch = async () => { sent = true; };
    await BrowserCampaign.prototype.browserContext.call(f.campaign, f.browser, {}); await f.handler()(f.route);
    await assert.rejects(f.context.close(), error => error.code === 'WT_BUDGET'); assert.equal(sent, false);
    assert.equal(f.saved[0][1].budgetStopped, true);
});
test('crash matrix propagates guard and HTTP assertion failures instead of claiming disconnection', async () => {
    const { CrashCampaign } = require('./crash-coverage.cjs');
    for (const failure of [Object.assign(Error('budget'), { code: 'WT_BUDGET' }), new assert.AssertionError({ message: 'Unexpected HTTP status' })]) {
        const campaign = { key: () => 'WT_case', event: () => ({}), ledger: () => [], revision: async () => 1, seal: async () => ({}), control: () => {}, line: async () => { throw failure; } };
        await assert.rejects(CrashCampaign.prototype.WT_CRASH_MATRIX.call(campaign), error => error === failure);
    }
});
test('actual Orders form helper supplies both valid PNG fixtures before submission', async () => {
    const files = [], page = { goto: async () => {}, getByPlaceholder: () => ({ fill: async () => {} }), locator: () => ({ count: async () => 2, nth: () => ({ setInputFiles: async file => files.push(file) }) }) };
    await BrowserCampaign.prototype.openOrderForm.call({ config: { origin: 'http://127.0.0.1:3150' } }, page, 'WT_form');
    assert.equal(files.length, 2);
    for (const file of files) { assert.equal(file.mimeType, 'image/png'); assert.equal(file.buffer.readUInt32BE(0), 0x89504e47); }
});
