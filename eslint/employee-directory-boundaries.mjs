import { noDynamicServerBypass } from "./orders-boundaries.mjs";
const files={
 "src/modules/inventory/contracts.ts":[],
 "src/modules/hr/contracts.ts":[],
 "src/modules/inventory/application/ports/employee-directory.ts":["../../contracts"],
 "src/modules/inventory/application/list-adjustment-employees.ts":["../contracts","./ports/employee-directory"],
 "src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts":["server-only","@/externals/google/sheet/types","@/externals/google/sheet/sheets/employees/const","../../contracts"],
 "src/modules/hr/server.ts":["server-only","@/externals/google/sheet/types","./contracts","./infrastructure/google-sheets/employee-directory-reader","./application/ports/payroll","./application/employees","./application/attendance","./infrastructure/google-sheets/workforce-store","./infrastructure/workforce-runtime","./domain/attendance-rules"],
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
// Legacy-local movement schema prerequisite: no LINE/session dependency in the leaf.
employeeDirectoryBoundaries.push({files:["src/services/movements/worksheet-schema.ts"],rules:{
 "no-restricted-imports":["error",{patterns:[{regex:"^(?!@/infrastructure/persistence/google-sheets/types$).+",message:"Movement worksheet schemas use only erased root Sheet interfaces."}]}],
 "no-restricted-syntax":[...noDynamicServerBypass,{selector:"ImportDeclaration:not([importKind='type'])",message:"The schema leaf has no runtime imports."},{selector:"ExportAllDeclaration",message:"Keep schema exports explicit."},{selector:"ExportNamedDeclaration[source]",message:"Do not forward implementation dependencies from schemas."}],
 "no-restricted-globals":["error","Date","process","Buffer","fetch","crypto","performance"],
}});
const legacyInventoryImportPatterns=employeeDirectoryBoundaries.find(scope=>scope.files.includes("src/services/movements/manageMovements.ts")).rules["no-restricted-imports"][1].patterns;
employeeDirectoryBoundaries.push({files:["src/services/movements/manageMovements.ts"],rules:{
 "no-restricted-imports":["error",{patterns:[...legacyInventoryImportPatterns,{regex:"(?:^|/)state(?:\\.ts)?$",message:"Movement business operations consume worksheet-schema, not LINE session state."}]}],
}});
// Inventory's Sales read dependency must not evaluate the aggregate Sheets registry.
const salesHeaderLeaves=["receipts","receipt-items","receipt-payments","receipt-syncs"].map(folder=>`@/modules/sales/infrastructure/google-sheets/${folder}/const`);
const salesQueryImports=["@/externals/google/sheet/types","@/modules/expenses/contracts","@/modules/sales/contracts",...salesHeaderLeaves];
employeeDirectoryBoundaries.push({files:["src/services/sales/getGoogleSheetsDailySales.ts"],rules:{
 "no-restricted-imports":["error",{patterns:[{regex:`^(?!(?:${salesQueryImports.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})$).+`,message:"Sales queries consume exact headers and erased pure types, never mixed registries."}]}],
 "no-restricted-syntax":[...noDynamicServerBypass,{selector:"ExportAllDeclaration",message:"Keep query exports explicit."},{selector:"ExportNamedDeclaration[source]",message:"Do not forward implementation dependencies."},...salesQueryImports.slice(0,3).map(path=>({selector:`ImportDeclaration[source.value='${path}']:not([importKind='type'])`,message:"Query type dependencies must be erased."}))],
 "no-restricted-globals":["error","process","Buffer","fetch","crypto"],
}});
const stockCountImports=employeeDirectoryBoundaries.find(scope=>scope.files.includes("src/services/stock-counts/manageStockCounts.ts")).rules["no-restricted-imports"][1].patterns;
employeeDirectoryBoundaries.push({files:["src/services/stock-counts/manageStockCounts.ts"],rules:{"no-restricted-imports":["error",{patterns:[...stockCountImports,{regex:"(?:^|/)sales(?:/index(?:\\.ts)?)?$",message:"Stock counts use the direct Sales query, not its mixed service barrel."}]}]}});
employeeDirectoryBoundaries.push({files:["src/modules/sales/contracts.ts"],rules:{
 "no-restricted-imports":["error",{patterns:[{regex:".+",message:"This exact Sales DTO leaf has no dependencies."}]}],
 "no-restricted-syntax":[...noDynamicServerBypass,{selector:"ExportAllDeclaration",message:"No broad contract forwarding."},{selector:"ExportNamedDeclaration[source]",message:"Define the canonical DTO here."},{selector:"VariableDeclaration",message:"This contract exports only its erased DTO."},{selector:"FunctionDeclaration",message:"No runtime contract exports."},{selector:"ClassDeclaration",message:"No runtime contract exports."},{selector:"TSEnumDeclaration",message:"No runtime contract exports."},{selector:"ExpressionStatement",message:"No side effects in Sales contracts."}],
 "no-restricted-globals":["error","Date","process","Buffer","fetch","crypto"],
}});
