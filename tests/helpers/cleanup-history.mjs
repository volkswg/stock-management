import {restoreRetirementSource} from "./retirement-history.mjs";
import assert from 'node:assert/strict';
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import { createHash } from 'node:crypto';
export const cleanupHistory = JSON.parse(readFileSync('tests/fixtures/final-cleanup-before.json', 'utf8'));
export const cleanupNewFiles = [...Object.values(cleanupHistory.moves).map(e => e.to), ...cleanupHistory.newFiles];
export const cleanupChanged = new Set([...Object.keys(cleanupHistory.moves), ...Object.keys(cleanupHistory.edits)]);
export const legacySpecifier = spec => Object.entries(cleanupHistory.specifiers).find(([, next]) => spec === next)?.[0] ?? spec;
const hash = s => createHash('sha256').update(s).digest('hex');
const prior = new Map(), priorHashes = new Map();
for (const name of ['external-infrastructure-before', 'orders-line-before', 'expenses-business-before', 'inventory-sales-query-before', 'movement-schema-before', 'inventory-employee-directory-before', 'remaining-worksheets-before', 'sales-application-before', 'inventory-application-before', 'hr-application-before', 'hr-payroll-before']) {
    const d = JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
    for (const [file, e] of Object.entries({ ...d.files, ...d.routes, ...d.edits, ...d.splits, ...d.moves })) {
        const hashes = priorHashes.get(file) ?? new Set();
        if (e.sha256)
            hashes.add(e.sha256);
        if (e.rawHash)
            hashes.add(e.rawHash);
        priorHashes.set(file, hashes);
        if (e.source) {
            const values = prior.get(file) ?? new Set();
            values.add(e.source);
            if (e.after)
                values.add(e.after);
            prior.set(file, values);
        }
    }
}
function reverseEdit(file, source) { const e = cleanupHistory.edits[file]; if (!e)
    return source; for (const c of e.changes.toReversed()) {
    assert.equal(source.split(c.to).length - 1, c.count, file);
    source = source.replaceAll(c.to, c.from);
} assert.equal(hash(source), e.sha256, file); return source; }
export function restoreCleanupSource(file, source = readFileSync(file, 'utf8')) {
    source=restoreRetirementSource(file,source);
    const move = cleanupHistory.moves[file];
    if (move) {
        const saved = cleanupHistory.files[file];
        assert.equal(hash(saved.source), saved.sha256, file);
        assert.equal(readFileSync(file, 'utf8'), move.forward, file);
        let owner = readFileSync(move.to, 'utf8');
        if (cleanupHistory.edits[move.to]) {
            assert.equal(hash(owner), cleanupHistory.edits[move.to].afterHash, move.to);
            owner = reverseEdit(move.to, owner);
        }
        assert.equal(hash(owner), move.ownerHash, move.to);
        for (const c of move.changes.toReversed()) {
            assert.equal(owner.split(c.to).length - 1, 1, move.to);
            owner = owner.replace(c.to, c.from);
        }
        assert.equal(owner, saved.source, file);
        if ((prior.get(file)?.has(source) || priorHashes.get(file)?.has(hash(source))))
            return source;
        assert.ok(source === move.forward || source === saved.source, file);
        return saved.source;
    }
    const edit = cleanupHistory.edits[file];
    if (edit) {
        assert.equal(hash(readFileSync(file)), edit.afterHash, file);
        if (hash(source) === edit.sha256 || (prior.get(file)?.has(source) || priorHashes.get(file)?.has(hash(source))))
            return source;
        return reverseEdit(file, source);
    }
    return source;
}
