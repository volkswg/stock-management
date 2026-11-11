/* eslint-disable @typescript-eslint/no-require-imports -- Guarded local completion entrypoint; never a production script. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { Campaign } = require('./campaign.cjs');
const { collisionPngPair } = require('./binary-fixtures.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
class CompletionCampaign extends Campaign {
    async rawBinaryIntent() {
        const [firstBytes, changedBytes] = collisionPngPair();
        const movement = this.context.movement, route = '/api/movements/' + movement.masterId + '/items/' + movement.masterId + '_ITEM/image';
        const key = this.key('binary-intent'), headers = { 'content-type': 'image/png' };
        const first = await this.api(route, { method: 'PATCH', key, headers, body: firstBytes, _probe: true });
        const revision = await this.revision(), business = await this.seal(), ledgerCount = this.ledger().length;
        const same = await this.api(route, { method: 'PATCH', key, headers, body: firstBytes, _probe: true });
        assert.equal(same.text, first.text); assert.equal(same.revision, first.revision);
        assert.equal(await this.revision(), revision); assert.deepEqual(await this.seal(), business);
        const changed = await this.api(route, { method: 'PATCH', key, headers, body: changedBytes, _probe: true, status: [200, 409] });
        const proof = {
            id: 'WT12-RAW-BYTES', route, key, expectedChangedIntentStatus: 409,
            firstStatus: first.status, identicalReplayStatus: same.status, changedIntentStatus: changed.status,
            firstSha256: hash(firstBytes), changedSha256: hash(changedBytes),
            distinctValidPngBytes: !firstBytes.equals(changedBytes), decodedTextEqual: firstBytes.toString('utf8') === changedBytes.toString('utf8'),
            changedResponseEqualsFirst: changed.text === first.text, revisionUnchanged: await this.revision() === revision,
            rowsUnchangedAfterReplay: JSON.stringify(await this.seal()) === JSON.stringify(business),
            providerUploadsAfterFirst: this.ledger().slice(ledgerCount).filter(x => x.provider === 'drive' && x.operation === 'upload').length,
            originalCopiedRowsUnchanged: !!(await this.verifyOriginal()), productionSourceChanged: 'Only the scoped raw-image intent branch'
        };
        this.save('raw-binary-intent-proof.json', proof);
        assert.equal(changed.status, 409, 'Different raw image bytes reused an existing operation key without 409; stop before further writes/load.');
        assert.ok(proof.revisionUnchanged && proof.rowsUnchangedAfterReplay && proof.providerUploadsAfterFirst === 0);
        const changedType = await this.api(route, { method: 'PATCH', key, headers: { 'content-type': 'image/webp' }, body: firstBytes, _probe: true, status: 409 });
        const fresh = await this.api(route, { method: 'PATCH', key: this.key('new-image-intent'), headers, body: changedBytes, _probe: true });
        assert.notEqual(fresh.body.record.imageUrl, first.body.record.imageUrl);
        assert.equal(this.ledger().filter(x => x.provider === 'drive' && x.operation === 'upload').at(-1).contentSha256, hash(changedBytes));
        const afterFreshRevision = await this.revision(), afterFresh = await this.seal(), afterFreshLedger = this.ledger().length;
        const oldReplay = await this.api(route, { method: 'PATCH', key, headers, body: firstBytes, _probe: true });
        assert.equal(oldReplay.text, first.text); assert.equal(oldReplay.revision, first.revision);
        assert.equal(await this.revision(), afterFreshRevision); assert.deepEqual(await this.seal(), afterFresh);
        assert.equal(this.ledger().slice(afterFreshLedger).filter(x => x.provider === 'drive').length, 0);
        this.save('raw-binary-intent-proof.json', { ...proof, changedMediaTypeStatus: changedType.status, freshIntentStatus: fresh.status, changedBytesActuallyUploadedOnFreshKey: true, oldKeyReplayAfterLaterUploadExact: true, productionSourceChanged: 'Only the scoped raw-image intent branch' });
    }
    async WT_RAW_IMAGE() { await this.rawBinaryIntent(); }
    summary(status) {
        return { ...super.summary(status), sourceCommit: this.manifest.sourceCommit, completionPlan: 63, fullLocalAcceptance: false, capacity: 'NOT RUN; correctness must pass first' };
    }
    async runPreflight() {
        await this.baseline();
        this.save('completion-order.json', { baseline: this.manifest.sourceCommit, localOnly: true, firstBoundary: 'raw binary intent', capacityRequiresFullCorrectness: true, inheritedFamilyPassDoesNotCertifyAllVariants: true });
        for (const [id, operation] of [['WT00', () => this.WT00()], ['WT01', () => this.WT01()], ['WT04', () => this.WT04()], ['WT12-RAW-BYTES', () => this.rawBinaryIntent()]]) await this.family(id, operation);
        this.save('campaign-summary.json', this.summary('BLOCKED'));
        return this.summary('BLOCKED');
    }
}
module.exports = { CompletionCampaign };
if (require.main === module) (async () => {
    let campaign;
    try {
        assert.equal(process.argv.length, 4);
        campaign = new CompletionCampaign(process.argv[2], process.argv[3]);
        await campaign.runPreflight();
        console.log('Priority correctness boundaries completed; full completion inventory remains required.');
    } catch (error) {
        if (campaign) {
            let originalRowsUnchanged = false;
            try { await campaign.verifyOriginal(); originalRowsUnchanged = true; } catch { /* Preserve the original failure and independently report integrity failure. */ }
            campaign.save('completion-stop.json', { failureClass: error.name, message: error.message, originalRowsUnchanged, furtherWritesStopped: true, capacityStarted: false, secondCampaignStarted: false });
        }
        console.error('STOP: correctness boundary failed; restricted evidence retained.');
        process.exitCode = 1;
    } finally { await campaign?.close(); }
})();
