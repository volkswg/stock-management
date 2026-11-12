/* eslint-disable @typescript-eslint/no-require-imports -- Fail-closed recovery profile without connecting to a database or provider. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), net = require('node:net');
const { OPTIONS, validateRecovery, installRecovery } = require('./recovery-readonly.cjs');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-recovery-')), manifest = { version: 1, approvedLocalExecution: true, hostedTestingAuthorized: false, productionCutoverAuthorized: false, providerMode: 'fake-only', databaseHost: '127.0.0.1', databasePort: 55443, databaseNames: ['wt_ms_unit_restore01'], runtimeUser: 'wt_runtime', targetIsolationId: '00000000-0000-0000-0000-000000000123', appOrigin: 'http://127.0.0.1:3150', cluster: { id: 'local-test', volume: 'local-test' }, recoveryReadOnly: true };
    const env = { STOCK_LOCAL_WRITE_HARNESS: 'true', STOCK_STORAGE: 'supabase', STOCK_STAGING_ENABLED: 'true', STOCK_STAGING_READ_ONLY: 'true', STOCK_ALLOW_LOCAL_TEST_DATABASE: 'true', STOCK_DATABASE_URL: 'postgresql://wt_runtime:synthetic@127.0.0.1:55443/wt_ms_unit_restore01', STOCK_TARGET_ISOLATION_ID: manifest.targetIsolationId, STOCK_STAGING_AUTH_TOKEN: 'synthetic-test-token-with-32-characters', STOCK_WRITE_MANIFEST: path.join(root, 'manifest.json'), STOCK_WRITE_CONTROL: path.join(root, 'control.json'), STOCK_WRITE_LEDGER: path.join(root, 'provider-ledger.jsonl'), PGOPTIONS: OPTIONS };
    fs.writeFileSync(env.STOCK_WRITE_MANIFEST, JSON.stringify(manifest), { mode: 0o600 }); env.STOCK_WRITE_MANIFEST_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(env.STOCK_WRITE_MANIFEST)).digest('hex');
    return { root, env, manifest };
}
test('recovery requires explicit readonly app, startup role, sealed single restored target and UUID', () => {
    const f = fixture(); try {
        assert.equal(validateRecovery(f.env, f.manifest).databasePort, 55443);
        for (const change of [{ STOCK_STAGING_READ_ONLY: 'false' }, { PGOPTIONS: '' }, { VERCEL_ENV: 'production' }, { STOCK_TARGET_ISOLATION_ID: '160669bd-2f6f-4490-9259-bada5a1d02c4' }, { STOCK_DATABASE_URL: 'postgresql://wt_runtime:synthetic@source.invalid/wt_ms_unit_restore01' }]) assert.throws(() => validateRecovery({ ...f.env, ...change }, f.manifest));
        assert.throws(() => validateRecovery(f.env, { ...f.manifest, recoveryReadOnly: false }));
        assert.throws(() => validateRecovery(f.env, { ...f.manifest, databaseNames: [...f.manifest.databaseNames, 'wt_writable'] }));
    } finally { fs.rmSync(f.root, { recursive: true }); }
});
test('recovery denies provider fetches and foreign sockets and refuses manifest tampering', async () => {
    const f = fixture(); let restore;
    try {
        restore = installRecovery(f.env);
        await assert.rejects(async () => fetch('https://api.line.me/v2/bot/message/reply'), /disabled during recovery/);
        const socket = new net.Socket(); assert.throws(() => socket.connect({ host: 'source.invalid', port: 5432 }), /disabled during recovery/); socket.destroy();
        restore(); restore = undefined; fs.appendFileSync(f.env.STOCK_WRITE_MANIFEST, ' '); assert.throws(() => installRecovery(f.env), /manifest refused/);
    } finally { restore?.(); fs.rmSync(f.root, { recursive: true }); }
});
