/* eslint-disable @typescript-eslint/no-require-imports -- Explicit intent, transition, reference and provider-uncertainty matrices. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { EdgeCampaign } = require('./edge-coverage.cjs');
const { PNG } = require('./runtime.cjs');
const { collisionPngPair } = require('./binary-fixtures.cjs');
const { hashIntent } = require('../../../src/infrastructure/persistence/postgres/commands.ts');
class StrictCampaign extends EdgeCampaign {
    async WT_ALL_METHOD_BODY_INTENTS() {
        const proofs = [], [, changed] = collisionPngPair();
        for (const route of this.methodRoutes()) {
            const input = await this.scenario(route), key = this.key('body-intent');
            const first = await this.api(input.url, { ...input, key }), before = await this.seal(), revision = await this.revision(), start = this.ledger().length;
            const variants = [];
            if (input.body instanceof FormData) {
                for (const kind of ['bytes', 'mime', 'filename']) {
                    const form = new FormData(); let changedFile = false;
                    for (const [name, value] of input.body) {
                        if (typeof value === 'string') form.append(name, value);
                        else {
                            const alter = !changedFile; changedFile = true;
                            form.append(name, new Blob([alter && kind === 'bytes' ? changed : await value.arrayBuffer()], { type: alter && kind === 'mime' ? 'image/webp' : value.type }), alter && kind === 'filename' ? 'WT-renamed.png' : value.name);
                        }
                    }
                    variants.push({ id: 'multipart-' + kind, body: form });
                }
                const fields = new FormData(); for (const [name, value] of input.body) { if (typeof value === 'string') fields.append(name, value + '_changed'); else fields.append(name, value, value.name); }
                if ([...input.body.values()].some(value => typeof value === 'string')) variants.push({ id: 'multipart-field', body: fields });
            } else if (Buffer.isBuffer(input.body)) {
                variants.push({ id: 'raw-bytes', body: changed }, { id: 'raw-media-type', body: input.body, headers: { 'content-type': 'image/webp' } });
            } else if (input.body !== undefined) {
                const body = structuredClone(input.body), numbers = Object.keys(body).filter(name => typeof body[name] === 'number'), names = Object.keys(body);
                if (numbers.length) body[numbers[0]] += 1;
                else if (Array.isArray(body.items)) body.items[0].quoteQuantity = (body.items[0].quoteQuantity || 0) + 1;
                else { const name = names.find(name => typeof body[name] === 'string'); if (name) body[name] += '_changed'; else { assert.equal(names.length, 0); body.WT_changed_input = true; } }
                variants.push({ id: 'changed-json', body });
                // Canonical object-key reordering is still the same intent.
                const canonicalReplay = await this.api(input.url, { ...input, key, body: Object.fromEntries(Object.entries(input.body).reverse()) });
                assert.equal(canonicalReplay.text, first.text); assert.equal(canonicalReplay.revision, first.revision);
            } else variants.push({ id: 'previously-empty-body-changed', body: { WT_changed_input: true } });
            for (const variant of variants) await this.api(input.url, { ...input, key, body: variant.body, headers: { ...input.headers, ...variant.headers }, status: 409 });
            await this.api(input.url + '?WT_body_matrix_query=changed', { ...input, key, status: 409 });
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            assert.equal(this.ledger().slice(start).filter(e => e.kind === 'fake-provider').length, 0);
            proofs.push({ route, sameIntentReplay: true, changedBodyVariants: variants.map(v => v.id), changedQueryRejected: true, rejectedStatus: 409, noBusinessRevisionOrProviderDelta: true }); this.save('all-method-body-intents.json', proofs);
        }
        assert.equal(proofs.length, 32); this.control({}); await this.verifyOriginal();
    }
    async shipmentAt(status) {
        const poNumber = this.key('MATRIX_PO');
        if (status === 'canceled') {
            const id = this.key('MATRIX_CANCELED_SHIPMENT');
            await this.seedHistory([{ table: 'shipments', row: { id, status, poNumber, carrier: 'WT Carrier', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z', createdBy: 'WT_history' } }], id); return { id, poNumber };
        }
        const shipment = (await this.api('/api/shipments', { method: 'POST', key: this.key('matrix-create'), body: { poNumber, carrier: 'WT Carrier' }, status: 201, _probe: true })).body.shipment;
        for (const step of ['ready_to_ship', 'shipping', 'delivered'].slice(0, ['draft', 'ready_to_ship', 'shipping', 'delivered'].indexOf(status))) {
            await this.patch('/api/shipments/' + shipment.id, { status: step, poNumber, deliveryFee: 0 }, { _probe: true });
        }
        return { id: shipment.id, poNumber };
    }
    async WT_SHIPMENT_TRANSITION_MATRIX() {
        const states = ['draft', 'ready_to_ship', 'shipping', 'delivered', 'canceled'], next = { draft: 'ready_to_ship', ready_to_ship: 'shipping', shipping: 'delivered' }, proofs = [];
        for (const from of states) for (const to of states) {
            const shipment = await this.shipmentAt(from), before = await this.seal(), revision = await this.revision();
            const expected = ['draft', 'canceled'].includes(to) ? 400 : next[from] === to ? 200 : 409;
            const response = await this.patch('/api/shipments/' + shipment.id, { status: to, poNumber: shipment.poNumber, deliveryFee: 0 }, { status: expected, _probe: true });
            if (expected !== 200) { assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); }
            else { assert.equal(response.body.shipment.status, to); assert.equal((await this.get('/api/shipments/' + shipment.id)).shipment.status, to); }
            proofs.push({ from, to, expected, actual: response.status, rejectedDeltaAbsent: expected !== 200 }); this.save('shipment-transition-matrix.json', proofs);
        }
        assert.equal(proofs.length, 25); assert.equal(proofs.filter(row => row.actual === 200).length, 3); await this.verifyOriginal();
    }
    async WT_STOCK_REFERENCE_MATRIX() {
        const read = async () => (await this.get('/api/stock-counts?month=2025-05')).stockCounts;
        const counts = rows => Object.fromEntries(['WT_ACCOUNT_A', 'WT_ACCOUNT_B'].map(id => [id, rows.find(row => row.accountId === id).calculatedStock]));
        const initial = counts(await read()), body = { requestId: crypto.randomUUID(), accountId: 'WT_ACCOUNT_A', date: '2025-05-05', direction: 'out', reason: 'damage', quantity: 3, itemDescription: 'WT original', photoUrl: '', note: 'WT reference matrix', notInLoyverse: true };
        const original = (await this.post('/api/stock-adjustments', body, { status: 201, _probe: true })).body.record;
        const reject = async input => { const before = await this.seal(), revision = await this.revision(); await this.post('/api/stock-adjustments', input, { status: 400, _probe: true }); assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); };
        await reject({ ...body, requestId: crypto.randomUUID(), quantity: 1, replacesId: original.id });
        await this.patch('/api/stock-adjustments', { action: 'reverse', id: original.id, note: 'WT correction' }, { _probe: true });
        await reject({ ...body, requestId: crypto.randomUUID(), accountId: 'WT_missing_account', replacesId: original.id });
        await reject({ ...body, requestId: crypto.randomUUID(), replacesId: 'WT_missing_adjustment' });
        // The existing correction contract permits changing the destination
        // account after reversal. Verify its exact two-account stock effects.
        await this.post('/api/stock-adjustments', { ...body, requestId: crypto.randomUUID(), accountId: 'WT_ACCOUNT_B', quantity: 1, replacesId: original.id }, { status: 201, _probe: true });
        await this.post('/api/stock-adjustments', { ...body, requestId: crypto.randomUUID(), accountId: 'WT_ACCOUNT_B', direction: 'in', reason: 'employee_return', employeeId: this.context.employee.id, quantity: 2 }, { status: 201, _probe: true });
        const final = counts(await read()); assert.equal(final.WT_ACCOUNT_A, initial.WT_ACCOUNT_A); assert.equal(final.WT_ACCOUNT_B, initial.WT_ACCOUNT_B + 1);
        this.save('stock-reference-matrix.json', { missingAccountAndAdjustmentRejected: true, replacementBeforeReversalRejected: true, existingCrossAccountCorrectionRulePreserved: true, netAccountAChange: 0, netAccountBChange: 1, originalHistoryRetained: true }); await this.verifyOriginal();
    }
    async WT_UPLOAD_UNCERTAINTY_REPETITIONS() {
        const proofs = [], target = this.context.uploadRetryTarget, active = '/api/movements/' + target.masterId + '/items/' + target.itemId + '/image';
        for (const failure of ['accepted-response-lost', 'cleanup-rejected']) for (let trial = 0; trial < 10; trial++) {
            const url = failure === 'accepted-response-lost' ? active : '/api/movements/WT_missing/items/WT_missing/image', key = this.key('uncertain-' + failure), before = await this.seal(), revision = await this.revision(), start = this.ledger().length;
            this.control(failure === 'accepted-response-lost' ? { driveUncertain: true } : { driveDeleteFailure: true });
            try { await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 500, _probe: true }); } finally { this.control({}); }
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            const prefix = 'UPLOAD:' + hashIntent({ kind: 'PATCH:' + url, key }) + ':';
            assert.deepEqual((await this.sql('SELECT state FROM stock_operational.side_effects WHERE key LIKE $1', [prefix + '%'])).map(row => row.state), ['uncertain']);
            await this.restartMode('quantity_photo');
            const refused = await this.api(url, { method: 'PATCH', key, body: PNG, headers: { 'content-type': 'image/png' }, status: 503, _probe: true }); assert.match(refused.body.error, /reconciliation/);
            const events = this.ledger().slice(start), uploads = events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'upload'), deletes = events.filter(e => e.kind === 'fake-provider' && e.provider === 'drive' && e.operation === 'delete');
            assert.equal(uploads.length, 1); assert.equal(deletes.length, failure === 'cleanup-rejected' ? 1 : 0);
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
            proofs.push({ failure, trial: trial + 1, key, fileId: uploads[0].id, uploadAttemptId: uploads[0].attemptId, acceptedUploadAttempts: 1, cleanupAttempts: deletes.length, durableGuardState: 'uncertain', retryAfterProcessRestart: 503, automaticResend: false, businessAndRevisionUnchanged: true, requiresExplicitReconciliation: true }); this.save('upload-uncertainty-repetitions.json', proofs);
        }
        assert.equal(proofs.length, 20); await this.verifyOriginal();
    }
}
module.exports = { StrictCampaign };
