/* eslint-disable @typescript-eslint/no-require-imports -- Test actual TypeScript owners through the existing offline loader. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {transaction,requireMutation,PersistenceFailure}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {installReadOnlyProviderGuard}=require('../../src/infrastructure/runtime/staging-read-only.ts');
const {listLoyverseAccounts}=require('../../src/composition/loyverse-accounts.ts');
const crypto=require('node:crypto');
const configurationUrl="https://sheets.googleapis.com/v4/spreadsheets/synthetic-workbook/values/"+encodeURIComponent("'loyverse_accounts'!A:F");
const principal='synthetic@example.invalid';
function readonlyAssertion(change={}) {
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 return [encode({alg:'RS256'}),encode({iss:principal,aud:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/spreadsheets.readonly',...change}),'synthetic-signature'].join('.');
}
function oauthRequest(assertion=readonlyAssertion()) {
 return {method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})};
}
async function withGuard(run, network, change={}) {
 const env={...process.env},original=global.fetch;
 try {
  Object.assign(process.env,{VERCEL_ENV:'production',STOCK_STORAGE:'supabase',STOCK_PRODUCTION_READ_ONLY:'true',LOYVERSE_ACCOUNT_SOURCE:'sheet',GOOGLE_SHEETS_SPREADSHEET_ID:'synthetic-workbook',GOOGLE_SERVICE_ACCOUNT_EMAIL:principal,...change});
  global.fetch=network;installReadOnlyProviderGuard();await run();
 }finally{process.env=env;global.fetch=original;}
}
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

test('production read-only account composition signs readonly OAuth and reads only fixed configuration metadata',async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const config={loyverse:{accountSource:'sheet'},googleSheets:{spreadsheetId:'synthetic-workbook'},googleService:{accountEmail:principal,accountPrivateKey:privateKey.export({type:'pkcs8',format:'pem'})}};
 const requests=[];
 await withGuard(async()=>{
  const accounts=await listLoyverseAccounts(config);
  assert.deepEqual(accounts,[{id:'synthetic-shop',shopName:'Synthetic Shop'}]);
  assert.equal(JSON.stringify(accounts).includes('synthetic-secret'),false);
  assert.deepEqual(requests,['oauth','configuration']);
 },async(input,init)=>{
  assert.equal(init.redirect,'error');
  if(input==='https://oauth2.googleapis.com/token'){
   requests.push('oauth');assert.equal(init.method,'POST');
   const assertion=init.body.get('assertion'),parts=assertion.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets.readonly');assert.equal(claims.iss,principal);
   assert.equal(crypto.verify('RSA-SHA256',Buffer.from(parts.slice(0,2).join('.')),publicKey,Buffer.from(parts[2],'base64url')),true);
   return Response.json({access_token:'synthetic-oauth-secret',expires_in:3600});
  }
  assert.equal(input,configurationUrl);assert.equal(init.method,'GET');requests.push('configuration');
  return Response.json({values:[['id','shopName','storeId','accessToken','active','sortOrder'],['synthetic-shop','Synthetic Shop','','synthetic-account-secret',true,0]]});
 });
});

test('production read-only exception rejects business ranges, mutations, other identities/scopes and provider traffic before network',async()=>{
 let calls=0;
 const rejected=[
  [configurationUrl.replace('synthetic-workbook','another-workbook')],
  [configurationUrl.replace(encodeURIComponent("'loyverse_accounts'!A:F"),encodeURIComponent("'orders'!A:F"))],
  [configurationUrl+'?valueRenderOption=FORMULA'],[configurationUrl+'#fragment'],
  [configurationUrl.replace('sheets.googleapis.com','sheets.googleapis.com.evil.invalid')],
  [configurationUrl,{method:'PUT',body:'synthetic-private-data'}],[configurationUrl,{method:'POST'}],
  [configurationUrl,{method:'DELETE'}],[configurationUrl,{method:'GET',body:'unexpected'}],
  [new Request(configurationUrl)], [new URL(configurationUrl)],
  ['https://api.line.me/v2/bot/message/reply',{method:'POST'}],
  ['https://api.loyverse.com/v1.0/receipts'],['https://www.googleapis.com/drive/v3/files'],
  ['https://oauth2.googleapis.com/token',oauthRequest(readonlyAssertion({scope:'https://www.googleapis.com/auth/spreadsheets'}))],
  ['https://oauth2.googleapis.com/token',oauthRequest(readonlyAssertion({scope:'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive'}))],
  ['https://oauth2.googleapis.com/token',oauthRequest(readonlyAssertion({iss:'other@example.invalid'}))],
  ['https://oauth2.googleapis.com/token',oauthRequest(readonlyAssertion({aud:'https://other.invalid'}))],
  ['https://oauth2.googleapis.com/token',oauthRequest(readonlyAssertion({sub:'other@example.invalid'}))],
  ['https://oauth2.googleapis.com/token',oauthRequest('not-a-jwt')],
  ['https://oauth2.googleapis.com/token',{...oauthRequest(),body:'grant_type=not-the-current-client'}],
  ['https://oauth2.googleapis.com/token?unexpected=1',oauthRequest()],
 ];
 const extra=oauthRequest();extra.body.append('scope','broader');rejected.push(['https://oauth2.googleapis.com/token',extra]);
 const duplicate=oauthRequest();duplicate.body.append('assertion',readonlyAssertion());rejected.push(['https://oauth2.googleapis.com/token',duplicate]);
 await withGuard(async()=>{
  for(const [url,init]of rejected)await assert.rejects(fetch(url,init),/External requests are disabled/);
 },async()=>{calls++;throw Error('Forbidden network reached');});
 assert.equal(calls,0);
});

test('isolated staging still denies even valid configuration reads and readonly authorization',async()=>{
 let calls=0;
 await withGuard(async()=>{
  for(const [url,init]of [[configurationUrl],['https://oauth2.googleapis.com/token',oauthRequest()]])await assert.rejects(fetch(url,init),/External requests are disabled/);
 },async()=>{calls++;},{VERCEL_ENV:'preview',STOCK_STAGING_READ_ONLY:'true'});
 assert.equal(calls,0);
});

test('missing or env-only configuration fails closed; allowed calls cannot opt into redirects',async()=>{
 let calls=0;
 for(const change of [{LOYVERSE_ACCOUNT_SOURCE:'env'},{GOOGLE_SHEETS_SPREADSHEET_ID:''},{GOOGLE_SERVICE_ACCOUNT_EMAIL:''}])await withGuard(async()=>{
  await assert.rejects(fetch(configurationUrl),/External requests are disabled/);
  await assert.rejects(fetch('https://oauth2.googleapis.com/token',oauthRequest()),/External requests are disabled/);
 },async()=>{calls++;},change);
 assert.equal(calls,0);
 await withGuard(async()=>{
  await fetch(configurationUrl,{redirect:'follow'});
 },async(input,init)=>{calls++;assert.equal(input,configurationUrl);assert.equal(init.redirect,'error');return Response.json({values:[]});});
 assert.equal(calls,1);
});
