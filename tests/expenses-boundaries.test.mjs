import { completionExtraFiles, assertCompletionHistory } from "./helpers/hr-application-history.mjs";
import { hrFiles, assertHRHistory } from "./helpers/hr-payroll-history.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ESLint} from 'eslint';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';
import {expensesFiles,expensesNewFiles,expensesHistory,assertExpensesHistory,expenseBrowserFixed} from './helpers/expenses-business-history.mjs';
import {expenseGraph} from './helpers/expenses-business.mjs';

test('Expenses contracts/rules and legacy forwards retain original declarations and a single error/function identity',()=>{
 for(const file of expensesFiles){if(completionExtraFiles.has(file))assertCompletionHistory(file,hash);else if(hrFiles.has(file))assertHRHistory(file,expensesHistory.files[file].sha256);else assertExpensesHistory(file,expensesHistory.files[file].sha256);}
 const original=expensesHistory.files['src/services/expenses/manageExpenses.ts'].source;
 const rules=readFileSync('src/modules/expenses/domain/rules.ts','utf8');
 assert.ok(rules.includes(original.slice(original.indexOf('export class ExpenseError'),original.indexOf('const text'))));
 assert.ok(rules.includes(original.match(/export const validMonth = .*;\n/)[0]));
 assert.ok(rules.includes(original.slice(original.indexOf('function validDate'),original.indexOf('export async function readTable'))));
 const adapter=readFileSync('src/modules/expenses/infrastructure/google-sheets/expense-store.ts','utf8');
 assert.ok(adapter.includes(original.slice(original.indexOf('export async function readTable'),original.indexOf('export async function listExpenseCategories'))));
 for(const path of ['src/modules/expenses/server.ts','src/modules/expenses/infrastructure/google-sheets/expense-store.ts','src/services/employees/salary-advance-shops.ts'])assert.match(readFileSync(path,'utf8'),/^import "server-only";/);
 const app=readFileSync('src/modules/expenses/application/manage-expenses.ts','utf8');
 for(const name of ['saveExpense','saveExpenseMaster']){const start=source=>source.indexOf('\n',source.indexOf('export async function '+name))+1;const before=original.slice(start(original)),after=app.slice(start(app));const end=before.indexOf(name==='saveExpense'?'  const [rows':'  const isShop');assert.equal(after.slice(0,end),before.slice(0,end));}
 const graph=expenseGraph(),legacy=graph.api(),server=graph.load('src/modules/expenses/server.ts'),index=graph.load('src/services/expenses/index.ts');
 assert.deepEqual(Object.keys(legacy).sort(),['ExpenseError','listExpenseCategories','listExpenseShops','listExpenses','readTable','removeExpense','saveExpense','saveExpenseMaster','validMonth'].sort());
 for(const key of Object.keys(legacy)){assert.equal(legacy[key],server[key]);if(key!=='readTable')assert.equal(legacy[key],index[key]);}
 assert.equal(legacy.ExpenseError,graph.load('src/modules/expenses/domain/rules.ts').ExpenseError);
});

test('Expenses runtime/type graphs enforce pure application, public HR shop contract, browser debt reduction and unchanged legacy cycle',()=>{
 const graph=userStateGraph(),provider=p=>p.startsWith('src/services/')||p.startsWith('src/externals/')||p.startsWith('src/config/')||p.startsWith('src/app/');
 for(const types of [false,true]){
  assert.deepEqual(graph.modules(types).sort(),types?['hr->expenses','shipments->orders']:['shipments->orders']);
  for(const file of expensesNewFiles.filter(f=>f.startsWith('src/modules/expenses/'))){assert.equal(graph.trace(file,types,provider),null,file);assert.equal(graph.trace(file,types,p=>p.startsWith('src/modules/')&&!p.startsWith('src/modules/expenses/')),null,file);}
  for(const file of graph.all.filter(f=>f.startsWith('src/infrastructure/')))assert.equal(graph.trace(file,types,p=>p.startsWith('src/modules/')),null,file);
  for(const root of expenseBrowserFixed)assert.equal(graph.trace(root,types,p=>provider(p)&&p!==root||/\/modules\/expenses\/(?:server|application|infrastructure)/.test(p)),null,root);
  for(const root of graph.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))))assert.equal(graph.trace(root,false,p=>p==='src/modules/expenses/server.ts'||p==='src/services/employees/salary-advance-shops.ts'),null,root);
 }
 const port='src/modules/hr/application/ports/salary-advance-shops.ts';assert.deepEqual(graph.deps(port,false),[]);assert.deepEqual(graph.deps(port,true),['src/modules/expenses/contracts.ts']);
 for(const path of ['@/modules/expenses/infrastructure/google-sheets/expense-store','@/services/expenses'])assert.ok(userStateGraph({[port]:`export type X=import("${path}");`}).trace(port,true,p=>p==='src/modules/expenses/server.ts'||p==='src/modules/expenses/infrastructure/google-sheets/expense-store.ts'));
});

test('Expenses exact lint scopes reject private/legacy, erased, relative, dynamic and global IO bypasses',async()=>{
 const eslint=new ESLint();
 for(const file of expensesNewFiles.filter(f=>f.startsWith('src/modules/'))){const [ok]=await eslint.lintText(readFileSync(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));
  for(const source of ['import type { Expense } from "@/services/expenses"; export type X=Expense;','export { StockCountsSheet } from "@/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet";','export type X=import("@/config").AppConfig;','const x=require("node:fs"); export {x};','const x=import("@/config"); export {x};']){const [bad]=await eslint.lintText(source,{filePath:file});assert.ok(bad.errorCount>0,`${file}: ${source}`);}
 }
 const [bad]=await eslint.lintText('export const x=Date.now();',{filePath:'src/modules/expenses/application/manage-expenses.ts'});assert.ok(bad.errorCount>0);
});
