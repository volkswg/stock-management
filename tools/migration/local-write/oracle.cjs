/* eslint-disable @typescript-eslint/no-require-imports -- Existing TypeScript application rules over an in-memory, non-network Sheets transport. */
require('../../../tests/helpers/postgres-runtime.cjs');
const { GoogleSheetsService } = require('../../../src/composition/google-sheets/GoogleSheetsService.ts');
const catalog = require('../worksheets.json'), audit = require('../source-audit.json');
function memoryService(seed = {}) {
    const rows = {}, config = { spreadsheetId: 'WT_OFFLINE_ONLY', serviceAccountEmail: 'WT@example.invalid', serviceAccountPrivateKey: 'WT_never_used' };
    for (const [table, s] of Object.entries(catalog)) {
        config[audit[table].configProperty] = table;
        rows[table] = [structuredClone(s.headers), ...structuredClone(seed[table] || [])];
    }
    const service = new GoogleSheetsService(config), client = service.client;
    const column = s => [...s].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0) - 1;
    function bounds(range) { const m = /^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range); if (!m)
        throw Error('Unsupported offline range'); return { x: column(m[1]), y: column(m[3] || m[1]) + 1, start: Number(m[2] || 1) - 1, end: m[4] ? Number(m[4]) : m[3] ? Infinity : m[2] ? Number(m[2]) : Infinity }; }
    const deny = () => { throw Error('Provider access is forbidden in the offline write oracle'); };
    for (const n of Object.getOwnPropertyNames(Object.getPrototypeOf(client)))
        if (n !== 'constructor')
            client[n] = deny;
    client.ensureWorksheet = async (table) => { if (!rows[table])
        throw Error('Unknown offline worksheet'); };
    client.getValues = async (table, range) => { const b = bounds(range); return structuredClone(rows[table].slice(b.start, b.end).map(r => r.slice(b.x, b.y))); };
    client.getValuesBatch = async (ranges) => Promise.all(ranges.map(({ worksheetName, range }) => client.getValues(worksheetName, range)));
    client.appendValues = async (table, _range, values) => { rows[table].push(...structuredClone(values)); };
    client.updateValues = async (table, range, values) => { const b = bounds(range); for (const [i, patch] of values.entries()) {
        while (rows[table].length <= b.start + i)
            rows[table].push([]);
        const row = rows[table][b.start + i];
        for (const [j, v] of patch.entries())
            row[b.x + j] = structuredClone(v);
    } };
    client.batchUpdateValues = async (table, updates) => { for (const u of updates)
        await client.updateValues(table, u.range, u.values); };
    client.clearValues = async (table, range) => { const b = bounds(range); for (const row of rows[table].slice(b.start, b.end))
        for (let i = b.x; i < b.y; i++)
            row[i] = ''; };
    client.deleteRow = async (table, row) => { rows[table].splice(row - 1, 1); };
    return { service, rows };
}
module.exports = { memoryService };
