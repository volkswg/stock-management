import 'server-only';
import {currentTransaction,requireMutation} from '@/infrastructure/persistence/postgres/database';
import type {OrderItemCatalogueStore,CatalogueItem} from '../../application/ports/product-catalogue';
export class PostgresOrderCatalogue implements OrderItemCatalogueStore {
 async read(orderId:string,itemId:string){
  // Parent ownership and active state are checked in SQL; no trusted client URL/media ID.
  const result=await currentTransaction().query<CatalogueItem>(`SELECT i.id::text AS id,i."orderId",coalesce(i."productCode",'') AS "productCode",coalesce(m."sourceUrl",'') AS "imageUrl",i."imageMediaId"::text AS "imageMediaId",i."productId"::text AS "productId",i.revision::text AS revision FROM stock_operational.order_items i JOIN stock_operational.orders o ON o.id=i."orderId" LEFT JOIN stock_operational.media m ON m.id=i."imageMediaId" WHERE i.id::text=$1 AND i."orderId"=$2 AND i."deletedAt" IS NULL AND o."deletedAt" IS NULL`,[itemId,orderId]);return result.rows[0];
 }
 async link(item:CatalogueItem,productId:string|null){return (await requireMutation().query(`UPDATE stock_operational.order_items SET "productId"=$4::bigint,"updatedAt"=now() WHERE id::text=$1 AND "orderId"=$2 AND revision=$3::bigint AND "deletedAt" IS NULL`,[item.id,item.orderId,item.revision,productId])).rowCount===1;}
}
