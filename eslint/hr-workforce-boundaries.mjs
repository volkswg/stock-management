import { noDynamicServerBypass } from './orders-boundaries.mjs';
const h='src/modules/hr/';
const scopes={
 [h+'application/ports/workforce.ts']:['../../contracts'],
 [h+'application/employees.ts']:['../contracts','./ports/workforce','../domain/compensation'],
 [h+'application/attendance.ts']:['../contracts','../domain/attendance-rules','./ports/workforce','./ports/payroll'],
 [h+'domain/compensation.ts']:['../contracts'],
 [h+'domain/attendance-rules.ts']:[],
 [h+'infrastructure/google-sheets/workforce-store.ts']:['server-only','@/infrastructure/persistence/google-sheets/types','../../contracts','../../application/ports/workforce','./employees/const','./employee-compensations/const','./employee-timesheets/const'],
 [h+'infrastructure/workforce-runtime.ts']:['server-only','node:crypto'],
};
export const hrWorkforceBoundaries=Object.entries(scopes).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`:'.+',message:'Workforce use cases use only own contracts, deterministic rules and semantic ports; mapping/ranges stay in own adapters.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Keep HR entrypoints named.'},{selector:'ExportNamedDeclaration[source]',message:'A physical workforce owner is not a compatibility forward.'},...(file.includes('/domain/')?[{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Inject the current clock.'},{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Domain dates are supplied values.'}]:[])],
 'no-restricted-globals':['error','process','Buffer','fetch','crypto',...(file.includes('/application/')?['Date','performance']:[])],
}}));
hrWorkforceBoundaries.push({files:['src/app/api/employees/route.ts','src/app/api/employees/[id]/route.ts','src/app/api/employees/timesheets/route.ts','src/app/api/employees/timesheets/[id]/route.ts','src/app/api/employees/timesheets/summary/route.ts','src/app/api/employees/advances/route.ts'],rules:{'no-restricted-imports':['error',{patterns:[{regex:'services/employees(?:$|/(?:index|manageEmployees|manageEmployeeTimesheets))|modules/hr/infrastructure',message:'HR HTTP uses named HR server entrypoints, not legacy business or private adapters.'}]}]}});
for (const file of ['src/services/employees/manageEmployees.ts','src/services/employees/manageEmployeeTimesheets.ts']) {
  hrWorkforceBoundaries.push({files:[file],rules:{
    'no-restricted-imports':['error',{patterns:[{regex:'^(?!@/infrastructure/persistence/google-sheets/service-contracts$|@/modules/hr/contracts$|@/modules/hr/server$).+',message:'Compatibility aliases resolve only to HR public owners and the erased original service signature.'}]}],
    'no-restricted-syntax':['error',...noDynamicServerBypass.slice(1).filter(rule=>rule.selector!=='TSImportEqualsDeclaration'),{selector:'TSImportEqualsDeclaration:not([id.name="EmployeeTimesheetStatus"]), TSImportEqualsDeclaration:not([moduleReference.name="CanonicalStatus"])',message:'Only the original enum identity alias is permitted.'},{selector:'FunctionDeclaration',message:'Legacy paths retain aliases, not business implementations.'},{selector:'ArrowFunctionExpression',message:'Keep the original function object through a typed alias.'},{selector:'FunctionExpression',message:'Keep the original function object through a typed alias.'},{selector:'ClassDeclaration',message:'Error classes have one HR domain owner.'}],
  }});
}
