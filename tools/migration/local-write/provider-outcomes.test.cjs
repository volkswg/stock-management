/* eslint-disable @typescript-eslint/no-require-imports -- Independent provider evidence and immutable fixture controls. */
const test = require('node:test'), assert = require('node:assert/strict');
const { providerJournal, classifyUploads, catalogKey, catalogReply } = require('./provider-outcomes.cjs');
test('provider acceptance survives an unknown caller outcome and cannot silently become rejected', () => {
    const events = [], journal = providerJournal(e => events.push(e));
    const attempt = journal.begin('drive', 'upload', { id: 'WT_FILE_test' }); attempt.accepted(); attempt.uncertain();
    const result = classifyUploads(events, []);
    assert.equal(result.acceptedUploads, 1); assert.deepEqual(result.orphanIds, ['WT_FILE_test']); assert.equal(result.unresolvedAttempts.length, 1); assert.equal(result.pass, false);
    attempt.rejected(); assert.throws(() => classifyUploads(events, []));
});
test('referenced uploads and acknowledged compensation pass; delete attempts without acceptance do not compensate', () => {
    const events = [], journal = providerJournal(e => events.push(e));
    const upload = journal.begin('drive', 'upload', { id: 'WT_FILE_test' }); upload.accepted(); upload.completed();
    assert.equal(classifyUploads(events, ['WT_FILE_test']).pass, true);
    assert.equal(classifyUploads(events, []).pass, false);
    assert.deepEqual(classifyUploads(events, [], ['WT_FILE_test']).retainedHistorical, ['WT_FILE_test']);
    const failedDelete = journal.begin('drive', 'delete', { id: 'WT_FILE_test' }); failedDelete.rejected();
    assert.equal(classifyUploads(events, []).pass, false);
    const removed = journal.begin('drive', 'delete', { id: 'WT_FILE_test' }); removed.accepted(); removed.completed();
    assert.deepEqual(classifyUploads(events, []).compensated, ['WT_FILE_test']); assert.equal(classifyUploads(events, []).pass, true);
    assert.equal(classifyUploads(events, ['WT_FILE_test']).pass, false);
});
test('missing, duplicate, fabricated and late outcomes fail closed', () => {
    const events = [], journal = providerJournal(e => events.push(e));
    journal.begin('line', 'reply'); assert.equal(classifyUploads(events, []).unresolvedAttempts.length, 1);
    assert.throws(() => classifyUploads([...events, events[0]], []));
    assert.throws(() => classifyUploads([{ kind: 'fake-provider-outcome', attemptId: 'missing', phase: 'completed' }], []));
    assert.throws(() => classifyUploads([...events, { kind: 'fake-provider-outcome', attemptId: events[0].attemptId, phase: 'completed' }], []));
    assert.equal(classifyUploads([], ['WT_FILE_missing']).pass, false);
});
test('immutable receipt fixtures distinguish account, store, date and cursor during concurrent access', async () => {
    const urls = ['https://api.loyverse.com/v1.0/receipts?store_id=A&created_at_min=2026-01-01&cursor=1', 'https://api.loyverse.com/v1.0/receipts?store_id=A&created_at_min=2026-01-02&cursor=1', 'https://api.loyverse.com/v1.0/receipts?store_id=B&created_at_min=2026-01-01&cursor=1'].map(s => new URL(s));
    const catalog = Object.fromEntries(urls.map((url, i) => [catalogKey('A', url), { status: 200, body: { receipts: [{ receipt_number: 'WT_' + i }], cursor: null } }]));
    const before = JSON.stringify(catalog);
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => Promise.resolve().then(() => catalogReply(catalog, 'A', urls[i % urls.length]))));
    results.forEach((reply, i) => assert.equal(reply.body.receipts[0].receipt_number, 'WT_' + (i % 3)));
    results[0].body.receipts.length = 0; assert.equal(JSON.stringify(catalog), before);
    assert.throws(() => catalogReply(catalog, 'B', urls[0]));
    assert.throws(() => catalogReply(catalog, 'A', new URL('https://api.loyverse.com/v1.0/receipts?cursor=2')));
    assert.equal(catalogKey('A', urls[0]), catalogKey('A', new URL('https://api.loyverse.com/v1.0/receipts?cursor=1&created_at_min=2026-01-01&store_id=A')));
});
