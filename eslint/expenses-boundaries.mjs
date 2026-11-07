import { noDynamicServerBypass } from './orders-boundaries.mjs';
const base='src/modules/expenses/';
const imports={
 [base+'contracts.ts']:[],
 [base+'domain/rules.ts']:[],
 [base+'application/ports/expense-store.ts']:[],
 [base+'application/manage-expenses.ts']:['../contracts','../domain/rules','./ports/expense-store'],
 [base+'infrastructure/google-sheets/expense-store.ts']:['server-only','@/infrastructure/persistence/google-sheets/types','../../application/ports/expense-store','../../domain/rules','./expenses/const'],
 [base+'server.ts']:['server-only','node:crypto','./contracts','./application/manage-expenses','./infrastructure/google-sheets/expense-store','./domain/rules'],
 'src/modules/hr/application/ports/salary-advance-shops.ts':['@/modules/expenses/contracts'],
};
export const expensesBoundaries=Object.entries(imports).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`:'.+',message:'Use only the explicit Expenses port, contract and adapter dependencies.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Use explicit named exports.'},...(file.endsWith('server.ts')?[]:[{selector:'ExportNamedDeclaration[source]',message:'Physical owners do not forward implementations.'}]),...((file.includes('/application/')||file.endsWith('contracts.ts'))?[{selector:'ImportDeclaration:not([importKind="type"])[source.value=/contracts|ports/]',message:'Contract and port imports are erased.'}]:[])],
 'no-restricted-globals':['error','process','Buffer','fetch','crypto',...(file.includes('/application/')?['Date','performance']:[])],
}}));
expensesBoundaries.push({files:[base+'domain/rules.ts'],rules:{'no-restricted-syntax':[...noDynamicServerBypass,{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Only deterministic supplied-date validation belongs in rules.'}]}});
expensesBoundaries.push({files:['src/app/expenses/ExpensesPage.tsx','src/app/expenses/ExpenseMasterPage.tsx'],rules:{'no-restricted-imports':['error',{patterns:[{regex:'services/expenses|modules/expenses/(?:server|application|infrastructure)',message:'Browser Expenses pages consume only public contracts.'}]}]}});
expensesBoundaries.push({files:['src/services/employees/manageSalaryAdvances.ts','src/app/api/employees/advances/route.ts','src/app/api/sales/profit-summary/route.ts'],rules:{'no-restricted-imports':['error',{patterns:[{regex:'services/expenses|modules/expenses/(?:infrastructure|application)',message:'HR/Sales use public Expenses contracts/query composition, never private storage or legacy Expenses implementations.'}]}]}});
