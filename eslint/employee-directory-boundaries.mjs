import { noDynamicServerBypass } from "./orders-boundaries.mjs";
const files={
 "src/modules/inventory/contracts.ts":[],
 "src/modules/hr/contracts.ts":[],
 "src/modules/inventory/application/ports/employee-directory.ts":["../../contracts"],
 "src/modules/inventory/application/list-adjustment-employees.ts":["../contracts","./ports/employee-directory"],
 "src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts":["server-only","@/externals/google/sheet/types","@/externals/google/sheet/sheets/employees/const","../../contracts"],
 "src/modules/hr/server.ts":["server-only","@/externals/google/sheet/types","./contracts","./infrastructure/google-sheets/employee-directory-reader"],
 "src/services/stock-adjustments/employee-directory.ts":["server-only","@/externals/google/sheet/types","@/modules/inventory/application/ports/employee-directory","@/modules/hr/server"],
};
export const employeeDirectoryBoundaries=Object.entries(files).map(([file,allowed])=>({files:[file],rules:{
 "no-restricted-imports":["error",{patterns:[{regex:allowed.length?`^(?!(?:${allowed.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})$).+`:".+",message:"Use only the exact employee-directory contract and composition dependencies."}]}],
 "no-restricted-syntax":[...noDynamicServerBypass,{selector:"ExportAllDeclaration",message:"Expose only named directory operations and types."},{selector:"ExportNamedDeclaration[source]",message:"No implementation forwarding inside directory owners."},{selector:"ImportDeclaration[source.value='@/externals/google/sheet/types']:not([importKind='type'])",message:"Erase Sheet interface imports."},{selector:"ImportDeclaration[source.value='@/modules/inventory/application/ports/employee-directory']:not([importKind='type'])",message:"The composition consumes only the erased Inventory port."}],
 "no-restricted-globals":["error","Date","process","Buffer","fetch","crypto","performance"],
}}));
// Legacy Inventory algorithms stay in place; close their previous mixed Sheet imports.
employeeDirectoryBoundaries.push({files:["src/services/stock-adjustments/manageStockAdjustments.ts","src/services/stock-counts/manageStockCounts.ts","src/services/movements/manageMovements.ts"],rules:{
 "no-restricted-imports":["error",{patterns:[{regex:"(?:externals/google/sheet$|externals/google/sheet/index|modules/hr/(?:infrastructure|application)|sheets/employees/const|modules/hr/infrastructure)",message:"Inventory consumes the employee directory, never HR headers/private adapters or mixed Sheet barrels."}]}],
 "no-restricted-syntax":noDynamicServerBypass,
}});
