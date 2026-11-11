import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const uploadOutcomesHistory = JSON.parse(readFileSync('tests/fixtures/staging-upload-outcomes-before.json', 'utf8'));
const lineBoundaryHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-boundary-before.json', 'utf8'));
const lineCountersHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-counters-before.json', 'utf8'));
const lineRollbackHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-rollback-before.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
export function restoreUploadOutcomesSource(file, source) {
  const rollback = lineRollbackHistory.edits[file];
  if (rollback) {
    assert.equal(hash(rollback.before), rollback.beforeHash, file);
    assert.equal(hash(source), rollback.afterHash, file);
    source = rollback.before;
  }
  const counters = lineCountersHistory.edits[file];
  if (counters) {
    assert.equal(hash(counters.before), counters.beforeHash, file);
    assert.equal(hash(source), counters.afterHash, file);
    source = counters.before;
  }
  const line = lineBoundaryHistory.edits[file];
  if (line) {
    assert.equal(hash(line.before), line.beforeHash, file);
    assert.equal(hash(source), line.afterHash, file);
    source = line.before;
  }
  const entry = uploadOutcomesHistory.edits[file];
  if (!entry) return source;
  assert.equal(hash(entry.before), entry.beforeHash, file);
  assert.equal(hash(source), entry.afterHash, file);
  return entry.before;
}
