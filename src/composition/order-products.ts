import 'server-only';
import {createProductCatalogue} from '@/modules/products/server';
import {createOrderItemCatalogue} from '@/modules/orders/product-catalogue-server';
export function orderProducts(){return createOrderItemCatalogue(createProductCatalogue());}
