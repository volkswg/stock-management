/* eslint-disable @typescript-eslint/no-require-imports -- Additional actual HTTP/LINE journeys on approved disposable copies only. */
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs');
const { UploadCampaign } = require('./upload-coverage.cjs');
class AcceptanceCampaign extends UploadCampaign {
    async unsupportedContracts() {
        const cases = [
            ['DELETE', '/api/orders/' + this.context.order.id, undefined, 405],
            ['PATCH', '/api/orders/' + this.context.order.id, { status: 'cancelled' }, 400],
            ['DELETE', '/api/shipments/' + this.context.shipment.id + '/orders', { orderId: this.context.order.id }, 405],
            ['PATCH', '/api/shipments/' + this.context.shipment.id, { status: 'cancelled' }, 400],
            ['PATCH', '/api/shipments/' + this.context.shipment.id, { status: 'draft' }, 400],
        ], results = [];
        for (const [method, url, body, status] of cases) {
            const before = await this.seal(), revision = await this.revision();
            // Unsupported methods do not belong to the exported mutation inventory.
            const key = this.key('unsupported'), headers = { authorization: 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN, 'Idempotency-Key': key, 'content-type': 'application/json' };
            const r = await fetch(this.config.origin + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10000) });
            await r.arrayBuffer(); assert.equal(r.status, status);
            assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
            assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 0);
            results.push({ method, route: url, expected: status, actual: r.status, businessRevisionAndJournalUnchanged: true });
        }
        this.save('unsupported-contracts.json', { disposition: 'Unsupported success operations; refusal verified. Synthetic legacy-history coverage remains separate.', cases: results });
    }
    event(user, label, text, image = false) {
        const event = this.lineEvent(this.key('event-' + label), text);
        event.source.userId = user;
        if (image) event.message = { id: 'WT_IMG_' + event.webhookEventId, type: 'image' };
        return event;
    }
    async exactRedelivery(events, label) {
        const before = await this.seal(), revision = await this.revision(), calls = this.ledger().filter(e => e.kind === 'fake-provider').length;
        for (const group of [events.slice().reverse(), events.filter((_, i) => i % 2 === 0), events.filter((_, i) => i % 2)]) {
            if (group.length) await this.line(group.map(e => ({ ...e, replyToken: 'WT_regroup_' + e.webhookEventId, deliveryContext: { isRedelivery: true } })));
        }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        assert.equal(this.ledger().filter(e => e.kind === 'fake-provider').length, calls);
        this.save(label + '-redelivery.json', { logicalEvents: events.length, regroupedAndReversed: true, businessRevisionAndProvidersUnchanged: true });
    }
    async lineOrderJourney() {
        const user = 'WT_ORDER_JOURNEY_' + this.prefix;
        const events = [this.event(user, 'order', 'create:order'), this.event(user, 'bill', '', true), this.event(user, 'bill-done', 'order:bill:complete'), this.event(user, 'product', '', true), this.event(user, 'product-done', 'order:product:complete'), this.event(user, 'total', '1,250.50')];
        await this.line(events.slice(0, 3)); await this.line(events.slice(3));
        const rows = await this.sql('SELECT id,status,"totalPrice" FROM stock_operational.orders WHERE "createdBy"=$1', [user]);
        assert.equal(rows.length, 1); assert.equal(rows[0].status, 'complete'); assert.equal(Number(rows[0].totalPrice), 1250.50);
        const detail = (await this.get('/api/orders/' + rows[0].id)).order;
        assert.equal(detail.billImages.length, 1); assert.equal(detail.productImages.length, 1);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.user_state WHERE "userId"=$1 AND archived_at IS NULL AND "referenceId" IS NOT NULL', [user]))[0].n, 0);
        await this.exactRedelivery(events, 'line-order');
        this.save('line-order-journey.json', { events: 6, orders: 1, billImages: 1, productImages: 1, totalPrice: 1250.50, stateCleared: true });
    }
    async lineSqlRetry() {
        const user = 'WT_SQL_RETRY_' + this.prefix, event = this.event(user, 'sql-fail', 'create:order');
        const before = await this.seal(), revision = await this.revision();
        this.control({ sqlBefore: { commandKey: event.webhookEventId, match: 'INSERT INTO stock_operational.orders', remaining: 1 } });
        try { await this.line([event], 503); } finally { this.control({}); }
        assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [event.webhookEventId]))[0].n, 0);
        await this.line([event]); await this.exactRedelivery([event], 'line-sql-retry');
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1', [user]))[0].n, 1);
        this.save('line-sql-retry.json', { injectedFailure: 503, commandAndBusinessRolledBack: true, sameEventRetry: 200, orders: 1 });
    }
    async restartMode(mode) {
        assert.ok(['quantity_photo', 'photo_only'].includes(mode));
        const pid = Number(cp.execFileSync('lsof', ['-t', '-nP', '-iTCP:' + this.config.appPort, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim());
        const cwd = cp.execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
        assert.ok(cwd.includes('\nn' + fs.realpathSync(this.app) + '\n'));
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 50; i++) {
            const listening = cp.spawnSync('lsof', ['-t', '-nP', '-iTCP:' + this.config.appPort, '-sTCP:LISTEN']);
            if (listening.status !== 0) break;
            assert.ok(i < 49, 'Task-owned app did not stop'); await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.env.MOVEMENT_CREATE_MODE = mode;
        await this.restartApp();
    }
    async lineMovementJourneys() {
        for (const mode of ['quantity_photo', 'photo_only']) {
            if (mode !== (this.env.MOVEMENT_CREATE_MODE || 'quantity_photo')) await this.restartMode(mode);
            const user = 'WT_MOVE_' + mode + '_' + this.prefix, events = [];
            const send = async (label, text, image = false) => { const e = this.event(user, mode + '-' + label, text, image); events.push(e); await this.line([e]); };
            await send('menu', 'create:movement'); await send('start', 'create:new-movement');
            await send('bad-shop', 'WT invalid shop'); await send('shop-a', 'NJ');
            if (mode === 'quantity_photo') { await send('bad-quantity', '0'); await send('quantity-a', '3 WT note'); }
            await send('photo-a', '', true); await send('resume', 'resume:movement'); await send('close-a', 'close bag');
            await send('another-shop', 'another shop'); await send('shop-b', 'YY');
            if (mode === 'quantity_photo') await send('quantity-b', '2');
            await send('photo-b', '', true); await send('close-b', 'close bag'); await send('summary', 'summary');
            // Completing a movement clears its active session. The retained SQL
            // archive keeps the last bag_closed checkpoint; no complete row is
            // invented to satisfy the harness.
            const state = (await this.sql('SELECT state,"referenceId",context,archived_at FROM stock_operational.user_state WHERE "userId"=$1 AND flowname=$2 ORDER BY row_order DESC LIMIT 1', [user, 'MovementCreate']))[0];
            assert.ok(state?.archived_at); assert.equal(state.state, 'bag_closed');
            const rows = await this.sql('SELECT id,"shopName",quantity,"productImageUrl" FROM stock_operational.movement_details WHERE "movementMasterId"=$1 AND archived_at IS NULL ORDER BY row_order', [state.referenceId]);
            assert.equal(rows.length, 2); assert.deepEqual(rows.map(r => r.shopName), ['NJ', 'YY']); assert.ok(rows.every(r => /WT_FILE_/.test(r.productImageUrl)));
            this.context.uploadRetryTarget = { masterId: state.referenceId, itemId: rows[0].id };
            if (mode === 'quantity_photo') assert.deepEqual(rows.map(r => Number(r.quantity)), [3, 2]);
            else {
                assert.ok(rows.every(r => r.quantity === null));
                const before = await this.seal(), revision = await this.revision();
                await this.patch('/api/movements/' + state.referenceId, { status: 'delivered' }, { status: 409, _probe: true });
                assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision);
                for (const [index, row] of rows.entries()) await this.patch('/api/movements/' + state.referenceId + '/items/' + row.id, { quantity: String(index + 1) }, { _probe: true });
            }
            await this.exactRedelivery(events, 'line-movement-' + mode);
            this.save('line-movement-' + mode + '.json', { mode, events: events.length, completed: true, savedPhotos: 2, shops: ['NJ', 'YY'], missingQuantityDeliveryRefused: mode === 'photo_only' });
        }
        await this.restartMode('quantity_photo');
    }
    async WT_UNSUPPORTED_CONTRACTS() { await this.unsupportedContracts(); }
    async WT_LINE_COMPLETE_JOURNEYS() { await this.lineOrderJourney(); await this.lineMovementJourneys(); await this.lineSqlRetry(); await this.fileGraph('line-journeys-file-graph'); }
}
module.exports = { AcceptanceCampaign };
