import 'server-only';
import {orderItemCatalogue} from './application/product-catalogue';
import {PostgresOrderCatalogue} from './infrastructure/postgres/product-catalogue';
import type {ProductCatalogue} from './application/ports/product-catalogue';
export {OrderCatalogueError} from './application/product-catalogue';
export function createOrderItemCatalogue(products:ProductCatalogue){return orderItemCatalogue(new PostgresOrderCatalogue(),products);}
