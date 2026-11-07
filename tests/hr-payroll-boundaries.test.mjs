import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import {ESLint}from'eslint';
import {hrBefore,hrFiles,hrNewFiles,assertHRHistory,expectedHRContracts,hrBrowserFixed}from'./helpers/hr-payroll-history.mjs';
import {hrPayrollGraph}from'./helpers/hr-payroll.mjs';import {userStateGraph}from'./helpers/user-state-worksheet-graph.mjs';
function cycles(graph,types){const seen=new Set(),active=[],result=[];function visit(file){if(active.includes(file)){result.push([...active.slice(active.indexOf(file)),file]);return;}if(seen.has(file))return;active.push(file);graph.deps(file,types).forEach(visit);active.pop();seen.add(file);}graph.all.forEach(visit);return result;}

test('HR contracts, numerical payroll body, pure salary rules, schema helpers and revision hashing retain original source and identities',()=>{
 for(const file of hrFiles)assertHRHistory(file,hrBefore.files[file]?.sha256??hrBefore.types[file]?.sha256??hrBefore.edits[file].sha256);
 assert.equal(readFileSync('src/modules/hr/contracts.ts','utf8'),expectedHRContracts());
 const salary=hrBefore.files['src/services/employees/manageSalaryAdvances.ts'].source,payroll=hrBefore.files['src/services/employees/calculateEmployeePayroll.ts'].source,settle=hrBefore.files['src/services/employees/settleEmployeePayroll.ts'].source;
 const body=payroll.slice(payroll.indexOf('  const netSalesByShopDate'),payroll.indexOf('\nfunction calculateBucketCount')),helpers=payroll.slice(payroll.indexOf('function calculateBucketCount')).replace('function getMonthEnd','export function getMonthEnd');
 const domain=readFileSync('src/modules/hr/domain/payroll-calculation.ts','utf8');assert.ok(domain.includes(body));assert.ok(domain.endsWith(helpers));
 let rules=salary.slice(salary.indexOf('export class SalaryAdvanceError'),salary.indexOf('export async function readSalaryTable')).replace(salary.match(/export const bangkokToday = .*;\n/)[0],'').replace('const str =','export const str =').replace('function record(','export function record(').replace('function field(','export function field(');rules+=salary.slice(salary.indexOf('export function recoveredAmount'),salary.indexOf('export async function createSalaryAdvance')).replace('function assertOpenMonth(','export function assertOpenMonth(');
 assert.equal(readFileSync('src/modules/hr/domain/salary-rules.ts','utf8'),'import type { SalaryAdvance, AdvanceDeduction, PayrollSettlement } from "../contracts";\n\n'+rules);
 assert.ok(readFileSync('src/modules/hr/infrastructure/google-sheets/salary-store.ts','utf8').includes(salary.slice(salary.indexOf('export async function readSalaryTable'),salary.indexOf('export async function listSalaryAdvances'))));
 assert.ok(readFileSync('src/modules/hr/infrastructure/payroll-revision.ts','utf8').includes(settle.slice(settle.indexOf('// Includes attendance'),settle.indexOf('export async function settleEmployeePayroll'))));
 const g=hrPayrollGraph(),old=hrPayrollGraph({original:true}),legacy=g.salary(),server=g.load('src/modules/hr/payroll-server.ts');assert.deepEqual(Object.keys(legacy),Object.keys(old.salary()));
 for(const key of ['SalaryAdvanceError','bangkokToday','validMoney','validAdvanceDate','validPayrollMonth','money','recoveredAmount','calculateAdvanceDeductions','listSalaryAdvances','listPayrollSettlements','readSalaryLedger','transitionSalaryAdvance'])assert.equal(legacy[key],server[key]);
 assert.equal(g.load('src/services/employees/manageEmployeeTimesheets.ts').EmployeeTimesheetStatus,g.load('src/modules/hr/contracts.ts').EmployeeTimesheetStatus);
});

