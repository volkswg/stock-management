/* eslint-disable @typescript-eslint/no-require-imports -- Fake-provider evidence, outside application transactions. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
function providerJournal(append) {
    return {
        begin(provider, operation, metadata = {}) {
            const attemptId = crypto.randomUUID();
            append({ ...metadata, kind: 'fake-provider', provider, operation, attemptId });
            return {
                accepted(details = {}) { append({ ...details, kind: 'fake-provider-outcome', attemptId, phase: 'accepted' }); },
                completed() { append({ kind: 'fake-provider-outcome', attemptId, phase: 'completed' }); },
                rejected() { append({ kind: 'fake-provider-outcome', attemptId, phase: 'rejected' }); },
                uncertain() { append({ kind: 'fake-provider-outcome', attemptId, phase: 'uncertain' }); },
            };
        },
    };
}
function classifyUploads(events, referencedIds, committedHistoryIds = []) {
    const attempts = new Map(), files = new Map(), unresolvedAttempts = [];
    for (const event of events) {
        if (event.kind === 'fake-provider') {
            assert.ok(event.attemptId && !attempts.has(event.attemptId), 'Missing/duplicate provider attempt identity');
            attempts.set(event.attemptId, { ...event, phases: [] });
        } else if (event.kind === 'fake-provider-outcome') {
            const attempt = attempts.get(event.attemptId);
            assert.ok(attempt, 'Outcome has no provider attempt');
            assert.ok(['accepted', 'completed', 'rejected', 'uncertain'].includes(event.phase));
            assert.ok(!attempt.phases.includes(event.phase), 'Duplicate outcome phase');
            assert.ok(!attempt.phases.some(p => ['completed', 'rejected', 'uncertain'].includes(p)), 'Outcome follows a terminal result');
            if (event.phase === 'accepted') {
                assert.equal(attempt.phases.length, 0);
                if (attempt.provider === 'drive' && ['upload', 'delete'].includes(attempt.operation)) {
                    assert.match(attempt.id, /^WT_FILE_/);
                    if (attempt.operation === 'upload') {
                        assert.ok(!files.has(attempt.id), 'Duplicate fake file identity'); files.set(attempt.id, { exists: true, attemptId: attempt.attemptId });
                    } else {
                        assert.ok(files.has(attempt.id), 'Delete has no accepted upload'); files.get(attempt.id).exists = false;
                    }
                }
            }
            if (event.phase === 'completed' || event.phase === 'uncertain') assert.ok(attempt.phases.includes('accepted'), 'Completion/uncertainty without acceptance');
            if (event.phase === 'rejected') assert.ok(!attempt.phases.includes('accepted'), 'Accepted work cannot be classified rejected');
            attempt.phases.push(event.phase);
        }
    }
    for (const attempt of attempts.values()) if (!attempt.phases.some(p => ['completed', 'rejected'].includes(p))) unresolvedAttempts.push(attempt.attemptId);
    const orphanIds = [], referenced = [], retainedHistorical = [], compensated = [], brokenReferences = [];
    const references = new Set(referencedIds);
    const history = new Set(committedHistoryIds);
    for (const [id, file] of files) {
        if (file.exists && !references.has(id) && history.has(id)) retainedHistorical.push(id);
        else if (file.exists && !references.has(id)) orphanIds.push(id);
        else if (file.exists) referenced.push(id);
        else if (references.has(id)) brokenReferences.push(id);
        else compensated.push(id);
    }
    for (const id of references) if (!files.has(id)) brokenReferences.push(id);
    return { acceptedUploads: files.size, orphanIds, unresolvedAttempts, brokenReferences, referenced, retainedHistorical, compensated, pass: !orphanIds.length && !unresolvedAttempts.length && !brokenReferences.length };
}
function catalogKey(account, url) {
    const query = [...url.searchParams].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
    return JSON.stringify([account, query]);
}
function catalogReply(catalog, account, url) {
    const key = catalogKey(account, url);
    assert.ok(Object.hasOwn(catalog, key), 'Provider request absent from sealed fake catalog');
    const value = catalog[key];
    assert.ok(Number.isInteger(value.status) && value.status >= 200 && value.status <= 599);
    return structuredClone(value);
}
module.exports = { providerJournal, classifyUploads, catalogKey, catalogReply };
