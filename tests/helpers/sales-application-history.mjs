import {restoreOrdersLineSource} from "./orders-line-history.mjs";
import { restoreInventoryApplicationSource, inventoryApplicationFiles, inventoryApplicationChanged } from "./inventory-application-history.mjs";
export {inventoryApplicationChanged};
import { salesOwners } from "./sales-source.mjs";
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const salesApplicationBefore=JSON.parse(readFileSync('tests/fixtures/sales-application-before.json','utf8'));
const priorSources=new Map();
for(const name of ['expenses-business-before','inventory-sales-query-before','movement-schema-before','inventory-employee-directory-before','remaining-worksheets-before']){const d=JSON.parse(readFileSync(`tests/fixtures/${name}.json`,'utf8'));for(const [file,e]of Object.entries({...d.files,...d.edits,...d.splits,...d.moves})){if(e.source){const set=priorSources.get(file)??new Set();set.add(e.source);if(e.after)set.add(e.after);priorSources.set(file,set);}}}

export const salesApplicationFiles=[...salesOwners.filter(f=>!f.endsWith('/contracts.ts')),...inventoryApplicationFiles];
const reportApp='src/modules/sales/application/reports.ts', reportAdapter='src/modules/sales/infrastructure/google-sheets/sales-reader.ts';
const query='src/services/sales/getGoogleSheetsDailySales.ts';
export function restoreSalesApplicationSource(file,source=readFileSync(file,'utf8')){
 source=restoreOrdersLineSource(file,source);
 source=restoreInventoryApplicationSource(file,source);
 const edit=salesApplicationBefore.edits?.[file];
 if(edit) {
  assert.equal(createHash('sha256').update(restoreOrdersLineSource(file)).digest('hex'),salesApplicationBefore.changedHashes[file],file);
  if(createHash('sha256').update(source).digest('hex')===edit.sha256||priorSources.get(file)?.has(source))return source;
  for(const change of edit.changes.toReversed()){assert.equal(source.split(change.to).length-1,1,file);source=source.replace(change.to,change.from);}
  assert.equal(createHash('sha256').update(source).digest('hex'),edit.sha256,file);return source;
 }
 const saved=salesApplicationBefore.files[file];if(!saved)return source;
 assert.equal(createHash('sha256').update(saved.source).digest('hex'),saved.sha256);
 if(source===saved.source||priorSources.get(file)?.has(source)){assert.equal(createHash('sha256').update(restoreOrdersLineSource(file)).digest('hex'),salesApplicationBefore.changedHashes[file],file);return source;}
 if(file.endsWith('/contracts.ts')){const original=salesApplicationBefore.files[query].source;assert.equal(source,(saved.source+'\nimport type { Expense } from "@/modules/expenses/contracts";\n\n'+original.slice(original.indexOf('export type GoogleSheetsDailySalesItemRow'),original.indexOf('type SheetRecord'))+(()=>{const status=salesApplicationBefore.files['src/services/sales/listSalesSyncStatus.ts'].source;return status.slice(status.indexOf('export type'),status.indexOf('export async function'));})()).replace(/\n+$/,'\n'));}
 else if(file.startsWith('src/app/')) assert.equal(source,saved.source.replaceAll('from "@/services/sales"','from "@/modules/sales/server"'));
 else if(file==='src/services/employees/payroll-composition.ts') assert.equal(source,saved.source.replace('import { getGoogleSheetsSalesDashboard } from "@/services/sales/getGoogleSheetsDailySales";','import { createSalesDashboardReader } from "@/modules/sales/server";').replace('{ readSales: input => getGoogleSheetsSalesDashboard({...input, googleSheetsService: service}) }','createSalesDashboardReader(service)'));
 else if(file===query) {
  const names=[...saved.source.matchAll(/export type (\w+)/g)].map(x=>x[1]);
  assert.equal(source,`export type { ${names.join(', ')} } from "@/modules/sales/contracts";\nexport { getGoogleSheetsDailySales, getGoogleSheetsSalesDashboard, getGoogleSheetsProfitSummary } from "@/modules/sales/server";\n`);
  const app=readFileSync(reportApp,'utf8'),adapter=readFileSync(reportAdapter,'utf8');
  const start=saved.source.indexOf('async function readRecords('),end=saved.source.indexOf('function aggregateItems(',start);
  assert.ok(adapter.endsWith(saved.source.slice(start,end).replaceAll('RowsSheet','IGoogleRowsSheet')));
  let expected=saved.source.slice(saved.source.indexOf('export async function getGoogleSheetsDailySales'),start)+saved.source.slice(end);
  expected=expected.replaceAll('googleSheetsService','reader').replaceAll('IGoogleSheetsService','SalesReader').replaceAll('GoogleSheetCellValue','SalesValue');
  for(const [name,header,method]of [['salesReceipts','SALES_RECEIPT_HEADERS','receipts'],['salesReceiptItems','SALES_RECEIPT_ITEM_HEADERS','items'],['salesReceiptPayments','SALES_RECEIPT_PAYMENT_HEADERS','payments'],['salesReceiptSyncs','SALES_RECEIPT_SYNC_HEADERS','syncs']])expected=expected.replace(new RegExp(`readRecords\\(\\s*reader\\.${name},\\s*${header},?\\s*\\)`,'g'),`reader.${method}()`);
  const split=expected.indexOf('function createDashboardDays');
  let operations=expected.slice(0,split).replaceAll('export async function','async function').replaceAll('  reader,','  googleSheetsService,').replaceAll('  reader: SalesReader;','  googleSheetsService: Context;');
  operations=operations.replace(/(\): Promise<\w+> \{\n)/g,'$1  const reader = createReader(googleSheetsService);\n');
  expected='export function createSalesReports<Context>(createReader: (context: Context) => SalesReader) {\n'+operations+'return { getGoogleSheetsDailySales, getGoogleSheetsSalesDashboard, getGoogleSheetsProfitSummary };\n}\n\n'+expected.slice(split);
  assert.equal(app.slice(app.indexOf('export function createSalesReports')),expected);
 }
 if(file!==query&&!file.endsWith("/contracts.ts")&&!file.startsWith("src/app/")&&file!=="src/services/employees/payroll-composition.ts"){assert.equal(source,salesApplicationBefore.facades[file],file);for(const [owner,expected]of Object.entries(salesApplicationBefore.ownerHashes))assert.equal(createHash("sha256").update(restoreOrdersLineSource(owner)).digest("hex"),expected,owner);}
 return saved.source;
}
