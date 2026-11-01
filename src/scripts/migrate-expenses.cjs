/* Run from the repository root:
 * node --env-file=.env src/scripts/migrate-expenses.cjs [--apply] [--backup-dir /private/path]
 * Default is read-only. The legacy sheet is NEVER changed.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const root = process.cwd();
const ts = require(path.join(root, 'node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const original = Module._load;
Module._load = function (id, parent, isMain) {
  if (id.startsWith('@/')) return original.call(this, path.join(root, 'src', id.slice(2)), parent, isMain);
  return original.apply(this, arguments);
};
(async () => {
  const { getConfig } = require(path.join(root, 'src/config/index.ts'));
  const { createGoogleSheetsServiceFromConfig } = require(path.join(root, 'src/externals/google/sheet/createGoogleSheetsServiceFromConfig.ts'));
  const { sourceExpenseRows, rebuildSourceExpenses, rebuildExpenseData } = require(path.join(root, 'src/services/expenses/migrateExpenses.ts'));
  const config = getConfig();
  const keys = ['expensesWorksheetName', 'expenseCategoriesWorksheetName', 'shopsWorksheetName'];
  const names = keys.map(key => config.googleSheets[key]);
  const otherNames = Object.entries(config.googleSheets).filter(([key]) => key.endsWith('WorksheetName') && !keys.includes(key)).map(([, value]) => value);
  if (new Set(names).size !== names.length || names.some(name => otherNames.includes(name))) throw new Error('Destination worksheet names collide with existing application sheets.');
  const service = createGoogleSheetsServiceFromConfig(config);
  const source = await service.salesProfitExpenses.readRows('A:K');
  const records = sourceExpenseRows(source);
  const totals = {};
  for (const row of records) { const key = `${row[1]}:${row[8] || 'SHOP'}:${row[2] || 'shared'}`; totals[key] = Math.round(((totals[key] || 0) + Number(row[3])) * 100) / 100; }
  const rebuilt = rebuildSourceExpenses(source);
  console.log(JSON.stringify({ rebuiltRecords: rebuilt.length, mode: process.argv.includes('--apply') ? 'apply' : 'read-only preview', sourceSheet: config.googleSheets.salesProfitExpensesWorksheetName, destinationSheets: names, records: records.length, totals }, null, 2));
  if (!process.argv.includes('--apply')) return;
  const backupIndex = process.argv.indexOf('--backup-dir');
  if (backupIndex < 0 || !process.argv[backupIndex + 1]) throw new Error('--apply requires --backup-dir outside the repository.');
  const directory = path.resolve(process.argv[backupIndex + 1]);
  if (directory === root || directory.startsWith(root + path.sep)) throw new Error('Store the private migration backup outside the repository.');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = path.join(directory, `expense-source-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const accounts = config.loyverse.accounts.map(({ id, shopName }) => ({ id, shopName }));
  fs.writeFileSync(backup, JSON.stringify({ sourceSheet: config.googleSheets.salesProfitExpensesWorksheetName, readAt: new Date().toISOString(), sha256: hash(source), rows: source, accounts }, null, 2), { mode: 0o600, flag: 'wx' });
  console.log('Backup saved:', backup);
  const result = await rebuildExpenseData(service, source, accounts);
  const after = await service.salesProfitExpenses.readRows('A:K');
  if (hash(after) !== hash(source)) throw new Error('Source changed during migration. Reconcile before deployment.');
  console.log(JSON.stringify({ result, sourceUnchanged: true, backup }, null, 2));
})().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed.'); process.exitCode = 1; });
