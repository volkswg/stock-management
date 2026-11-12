/* eslint-disable @typescript-eslint/no-require-imports -- Actual HTTP upload boundaries and independent provider/file reconciliation. */
const assert = require('node:assert/strict');
const { CompletionCampaign } = require('./completion.cjs');
const { PNG } = require('./runtime.cjs');
const { sizedPng } = require('./binary-fixtures.cjs');
const { classifyUploads } = require('./provider-outcomes.cjs');
const catalog = require('../worksheets.json');
class UploadCampaign extends CompletionCampaign {
    async fileReferences() {
        const branches = Object.keys(catalog).map(table => 'SELECT business_cells::text AS payload FROM stock_operational.' + table);
        branches.push("SELECT CASE WHEN response->'value'->>'body' IS NOT NULL THEN convert_from(decode(response->'value'->>'body','base64'),'UTF8') ELSE response::text END AS payload FROM stock_operational.commands WHERE response IS NOT NULL");
        branches.push('SELECT to_jsonb(t)::text AS payload FROM stock_operational.side_effects t');
        const rows = await this.sql("WITH data AS (" + branches.join(' UNION ALL ') + ") SELECT DISTINCT match[1] AS id FROM data CROSS JOIN LATERAL regexp_matches(payload,'(WT_FILE_[0-9a-f-]{36})','g') AS match ORDER BY 1");
        return rows.map(row => row.id);
    }
    async fileGraph(label) {
        // Existing replacement contracts retain earlier files. A successful
        // committed HTTP read is independent evidence that a file had an owner;
        // record that history separately from current SQL references. A file
        // accepted for a rolled-back request has neither kind of evidence.
        const history = [...new Set(this.requests.filter(r => r.status >= 200 && r.status < 300).flatMap(r => [...r.text.matchAll(/WT_FILE_[0-9a-f-]{36}/g)].map(m => m[0])))];
        const ledger = this.ledger(), attempts = new Set(ledger.filter(e => e.kind === 'fake-provider' && e.provider === 'drive').map(e => e.attemptId));
        const driveEvents = ledger.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' || e.kind === 'fake-provider-outcome' && attempts.has(e.attemptId));
        const result = { ...classifyUploads(driveEvents, await this.fileReferences(), history), scope: 'Drive uploads and deletions; LINE outcome boundaries are independently asserted by the crash matrix' };
        this.save(label + '.json', result);
        assert.ok(result.pass, 'Accepted provider files are orphaned, uncertain, or missing; stop before capacity.');
        return result;
    }
    async uploadBoundaries() {
        const order = this.context.imageOrder.id, product = this.context.productId, movement = this.context.movement.masterId;
        const rawPath = '/api/movements/' + movement + '/items/' + movement + '_ITEM/image';
        const form = (field, bytes, type = 'image/png') => { const value = new FormData(); value.set(field, new Blob([bytes], { type }), 'WT.png'); return value; };
        const targets = [
            { id: 'order-create', limit: 10 * 1024 * 1024, method: 'POST', url: '/api/orders/with-images', valid: 201, invalid: 400, make: (bytes, type) => { const f = form('billImages', bytes, type); f.set('seller', this.prefix + '_BOUNDS'); f.append('productImages', new Blob([PNG], { type: 'image/png' }), 'WT-product.png'); return f; } },
            { id: 'order-add', limit: 10 * 1024 * 1024, method: 'POST', url: '/api/orders/' + order + '/images', valid: 201, invalid: 400, make: (bytes, type) => { const f = form('image', bytes, type); f.set('imageType', 'product'); return f; } },
            { id: 'order-replace', limit: 10 * 1024 * 1024, method: 'PATCH', url: '/api/orders/' + order + '/items/' + product + '/image', valid: 200, invalid: 400, make: (bytes, type) => form('image', bytes, type) },
            { id: 'movement-raw', limit: 20 * 1024 * 1024, method: 'PATCH', url: rawPath, valid: 200, invalid: 413, make: bytes => bytes, headers: { 'content-type': 'image/png' } },
            // A missing shipment exercises its upload validation and compensation
            // without changing a copied shipment or inventing a repeated transition.
            { id: 'shipping-bill', limit: 10 * 1024 * 1024, method: 'PATCH', url: '/api/shipments/WT_missing_upload_target', valid: 404, invalid: 400, make: (bytes, type) => { const f = form('shippingBill', bytes, type); f.set('status', 'shipping'); f.set('poNumber', 'WT_PO'); return f; } },
        ];
        const results = [];
        for (const target of targets) {
            for (const size of [0, target.limit - 1, target.limit, target.limit + 1]) {
                const bytes = size === 0 ? Buffer.alloc(0) : sizedPng(size);
                // Empty optional shipping-bill fields follow the current route's
                // omitted-file semantics and still reject the missing shipment.
                const expected = size === 0 ? target.id === 'movement-raw' ? 400 : target.id === 'shipping-bill' ? 404 : 400 : size > target.limit ? target.invalid : target.valid;
                const before = await this.seal(), revision = await this.revision();
                const response = await this.api(target.url, { method: target.method, key: this.key('size-' + target.id), body: target.make(bytes, 'image/png'), headers: target.headers, status: expected, _probe: true });
                if (expected >= 400) { assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); }
                results.push({ endpoint: target.id, bytes: size, expected, actual: response.status });
            }
            const before = await this.seal(), revision = await this.revision();
            const response = await this.api(target.url, { method: target.method, key: this.key('mime-' + target.id), body: target.make(PNG, 'text/plain'), headers: target.id === 'movement-raw' ? { 'content-type': 'text/plain' } : undefined, status: target.id === 'movement-raw' ? 415 : 400, _probe: true });
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            results.push({ endpoint: target.id, case: 'unsupported-mime', actual: response.status });
        }
        this.save('upload-boundary-matrix.json', results);
        await this.verifyOriginal();
        await this.fileGraph('upload-boundary-file-graph');
    }
    async uploadSqlRollback() {
        const movement = this.context.movement.masterId, url = '/api/movements/' + movement + '/items/' + movement + '_ITEM/image';
        const before = await this.seal(), revision = await this.revision(), start = this.ledger().length, key = this.key('upload-sql-rollback');
        this.control({ sqlBefore: { commandKey: key, match: 'UPDATE stock_operational.movement_details', remaining: 1 } });
        try {
            await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 500, _probe: true });
        } finally { this.control({}); }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        assert.equal((await this.sql('SELECT count(*)::int AS n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
        const events = this.ledger().slice(start), fault = events.filter(e => e.kind === 'injected-fault');
        assert.equal(fault.length, 1); assert.equal(fault[0].commandKey, key);
        const newUploadIds = new Set(events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'upload').map(e => e.id));
        const graph = classifyUploads(events, (await this.fileReferences()).filter(id => newUploadIds.has(id)));
        this.save('upload-sql-rollback-proof.json', { httpStatus: 500, businessAndRevisionRolledBack: true, commandRolledBack: true, exactCommandFaultHit: true, ...graph });
        await this.verifyOriginal();
        assert.ok(graph.pass, 'SQL rollback left an accepted uploaded file without a committed reference or confirmed cleanup.');
    }
    async WT_UPLOAD_BOUNDARIES() { await this.uploadBoundaries(); }
    async WT_UPLOAD_SQL_ROLLBACK() { await this.uploadSqlRollback(); }
    async WT_UPLOAD_FINALIZE_ROLLBACK() {
        const movement = this.context.movement.masterId, url = '/api/movements/' + movement + '/items/' + movement + '_ITEM/image';
        const before = await this.seal(), revision = await this.revision(), start = this.ledger().length, key = this.key('upload-finalize-rollback');
        this.control({ sqlBefore: { commandKey: key, match: "UPDATE stock_operational.commands SET state='complete'", remaining: 1 } });
        try { await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 503, _probe: true }); }
        finally { this.control({}); }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        assert.equal((await this.sql('SELECT count(*)::int AS n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
        const events = this.ledger().slice(start), uploads = new Set(events.filter(e => e.provider === 'drive' && e.operation === 'upload').map(e => e.id));
        assert.equal(events.filter(e => e.kind === 'injected-fault' && e.commandKey === key).length, 1);
        const graph = classifyUploads(events, (await this.fileReferences()).filter(id => uploads.has(id)));
        this.save('upload-finalize-rollback-proof.json', { httpStatus: 503, businessAndRevisionRolledBack: true, commandRolledBack: true, ...graph });
        await this.verifyOriginal();
        assert.ok(graph.pass, 'Command-finalization rollback left a newly accepted file without cleanup.');
    }
    async WT_UPLOAD_UNKNOWN_RETRY() {
        const target = this.context.uploadRetryTarget || { masterId: this.context.movement.masterId, itemId: this.context.movement.masterId + '_ITEM' };
        const url = '/api/movements/' + target.masterId + '/items/' + target.itemId + '/image';
        const before = await this.seal(), revision = await this.revision(), start = this.ledger().length, key = this.key('upload-unknown');
        this.control({ driveUncertain: true });
        try { await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: [500, 503], _probe: true }); }
        finally { this.control({}); }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        const retried = await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: [200, 503], _probe: true });
        const events = this.ledger().slice(start), attempts = events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'upload');
        this.save('upload-unknown-retry-proof.json', { key, url, fileId: attempts[0]?.id, uploadAttemptId: attempts[0]?.attemptId, retryStatus: retried.status, uploadAttempts: attempts.length, unknownOutcomes: events.filter(e => e.kind === 'fake-provider-outcome' && e.phase === 'uncertain').length, originalRowsUnchanged: !!(await this.verifyOriginal()) });
        assert.equal(retried.status, 503, 'An accepted upload with a lost response must require reconciliation instead of blind retry.');
        assert.equal(attempts.length, 1); assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
    }
}
module.exports = { UploadCampaign };
