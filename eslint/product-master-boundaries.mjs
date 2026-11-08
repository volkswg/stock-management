import { noDynamicServerBypass } from './orders-boundaries.mjs';
const scopes = {
 'src/modules/products/contracts.ts': [],
 'src/modules/products/domain/validation.ts': ['../contracts','@/shared/lib/request-id'],
 'src/modules/products/application/products.ts': ['./ports/product-store','../contracts','../domain/validation'],
 'src/modules/products/application/ports/product-store.ts': ['../../contracts'],
 'src/modules/products/infrastructure/google-sheets/product-store.ts': ['server-only','@/infrastructure/persistence/google-sheets/client','@/infrastructure/persistence/google-sheets/guarded-write','../../contracts','../../application/ports/product-store','../../domain/validation'],
 'src/modules/products/server.ts': ['server-only','@/infrastructure/persistence/google-sheets/client','./infrastructure/google-sheets/product-store','./application/products','./contracts','./domain/validation','@/infrastructure/persistence/google-sheets/guarded-write'],
 'src/modules/orders/product-link-contracts.ts': [],
 'src/modules/orders/application/ports/product-links.ts': ['../../product-link-contracts'],
 'src/modules/orders/application/product-links.ts': ['@/shared/lib/request-id','./ports/product-links','../product-link-contracts'],
 'src/modules/orders/infrastructure/google-sheets/product-links.ts': ['server-only','@/shared/lib/request-id','@/infrastructure/persistence/google-sheets/client','@/infrastructure/persistence/google-sheets/guarded-write','./order-items/const','./orders/const','../../application/ports/product-links','../../product-link-contracts'],
 'src/modules/orders/product-link-server.ts': ['server-only','@/infrastructure/persistence/google-sheets/client','./application/ports/product-links','./infrastructure/google-sheets/product-links','./application/product-links','./product-link-contracts'],
 'src/infrastructure/persistence/google-sheets/guarded-write.ts': ['server-only','node:crypto','./client','./types'],
 'src/infrastructure/security/product-staff-session.ts': ['server-only','node:crypto','@/config/product-master-access'],
 'src/infrastructure/http/read-json.ts': ['server-only'],
 'src/config/product-master-access.ts': ['server-only'],
 'src/composition/product-master.ts': ['server-only','@/config','@/infrastructure/persistence/google-sheets/client','@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth','@/infrastructure/persistence/google-sheets/const','@/modules/products/server','@/modules/orders/product-link-server'],
 'src/composition/product-master-http.ts': ['server-only','next/server','@/modules/products/server','@/modules/orders/product-link-server','@/infrastructure/persistence/google-sheets/guarded-write','@/infrastructure/security/product-staff-session','@/config/product-master-access'],
};
const quote = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const productMasterBoundaries=Object.entries(scopes).map(([file,paths])=>({files:[file],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:paths.length?`^(?!(?:${paths.map(quote).join('|')})$).+`:'.+',message:'Product Master uses its own contracts/ports and explicit server composition; never private cross-feature persistence or legacy services.'}]}],
 'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Keep public exports named.'},...(/\/(application|domain)\//.test(file)?[{selector:'NewExpression[callee.name="Date"][arguments.length=0]',message:'Inject the clock.'},{selector:'CallExpression[callee.object.name="Date"][callee.property.name="now"]',message:'Inject the clock.'}]:[]),...(file==='src/infrastructure/security/product-staff-session.ts'?[{selector:'ImportDeclaration[source.value="@/config/product-master-access"]:not([importKind="type"])',message:'Session verification receives settings; it must not read environment configuration.'}]:[])],
 'no-restricted-globals':['error',...(!file.startsWith('src/config/')?['process']:[]),...(/\/(application|domain)\//.test(file)||file.includes('contracts.ts')?['fetch','Buffer','crypto','performance']:[])],
}}));
productMasterBoundaries.push({files:['src/modules/products/ui/**/*.{ts,tsx}'],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:'(^|/)(application|infrastructure|config|composition|services|app)(/|$)|(^|/)[^/]*server(\\.[^/]+)?$|^node:|^(server-only|next/server|next/headers)$',message:'Product UI must use browser contracts and same-origin HTTP only.'},{regex:'(^|/)modules/(?!products/)',message:'Cross-feature UI is injected at app composition.'}]}],
 'no-restricted-syntax':noDynamicServerBypass,
 'no-restricted-globals':['error','process','Buffer'],
}});
// No cross-feature UI edges: the app owns ProductSelector composition.
productMasterBoundaries.push({files:['src/modules/orders/ui/OrderItemProductLink.tsx','src/modules/orders/ui/OrderAdditionalProductLinks.tsx','src/modules/orders/ui/OrderProductLinkProvider.tsx','src/modules/orders/ui/[[]id[]]/product-picker-port.ts'],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:'(^|/)(services|infrastructure|application|composition|config|app)(/|$)|(^|/)[^/]*server(\.[^/]+)?$|(^|/)modules/(?!orders/)|^node:|^(server-only|next/server|next/headers)$',message:'Orders identification UI owns its contracts and injected picker; keep other features at app composition.'}]}],
 'no-restricted-syntax':noDynamicServerBypass,
 'no-restricted-globals':['error','process','Buffer'],
}});
const routeScopes={
 'src/app/api/products/route.ts':['@/composition/product-master','@/composition/product-master-http','@/infrastructure/http/read-json','@/modules/products/server','@/shared/lib/is-record'],
 'src/app/api/products/[id]/route.ts':['@/composition/product-master','@/composition/product-master-http','@/infrastructure/http/read-json','@/modules/products/server','@/shared/lib/is-record','@/modules/products/contracts'],
 'src/app/api/products/suggestions/route.ts':['@/composition/product-master','@/composition/product-master-http','@/infrastructure/http/read-json'],
 'src/app/api/products/creations/[requestId]/cancel/route.ts':['@/composition/product-master','@/composition/product-master-http','@/infrastructure/http/read-json','@/modules/products/server','@/shared/lib/is-record'],
 'src/app/api/orders/[id]/product-links/route.ts':['@/composition/product-master','@/composition/product-master-http'],
 'src/app/api/orders/[id]/items/[itemId]/product/route.ts':['@/composition/product-master','@/composition/product-master-http','@/infrastructure/http/read-json','@/modules/products/server','@/shared/lib/is-record'],
 'src/app/api/product-access/route.ts':['next/server','@/config/product-master-access','@/infrastructure/security/product-staff-session','@/infrastructure/http/read-json'],
};
for(const [file,paths]of Object.entries(routeScopes))productMasterBoundaries.push({files:[file.replace(/\[([^\]]+)\]/g,'[[]$1[]]')],rules:{
 'no-restricted-imports':['error',{patterns:[{regex:`^(?!(?:${paths.map(quote).join('|')})$).+`,message:'Product HTTP routes use named composition, validation and pure contracts only.'}]}],
 'no-restricted-syntax':noDynamicServerBypass,
 'no-restricted-globals':['error','process','Buffer'],
}});
