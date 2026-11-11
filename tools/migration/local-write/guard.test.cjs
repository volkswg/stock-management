/* eslint-disable @typescript-eslint/no-require-imports -- Test-only runtime and private-build guard. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), net = require('node:net'), http = require('node:http');
const { validate, install, FakeDrive } = require('./runtime.cjs');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-guard-')), m = { version: 1, approvedLocalExecution: true, hostedTestingAuthorized: false, productionCutoverAuthorized: false, providerMode: 'fake-only', databaseHost: '127.0.0.1', databasePort: 55441, databaseNames: ['wt_test'], runtimeUser: 'wt_runtime', targetIsolationId: '00000000-0000-0000-0000-000000000123', appOrigin: 'http://127.0.0.1:3147', forbiddenIsolationIds: ['160669bd-2f6f-4490-9259-bada5a1d02c4'], cluster: { id: 'task-owned-cluster', volume: 'task-owned-volume' } };
    const e = { STOCK_LOCAL_WRITE_HARNESS: 'true', STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'false', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_DATABASE_URL: 'postgresql://wt_runtime:synthetic@127.0.0.1:55441/wt_test', STOCK_TARGET_ISOLATION_ID: m.targetIsolationId, STOCK_STAGING_AUTH_TOKEN: 'synthetic-test-token-with-32-characters', STOCK_WRITE_MANIFEST: path.join(root, 'manifest.json'), STOCK_WRITE_CONTROL: path.join(root, 'control.json'), STOCK_WRITE_LEDGER: path.join(root, 'provider-ledger.jsonl') };
    fs.writeFileSync(e.STOCK_WRITE_MANIFEST, JSON.stringify(m), { mode: 0o600 });
    e.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(e.STOCK_WRITE_MANIFEST)).digest('hex');
    fs.writeFileSync(e.STOCK_WRITE_CONTROL, '{}', { mode: 0o600 });
    fs.writeFileSync(e.STOCK_WRITE_LEDGER, '', { mode: 0o600 });
    return { root, m, e };
}
test('local harness refuses remote databases, protected identities, environment leakage and unknown targets', () => { const f = fixture(); try {
    assert.equal(validate(f.e, f.m).databasePort, 55441);
    for (const changed of [{ STOCK_DATABASE_URL: 'postgres://wt_runtime:synthetic@db.orjnazrothkdgmzlsuto.supabase.co:5432/postgres' }, { STOCK_DATABASE_URL: 'postgres://wt_runtime:synthetic@127.0.0.1:55441/wrong' }, { STOCK_TARGET_ISOLATION_ID: '160669bd-2f6f-4490-9259-bada5a1d02c4' }, { VERCEL_ENV: 'production' }, { GOOGLE_OAUTH_REFRESH_TOKEN: 'must-never-enter' }, { STOCK_WRITE_LEDGER: '/tmp/not-owned-ledger' }, { STOCK_STAGING_READ_ONLY: 'true' }])
        assert.throws(() => validate({ ...f.e, ...changed }, f.m), { code: 'WT_ISOLATION_DENIED' });
}
finally {
    fs.rmSync(f.root, { recursive: true });
} });
test('independent guard blocks fetch, SDK sockets and redirects while fake providers execute without network', async () => {
    const f = fixture(), previous = { ...process.env };
    let restore;
    try {
        Object.assign(process.env, f.e);
        delete process.env.VERCEL_ENV;
        restore = install();
        await assert.rejects(fetch('https://provider.invalid/private'), { code: 'WT_ISOLATION_DENIED' });
        assert.throws(() => net.connect({ host: 'provider.invalid', port: 443 }), { code: 'WT_ISOLATION_DENIED' });
        await assert.rejects(fetch('http://127.0.0.1:3147/redirect'), { code: 'WT_ISOLATION_DENIED' });
        await assert.rejects(fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: { authorization: 'Bearer WT_fake_line' }, body: JSON.stringify({ replyToken: 'real-recipient', messages: [] }) }), { code: 'WT_ISOLATION_DENIED' });
        const r = await fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: { authorization: 'Bearer WT_fake_line' }, body: JSON.stringify({ replyToken: 'WT_token', messages: [{ type: 'text', text: 'synthetic' }] }) });
        assert.equal(r.status, 200);
        const drive = new FakeDrive();
        const file = await drive.uploadImage({ fileName: 'WT.png', contentType: 'image/png', bytes: Buffer.from('synthetic') });
        assert.match(file.id, /^WT_FILE_/);
        await assert.rejects(drive.deleteFile('original-file'), { code: 'WT_ISOLATION_DENIED' });
        const rows = fs.readFileSync(f.e.STOCK_WRITE_LEDGER, 'utf8').trim().split('\n').map(JSON.parse);
        assert.equal(rows.filter(r => r.kind === 'fake-provider').length, 2);
        assert.equal(rows.filter(r => r.kind === 'local-connection').length, 0);
    }
    finally {
        restore?.();
        process.env = previous;
        fs.rmSync(f.root, { recursive: true });
    }
});
test('guard permits only the explicit loopback transport and catches HTTP redirects without following them', async () => { const f = fixture(), previous = { ...process.env }; let restore, server; try {
    server = http.createServer((req, res) => { res.writeHead(302, { location: 'https://provider.invalid/steal' }); res.end(); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    f.m.appOrigin = 'http://127.0.0.1:' + server.address().port;
    fs.writeFileSync(f.e.STOCK_WRITE_MANIFEST, JSON.stringify(f.m));
    f.e.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(f.e.STOCK_WRITE_MANIFEST)).digest('hex');
    Object.assign(process.env, f.e);
    delete process.env.VERCEL_ENV;
    restore = install();
    const result = await fetch(f.m.appOrigin, { redirect: 'manual' });
    assert.equal(result.status, 302);
    await assert.rejects(fetch(f.m.appOrigin, { redirect: 'error' }));
    assert.throws(() => net.connect({ host: '127.0.0.1', port: 1 }), { code: 'WT_ISOLATION_DENIED' });
}
finally {
    restore?.();
    process.env = previous;
    server?.closeAllConnections();
    await new Promise(r => server ? server.close(r) : r());
    fs.rmSync(f.root, { recursive: true });
} });
