/* eslint-disable @typescript-eslint/no-require-imports -- Actual report and HTTP owners with synthetic data and closed provider bindings. */
require('../helpers/postgres-runtime.cjs');
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { createHash } = require('node:crypto');
const { beforeSalesNaming } = require('../helpers/sales-naming-history.cjs');
const server = require('../../src/modules/sales/server.ts');
const { createSalesReports } = require('../../src/modules/sales/application/reports.ts');
const mapping = require('../../src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts');
const ids = require('../../src/modules/sales/domain/receipt-ids.ts');
const { receipts } = require('../helpers/lean-sales-fixture.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const account = { id: 'synthetic-account', shopName: 'Synthetic shop' };
const at = '2026-11-01T00:00:00.000Z';
function data() {
  const rows = { receipts: [], items: [], payments: [], syncs: [] };
  for (const receipt of receipts()) {
    const id = ids.createSalesReceiptId(account.id, receipt.receipt_number);
    rows.receipts.push(mapping.salesReceiptToRecord({ id, accountId: account.id, shopName: account.shopName, salesDate: '2026-11-01', receipt, syncedAt: at }));
    receipt.line_items.forEach((item, index) => rows.items.push(mapping.salesReceiptItemToRecord({ id: ids.createSalesReceiptItemId(id, item.id, index), receiptId: id, item, syncedAt: at })));
    receipt.payments.forEach((payment, index) => rows.payments.push(mapping.salesReceiptPaymentToRecord({ id: ids.createSalesReceiptPaymentId(id, index), receiptId: id, paymentIndex: index, payment, syncedAt: at })));
  }
  for (const day of ['2026-11-01', '2026-11-02']) rows.syncs.push({ id: ids.createSalesReceiptSyncId(account.id, day), accountId: account.id, shopName: account.shopName, salesDate: day, status: 'complete', receiptCount: day.endsWith('01') ? '2' : '0', itemCount: day.endsWith('01') ? '2' : '0', paymentCount: day.endsWith('01') ? '3' : '0', syncedAt: at });
  return rows;
}
function evaluate(file, source, imports = {}, errors = []) {
  const exports = {};
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, Date, Intl, console: { error: (...args) => errors.push(args) }, require(specifier) { assert.ok(Object.hasOwn(imports, specifier), `Unstubbed dependency: ${specifier}`); return imports[specifier]; } }, { filename: file });
  return exports;
}
function reportPair() {
  const snapshot = data();
  const reader = () => Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, async () => rows]));
  const file = 'src/modules/sales/application/reports.ts';
  return { current: createSalesReports(reader), previous: evaluate(file, beforeSalesNaming(file).toString()).createSalesReports(reader) };
}
const names = [['getDailySales', 'getGoogleSheetsDailySales'], ['getSalesDashboard', 'getGoogleSheetsSalesDashboard'], ['getProfitSummary', 'getGoogleSheetsProfitSummary']];

test('daily, dashboard and profit reports preserve split payments, refunds, taxes, costs and zero-sales days', async () => {
  const { current, previous } = reportPair();
  const inputs = [
    { storage: {}, accountId: account.id, salesDate: '2026-11-01' },
    { storage: {}, accountIds: [account.id], fromDate: '2026-11-01', toDate: '2026-11-02' },
    { storage: {}, accounts: [account], year: '2026', expenses: [{ id: 'expense', month: '2026-11', accountId: account.id, scope: 'SHOP', amount: 2, name: 'Synthetic expense', category: 'Synthetic', note: '' }], costOverrides: [{ id: 'override', month: '2026-11', accountId: account.id, averageItemCost: 5, note: '', createdAt: '', updatedAt: '', createdBy: '' }] },
  ];
  for (const [index, [name, oldName]] of names.entries()) assert.deepEqual(plain(await current[name](inputs[index])), plain(await previous[oldName](inputs[index])), name);
  const daily = await current.getDailySales(inputs[0]);
  assert.equal(daily.receiptCount, 2); assert.equal(daily.totals.netSales, 18); assert.equal(daily.totals.costOfGoods, 8); assert.equal(daily.totals.taxes, 1.26);
  assert.equal(daily.paymentsByType.length, 2);
  assert.equal((await current.getSalesDashboard(inputs[1])).dailySales[1].netSales, 0);
  for (const salesDate of ['2026-11-02', '2026-11-03']) assert.deepEqual(plain(await current.getDailySales({ ...inputs[0], salesDate })), plain(await previous.getGoogleSheetsDailySales({ ...inputs[0], salesDate })));
});

test('current Sales exports have neutral names and do not retain old aliases', () => {
  for (const [name, oldName] of names) { assert.equal(typeof server[name], 'function'); assert.equal(server[oldName], undefined); }
});

