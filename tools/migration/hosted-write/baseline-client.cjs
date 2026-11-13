/* eslint-disable @typescript-eslint/no-require-imports -- Frozen baseline for the unchanged independent oracle; never connects to a live source. */
const catalog = require('../worksheets.json');
const { requireGate } = require('./policy.cjs');
function baselineClient(input, revision) {
  requireGate(typeof revision === 'string' && /^\d+$/.test(revision), 'BASELINE_REVISION');
  requireGate(Object.keys(input).sort().join() === Object.keys(catalog).sort().join(), 'BASELINE_TABLES');
  const baseline = structuredClone(input);
  for (const rows of Object.values(baseline)) {
    requireGate(Array.isArray(rows), 'BASELINE_ROWS');
    for (const row of rows) {
      requireGate(typeof row.n === 'string' && /^\d+$/.test(row.n) && Array.isArray(row.business_cells) && typeof row.revision === 'string' && /^\d+$/.test(row.revision), 'BASELINE_ROW');
      if (row.archived_at !== null) { requireGate(typeof row.archived_at === 'string' && Number.isFinite(Date.parse(row.archived_at)), 'BASELINE_ARCHIVE_TIME'); row.archived_at = new Date(row.archived_at); }
    }
  }
  return { async query(text) {
    if (text === 'SELECT value::text v FROM stock_operational.revision WHERE singleton') return { rows: [{ v: revision }] };
    const match = /^SELECT row_order::text n,business_cells,revision::text revision,archived_at FROM stock_operational\.([a-z_]+) ORDER BY row_order$/.exec(text);
    requireGate(match && Object.hasOwn(baseline, match[1]), 'BASELINE_READ_ONLY_QUERY'); return { rows: structuredClone(baseline[match[1]]) };
  }, async end() {} };
}
module.exports = { baselineClient };
