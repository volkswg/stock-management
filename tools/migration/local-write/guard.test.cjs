/* eslint-disable @typescript-eslint/no-require-imports -- Test-only runtime and private-build guard. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), net = require('node:net'), http = require('node:http');
const { validate, install, FakeDrive } = require('./runtime.cjs');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-guard-')), m = {
        version: 1, approvedLocalExecution: true, hostedTestingAuthorized: false, productionCutoverAuthorized: false, providerMode: 'fake-only', databaseHost: '127.0.0.1', databasePort: 55441, databaseNames: ['wt_test'], runtimeUser: 'wt_runtime', targetIsolationId: '00000000-0000-0000-0000-000000000123', appOrigin: 'http://127.0.0.1:3147', forbiddenIsolationIds: ['160669bd-2f6f-4490-9259-bada5a1d02c4'], cluster: {
            id: 'task-owned-cluster', volume: 'task-owned-volume'
        }
    };
    const e = {
        STOCK_LOCAL_WRITE_HARNESS: 'true', STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'false', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_DATABASE_URL: 'postgresql://wt_runtime:synthetic@127.0.0.1:55441/wt_test', STOCK_TARGET_ISOLATION_ID: m.targetIsolationId, STOCK_STAGING_AUTH_TOKEN: 'synthetic-test-token-with-32-characters', STOCK_WRITE_MANIFEST: path.join(root, 'manifest.json'), STOCK_WRITE_CONTROL: path.join(root, 'control.json'), STOCK_WRITE_LEDGER: path.join(root, 'provider-ledger.jsonl')
    };
    fs.writeFileSync(e.STOCK_WRITE_MANIFEST, JSON.stringify(m), {
        mode: 0o600
    });
    e.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(e.STOCK_WRITE_MANIFEST)).digest('hex');
    fs.writeFileSync(e.STOCK_WRITE_CONTROL, '{}', {
        mode: 0o600
    });
    fs.writeFileSync(e.STOCK_WRITE_LEDGER, '', {
        mode: 0o600
    });
    return {
        root, m, e
    };
}
test('crash controls distinguish pre-commit, committed business and recorded-effect boundaries', async () => {
    const f = fixture(), previous = { ...process.env }, { Client } = require('pg'), query = Client.prototype.query, exit = process.exit;
    let restore;
    try {
        Client.prototype.query = () => Promise.resolve({ rowCount: 1, rows: [] });
        Object.assign(process.env, f.e); delete process.env.VERCEL_ENV;
        process.exit = code => { const error = new Error('WT controlled exit'); error.exitCode = code; throw error; };
        restore = install();
        for (const [control, sql, code, phase] of [
            ['exitBeforeBusinessCommit', "UPDATE stock_operational.commands SET state='complete'", 89, 'before-business-commit'],
            ['exitAfterBusinessCommit', "UPDATE stock_operational.commands SET state='complete'", 90, 'after-business-commit-before-effect'],
            ['exitAfterEffectRecorded', "UPDATE stock_operational.side_effects SET state='done'", 91, 'after-effect-recorded'],
        ]) {
            fs.writeFileSync(f.e.STOCK_WRITE_CONTROL, JSON.stringify({ [control]: { remaining: 1 } }));
            const client = new Client(); await client.query(sql);
            try { await client.query('COMMIT'); assert.fail('Missing controlled exit'); } catch (error) { assert.equal(error.exitCode, code); }
            const events = fs.readFileSync(f.e.STOCK_WRITE_LEDGER, 'utf8').trim().split('\n').map(JSON.parse);
            assert.equal(events.filter(e => e.kind === 'injected-fault' && e.phase === phase).length, 1);
        }
    } finally {
        restore?.(); Client.prototype.query = query; process.exit = exit;
        for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous);
        fs.rmSync(f.root, { recursive: true });
    }
});
test('local harness refuses remote databases, protected identities, environment leakage and unknown targets', () => {
    const f = fixture();
    try {
        assert.equal(validate(f.e, f.m).databasePort, 55441);
        for (const changed of [{
                STOCK_DATABASE_URL: 'postgres://wt_runtime:synthetic@db.orjnazrothkdgmzlsuto.supabase.co:5432/postgres'
            }, {
                STOCK_DATABASE_URL: 'postgres://wt_runtime:synthetic@127.0.0.1:55441/wrong'
            }, {
                STOCK_TARGET_ISOLATION_ID: '160669bd-2f6f-4490-9259-bada5a1d02c4'
            }, {
                VERCEL_ENV: 'production'
            }, {
                GOOGLE_OAUTH_REFRESH_TOKEN: 'must-never-enter'
            }, {
                STOCK_WRITE_LEDGER: '/tmp/not-owned-ledger'
            }, {
                STOCK_STAGING_READ_ONLY: 'true'
            }])
            assert.throws(() => validate({
                ...f.e, ...changed
            }, f.m), {
                code: 'WT_ISOLATION_DENIED'
            });
    }
    finally {
        fs.rmSync(f.root, {
            recursive: true
        });
    }
});
test('independent guard blocks fetch, SDK sockets and redirects while fake providers execute without network', async () => {
    const f = fixture(), previous = {
        ...process.env
    };
    let restore;
    try {
        Object.assign(process.env, f.e);
        delete process.env.VERCEL_ENV;
        restore = install();
        await assert.rejects(fetch('https://provider.invalid/private'), {
            code: 'WT_ISOLATION_DENIED'
        });
        assert.throws(() => net.connect({
            host: 'provider.invalid', port: 443
        }), {
            code: 'WT_ISOLATION_DENIED'
        });
        await assert.rejects(fetch('http://127.0.0.1:3147/redirect'), {
            code: 'WT_ISOLATION_DENIED'
        });
        await assert.rejects(fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST', headers: {
                authorization: 'Bearer WT_fake_line'
            }, body: JSON.stringify({
                replyToken: 'real-recipient', messages: []
            })
        }), {
            code: 'WT_ISOLATION_DENIED'
        });
        const r = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST', headers: {
                authorization: 'Bearer WT_fake_line'
            }, body: JSON.stringify({
                replyToken: 'WT_token', messages: [{
                        type: 'text', text: 'synthetic'
                    }]
            })
        });
        assert.equal(r.status, 200);
        const drive = new FakeDrive();
        const file = await drive.uploadImage({
            fileName: 'WT.png', contentType: 'image/png', bytes: Buffer.from('synthetic')
        });
        assert.match(file.id, /^WT_FILE_/);
        await assert.rejects(drive.deleteFile('original-file'), {
            code: 'WT_ISOLATION_DENIED'
        });
        const rows = fs.readFileSync(f.e.STOCK_WRITE_LEDGER, 'utf8').trim().split('\n').map(JSON.parse);
        assert.equal(rows.filter(r => r.kind === 'fake-provider').length, 2);
        assert.equal(rows.filter(r => r.kind === 'local-connection').length, 0);
    }
    finally {
        restore?.();
        process.env = previous;
        fs.rmSync(f.root, {
            recursive: true
        });
    }
});
test('guard permits only the explicit loopback transport and catches HTTP redirects without following them', async () => {
    const f = fixture(), previous = {
        ...process.env
    };
    let restore, server;
    try {
        server = http.createServer((req, res) => {
            res.writeHead(302, {
                location: 'https://provider.invalid/steal'
            });
            res.end();
        });
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        f.m.appOrigin = 'http://127.0.0.1:' + server.address().port;
        fs.writeFileSync(f.e.STOCK_WRITE_MANIFEST, JSON.stringify(f.m));
        f.e.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(f.e.STOCK_WRITE_MANIFEST)).digest('hex');
        Object.assign(process.env, f.e);
        delete process.env.VERCEL_ENV;
        restore = install();
        const result = await fetch(f.m.appOrigin, {
            redirect: 'manual'
        });
        assert.equal(result.status, 302);
        await assert.rejects(fetch(f.m.appOrigin, {
            redirect: 'error'
        }));
        assert.throws(() => net.connect({
            host: '127.0.0.1', port: 1
        }), {
            code: 'WT_ISOLATION_DENIED'
        });
    }
    finally {
        restore?.();
        process.env = previous;
        server?.closeAllConnections();
        await new Promise(r => server ? server.close(r) : r());
        fs.rmSync(f.root, {
            recursive: true
        });
    }
});
test('runtime uses the sealed provider catalog rather than shared control pages and records durable acceptance', async () => {
    const { catalogKey, classifyUploads } = require('./provider-outcomes.cjs');
    const f = fixture(), previous = { ...process.env }, urls = [1, 2].map(day => new URL('https://api.loyverse.com/v1.0/receipts?store_id=WT_A&created_at_min=2026-01-0' + day));
    let restore;
    try {
        const catalog = Object.fromEntries(urls.map((url, i) => [catalogKey('A', url), { status: 200, body: { receipts: [{ receipt_number: 'WT_' + i }], cursor: null } }]));
        const file = path.join(f.root, 'provider-catalog.json'); fs.writeFileSync(file, JSON.stringify(catalog), { mode: 0o600 });
        f.m.providerCatalog = { file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
        fs.writeFileSync(f.e.STOCK_WRITE_MANIFEST, JSON.stringify(f.m));
        f.e.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(f.e.STOCK_WRITE_MANIFEST)).digest('hex');
        Object.assign(process.env, f.e); delete process.env.VERCEL_ENV; restore = install();
        fs.writeFileSync(f.e.STOCK_WRITE_CONTROL, JSON.stringify({ salesPages: { A: [[{ receipt_number: 'WRONG_SHARED_PAGE' }]] } }));
        const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => fetch(urls[i % 2], { headers: { authorization: 'Bearer WT_fake_only_A' } }).then(r => r.json())));
        responses.forEach((r, i) => assert.equal(r.receipts[0].receipt_number, 'WT_' + (i % 2)));
        const rows = fs.readFileSync(f.e.STOCK_WRITE_LEDGER, 'utf8').trim().split('\n').map(JSON.parse);
        assert.equal(rows.filter(e => e.kind === 'fake-provider-outcome' && e.phase === 'accepted').length, 10);
        assert.equal(classifyUploads(rows, []).pass, true);
    } finally { restore?.(); process.env = previous; fs.rmSync(f.root, { recursive: true }); }
});
test('fake accepted upload with a lost response remains visible as uncertain and cannot be reported cleaned up', async () => {
    const { classifyUploads } = require('./provider-outcomes.cjs');
    const f = fixture(), previous = { ...process.env }; let restore;
    try {
        Object.assign(process.env, f.e); delete process.env.VERCEL_ENV; restore = install();
        fs.writeFileSync(f.e.STOCK_WRITE_CONTROL, JSON.stringify({ driveUncertain: true }));
        await assert.rejects(new FakeDrive().uploadImage({ contentType: 'image/png', fileName: 'WT.png', bytes: Buffer.from('WT') }));
        const rows = fs.readFileSync(f.e.STOCK_WRITE_LEDGER, 'utf8').trim().split('\n').map(JSON.parse), proof = classifyUploads(rows, []);
        assert.equal(proof.acceptedUploads, 1); assert.equal(proof.orphanIds.length, 1); assert.equal(proof.unresolvedAttempts.length, 1); assert.equal(proof.pass, false);
    } finally { restore?.(); process.env = previous; fs.rmSync(f.root, { recursive: true }); }
});
