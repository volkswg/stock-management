import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const uploadCleanupHistory = JSON.parse(readFileSync('tests/fixtures/staging-upload-cleanup-before.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
export function restoreUploadCleanupSource(file, source) {
  const entry = uploadCleanupHistory.edits[file];
  if (!entry || !source.includes('import { withStagingUploadCleanup }')) return source;
  assert.equal(hash(entry.before), entry.beforeHash, file);
  assert.equal(hash(source), entry.afterHash, file);
  return entry.before;
}
