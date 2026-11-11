/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic process crashes with independent SQL and provider witnesses. */
const assert = require('node:assert/strict');
const { MethodCampaign } = require('./method-repetitions.cjs');
class CrashCampaign extends MethodCampaign {
    async WT_CRASH_MATRIX() {
        const boundaries = [
            { control: 'exitBeforeBusinessCommit', phase: 'before-business-commit', committed: false, beforeAttempts: 0, afterAttempts: 1, effect: null },
            { control: 'exitAfterBusinessCommit', phase: 'after-business-commit-before-effect', committed: true, beforeAttempts: 0, afterAttempts: 1, effect: null },
            { control: 'exitAfterEffectClaim', phase: 'after-effect-claim', committed: true, beforeAttempts: 0, afterAttempts: 0, effect: 'sending' },
            { control: 'exitBeforeFakeReply', phase: 'before-fake-reply', committed: true, beforeAttempts: 0, afterAttempts: 0, effect: 'sending' },
            { control: 'exitAfterFakeReply', phase: null, committed: true, beforeAttempts: 1, afterAttempts: 1, effect: 'sending' },
            { control: 'exitAfterEffectRecorded', phase: 'after-effect-recorded', committed: true, beforeAttempts: 1, afterAttempts: 1, effect: 'done' },
        ], results = [];
        for (const boundary of boundaries) {
            for (let trial = 0; trial < 10; trial++) {
                const user = 'WT_CRASH_MATRIX_' + this.key(boundary.control), event = this.event(user, 'crash', 'create:order');
                const start = this.ledger().length, revision = await this.revision(), before = boundary.committed ? null : await this.seal();
                this.control({ [boundary.control]: { remaining: 1 } });
                let disconnected = false;
                try { await this.line([event]); } catch { disconnected = true; }
                assert.ok(disconnected, 'Crash boundary did not disconnect the actual request'); this.control({});
                const phases = this.ledger().slice(start);
                if (boundary.phase) assert.equal(phases.filter(e => e.kind === 'injected-fault' && e.phase === boundary.phase).length, 1);
                const countOrders = async () => (await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1', [user]))[0].n;
                const countCommands = async () => (await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1 AND state=\'complete\'', [event.webhookEventId]))[0].n;
                const effectKey = 'LINE:' + event.webhookEventId + ':reply:0';
                const effects = await this.sql('SELECT state FROM stock_operational.side_effects WHERE key=$1', [effectKey]);
                assert.equal(await countOrders(), boundary.committed ? 1 : 0); assert.equal(await countCommands(), boundary.committed ? 1 : 0);
                if (boundary.effect) assert.deepEqual(effects.map(e => e.state), [boundary.effect]); else assert.equal(effects.length, 0);
                if (!boundary.committed) { assert.deepEqual(await this.seal(), before); assert.equal(await this.revision(), revision); }
                const attempts = () => this.ledger().slice(start).filter(e => e.kind === 'fake-provider' && e.provider === 'line' && e.operation === 'reply');
                assert.equal(attempts().length, boundary.beforeAttempts);
                if (boundary.control === 'exitAfterFakeReply') {
                    const id = attempts()[0].attemptId, outcome = phases.filter(e => e.kind === 'fake-provider-outcome' && e.attemptId === id).map(e => e.phase);
                    assert.deepEqual(outcome, ['accepted']);
                }
                await this.restartApp();
                await this.line([{ ...event, replyToken: 'WT_post_crash_' + event.webhookEventId, deliveryContext: { isRedelivery: true } }]);
                await this.line([{ ...event, replyToken: 'WT_regroup_crash_' + event.webhookEventId }]);
                assert.equal(await countOrders(), 1); assert.equal(await countCommands(), 1); assert.equal(attempts().length, boundary.afterAttempts);
                const afterEffect = await this.sql('SELECT state FROM stock_operational.side_effects WHERE key=$1', [effectKey]);
                assert.deepEqual(afterEffect.map(e => e.state), [boundary.afterAttempts === 0 || boundary.control === 'exitAfterFakeReply' ? 'sending' : 'done']);
                results.push({ boundary: boundary.control, trial: trial + 1, committedBeforeRestart: boundary.committed, attemptsBeforeRestart: boundary.beforeAttempts, attemptsAfterRedelivery: attempts().length, businessCommandsAfterRecovery: 1, effectState: afterEffect[0].state, unknownOutcomeAutoResent: false });
                this.save('crash-matrix.json', results);
            }
            await this.verifyOriginal();
        }
        assert.equal(results.length, 60);
    }
}
module.exports = { CrashCampaign };
