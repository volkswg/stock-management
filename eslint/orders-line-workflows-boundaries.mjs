import {noDynamicServerBypass} from './orders-boundaries.mjs';
const scopes={
  "src/infrastructure/persistence/google-sheets/read-and-repair-rows.ts": [
    "./types"
  ],
  "src/modules/inventory/application/movement-journeys.ts": [
    "../contracts",
    "./ports/movement-journeys",
    "../domain/journey-quantities"
  ],
  "src/modules/inventory/application/ports/movement-journeys.ts": [
    "../../contracts"
  ],
  "src/modules/inventory/domain/journey-quantities.ts": [
    "../contracts"
  ],
  "src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "@/infrastructure/persistence/google-sheets/read-and-repair-rows",
    "../../contracts",
    "../../application/ports/movement-journeys",
    "./movement-schema"
  ],
  "src/modules/line-workflows/application/classify-event.ts": [
    "@/shared/types/line-protocol",
    "../contracts",
    "./ports/workflows",
    "./sessions"
  ],
  "src/modules/line-workflows/application/movement-events.ts": [
    "@/shared/types/line-protocol",
    "@/modules/orders/rules",
    "@/modules/inventory/quantity",
    "@/modules/inventory/contracts",
    "../contracts",
    "./ports/workflows",
    "./classify-event",
    "./sessions",
    "./reply"
  ],
  "src/modules/line-workflows/application/order-events.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../contracts",
    "./ports/workflows",
    "./resolve-user-state",
    "../commands",
    "./order-events/complete-bill",
    "./order-events/complete-products",
    "./order-events/create-order",
    "./order-events/bill-image",
    "./order-events/product-image",
    "./order-events/total-price"
  ],
  "src/modules/line-workflows/application/order-events/bill-image.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../../contracts",
    "../ports/workflows"
  ],
  "src/modules/line-workflows/application/order-events/complete-bill.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../../contracts",
    "../ports/workflows",
    "../resolve-user-state",
    "../sessions"
  ],
  "src/modules/line-workflows/application/order-events/complete-products.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../../contracts",
    "../ports/workflows",
    "../resolve-user-state",
    "../sessions"
  ],
  "src/modules/line-workflows/application/order-events/create-order.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "@/modules/orders/rules",
    "../../contracts",
    "../ports/workflows",
    "../resolve-user-state",
    "../sessions"
  ],
  "src/modules/line-workflows/application/order-events/product-image.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../../contracts",
    "../ports/workflows"
  ],
  "src/modules/line-workflows/application/order-events/total-price.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "@/modules/orders/contracts",
    "../../contracts",
    "../ports/workflows",
    "../sessions"
  ],
  "src/modules/line-workflows/application/ports/workflows.ts": [
    "@/modules/orders/contracts",
    "@/modules/inventory/contracts",
    "@/shared/types/line-protocol",
    "../../contracts"
  ],
  "src/modules/line-workflows/application/reply.ts": [
    "@/shared/lib/line-messages",
    "@/shared/types/line-protocol",
    "./ports/workflows"
  ],
  "src/modules/line-workflows/application/resolve-user-state.ts": [
    "@/shared/types/line-protocol",
    "../contracts",
    "./ports/workflows"
  ],
  "src/modules/line-workflows/application/sessions.ts": [
    "@/modules/orders/contracts",
    "@/shared/lib/is-record",
    "../contracts",
    "./ports/workflows"
  ],
  "src/modules/line-workflows/application/webhook.ts": [
    "@/shared/types/line-protocol",
    "../contracts",
    "./ports/workflows",
    "./classify-event",
    "./movement-events",
    "./order-events"
  ],
  "src/modules/line-workflows/commands.ts": [
    "./contracts"
  ],
  "src/modules/line-workflows/contracts.ts": [
    "@/modules/orders/contracts",
    "@/shared/types/line-protocol",
    "@/modules/inventory/contracts"
  ],
  "src/modules/line-workflows/domain/payload.ts": [
    "@/shared/types/line-protocol",
    "@/shared/lib/is-record"
  ],
  "src/modules/line-workflows/infrastructure/google-sheets/sessions.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "@/infrastructure/persistence/google-sheets/const",
    "@/infrastructure/persistence/google-sheets/read-and-repair-rows",
    "./user-state/const",
    "@/modules/orders/contracts",
    "@/modules/inventory/contracts",
    "../../contracts",
    "../../application/ports/workflows"
  ],
  "src/modules/line-workflows/infrastructure/payload.ts": [
    "server-only",
    "../domain/payload",
    "@/shared/types/line-protocol"
  ],
  "src/modules/line-workflows/infrastructure/runtime.ts": [
    "server-only",
    "../application/ports/workflows"
  ],
  "src/modules/line-workflows/server.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "@/infrastructure/files/google-drive/types",
    "@/infrastructure/external/line",
    "@/shared/types/line-protocol",
    "@/config",
    "@/services/utils/createSortableId",
    "@/modules/orders/contracts",
    "@/modules/orders/server",
    "@/modules/inventory/server",
    "./contracts",
    "./application/ports/workflows",
    "./infrastructure/google-sheets/sessions",
    "./infrastructure/runtime",
    "./application/sessions",
    "./application/order-events",
    "./application/movement-events",
    "./application/classify-event",
    "./application/resolve-user-state",
    "./application/reply",
    "./application/order-events/complete-bill",
    "./application/order-events/complete-products",
    "./application/order-events/create-order",
    "./application/order-events/bill-image",
    "./application/order-events/product-image",
    "./application/order-events/total-price",
    "./infrastructure/payload",
    "./domain/payload",
    "./commands",
    "./application/webhook"
  ],
  "src/modules/orders/application/order-attachments.ts": [
    "../contracts",
    "./ports/order-attachments"
  ],
  "src/modules/orders/application/order-images.ts": [
    "../contracts",
    "./ports/order-images",
    "../domain/image-names"
  ],
  "src/modules/orders/application/order-mutations.ts": [
    "../contracts",
    "./ports/order-mutations"
  ],
  "src/modules/orders/application/ports/order-attachments.ts": [
    "../../contracts"
  ],
  "src/modules/orders/application/ports/order-images.ts": [
    "../../contracts"
  ],
  "src/modules/orders/application/ports/order-mutations.ts": [
    "../../contracts"
  ],
  "src/modules/orders/application/replace-product-image.ts": [
    "../contracts",
    "./ports/order-mutations",
    "./ports/order-images"
  ],
  "src/modules/orders/domain/image-names.ts": [
    "../contracts"
  ],
  "src/modules/orders/infrastructure/google-drive/order-images.ts": [
    "server-only",
    "@/infrastructure/files/google-drive/types",
    "../../application/ports/order-images"
  ],
  "src/modules/orders/infrastructure/google-sheets/order-attachments.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "@/infrastructure/persistence/google-sheets/const",
    "./order-bills/const",
    "./order-items/const",
    "./orders/const",
    "../../contracts",
    "../../application/ports/order-attachments"
  ],
  "src/modules/orders/infrastructure/google-sheets/order-mutations.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/types",
    "../../application/ports/order-mutations"
  ],
  "src/modules/orders/rules.ts": [
    "./contracts"
  ],
  "src/shared/lib/is-record.ts": [],
  "src/shared/lib/line-messages.ts": [
    "../types/line-protocol"
  ],
  "src/shared/types/line-protocol.ts": [],
  "src/modules/orders/server.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "@/services/utils/createSortableId",
    "./contracts",
    "./application/create-order",
    "./application/list-orders",
    "./infrastructure/google-sheets/order-list-reader",
    "./infrastructure/google-sheets/order-writer",
    "./application/get-order-detail",
    "./application/ports/order-detail-shipment-projection",
    "./infrastructure/google-sheets/order-detail-reader",
    "./application/order-mutations",
    "./infrastructure/google-sheets/order-mutations",
    "./application/order-attachments",
    "./infrastructure/google-sheets/order-attachments",
    "@/infrastructure/files/google-drive/types",
    "./application/ports/order-images",
    "./application/order-images",
    "./application/replace-product-image",
    "./infrastructure/google-drive/order-images"
  ],
  "src/modules/inventory/server.ts": [
    "server-only",
    "@/infrastructure/persistence/google-sheets/service-contracts",
    "./contracts",
    "@/modules/hr/server",
    "./application/list-adjustment-employees",
    "./infrastructure/google-sheets/adjustments",
    "./application/adjustments",
    "./domain/adjustment-rules",
    "node:crypto",
    "@/modules/sales/server",
    "./application/stock-counts",
    "./infrastructure/google-sheets/stock-counts",
    "./application/movements",
    "./infrastructure/google-sheets/movements",
    "./quantity",
    "./infrastructure/google-sheets/movement-journeys",
    "./application/movement-journeys",
    "./infrastructure/google-sheets/movement-schema"
  ],
  "src/modules/inventory/quantity.ts": [
    "./domain/journey-quantities"
  ]
};
export const ordersLineWorkflowBoundaries=Object.entries(scopes).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{paths:file==='src/modules/orders/server.ts'?[{name:'@/infrastructure/persistence/google-sheets/service-contracts',allowTypeImports:true,message:'Import Sheet interfaces only as erased types.'}]:[],patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`:'.+',message:'Use explicit feature contracts, consumer-owned ports and adapter/server composition.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Keep compatibility and public exports named.'},...((/\/(application|domain)\//.test(file)||file.endsWith('/quantity.ts'))?[{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Inject the current clock.'},{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Inject the current clock.'}]:[]),...(file==='src/modules/orders/server.ts'?[{selector:"ImportDeclaration[source.value='@/infrastructure/persistence/google-sheets/service-contracts']:not([importKind='type'])",message:'No aggregate implementation imports.'}]:[])],
 'no-restricted-globals':['error','process','fetch',...(!file.includes('/server.ts')&&!file.includes('/infrastructure/')?['Buffer']:[])],
}}));
