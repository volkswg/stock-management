import { noDynamicServerBypass } from "./orders-boundaries.mjs";
const transport="@/infrastructure/persistence/google-sheets/";
const classes={orders:{orders:"OrdersSheet","order-items":"OrderItemsSheet","order-bills":"OrderBillsSheet"},shipments:{shipments:"ShipmentsSheet","shipment-orders":"ShipmentOrdersSheet"}};
export const worksheetBoundaries=Object.entries(classes).flatMap(([owner,sheets])=>Object.entries(sheets).flatMap(([folder,name])=>[`${name}.ts`,"const.ts"].map(file=>{
 const paths=file==="const.ts"?[]:[transport+"sheets/BaseGoogleSheet",transport+"types",...(name==="OrdersSheet"?[]:[transport+"const","./const"])];
 return {files:[`src/modules/${owner}/infrastructure/google-sheets/${folder}/${file}`],rules:{
  "no-restricted-imports":["error",{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})$).+`:".+",message:"Worksheet ownership allows only the existing root transport, erased types and own headers."}]}],
  "no-restricted-syntax":[...noDynamicServerBypass,{selector:"ExportAllDeclaration",message:"Keep physical worksheets explicit."},{selector:"ExportNamedDeclaration[source]",message:"No forwarding providers from a physical worksheet."},{selector:`ImportDeclaration[source.value='${transport}types']:not([importKind='type'])`,message:"Generic Sheet interfaces are erased imports."}],
  "no-restricted-globals":["error","process","Buffer","fetch","Date","crypto"],
 }};
})));
