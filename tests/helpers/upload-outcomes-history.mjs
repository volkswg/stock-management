import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const uploadOutcomesHistory = JSON.parse(readFileSync('tests/fixtures/staging-upload-outcomes-before.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
export function restoreUploadOutcomesSource(file, source) {
  const entry = uploadOutcomesHistory.edits[file];
  if (!entry) return source;
  assert.equal(hash(entry.before), entry.beforeHash, file);
  assert.equal(hash(source), entry.afterHash, file);
  return entry.before;
}
