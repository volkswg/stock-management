/* eslint-disable @typescript-eslint/no-require-imports -- Additive signed LINE image rollback/retry coverage on the same isolated checkpoints. */
const assert = require('node:assert/strict');
const { StrictCampaign } = require('./strict-coverage.cjs');
const { classifyUploads } = require('./provider-outcomes.cjs');
class LineUploadCampaign extends StrictCampaign {
    async WT_LINE_UPLOAD_ROLLBACKS() {
        const proofs = [];
        for (const type of ['order-bill', 'order-product', 'movement-quantity_photo', 'movement-photo_only']) {
            const mode = type === 'movement-photo_only' ? 'photo_only' : 'quantity_photo';
            if (mode !== (this.env.MOVEMENT_CREATE_MODE || 'quantity_photo')) await this.restartMode(mode);
            for (let trial = 0; trial < 10; trial++) {
                const user = 'WT_LINE_UPLOAD_' + this.key(type), events = [];
                const send = async (label, text, image = false) => { const event = this.event(user, label, text, image); events.push(event); return this.line([event]); };
                if (type.startsWith('order')) {
                    await send('create', 'create:order');
                    if (type === 'order-product') { await send('bill', '', true); await send('bill-complete', 'order:bill:complete'); }
                } else {
                    await send('menu', 'create:movement'); await send('new', 'create:new-movement'); await send('shop', 'NJ');
                    if (mode === 'quantity_photo') await send('quantity', '3 WT rollback');
                }
                const image = this.event(user, 'rollback-photo', '', true), before = await this.seal(), revision = await this.revision(), start = this.ledger().length;
                const table = type === 'order-bill' ? 'order_bills' : type === 'order-product' ? 'order_items' : 'movement_details';
                this.control({ sqlBefore: { commandKey: image.webhookEventId, match: 'INSERT INTO stock_operational.' + table, remaining: 1 } });
                try { await this.line([image], 503); } finally { this.control({}); }
                assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
                assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [image.webhookEventId]))[0].n, 0);
                const failed = this.ledger().slice(start), uploads = failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'upload'), deletes = failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'delete');
                assert.equal(failed.filter(row => row.kind === 'injected-fault' && row.commandKey === image.webhookEventId).length, 1); assert.equal(uploads.length, 1); assert.equal(deletes.length, 1); assert.equal(deletes[0].id, uploads[0].id);
                const driveIds = new Set(failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive').map(row => row.attemptId));
                assert.ok(classifyUploads(failed.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' || row.kind === 'fake-provider-outcome' && driveIds.has(row.attemptId)), []).pass);
                assert.equal(failed.filter(row => row.kind === 'fake-provider' && row.provider === 'line' && row.operation === 'reply').length, 0);
                await this.line([image]); const after = await this.seal(), afterRevision = await this.revision(), providerCount = this.ledger().filter(row => row.kind === 'fake-provider').length;
                await this.line([{ ...image, replyToken: 'WT_sql_retry_' + image.webhookEventId, deliveryContext: { isRedelivery: true } }]);
                assert.deepEqual(await this.seal(), after); assert.equal(await this.revision(), afterRevision); assert.equal(this.ledger().filter(row => row.kind === 'fake-provider').length, providerCount);
                const all = this.ledger().slice(start), attempts = all.filter(row => row.kind === 'fake-provider' && row.provider === 'drive' && row.operation === 'upload'); assert.equal(attempts.length, 2);
                assert.equal(all.filter(row => row.kind === 'fake-provider' && row.provider === 'line' && row.operation === 'reply').length, 1);
                assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1 AND state=\'complete\'', [image.webhookEventId]))[0].n, 1);
                if (type.startsWith('order')) assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.' + table + ' WHERE "createdBy"=$1 AND archived_at IS NULL', [user]))[0].n, 1);
                else {
                    const state = (await this.sql('SELECT "referenceId" FROM stock_operational.user_state WHERE "userId"=$1 AND archived_at IS NULL ORDER BY row_order DESC LIMIT 1', [user]))[0];
                    const details = await this.sql('SELECT quantity FROM stock_operational.movement_details WHERE "movementMasterId"=$1 AND archived_at IS NULL', [state.referenceId]); assert.equal(details.length, 1);
                    if (mode === 'photo_only') assert.equal(details[0].quantity, null); else assert.equal(Number(details[0].quantity), 3);
                }
                const refs = new Set(await this.fileReferences()); assert.ok(!refs.has(uploads[0].id)); assert.ok(refs.has(attempts[1].id));
                proofs.push({ type, trial: trial + 1, failedStatus: 503, faultAfterUploadBeforeBusinessCommit: true, failedCommandAndBusinessRolledBack: true, failedUploadCompensatedOnce: true, retrySameEvent: 200, completedImageCommands: 1, acceptedUploadsIncludingCompensatedFirst: 2, repliesAfterSuccessfulRetry: 1, redeliveryAddedNoProviderAttempt: true }); this.save('line-upload-rollback-repetitions.json', proofs);
            }
        }
        await this.restartMode('quantity_photo'); assert.equal(proofs.length, 40); await this.verifyOriginal();
    }
}
module.exports = { LineUploadCampaign };
