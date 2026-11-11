/* eslint-disable @typescript-eslint/no-require-imports -- Private isolated-build instrumentation, never imported by production source. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), net = require('node:net');
const STATE = Symbol.for('stock.localWriteHarness');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9N8AAAAASUVORK5CYII=', 'base64');
function refused() {
    const e = new Error('Local write harness refused configuration or outbound access.');
    e.code = 'WT_ISOLATION_DENIED';
    return e;
}
function digest(v) {
    return crypto.createHash('sha256').update(v).digest('hex');
}
function validate(env, manifest) {
    let u, origin;
    try {
        u = new URL(env.STOCK_DATABASE_URL);
        origin = new URL(manifest.appOrigin);
    }
    catch {
        throw refused();
    }
    const root = path.dirname(env.STOCK_WRITE_MANIFEST || '');
    if (manifest.version !== 1 || manifest.approvedLocalExecution !== true || manifest.hostedTestingAuthorized !== false || manifest.productionCutoverAuthorized !== false || manifest.providerMode !== 'fake-only' || env.STOCK_LOCAL_WRITE_HARNESS !== 'true' || env.STOCK_STORAGE !== 'supabase' || env.STOCK_STAGING_ENABLED !== 'true' || env.STOCK_STAGING_READ_ONLY !== 'false' || env.STOCK_ALLOW_LOCAL_TEST_DATABASE !== 'true' || env.VERCEL_ENV || !['postgres:', 'postgresql:'].includes(u.protocol) || u.hostname !== '127.0.0.1' || manifest.databaseHost !== '127.0.0.1' || Number(u.port) !== manifest.databasePort || !manifest.databaseNames?.includes(u.pathname.slice(1)) || u.username !== manifest.runtimeUser || !u.password || u.search || u.hash || env.STOCK_TARGET_ISOLATION_ID !== manifest.targetIsolationId || manifest.forbiddenIsolationIds?.includes(env.STOCK_TARGET_ISOLATION_ID) || env.STOCK_TARGET_ISOLATION_ID === '160669bd-2f6f-4490-9259-bada5a1d02c4' || origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.port === '' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || !manifest.cluster?.id || !manifest.cluster?.volume || !env.STOCK_STAGING_AUTH_TOKEN || env.STOCK_STAGING_AUTH_TOKEN.length < 32 || env.STOCK_WRITE_CONTROL !== path.join(root, 'control.json') || env.STOCK_WRITE_LEDGER !== path.join(root, 'provider-ledger.jsonl'))
        throw refused();
    for (const key of ['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_SHEETS_SPREADSHEET_ID'])
        if (env[key])
            throw refused();
    return {
        databasePort: Number(u.port), appPort: Number(origin.port), origin: origin.origin, root
    };
}
function install() {
    if (globalThis[STATE])
        return globalThis[STATE].restore;
    const env = process.env, raw = fs.readFileSync(env.STOCK_WRITE_MANIFEST || '');
    if (digest(raw) !== env.STOCK_WRITE_MANIFEST_SHA256)
        throw refused();
    const manifest = JSON.parse(raw), config = validate(env, manifest), originalFetch = globalThis.fetch, connect = net.Socket.prototype.connect;
    const ledger = event => fs.appendFileSync(env.STOCK_WRITE_LEDGER, JSON.stringify({
        at: new Date().toISOString(), ...event
    }) + '\n', {
        mode: 0o600
    });
    const control = () => JSON.parse(fs.readFileSync(env.STOCK_WRITE_CONTROL, 'utf8'));
    function consume(name, predicate) {
        const c = control();
        if (!c[name] || !predicate(c[name]))
            return false;
        if ((c[name].remaining ?? 1) <= 0)
            return false;
        c[name].remaining = (c[name].remaining ?? 1) - 1;
        fs.writeFileSync(env.STOCK_WRITE_CONTROL, JSON.stringify(c), {
            mode: 0o600
        });
        return c[name];
    }
    function denial(kind) {
        ledger({
            kind: 'denied', transport: kind
        });
        throw refused();
    }
    net.Socket.prototype.connect = function (...args) {
        let a = args[0];
        if (Array.isArray(a))
            a = a[0];
        let host, port;
        if (a && typeof a === 'object') {
            host = a.host || a.hostname || 'localhost';
            port = Number(a.port);
            if (a.path)
                return denial('unix');
        }
        else {
            port = Number(a);
            host = typeof args[1] === 'string' ? args[1] : 'localhost';
        }
        if (host !== '127.0.0.1' || ![config.databasePort, config.appPort].includes(port))
            return denial('socket');
        ledger({
            kind: 'local-connection', host, port
        });
        return connect.apply(this, args);
    };
    globalThis.fetch = async (input, init = {}) => {
        let url;
        try {
            url = new URL(input instanceof Request ? input.url : input);
        }
        catch {
            return denial('fetch-url');
        }
        if (url.username || url.password)
            return denial('fetch-credentials');
        if (url.origin === config.origin) {
            if (init.redirect !== 'error' && init.redirect !== 'manual')
                return denial('local-redirect-policy');
            return originalFetch(input, init);
        }
        const method = init.method || (input instanceof Request ? input.method : 'GET'), headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined)), c = control();
        if (url.protocol === 'https:' && url.hostname === 'api.loyverse.com' && url.pathname === '/v1.0/receipts' && method === 'GET') {
            const auth = headers.get('authorization');
            const account = auth === 'Bearer WT_fake_only_A' ? 'A' : auth === 'Bearer WT_fake_only_B' ? 'B' : null;
            if (!account)
                return denial('original-provider-account');
            const cursor = url.searchParams.get('cursor') || '', page = (c.salesPages?.[account] || [[]])[cursor ? Number(cursor) : 0];
            ledger({
                kind: 'fake-provider', provider: 'loyverse', operation: 'receipt-page', account, cursor
            });
            if (c.salesFailCursor === cursor)
                return new Response(JSON.stringify({
                    error: 'WT fake page failure'
                }), {
                    status: 503
                });
            if (!page)
                return new Response(JSON.stringify({
                    receipts: [], cursor: null
                }), {
                    headers: {
                        'content-type': 'application/json'
                    }
                });
            const more = (c.salesPages?.[account]?.length || 0) > ((cursor ? Number(cursor) : 0) + 1);
            return Response.json({
                receipts: page, cursor: c.salesRepeatCursor ? '1' : more ? String((cursor ? Number(cursor) : 0) + 1) : null
            });
        }
        if (url.protocol === 'https:' && url.hostname === 'api-data.line.me' && /^\/v2\/bot\/message\/WT_[A-Za-z0-9_-]+\/content$/.test(url.pathname) && method === 'GET') {
            if (headers.get('authorization') !== 'Bearer WT_fake_line')
                return denial('line-credential');
            ledger({
                kind: 'fake-provider', provider: 'line', operation: 'download'
            });
            return new Response(PNG, {
                headers: {
                    'content-type': 'image/png'
                }
            });
        }
        if (url.protocol === 'https:' && url.hostname === 'api.line.me' && ['/v2/bot/message/reply', '/v2/bot/message/push'].includes(url.pathname) && method === 'POST') {
            if (headers.get('authorization') !== 'Bearer WT_fake_line')
                return denial('line-credential');
            let payload;
            try {
                payload = JSON.parse(init.body);
            }
            catch {
                return denial('line-payload');
            }
            if (!String(payload.replyToken || payload.to || '').startsWith('WT_'))
                return denial('original-line-recipient');
            if (consume('exitBeforeFakeReply', () => true)) {
                ledger({
                    kind: 'injected-fault', phase: 'before-fake-reply'
                });
                process.exit(86);
            }
            ledger({
                kind: 'fake-provider', provider: 'line', operation: url.pathname.endsWith('/reply') ? 'reply' : 'push', recipientHash: digest(String(payload.replyToken || payload.to)), messageCount: payload.messages?.length || 0
            });
            if (consume('exitAfterFakeReply', () => true))
                process.exit(87);
            if (c.lineFailure)
                throw new Error('WT simulated uncertain reply');
            return Response.json({});
        }
        return denial('fetch');
    };
    const { Client } = require('pg'), query = Client.prototype.query, tags = new WeakMap();
    Client.prototype.query = function (...args) {
        const text = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
        if (consume('sqlBefore', f => typeof f.match === 'string' && text.includes(f.match))) {
            ledger({
                kind: 'injected-fault', phase: 'before-sql'
            });
            return Promise.reject(new Error('WT injected pre-commit failure'));
        }
        if (text.startsWith('INSERT INTO stock_operational.side_effects'))
            tags.set(this, 'effect-claim');
        if (text.startsWith('UPDATE stock_operational.commands SET state='))
            tags.set(this, 'business');
        const result = query.apply(this, args);
        if (!result?.then)
            return result;
        return result.then(value => {
            if (text === 'COMMIT') {
                const tag = tags.get(this);
                tags.delete(this);
                if (tag === 'business' && consume('loseCommitAck', () => true)) {
                    ledger({
                        kind: 'injected-fault', phase: 'committed-ack-loss'
                    });
                    throw new Error('WT injected committed acknowledgement loss');
                }
                if (tag === 'effect-claim' && consume('exitAfterEffectClaim', () => true)) {
                    ledger({
                        kind: 'injected-fault', phase: 'after-effect-claim'
                    });
                    process.exit(88);
                }
            }
            return value;
        });
    };
    const state = {
        config, manifest, ledger, control, consume, restore() {
            globalThis.fetch = originalFetch;
            net.Socket.prototype.connect = connect;
            Client.prototype.query = query;
            delete globalThis[STATE];
        }
    };
    globalThis[STATE] = state;
    state.drive = new FakeDrive();
    ledger({
        kind: 'harness-installed', database: manifest.databaseNames.find(n => new URL(env.STOCK_DATABASE_URL).pathname === '/' + n)
    });
    return state.restore;
}
class FakeDrive {
    async uploadImage(input) {
        const s = globalThis[STATE];
        if (!s)
            throw refused();
        const c = s.control();
        const id = 'WT_FILE_' + crypto.randomUUID();
        s.ledger({
            kind: 'fake-provider', provider: 'drive', operation: 'upload', id, contentType: input.contentType, bytes: input.bytes.length, contentSha256: digest(input.bytes)
        });
        if (c.driveFailure)
            throw new Error('WT simulated fake upload failure');
        return {
            id, name: input.fileName, webViewLink: s.config.origin + '/__wt/images/' + id, webContentLink: s.config.origin + '/__wt/images/' + id
        };
    }
    async deleteFile(id) {
        if (!String(id).startsWith('WT_FILE_'))
            throw refused();
        globalThis[STATE].ledger({
            kind: 'fake-provider', provider: 'drive', operation: 'delete', id
        });
    }
    async makeFileReadableByLink(id) {
        if (!String(id).startsWith('WT_FILE_'))
            throw refused();
        globalThis[STATE].ledger({
            kind: 'fake-provider', provider: 'drive', operation: 'share', id
        });
    }
    async checkConnection() {
        if (!globalThis[STATE])
            throw refused();
    }
}
module.exports = {
    install, validate, FakeDrive, PNG
};
