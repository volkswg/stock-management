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
