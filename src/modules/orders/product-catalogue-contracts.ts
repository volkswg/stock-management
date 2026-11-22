import type {Product,ProductInput} from '@/modules/products/contracts';
export type OrderItemCatalogue = {itemId:string;orderId:string;productCode:string;imageUrl:string;revision:string;product:Product|null};
export type OrderItemCatalogueInput = {expectedRevision:string} & (
 | {mode:'create';product:ProductInput;useItemImage:boolean;confirmSimilar:boolean}
 | {mode:'link';productId:string|null}
);
