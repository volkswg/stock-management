import type {Product,ProductCreateInput} from '@/modules/products/contracts';
export type CatalogueItem = {id:string;orderId:string;productCode:string;imageUrl:string;imageMediaId:string|null;productId:string|null;revision:string};
export interface OrderItemCatalogueStore {
 read(orderId:string,itemId:string):Promise<CatalogueItem|undefined>;
 link(item:CatalogueItem,productId:string|null):Promise<boolean>;
}
export interface ProductCatalogue {
 find(id:string):Promise<Product|undefined>;
 create(input:ProductCreateInput):Promise<Product>;
}
