import {retirementChanged,retirementNewFiles} from "./retirement-history.mjs";
import {shipmentValidationFile,validationBefore,assertShipmentValidationImportHistory} from "./shipments-validation-history.mjs";
import {shipmentHttpBefore,assertShipmentHttpHistory} from "./shipments-http-history.mjs";
import {assertOrdersSheetTypeHistory,sheetTypesBefore} from "./orders-sheet-type-history.mjs";
import {cleanupNewFiles,cleanupChanged} from "./cleanup-history.mjs";
import {externalNewFiles,externalChanged} from "./external-history.mjs";
import {assertOrdersDetailServerHistory} from "./orders-detail-history.mjs";
import {ordersLineNewFiles,ordersLineChanged} from "./orders-line-history.mjs";
import {inventoryApplicationChanged,assertInventoryApplicationHistory}from "./inventory-application-history.mjs";
import { restoreSalesApplicationSource, salesApplicationFiles, salesApplicationBefore } from "./sales-application-history.mjs";
import assert from 'node:assert/strict';
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from 'node:crypto';
export const expensesHistory=JSON.parse(readFileSync('tests/fixtures/expenses-business-before.json','utf8'));
export const expensesFiles=new Set([...Object.keys(expensesHistory.files),...Object.keys(salesApplicationBefore.files),...Object.keys(salesApplicationBefore.edits),...inventoryApplicationChanged,...ordersLineChanged,...externalChanged,...cleanupChanged,...retirementChanged]);
export const expensesNewFiles=[
 ...retirementNewFiles,...cleanupNewFiles,...externalNewFiles,...ordersLineNewFiles,...salesApplicationFiles,
 'src/modules/expenses/contracts.ts','src/modules/expenses/server.ts','src/modules/expenses/domain/rules.ts','src/modules/expenses/application/manage-expenses.ts','src/modules/expenses/application/ports/expense-store.ts','src/modules/expenses/infrastructure/google-sheets/expense-store.ts','src/modules/hr/application/ports/salary-advance-shops.ts','src/services/employees/salary-advance-shops.ts',
];
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreExpensesSource(file,source=readFileSync(file,'utf8')){
 source=restoreSalesApplicationSource(file,source);
 const e=expensesHistory.files[file];if(!e)return source;assert.equal(hash(e.source),e.sha256,file);let expected=e.source;
 if(file==='src/services/expenses/types.ts'){
  const i=expected.indexOf('export type Expense');assert.equal(readFileSync('src/modules/expenses/contracts.ts','utf8'),expected.slice(i));expected=expected.slice(0,i)+'export type { Expense, ExpenseCategory, ExpenseShop, ExpenseInput } from "@/modules/expenses/contracts";\n';
 }else if(file==='src/services/expenses/manageExpenses.ts')expected='export { listExpenses, saveExpense, removeExpense, listExpenseCategories, listExpenseShops, saveExpenseMaster, ExpenseError, validMonth, readTable } from "@/modules/expenses/server";\n';
 else if(file==='src/services/employees/manageSalaryAdvances.ts')expected=expected.replace('import { listExpenseShops } from "@/services/expenses";','import { createSalaryAdvanceShops } from "./salary-advance-shops";\nimport type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";').replace('createSalaryAdvance(service: IGoogleSheetsService, input: unknown)','createSalaryAdvance(service: IGoogleSheetsService, input: unknown, shopsReader: SalaryAdvanceShops = createSalaryAdvanceShops(service))').replace('listExpenseShops(service)]','shopsReader.listShops()]');
 else if(file==='src/services/sales/getGoogleSheetsDailySales.ts')expected=expected.replace('"@/services/expenses/types"','"@/modules/expenses/contracts"');
 else if(file.startsWith('src/app/expenses/'))expected=expected.replace('"@/services/expenses"','"@/modules/expenses/contracts"');
 else expected=expected.replaceAll('from "@/services/expenses"','from "@/modules/expenses/server"').replace('import type { ExpenseInput } from "@/modules/expenses/server"','import type { ExpenseInput } from "@/modules/expenses/contracts"');
 if(file==='src/app/api/employees/advances/route.ts')expected='import { createSalaryAdvanceShops } from "@/services/employees/salary-advance-shops";\n'+expected.replace('try { const advance = await createSalaryAdvance(service(), await request.json().catch(() => null));','try { const sheets = service(); const advance = await createSalaryAdvance(sheets, await request.json().catch(() => null), createSalaryAdvanceShops(sheets));');
 assert.equal(source,expected,file);return e.source;
}
export function assertExpensesHistory(file,expected){
 if(file===shipmentValidationFile&&validationBefore.sha256===expected)return assertShipmentValidationImportHistory(file,expected);
 if(shipmentHttpBefore.sources[file]?.sha256===expected)return assertShipmentHttpHistory(file,expected);
 if(inventoryApplicationChanged.has(file))return assertInventoryApplicationHistory(file,expected);
 if(file!=="src/modules/orders/server.ts"&&sheetTypesBefore.files[file]?.sha256===expected)return assertOrdersSheetTypeHistory(file,expected);
 let source=restoreExpensesSource(file);
 if(hash(source)!==expected){
  const remaining=JSON.parse(readFileSync('tests/fixtures/remaining-worksheets-before.json','utf8')).splits[file];
  if(remaining){
   const declarations=remaining.names.map(n=>remaining.source.match(new RegExp('export const '+n+' = .*;\\n'))[0]);let rest=remaining.source;for(const d of declarations)rest=rest.replace(d,'');const alias='@/'+remaining.to.slice(4,-3),prefix=(file.includes('manageSalaryAdvances')?`import { ${remaining.names.join(', ')} } from "${alias}";\n`:'')+`export { ${remaining.names.join(', ')} } from "${alias}";\n`;assert.equal(source,prefix+rest,file);source=remaining.source;
  }else if(file==='src/modules/orders/server.ts'){
   const e=JSON.parse(readFileSync('tests/fixtures/orders-sheet-types-before.json','utf8')).files[file];
   const restored=source.replace('"@/externals/google/sheet/types"','"@/externals/google/sheet"');assert.equal(restored,e.source,file);
   if(hash(restored)===expected)return;return assertOrdersDetailServerHistory(file,expected);
  }else if(file==='src/services/movements/state.ts'){
   const e=JSON.parse(readFileSync('tests/fixtures/movement-schema-before.json','utf8')).files[file];
   for(const c of e.changes.toReversed()){assert.equal(source.split(c.to).length-1,1,file);source=source.replace(c.to,c.from);}assert.equal(source,e.source,file);
  }else{const prior=JSON.parse(readFileSync('tests/fixtures/inventory-sales-query-before.json','utf8')).files[file];assert.ok(prior,file);for(const c of prior.changes.toReversed()){assert.equal(source.split(c.to).length,2,file);source=source.replace(c.to,c.from);}assert.equal(source,prior.source,file);}
 }
 assert.equal(hash(source),expected,file);
}
export const expenseBrowserFixed=['src/app/expenses/ExpenseMasterPage.tsx','src/app/expenses/ExpensesPage.tsx'];
export const expectedExpensesDebts=baseline=>baseline.filter(e=>!expenseBrowserFixed.includes(typeof e==='string'?e:e.root));
