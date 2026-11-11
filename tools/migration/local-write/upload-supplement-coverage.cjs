/* eslint-disable @typescript-eslint/no-require-imports -- Additive shipping-bill rollback proof with actual multipart HTTP and SQL. */
const assert = require('node:assert/strict');
const { LineUploadCampaign } = require('./line-upload-coverage.cjs');
const { classifyUploads } = require('./provider-outcomes.cjs');
const { PNG } = require('./runtime.cjs');
class UploadSupplementCampaign extends LineUploadCampaign {
    async WT_SHIPPING_UPLOAD_ROLLBACKS() {
        const proofs = [];
        for (let trial = 0; trial < 10; trial++) {
            const poNumber = this.key('UPLOAD_PO'), shipment = (await this.post('/api/shipments', { poNumber, carrier: 'WT Carrier' }, { status: 201, _probe: true })).body.shipment, url = '/api/shipments/' + shipment.id;
            await this.patch(url, { status: 'ready_to_ship' }, { _probe: true });
            const form = new FormData(); form.set('status', 'shipping'); form.set('poNumber', poNumber); form.set('shippingBill', new Blob([PNG], { type: 'image/png' }), 'WT_shipping.png');
            const key = this.key('shipping-upload-rollback'), before = await this.seal(), revision = await this.revision(), start = this.ledger().length;
            this.control({ sqlBefore: { commandKey: key, match: "UPDATE stock_operational.commands SET state='complete'", remaining: 1 } });
            try { await this.patch(url, form, { key, status: 503, _probe: true }); } finally { this.control({}); }
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); assert.equal((await this.get(url)).shipment.status, 'ready_to_ship');
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
            const failed = this.ledger().slice(start), uploads = failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'upload'), deletes = failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'delete');
            assert.equal(failed.filter(row => row.kind === 'injected-fault' && row.commandKey === key).length, 1); assert.equal(uploads.length, 1); assert.equal(deletes.length, 1); assert.equal(deletes[0].id, uploads[0].id);
            const ids = new Set(failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive').map(row => row.attemptId));
            assert.ok(classifyUploads(failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' || row.kind === 'fake-provider-outcome' && ids.has(row.attemptId)), []).pass);
            await this.patch(url, form, { key, _probe: true }); const after = await this.seal(), at = await this.revision(), attempts = this.ledger().filter(row => row.kind === 'fake-provider').length;
            await this.patch(url, form, { key, _probe: true }); assert.deepEqual(await this.seal(), after); assert.equal(await this.revision(), at); assert.equal(this.ledger().filter(row => row.kind === 'fake-provider').length, attempts);
            const final = (await this.get(url)).shipment; assert.equal(final.status, 'shipping'); assert.match(final.shippingBillUrl, /WT_FILE_/);
            assert.equal(this.ledger().slice(start).filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'upload').length, 2);
            proofs.push({ trial: trial + 1, fileAcceptedBeforeInjectedRollback: true, rollbackStatus: 503, priorReadyStateAndRevisionPreserved: true, failedFileCompensatedOnce: true, sameKeyRetry: 200, oneShippingTransitionAndFileReference: true, replayAddedNoProviderAttempt: true }); this.save('shipping-upload-rollback-repetitions.json', proofs);
        }
        assert.equal(proofs.length, 10); await this.verifyOriginal();
    }
}
module.exports = { UploadSupplementCampaign };
