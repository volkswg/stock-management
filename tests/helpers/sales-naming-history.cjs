/* eslint-disable @typescript-eslint/no-require-imports -- Exact source inverse for immutable pre-cleanup tests only. */
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
exports.beforeSalesNaming = (name, data = fs.existsSync(name) ? fs.readFileSync(name) : null) => {
  const edit = JSON.parse(fs.readFileSync('tests/fixtures/sales-naming-before.json')).edits[name];
  if (!edit) return data;
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  assert.equal(data === null ? null : hash(data), edit.afterSha256, name);
  assert.equal(hash(edit.before), edit.beforeSha256, name);
  return Buffer.from(edit.before);
};
