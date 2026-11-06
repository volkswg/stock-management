// Exact prerequisite scopes: the mixed aggregate remains legacy composition,
// while these four erased consumers use its pure interface leaf.
const types="@/externals/google/sheet/types";
const files={
 "src/modules/orders/server.ts":["server-only",types,"@/services/utils/createSortableId","./contracts","./application/create-order","./application/list-orders","./application/get-order-detail","./application/ports/order-detail-shipment-projection","./infrastructure/google-sheets/order-detail-reader","./infrastructure/google-sheets/order-list-reader","./infrastructure/google-sheets/order-writer"],
 "src/modules/orders/infrastructure/google-sheets/order-row-mapping.ts":["server-only","../../contracts",types],
 "src/modules/orders/infrastructure/google-sheets/order-writer.ts":["server-only",types,"@/externals/google/sheet/const","@/externals/google/sheet/sheets/orders/const","../../contracts","../../application/ports/created-order-writer"],
 "src/modules/orders/infrastructure/google-sheets/order-list-reader.ts":["server-only",types,"../../contracts","../../application/ports/order-list-reader","./order-row-mapping"],
};
export const ordersSheetTypeBoundaries=Object.entries(files).map(([file,allowed])=>({files:[file],rules:{
 "no-restricted-imports":["error",{
  paths:[{name:types,allowTypeImports:true,message:"Import Sheet interfaces only as erased types."}],
  patterns:[{regex:`^(?!(?:${allowed.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})$).+`,message:"Use the exact pure Sheet type leaf, not the mixed aggregate or other implementations."}],
 }],
}}));
