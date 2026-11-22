import type {OrderItemCatalogue,OrderItemCatalogueInput} from '../product-catalogue-contracts';
import {catalogueMutation,CatalogueRequestError,retryCatalogueRequest} from '@/modules/products/browser';
export {catalogueMutation,CatalogueRequestError,pendingCatalogueRequest,searchCatalogue,updateCatalogueProduct,archiveCatalogueProduct} from '@/modules/products/browser';
export const itemCataloguePath=(orderId:string,itemId:string)=>`/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/product`;
export async function readItemCatalogue(orderId:string,itemId:string,{signal}:{signal?:AbortSignal}={}){
 const response=await fetch(itemCataloguePath(orderId,itemId),{headers:{Accept:'application/json','x-stock-edit-protocol':'row-v1'},cache:'no-store',signal});
 const value=await response.json();
 if(!response.ok)throw new CatalogueRequestError(value.error||'Could not load the product catalogue.',response.status,value.code);
 return value as {item:OrderItemCatalogue};
}
export function saveItemCatalogue(orderId:string,itemId:string,input:OrderItemCatalogueInput){return catalogueMutation<{item:OrderItemCatalogue}>(itemCataloguePath(orderId,itemId),'POST',input);}
export function retryItemCatalogue(orderId:string,itemId:string){return retryCatalogueRequest<{item:OrderItemCatalogue}>(itemCataloguePath(orderId,itemId));}
