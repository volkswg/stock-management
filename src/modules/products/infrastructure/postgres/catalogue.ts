import 'server-only';
import {currentTransaction,requireMutation,PersistenceFailure} from '@/infrastructure/persistence/postgres/database';
import type {Product,ProductInput} from '../../contracts';
import type {ProductStore} from '../../application/ports/catalogue';
const projection=`p.id::text AS id,p."productCode",p."productName",p.variant,p."referenceImageMediaId"::text AS "referenceImageMediaId",coalesce(m."sourceUrl",'') AS "imageUrl",stock_operational.native_timestamp_text(p."createdAt") AS "createdAt",stock_operational.native_timestamp_text(p."updatedAt") AS "updatedAt",CASE WHEN p."deletedAt" IS NULL THEN NULL ELSE stock_operational.native_timestamp_text(p."deletedAt") END AS "deletedAt",p.revision::text AS revision`;
const select=`SELECT ${projection} FROM stock_operational.products p LEFT JOIN stock_operational.media m ON m.id=p."referenceImageMediaId"`;
export async function requireProductSchema() {
 const result=await currentTransaction().query<{present:boolean}>(`SELECT to_regclass('stock_operational.products') IS NOT NULL AND EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.order_items'::regclass AND attname='productId' AND atttypid='bigint'::regtype AND NOT attisdropped) AS present`);
 if(!result.rows[0]?.present)throw new PersistenceFailure(503,'The product catalogue is not installed on this target.');
}
export class PostgresProducts implements ProductStore {
 async search(query:string) {await requireProductSchema();const pattern=query.replace(/[\\%_]/g,'\\$&')+'%';return (await currentTransaction().query<Product>(select+` WHERE p."deletedAt" IS NULL AND (lower(p."productCode") LIKE lower($1) ESCAPE '\\' OR lower(p."productName") LIKE lower($1) ESCAPE '\\') ORDER BY p."createdAt" DESC,p.id DESC LIMIT 30`,[pattern])).rows;}
 async similar(input:ProductInput) {await requireProductSchema();return (await currentTransaction().query<Product>(select+` WHERE p."deletedAt" IS NULL AND ((length($1)>0 AND lower(p."productCode")=lower($1)) OR (lower(p."productName")=lower($2) AND lower(p.variant)=lower($3))) ORDER BY p.id LIMIT 10`,[input.productCode,input.productName,input.variant])).rows;}
 async find(id:string) {await requireProductSchema();return (await currentTransaction().query<Product>(select+' WHERE p.id=$1::bigint',[id])).rows[0];}
 async mediaExists(id:string) {return (await currentTransaction().query('SELECT id FROM stock_operational.media WHERE id=$1::uuid AND "deletedAt" IS NULL',[id])).rowCount===1;}
 async create(input:ProductInput,mediaId:string|null) {await requireProductSchema();const row=await requireMutation().query<{id:string}>(`INSERT INTO stock_operational.products("productCode","productName",variant,"referenceImageMediaId","createdBy") VALUES($1,$2,$3,$4::uuid,'web') RETURNING id::text`,[input.productCode,input.productName,input.variant,mediaId]);return (await this.find(row.rows[0].id))!;}
 async update(id:string,expected:string,input:ProductInput) {await requireProductSchema();const result=await requireMutation().query(`UPDATE stock_operational.products SET "productCode"=$3,"productName"=$4,variant=$5,"updatedAt"=now() WHERE id=$1::bigint AND revision=$2::bigint AND "deletedAt" IS NULL`,[id,expected,input.productCode,input.productName,input.variant]);return result.rowCount===1?this.find(id):undefined;}
 async archive(id:string,expected:string) {await requireProductSchema();const result=await requireMutation().query(`UPDATE stock_operational.products SET "deletedAt"=now(),"updatedAt"=now() WHERE id=$1::bigint AND revision=$2::bigint AND "deletedAt" IS NULL`,[id,expected]);return result.rowCount===1?this.find(id):undefined;}
}
