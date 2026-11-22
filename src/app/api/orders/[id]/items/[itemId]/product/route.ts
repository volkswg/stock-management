import {withPersistence} from '@/composition/postgres/route';
import {orderProducts} from '@/composition/order-products';
import {OrderCatalogueError} from '@/modules/orders/product-catalogue-server';
import type {OrderItemCatalogueInput} from '@/modules/orders/product-catalogue-contracts';
import {ProductError} from '@/modules/products/server';
export const runtime='nodejs';
type Context={params:Promise<{id:string;itemId:string}>};
async function execute(request:Request,{params}:Context){
 try{
  const {id,itemId}=await params;
  if(!id.trim()||!itemId.trim()||id.length>128||itemId.length>128)return Response.json({error:'Invalid order item.'},{status:400});
  const service=orderProducts();
  if(request.method==='GET')return Response.json({item:await service.read(id,itemId)});
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Choose create or link.'},{status:400});
  const value=body as Record<string,unknown>;
  if(typeof value.expectedRevision!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(value.expectedRevision))return Response.json({error:'Refresh this order item before saving.'},{status:428});
  if(value.mode==='link'&&value.productId!==null&&typeof value.productId!=='string')return Response.json({error:'Choose a valid product.'},{status:400});
  if(value.mode==='create'&&(!value.product||typeof value.product!=='object'||Array.isArray(value.product)))return Response.json({error:'Enter product details.'},{status:400});
  return Response.json({item:await service.save(id,itemId,value as OrderItemCatalogueInput)},{status:value.mode==='create'?201:200});
 }catch(error){if(error instanceof OrderCatalogueError||error instanceof ProductError)return Response.json({error:error.message,code:error.code},{status:error.status});throw error;}
}
export const GET=withPersistence(execute);
export const POST=withPersistence(execute);