test('full HR runtime/type graphs remove the exact inherited payroll cycle and both browser paths without cross-feature private imports',()=>{
 const current=userStateGraph(),historical=userStateGraph(Object.fromEntries(Object.entries(hrBefore.files).filter(([file])=>file.startsWith('src/services/employees/')).map(([file,e])=>[file,e.source]))),baseline=JSON.parse(readFileSync('tests/fixtures/user-state-worksheet-before.json','utf8')).graphBaseline;
 for(const types of [false,true]){
  current.modules(types);assert.deepEqual(cycles(current,types),[]);assert.deepEqual(cycles(historical,types),baseline[types?'typeCycles':'runtimeCycles']);
  for(const file of hrNewFiles.filter(f=>f.startsWith('src/modules/hr/'))){assert.equal(current.trace(file,types,p=>p.startsWith('src/services/')||p.startsWith('src/externals/')||p.startsWith('src/config/')||p.startsWith('src/app/')),null,file);assert.equal(current.trace(file,types,p=>p.startsWith('src/modules/')&&!p.startsWith('src/modules/hr/')&&p!=='src/modules/expenses/contracts.ts'),null,file);}
  for(const root of hrBrowserFixed)assert.equal(current.trace(root,types,p=>p.startsWith('src/services/')||p.startsWith('src/externals/')||p.startsWith('src/infrastructure/')||/^src\/modules\/[^/]+\/(?:application|infrastructure|.*server\.ts)/.test(p)),null,root);
  for(const root of current.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))))assert.equal(current.trace(root,false,p=>hrNewFiles.includes(p)),null,root);
  for(const root of current.all.filter(f=>f.startsWith('src/infrastructure/')))assert.equal(current.trace(root,types,p=>p.startsWith('src/modules/')),null,root);
 }
 // Reinstating either exact old browser import still reaches legacy provider composition.
 for(const [file,edit]of Object.entries(hrBefore.edits)){
  const restored=readFileSync(file,'utf8').replace('"'+edit.to+'"','"'+edit.from+'"'),root=file.endsWith('payrollPdf.ts')?'src/app/employees/payroll/PayrollPage.tsx':file;
  assert.ok(userStateGraph({[file]:restored}).trace(root,true,p=>p.startsWith('src/externals/')),root);
 }
 const physical='src/modules/hr/domain/payroll-calculation.ts';
 for(const source of ['export { calculateEmployeePayroll } from "@/services/employees/calculateEmployeePayroll";','export { getGoogleSheetsSalesDashboard } from "@/services/sales/getGoogleSheetsDailySales";'])assert.throws(()=>userStateGraph({[physical]:source}).modules(true));
 for(const file of ['src/modules/hr/payroll-server.ts','src/modules/hr/infrastructure/google-sheets/salary-store.ts','src/modules/hr/infrastructure/payroll-revision.ts','src/services/employees/payroll-composition.ts'])assert.match(readFileSync(file,'utf8'),/^import "server-only";/);
});

test('HR payroll exact lint scopes reject legacy/private/erased/relative/dynamic and implicit-clock dependencies',async()=>{
 const eslint=new ESLint();for(const file of hrNewFiles){const [ok]=await eslint.lintText(readFileSync(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));
  for(const source of ['import type { EmployeePayroll } from "@/services/employees/calculateEmployeePayroll"; export type X=EmployeePayroll;','export { RecordsSheet } from "@/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet";','export type X=import("@/config").AppConfig;','const x=import("@/config"); export {x};','const x=require("node:fs"); export {x};']){const [bad]=await eslint.lintText(source,{filePath:file});assert.ok(bad.errorCount>0,`${file}: ${source}`);}}
 for(const file of ['src/modules/hr/application/calculate-payroll.ts','src/modules/hr/domain/salary-rules.ts'])for(const source of ['export const x=Date.now();','export const x=new Date();']){const [bad]=await eslint.lintText(source,{filePath:file});assert.ok(bad.errorCount>0,`${file}: ${source}`);}
});
