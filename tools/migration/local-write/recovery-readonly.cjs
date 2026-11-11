/* eslint-disable @typescript-eslint/no-require-imports -- Local recovery-only preload; never loaded by production or writable campaigns. */
const fs = require('node:fs'), crypto = require('node:crypto'), net = require('node:net');
const { validate } = require('./runtime.cjs');
const OPTIONS = '-c role=stock_runtime -c default_transaction_read_only=on';
function validateRecovery(env, manifest) {
    const config = validate({ ...env, STOCK_STAGING_READ_ONLY: 'false' }, manifest);
    const database = new URL(env.STOCK_DATABASE_URL).pathname.slice(1);
    if (env.STOCK_STAGING_READ_ONLY !== 'true' || env.PGOPTIONS !== OPTIONS || manifest.recoveryReadOnly !== true || !/^wt_ms_[a-z0-9_]+_restore0[12]$/.test(database) || manifest.databaseNames.length !== 1) throw new Error('Local read-only recovery configuration refused.');
    return config;
}
function installRecovery(env = process.env) {
    const raw = fs.readFileSync(env.STOCK_WRITE_MANIFEST), manifest = JSON.parse(raw);
    if (crypto.createHash('sha256').update(raw).digest('hex') !== env.STOCK_WRITE_MANIFEST_SHA256) throw new Error('Local read-only recovery manifest refused.');
    const config = validateRecovery(env, manifest), connect = net.Socket.prototype.connect, fetch = globalThis.fetch;
    const denied = () => { throw new Error('Providers and nonlocal access are disabled during recovery verification.'); };
    net.Socket.prototype.connect = function (...args) {
        let a = args[0]; if (Array.isArray(a)) a = a[0];
        const host = a && typeof a === 'object' ? a.host || a.hostname || 'localhost' : typeof args[1] === 'string' ? args[1] : 'localhost';
        const port = Number(a && typeof a === 'object' ? a.port : a);
        if (a?.path || host !== '127.0.0.1' || port !== config.databasePort) return denied();
        return connect.apply(this, args);
    };
    globalThis.fetch = denied;
    return () => { net.Socket.prototype.connect = connect; globalThis.fetch = fetch; };
}
module.exports = { OPTIONS, validateRecovery, installRecovery };
if (require.main === module) installRecovery();
