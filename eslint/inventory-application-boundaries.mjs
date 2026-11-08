import { noDynamicServerBypass } from './orders-boundaries.mjs';
const scopes={
  "src/modules/inventory/server.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "./contracts",
    "@/modules/hr/server",
    "./application/list-adjustment-employees",
    "./infrastructure/google-sheets/adjustments",
    "./application/adjustments",
    "./domain/adjustment-rules",
    "./domain/adjustment-rules",
    "./application/adjustments",
    "node:crypto",
    "@/modules/sales/server",
    "./application/stock-counts",
    "./infrastructure/google-sheets/stock-counts",
    "./contracts",
    "./contracts",
    "./application/movements",
    "./infrastructure/google-sheets/movements",
    "./quantity",
    "./contracts"
  ],
  "src/modules/inventory/quantity.ts": [],
  "src/modules/inventory/domain/adjustment-rules.ts": [
    "../contracts"
  ],
  "src/modules/inventory/domain/movement-rules.ts": [
    "../contracts"
  ],
  "src/modules/inventory/application/adjustments.ts": [
    "../contracts",
    "../contracts",
    "../domain/adjustment-rules",
    "./ports/adjustments"
  ],
  "src/modules/inventory/application/stock-counts.ts": [
    "../contracts",
    "./adjustments",
    "./ports/stock-counts"
  ],
  "src/modules/inventory/application/movements.ts": [
    "../contracts",
    "./ports/movements",
    "../quantity",
    "../domain/movement-rules"
  ],
  "src/modules/inventory/application/ports/adjustments.ts": [
    "../../contracts"
  ],
  "src/modules/inventory/application/ports/stock-counts.ts": [
    "../../contracts"
  ],
  "src/modules/inventory/application/ports/movements.ts": [
    "../../contracts"
  ],
  "src/modules/inventory/infrastructure/google-sheets/adjustments.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../contracts",
    "./stock-adjustments/const",
    "../../domain/adjustment-rules",
    "../../application/ports/adjustments"
  ],
  "src/modules/inventory/infrastructure/google-sheets/stock-counts.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "./stock-counts/const",
    "../../contracts",
    "../../application/ports/stock-counts"
  ],
  "src/modules/inventory/infrastructure/google-sheets/movements.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../contracts",
    "../../application/ports/movements",
    "../../domain/movement-rules",
    "./movement-schema"
  ],
  "src/modules/inventory/infrastructure/google-sheets/movement-schema.ts": [
    "@/infrastructure/persistence/google-sheets/types"
  ]
};
export const inventoryApplicationBoundaries=Object.entries(scopes).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`:'.+',message:'Inventory business uses own contracts and semantic ports; mapping stays in adapters and public readers are composed only at the server.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,...((/\/(application|domain)\//.test(file)||file.endsWith('/quantity.ts'))?[{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Inject the current clock.'},{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Inject the current clock.'}]:[]),{selector:'ExportAllDeclaration',message:'Keep exports named.'}],
 'no-restricted-globals':['error','process','Buffer','fetch','crypto',...(file.includes('/application/')?['performance']:[])],
}}));
