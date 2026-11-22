import {withPersistence} from '@/composition/postgres/route';
import {createProductCatalogue,ProductError} from '@/modules/products/server';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
async function execute(request:Request,{params}:Context){
 try{
  if(request.method==='GET'){const product=await createProductCatalogue().find((await params).id);return product?Response.json({product}):Response.json({error:'Product was not found.'},{status:404});}
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Enter product details.'},{status:400});
  const data=body as Record<string,unknown>,id=(await params).id,catalogue=createProductCatalogue();
  if(typeof data.expectedRevision!=='string')return Response.json({error:'Refresh the product before editing.'},{status:428});
  const product=request.method==='DELETE'?await catalogue.archive(id,data.expectedRevision):await catalogue.update(id,data.expectedRevision,data);
  return Response.json({product});
 }catch(error){if(error instanceof ProductError)return Response.json({error:error.message,code:error.code},{status:error.status});throw error;}
}
export const GET=withPersistence(execute);
export const PATCH=withPersistence(execute);
export const DELETE=withPersistence(execute);
