import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCleanup } from './helpers/cleanup-source.mjs';
import { googleGraph } from './helpers/google-infrastructure.mjs';
const plain = x => JSON.parse(JSON.stringify(x));
function ids(original) { let now = 1000, calls = 0; const events = []; class Clock {
    static now() { events.push('now'); return now; }
} const { createSortableId } = evaluateCleanup('src/services/utils/createSortableId.ts', { original, globals: { Date: Clock }, imports: { 'node:crypto': { randomBytes: size => { events.push(['random', size]); return Buffer.alloc(size, ++calls === 1 ? 255 : 0); } } } }); const ids = [createSortableId(), createSortableId()]; now = 999; ids.push(createSortableId()); now = 2000; ids.push(createSortableId()); return { ids, events }; }
test('original/current sortable IDs retain monotonic sequence rollover, rollback, bytes/version and random/clock order', () => { const before = ids(true), after = ids(false); assert.deepEqual(after, before); assert.equal(after.ids.length, 4); assert.ok(after.ids.every(id => /^.{8}-.{4}-7.{3}-8.{3}-.{12}$/.test(id))); assert.ok(after.ids[1] > after.ids[0]); });
async function menu(original) { const events = [], queue = []; const { LineRichMenuClient } = evaluateCleanup('src/scripts/line-rich-menu-client.ts', { original, globals: { fetch: async (url, init) => { events.push([url, { ...init, ...(init.body instanceof Uint8Array ? { body: Array.from(init.body) } : {}) }]); return queue.shift() ?? Response.json({ richMenuId: 'M' }); } } }), c = new LineRichMenuClient('synthetic'); assert.equal(await c.createRichMenu({ name: 'menu' }), 'M'); await c.uploadRichMenuImage({ richMenuId: 'm /', image: Buffer.from('img'), contentType: 'image/png' }); await c.setDefaultRichMenu('m /'); queue.push(new Response('missing', { status: 404 }), Response.json({})); await c.upsertRichMenuAlias({ richMenuAliasId: 'a /', richMenuId: 'm' }); queue.push(new Response('quota', { status: 429 })); await assert.rejects(c.upsertRichMenuAlias({ richMenuAliasId: 'a', richMenuId: 'm' }), { message: 'LINE rich menu alias update failed: 429 quota' }); return plain(events); }
test('standalone operational LINE client keeps exact fake-fetch protocol and 404-only fallback without executing setup scripts', async () => { assert.deepEqual(await menu(false), await menu(true)); });
async function registry(original) {
    const events = [], provider = googleGraph();
    class Auth {
        constructor(config) { events.push(['auth', config]); }
    }
    class Client {
        constructor(auth, id) { events.push(['client', id]); }
        getValues(...args) { events.push(['read', ...args]); return Promise.resolve([]); }
        getValuesBatch(args) { events.push(['batch', args]); return Promise.resolve([[['state']]]); }
    }
    const auth = { GoogleServiceAccountAuth: Auth }, client = { GoogleSheetsClient: Client };
    const all = provider.load('src/externals/google/sheet/index.ts');
    const imports = { '@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth': auth, '@/infrastructure/persistence/google-sheets/client': client, '../auth/GoogleServiceAccountAuth': auth, './client': client, './const': provider.load('src/externals/google/sheet/const.ts'), './sheets': all };
    for (const [path] of [['stock-adjustments/StockAdjustmentsSheet', 'StockAdjustmentsSheet'], ['employee-advances/PayrollRecordsSheet', 'PayrollRecordsSheet'], ['expenses/RecordsSheet', 'RecordsSheet'], ['movements/MovementSheet', 'MovementSheet']])
        imports['./sheets/' + path] = provider.load('src/externals/google/sheet/sheets/' + path + '.ts');
    const C = evaluateCleanup('src/externals/google/sheet/GoogleSheetsService.ts', { original, imports }).GoogleSheetsService;
    const config = new Proxy({}, { get: (_, key) => { events.push(['config', key]); return String(key); } }), service = new C(config);
    const before = events.length;
    assert.ok(!events.some(e => e[0] === 'read'));
    await service.checkConnection();
    assert.ok(events.length > before);
    const ranges = [{ sheet: 'userState', range: 'A:H' }, { sheet: 'movementDetails', range: 'A:N' }];
    await service.readMovementRanges(ranges);
    return plain(events);
}
test('original/current aggregate constructor configuration, real worksheet ownership, health-read order and movement batch mapping remain exact', async () => { assert.deepEqual(await registry(false), await registry(true)); });
test('final ownership preserves every inverse witness, supported callable/constructor identity and runtime-only canonical composition', async () => {
    const { cleanupHistory, restoreCleanupSource } = await import('./helpers/cleanup-history.mjs'), { readFileSync } = await import('node:fs'), { createHash } = await import('node:crypto'), { ordersLineGraph } = await import('./helpers/orders-line-source.mjs');
    for (const [file, e] of Object.entries(cleanupHistory.files))
        assert.equal(createHash('sha256').update(restoreCleanupSource(file)).digest('hex'), e.sha256, file);
    for (const [file, e] of Object.entries(cleanupHistory.edits))
        assert.equal(createHash('sha256').update(restoreCleanupSource(file)).digest('hex'), e.sha256, file);
    const g = googleGraph(), C = g.load('src/composition/google-sheets/GoogleSheetsService.ts').GoogleSheetsService;
    assert.equal(g.load('src/externals/google/sheet/GoogleSheetsService.ts').GoogleSheetsService, C);
    assert.equal(g.load('src/externals/google/sheet/index.ts').GoogleSheetsService, C);
    assert.equal(C.prototype.constructor, C);
    const orders = ordersLineGraph();
    assert.equal(orders.load('src/services/orders/listOrders.ts').getOrderDetail, orders.load('src/composition/orders.ts').getOrderDetail);
    const { userStateGraph } = await import('./helpers/user-state-worksheet-graph.mjs'), graph = userStateGraph();
    for (const types of [false, true]) {
        graph.modules(types);
        const seen = new Set(), active = [];
        function visit(file) { assert.ok(!active.includes(file), [...active, file].join(' -> ')); if (seen.has(file))
            return; active.push(file); graph.deps(file, types).forEach(visit); active.pop(); seen.add(file); }
        graph.all.forEach(visit);
        for (const file of graph.all.filter(f => f.startsWith('src/infrastructure/') || f.startsWith('src/shared/')))
            assert.equal(graph.trace(file, types, p => p.startsWith('src/modules/') || p.startsWith('src/composition/')), null, file);
        for (const file of graph.all.filter(f => /^src\/modules\/[^/]+\/(application|domain)\//.test(f)))
            assert.equal(graph.trace(file, types, p => /^src\/(services|externals|infrastructure|composition|config|app)\//.test(p) || /^src\/modules\/[^/]+\/(?:server\.ts|infrastructure\/)/.test(p)), null, file);
        for (const root of graph.all.filter(f => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8'))))
            assert.equal(graph.trace(root, types, p => /^src\/(services|externals|infrastructure|composition|config)\//.test(p) || /^src\/modules\/[^/]+\/(application|infrastructure|server\.ts)/.test(p)), null, root);
    }
    for (const root of graph.all.filter(f => f.startsWith('src/app/') && f.endsWith('/route.ts')))
        assert.equal(graph.trace(root, false, p => p.startsWith('src/services/') || p.startsWith('src/externals/') || p.startsWith('src/features/backend/')), null, root);
});
test('final independent lint guards retain earlier scopes and reject active legacy imports or physical business code in compatibility paths', async () => {
    const { ESLint } = await import('eslint'), eslint = new ESLint();
    for (const [filePath, code] of [
        ['src/app/api/orders/route.ts', 'export {createOrder} from "@/services/orders";'],
        ['src/app/api/orders/route.ts', 'import {GoogleSheetsService} from "@/externals/google/sheet";export {GoogleSheetsService};'],
        ['src/config/index.ts', 'export {isRecord} from "@/features/backend/shared/utils";'],
        ['src/services/orders/createOrder.ts', 'export function createOrder(){return 1;}'],
        ['src/services/orders/createOrder.ts', 'export class Duplicate {}'],
        ['src/services/line/events.ts', 'export * from "@/modules/line-workflows/server";'],
        ['src/modules/orders/application/create-order.ts', 'import type {GoogleSheetsService} from "@/composition/google-sheets";export type T=GoogleSheetsService;'],
        ['src/modules/orders/application/create-order.ts', 'export const x=Date.now();'],
        ['src/modules/hr/domain/compensation.ts', 'export const x=Date.now();'],
        ['src/modules/line-workflows/application/webhook.ts', 'export const x=import("@/config");'],
    ]) {
        const [r] = await eslint.lintText(code, { filePath });
        assert.ok(r.errorCount > 0, filePath + code);
    }
});
