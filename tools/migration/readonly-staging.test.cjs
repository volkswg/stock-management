/* eslint-disable @typescript-eslint/no-require-imports -- Test actual TypeScript owners through the existing offline loader. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {transaction,requireMutation,PersistenceFailure}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {installReadOnlyProviderGuard}=require('../../src/infrastructure/runtime/staging-read-only.ts');
test('read-only staging rejects every mutation and webhook before handler, DB or provider execution',async()=>{
 const before={...process.env};
 try{
  Object.assign(process.env,{STOCK_STORAGE:'supabase',STOCK_STAGING_READ_ONLY:'true',STOCK_STAGING_ENABLED:'true',STOCK_DATABASE_URL:'postgres://unused@example.invalid/postgres',STOCK_STAGING_AUTH_TOKEN:'synthetic-authorization-token-32-characters',STOCK_TARGET_ISOLATION_ID:'00000000-0000-0000-0000-000000000001'});delete process.env.VERCEL_ENV;
  let calls=0;const handler=withPersistence(async()=>{calls++;return Response.json({});},{lineWebhook:true});
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])for(const path of ['/api/orders','/api/line/webhook']){
   const response=await handler(new Request('https://example.test'+path,{method,headers:{authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN}}));
   assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET, HEAD');
  }
  assert.equal((await handler(new Request('https://example.test/api/orders',{method:'POST'}))).status,401);
  await assert.rejects(transaction(true,async()=>{calls++;}),e=>e instanceof PersistenceFailure&&e.status===405);
  assert.throws(requireMutation,e=>e instanceof PersistenceFailure&&e.status===405);assert.equal(calls,0);
 }finally{process.env=before;}
});
test('provider guard denies outbound fetch without changing the default Sheets process',async()=>{
 const env={...process.env},original=global.fetch;
 try{
  process.env.STOCK_STORAGE='google-sheets';process.env.STOCK_STAGING_READ_ONLY='true';installReadOnlyProviderGuard();assert.equal(global.fetch,original);
  process.env.STOCK_STORAGE='supabase';installReadOnlyProviderGuard();await assert.rejects(fetch('https://provider.invalid/private'),/External requests are disabled/);
 }finally{process.env=env;global.fetch=original;}
});
