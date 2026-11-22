import type {OrderItemCatalogueInput,OrderItemCatalogue} from '../product-catalogue-contracts';
import type {OrderItemCatalogueStore,ProductCatalogue} from './ports/product-catalogue';
export class OrderCatalogueError extends Error {
 constructor(message:string,readonly status=400,readonly code='order_catalogue_invalid'){super(message);}
}
export function orderItemCatalogue(store:OrderItemCatalogueStore,products:ProductCatalogue){
 async function read(orderId:string,itemId:string):Promise<OrderItemCatalogue>{
  const item=await store.read(orderId,itemId);if(!item)throw new OrderCatalogueError('Order item was not found.',404);
  return {itemId:item.id,orderId:item.orderId,productCode:item.productCode,imageUrl:item.imageUrl,revision:item.revision,product:item.productId?await products.find(item.productId)??null:null};
 }
 return {read,async save(orderId:string,itemId:string,input:OrderItemCatalogueInput){
  const item=await store.read(orderId,itemId);if(!item)throw new OrderCatalogueError('Order item was not found.',404);
  if(item.revision!==input.expectedRevision)throw new OrderCatalogueError('This order item changed. Refresh and review before saving.',409,'product_revision_conflict');
  let productId:string|null;
  if(input.mode==='create'){
   if(typeof input.useItemImage!=='boolean'||typeof input.confirmSimilar!=='boolean')throw new OrderCatalogueError('Review the image and duplicate confirmation.');
   const product=await products.create({...input.product,referenceImageMediaId:input.useItemImage?item.imageMediaId:null,confirmSimilar:input.confirmSimilar});productId=product.id;
  }else if(input.mode==='link'){
   productId=input.productId;
   if(productId!==null){const product=await products.find(productId);if(!product||product.deletedAt)throw new OrderCatalogueError('Select an available product.',409);}
  }else throw new OrderCatalogueError('Choose create or link.');
  // The HTTP command transaction owns both this update and any product insert.
  // A late stale-row failure must roll back the insert as well.
  if(!await store.link(item,productId))throw new OrderCatalogueError('This order item changed. Refresh before saving.',409,'product_revision_conflict');
  return read(orderId,itemId);
 }};
}
