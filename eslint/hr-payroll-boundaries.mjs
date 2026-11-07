import { noDynamicServerBypass } from './orders-boundaries.mjs';
const h='src/modules/hr/';
const paths={
 [h+'domain/salary-rules.ts']:['../contracts'],
 [h+'domain/payroll-calculation.ts']:['../contracts','./salary-rules'],
 [h+'application/ports/payroll.ts']:['../../contracts'],
 [h+'application/salary-advances.ts']:['../contracts','../domain/salary-rules','./ports/payroll','./ports/salary-advance-shops'],
 [h+'application/calculate-payroll.ts']:['../contracts','../domain/payroll-calculation','./salary-advances','./ports/payroll'],
 [h+'application/settle-payroll.ts']:['../domain/salary-rules','./salary-advances','./ports/payroll'],
 [h+'infrastructure/google-sheets/salary-store.ts']:['server-only','@/infrastructure/persistence/google-sheets/types','../../contracts','../../domain/salary-rules','../../application/ports/payroll','./employee-advances/const'],
 [h+'infrastructure/payroll-revision.ts']:['server-only','node:crypto','../contracts'],
 [h+'payroll-server.ts']:['server-only','./application/ports/salary-advance-shops','./application/ports/payroll','./infrastructure/google-sheets/salary-store','./application/salary-advances','./application/calculate-payroll','./application/settle-payroll','./infrastructure/payroll-revision','./domain/salary-rules'],
 'src/services/employees/payroll-composition.ts':['server-only','@/externals/google/sheet/types','@/modules/hr/application/ports/salary-advance-shops','@/modules/hr/application/ports/payroll','@/modules/hr/payroll-server','@/modules/hr/server','@/services/sales/getGoogleSheetsDailySales','./salary-advance-shops'],
};
export const hrPayrollBoundaries=Object.entries(paths).map(([file,allowed])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:`^(?!(?:${allowed.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`,message:'HR payroll uses only explicit pure contracts, consumer ports and own adapters; legacy reads are composed outside the feature core.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Keep HR exports explicit.'},...(file.endsWith('payroll-server.ts')?[]:[{selector:'ExportNamedDeclaration[source]',message:'Physical HR owners do not forward implementations.'}]),...(file.includes('/domain/')?[{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Only supplied-date operations belong in HR domain.'},{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Inject the clock.'}]:[])],
 'no-restricted-globals':['error','process','Buffer','fetch','crypto',...(file.includes('/application/')?['Date','performance']:[])],
}}));
hrPayrollBoundaries.push({files:['src/app/employees/advances/SalaryAdvancesPage.tsx','src/app/employees/payroll/payrollPdf.ts'],rules:{'no-restricted-imports':['error',{patterns:[{regex:'services/employees|modules/hr/(?:payroll-server|server|infrastructure|application)',message:'Browser payroll/advances consume pure HR contracts only.'}]}]}});
hrPayrollBoundaries.push({files:['src/app/api/employees/advances/route.ts','src/app/api/employees/payroll/route.ts','src/app/api/employees/payroll/settle/route.ts'],rules:{'no-restricted-imports':['error',{patterns:[{regex:'services/employees/(?:manageSalaryAdvances|calculateEmployeePayroll|settleEmployeePayroll)|modules/hr/infrastructure',message:'HTTP composes named HR payroll entrypoints with injected readers.'}]}]}});
