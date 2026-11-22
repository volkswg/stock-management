import {withPersistence} from '@/composition/postgres/route';
import {createProductCatalogue,ProductError} from '@/modules/products/server';
export const runtime='nodejs';
async function get(request:Request){
 try{return Response.json({products:await createProductCatalogue().search(new URL(request.url).searchParams.get('q')||'')});}
 catch(error){if(error instanceof ProductError)return Response.json({error:error.message,code:error.code},{status:error.status});throw error;}
}
export const GET=withPersistence(get);
