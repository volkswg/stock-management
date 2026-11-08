import { noDynamicServerBypass } from './orders-boundaries.mjs';
const scopes={
  "src/modules/sales/server.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "@/modules/expenses/contracts",
    "./contracts",
    "./application/reports",
    "./infrastructure/google-sheets/sales-reader",
    "@/infrastructure/external/loyverse",
    "./application/sync-receipts",
    "./infrastructure/google-sheets/receipt-sync",
    "./application/ports/receipt-sync",
    "node:crypto",
    "./application/cost-overrides",
    "./infrastructure/google-sheets/cost-overrides",
    "./contracts",
    "./application/sync-status",
    "./infrastructure/google-sheets/sync-status",
    "./infrastructure/google-sheets/sales-reader",
    "@/infrastructure/external/loyverse",
    "./application/receipts-for-date"
  ],
  "src/modules/sales/application/reports.ts": [
    "@/modules/expenses/contracts",
    "../contracts",
    "./ports/sales-reader"
  ],
  "src/modules/sales/application/ports/sales-reader.ts": [],
  "src/modules/sales/application/sync-receipts.ts": [
    "./ports/receipt-sync",
    "../domain/receipt-ids"
  ],
  "src/modules/sales/application/ports/receipt-sync.ts": [],
  "src/modules/sales/application/ports/receipt-source.ts": [],
  "src/modules/sales/application/receipts-for-date.ts": [
    "./ports/receipt-source"
  ],
  "src/modules/sales/application/cost-overrides.ts": [
    "../contracts",
    "./ports/cost-overrides"
  ],
  "src/modules/sales/application/ports/cost-overrides.ts": [
    "../../contracts"
  ],
  "src/modules/sales/application/sync-status.ts": [
    "../contracts",
    "./ports/sync-status"
  ],
  "src/modules/sales/application/ports/sync-status.ts": [
    "../../contracts"
  ],
  "src/modules/sales/domain/receipt-ids.ts": [],
  "src/modules/sales/infrastructure/google-sheets/sales-reader.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../application/ports/sales-reader",
    "@/modules/sales/infrastructure/google-sheets/receipts/const",
    "@/modules/sales/infrastructure/google-sheets/receipt-items/const",
    "@/modules/sales/infrastructure/google-sheets/receipt-payments/const",
    "@/modules/sales/infrastructure/google-sheets/receipt-syncs/const"
  ],
  "src/modules/sales/infrastructure/google-sheets/receipt-sync.ts": [
    "node:crypto",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../application/ports/receipt-sync",
    "../../application/ports/receipt-source",
    "./receipts/const",
    "./receipt-items/const",
    "./receipt-payments/const",
    "./receipt-syncs/const",
    "../../domain/receipt-ids",
    "./receipt-row-mapping",
    "../../application/receipts-for-date"
  ],
  "src/modules/sales/infrastructure/google-sheets/receipt-row-mapping.ts": [
    "../../application/ports/receipt-source"
  ],
  "src/modules/sales/infrastructure/google-sheets/cost-overrides.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "./profit-cost-overrides/const",
    "../../contracts",
    "../../application/ports/cost-overrides"
  ],
  "src/modules/sales/infrastructure/google-sheets/sync-status.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../contracts",
    "../../application/ports/sync-status"
  ]
};
export const salesApplicationBoundaries=Object.entries(scopes).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`:'.+',message:'Sales reports use public contracts and semantic reader ports; persistence mapping stays in the adapter.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,...(file.endsWith('/google-sheets/receipt-sync.ts')?[{selector:'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(appendRows|updateRows|appendValues|updateValues|clear|deleteRow)$/]',message:'Receipt sync must publish through one validated atomic workbook request, never independent mutations.'}]:[]),...((/\/(application|domain)\//.test(file)||file.endsWith('/quantity.ts'))?[{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Inject the current clock.'},{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Inject the current clock.'}]:[]),{selector:'ExportAllDeclaration',message:'Keep exports named.'}],
 'no-restricted-globals':['error','process','Buffer','fetch','crypto',...(file.includes('/application/')?['performance']:[])],
}}));