const routes = [
  ['daily-sales', '?account=synthetic-account&date=2026-11-01'],
  ['dashboard', '?accounts=synthetic-account&from=2026-11-01&to=2026-11-02'],
  ['profit-summary', '?year=2026'],
  ['sync-status', '?account=synthetic-account&month=2026-11'],
];
function http(owner, previous = false, fail = false) {
  const reports = reportPair()[previous ? 'previous' : 'current'], errors = [];
  const failIfNeeded = () => { if (fail) throw Error('Synthetic unavailable storage'); };
  const sales = { isValidBangkokSalesDate: server.isValidBangkokSalesDate, listSalesProfitCostOverrides: async () => [], listSalesSyncStatus: async () => { failIfNeeded(); return { rows: data().syncs, summary: { complete: 2 } }; } };
  sales.projectProfitExpenses = server.projectProfitExpenses;
  for (const [name, oldName] of names) { const key = previous ? oldName : name; sales[key] = async input => { failIfNeeded(); return reports[key](input); }; }
  const imports = {
    '@/composition/postgres/route': { withPersistence: handler => handler },
    '@/composition/loyverse-accounts': { listLoyverseAccounts: async () => [account] },
    'next/server': { NextResponse: Response },
    '@/config': { getConfig: () => ({}) },
    '@/composition/postgres/service': { createBusinessDatabase: () => ({}) },
    '@/modules/sales/server': sales,
    '@/modules/expenses/server': { listExpenses: async () => [], listExpenseShops: async () => [], listExpenseCategories: async () => [] },
  };
  const file = `src/app/api/sales/${owner}/route.ts`;
  return { api: evaluate(file, previous ? beforeSalesNaming(file).toString() : fs.readFileSync(file, 'utf8'), imports, errors), errors };
}
async function response(owner, query, previous = false, fail = false) {
  const h = http(owner, previous, fail);
  const result = await h.api.GET(new Request(`https://example.test/api/sales/${owner}${query}`));
  return { status: result.status, json: await result.json(), errors: plain(h.errors) };
}

test('all four actual Sales GET handlers change only source metadata on successful requests', async () => {
  for (const [owner, query] of routes) {
    const previous = await response(owner, query, true), current = await response(owner, query);
    assert.equal(previous.status, 200); assert.equal(current.status, 200);
    assert.equal(previous.json.source, 'google_sheets'); assert.equal(current.json.source, 'postgres');
    previous.json.source = current.json.source;
    assert.deepEqual(current, previous, owner);
  }
});

test('actual Sales GET handlers retain validation, missing-account and HTTP status contracts', async () => {
  for (const [owner, query, status] of [
    ['daily-sales', '?date=bad', 400], ['daily-sales', '?date=2026-11-01&account=missing', 404],
    ['dashboard', '?from=bad&to=2026-11-01', 400], ['dashboard', '?accounts=missing', 404],
    ['dashboard', '?from=2026-11-02&to=2026-11-01', 400], ['profit-summary', '?year=bad', 400],
    ['sync-status', '?month=bad', 400], ['sync-status', '?month=2026-11&account=missing', 404],
  ]) {
    const actual = await response(owner, query); assert.equal(actual.status, status);
    assert.deepEqual(actual, await response(owner, query, true), owner);
  }
});

test('storage failures remain 500 and only obsolete Sheets wording is removed from errors and logs', async () => {
  for (const [owner, query] of routes) {
    const previous = await response(owner, query, true, true), current = await response(owner, query, false, true);
    assert.equal(current.status, 500); assert.equal(previous.status, 500);
    const normalized = JSON.parse(JSON.stringify(previous).replaceAll(' from Google Sheets', ''));
    assert.deepEqual(current, normalized, owner);
    assert.doesNotMatch(current.json.error, /Sheets|PostgreSQL|Supabase/);
  }
});

test('Sales page response types accept postgres and their emitted JavaScript is unchanged', () => {
  for (const file of ['src/app/sales/daily-sales/SalesDailySalesPage.tsx', 'src/app/sales/dashboard/SalesDashboardPage.tsx', 'src/app/sales/profit-summary/SalesProfitSummaryPage.tsx', 'src/app/sales/SalesSyncStatusPage.tsx']) {
    const current = fs.readFileSync(file, 'utf8'), previous = beforeSalesNaming(file).toString();
    assert.match(current, /source\??: "postgres"/);
    const emit = source => ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    assert.equal(emit(current), emit(previous), file);
  }
});

test('current Sales source has no Sheets names, source labels or record aliases', () => {
  function inspect(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (/\.tsx?$/.test(file)) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /GoogleSheets|Google Sheets|google_sheets|SheetRecord/, file);
    }
  }
  for (const folder of ['src/modules/sales', 'src/app/api/sales', 'src/app/sales']) inspect(folder);
});

test('historical source inverse preserves exact predecessor bytes and rejects unreviewed edits', () => {
  const fixture = JSON.parse(fs.readFileSync('tests/fixtures/sales-naming-before.json'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const [file, edit] of Object.entries(fixture.edits)) {
    assert.equal(hash(fs.readFileSync(file)), edit.afterSha256, file);
    assert.equal(hash(beforeSalesNaming(file)), edit.beforeSha256, file);
    assert.throws(() => beforeSalesNaming(file, Buffer.concat([fs.readFileSync(file), Buffer.from('\n')])), { code: 'ERR_ASSERTION' });
  }
});
