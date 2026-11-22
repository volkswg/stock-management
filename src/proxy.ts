import {NextRequest,NextResponse} from 'next/server';

// Preview-only server bridge behind the existing Vercel Authentication perimeter.
// The staging bearer remains server-side; ordinary staging/production auth is unchanged.
export function proxy(request:NextRequest){
 if(process.env.STOCK_UAT_HOSTED_BROWSER!=='reviewed-preview-product-uat-v1')return NextResponse.next();
 const host=process.env.VERCEL_URL,token=process.env.STOCK_STAGING_AUTH_TOKEN;
 let database:URL;try{database=new URL(process.env.STOCK_DATABASE_URL||'');}catch{return NextResponse.json({error:'UAT target is unavailable.'},{status:503});}
 const ref='orjnazrothkdgmzlsuto';
 if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||!host||!/^stock-management-[a-z0-9]+-volkswgs-projects\.vercel\.app$/.test(host)||
    process.env.STOCK_STAGING_ENABLED!=='true'||process.env.STOCK_PRODUCTION_ENABLED==='true'||process.env.STOCK_PRODUCTION_RELEASE_JSON||
    process.env.STOCK_TARGET_ISOLATION_ID!=='160669bd-2f6f-4490-9259-bada5a1d02c4'||!token||token.length<48||
    database.hostname!=='aws-0-ap-northeast-1.pooler.supabase.com'||database.port!=='5432'||database.pathname!=='/postgres'||database.search||database.hash||
    decodeURIComponent(database.username)!=='stock_uat_runtime_20261122.'+ref||request.nextUrl.hostname!==host||request.headers.get('host')!==host){
  return NextResponse.json({error:'UAT target is unavailable.'},{status:503});
 }
 const path=request.nextUrl.pathname,method=request.method;
 const read=['GET','HEAD'].includes(method)&&/^(\/api\/orders(?:\/[^/]+)?|\/api\/shipments(?:\/[^/]+)?|\/api\/products|\/api\/orders\/[^/]+\/items\/[^/]+\/product)$/.test(path);
 const write=(method==='POST'&&/^\/api\/orders\/[^/]+\/items\/[^/]+\/product$/.test(path))||(['PATCH','DELETE'].includes(method)&&/^\/api\/products\/[1-9][0-9]*$/.test(path))||
  (method==='PATCH'&&/^\/api\/orders\/[^/]+\/items(?:\/[^/]+)?$/.test(path));
 if(!read&&!write)return NextResponse.json({error:'External integrations and unrelated operations are disabled in product UAT.'},{status:405});
 if(write&&request.headers.has('origin')&&request.headers.get('origin')!=='https://'+host)return NextResponse.json({error:'Use this UAT deployment directly.'},{status:403});
 const headers=new Headers(request.headers);headers.set('authorization','Bearer '+token);
 return NextResponse.next({request:{headers}});
}
export const config={matcher:'/api/:path*'};
