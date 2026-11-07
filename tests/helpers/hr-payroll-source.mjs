import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
export const hrSourceFiles=new Set(['src/services/employees/manageSalaryAdvances.ts','src/services/employees/calculateEmployeePayroll.ts','src/services/employees/settleEmployeePayroll.ts','src/services/employees/payroll-composition.ts',...['contracts.ts','payroll-server.ts','domain/salary-rules.ts','domain/payroll-calculation.ts','application/salary-advances.ts','application/calculate-payroll.ts','application/settle-payroll.ts','infrastructure/google-sheets/salary-store.ts','infrastructure/payroll-revision.ts','infrastructure/google-sheets/employee-advances/const.ts'].map(f=>'src/modules/hr/'+f)]);
export function createHRSourceLoader({imports={},globals={}}={}){
 const cache=new Map(),forbidden=()=>assert.fail('Unstubbed HR reader');
 function load(file){assert.ok(hrSourceFiles.has(file),`Unapproved HR source ${file}`);if(cache.has(file))return cache.get(file);const exports={},code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;cache.set(file,exports);
  new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){
   if(Object.hasOwn(imports,spec))return imports[spec];
   if(spec==='server-only')return {};
   if(spec==='node:crypto')return {createHash};
   if(spec==='./manageEmployees')return {listEmployees:forbidden,listEmployeeCompensations:forbidden};
   if(spec==='./manageEmployeeTimesheets')return {listEmployeeTimesheetsForMonth:forbidden};
   if(spec==='@/services/sales/getGoogleSheetsDailySales')return {getGoogleSheetsSalesDashboard:forbidden};
   if(spec==='./salary-advance-shops')return {createSalaryAdvanceShops:service=>({listShops:()=>{const expense=imports['@/modules/expenses/server']??imports['@/services/expenses'];assert.ok(expense,'Unstubbed HR shop reader');return expense.listExpenseShops(service);}})};
   let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';return load(target);
  }});return exports;
 }return load;
}
