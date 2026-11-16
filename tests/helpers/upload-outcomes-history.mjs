import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const uploadOutcomesHistory = JSON.parse(readFileSync('tests/fixtures/staging-upload-outcomes-before.json', 'utf8'));
const lineBoundaryHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-boundary-before.json', 'utf8'));
const lineCountersHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-counters-before.json', 'utf8'));
const lineRollbackHistory = JSON.parse(readFileSync('tests/fixtures/staging-line-rollback-before.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const productionHistory = JSON.parse(readFileSync('tests/fixtures/production-release-before.json', 'utf8'));
const readonlyAccountsHistory = JSON.parse(readFileSync('tests/fixtures/readonly-account-configuration-before.json', 'utf8'));
const lineCutoffHistory = JSON.parse(readFileSync('tests/fixtures/line-cutoff-before.json', 'utf8'));
export const orderCreateKeyHistory = JSON.parse(readFileSync('tests/fixtures/order-create-key-before.json', 'utf8'));
const lineUploadFeedbackHistory = JSON.parse(readFileSync('tests/fixtures/line-upload-feedback-before.json', 'utf8'));
export function restoreOrderCreateKeySource(file, source) {
  const feedback = lineUploadFeedbackHistory.edits[file];
  if (feedback && source !== feedback.before) {
    assert.equal(hash(feedback.before), feedback.beforeHash, file);
    assert.equal(hash(source), feedback.afterHash, file);
    source = feedback.before;
  }
  const orderCreate = orderCreateKeyHistory.edits[file];
  if (!orderCreate) return source;
  assert.equal(hash(orderCreate.before), orderCreate.beforeHash, file);
  if (source === orderCreate.before) return source;
  assert.equal(hash(source), orderCreate.afterHash, file);
  return orderCreate.before;
}
export function restoreUploadOutcomesSource(file, source) {
  source = restoreOrderCreateKeySource(file, source);
  const cutoff = lineCutoffHistory.edits[file];
  if (cutoff) { assert.equal(hash(cutoff.before), cutoff.beforeHash, file); assert.equal(hash(source), cutoff.afterHash, file); source = cutoff.before; }
  const accounts = readonlyAccountsHistory.edits[file];
  if (accounts) { assert.equal(hash(accounts.before), accounts.beforeHash, file); assert.equal(hash(source), accounts.afterHash, file); source = accounts.before; }
  const production = productionHistory.edits[file];
  if (production) { assert.equal(hash(production.before), production.beforeHash, file); assert.equal(hash(source), production.afterHash, file); source = production.before; }
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
