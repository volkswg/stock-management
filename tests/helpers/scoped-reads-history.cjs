/* eslint-disable @typescript-eslint/no-require-imports -- Exact, test-only predecessor reconstruction. */
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
exports.beforeScopedReads = (name, data = fs.existsSync(name) ? fs.readFileSync(name) : null) => {
  const edit = JSON.parse(fs.readFileSync('tests/fixtures/scoped-reads-before.json')).edits[name];
  if (!edit) return data;
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(data === null ? null : hash(data), edit.afterSha256, name);
  const lines = data.toString().split(/(?<=\n)/);
  for (const delta of [...edit.inverse].reverse()) lines.splice(delta.start, delta.count, delta.before);
  const before = Buffer.from(lines.join(''));
  assert.equal(hash(before), edit.beforeSha256, name);
  return before;
};
