/* eslint-disable @typescript-eslint/no-require-imports -- Closed synthetic loader of actual TypeScript owners. */
require('./helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript');
const db=require('../src/infrastructure/persistence/postgres/database.ts');
const {PostgresLoyverseAccounts}=require('../src/infrastructure/configuration/postgres/loyverse-accounts.ts');
const {listLoyverseAccounts,createLoyverseAccounts}=require('../src/composition/loyverse-accounts.ts');
const {getConfig}=require('../src/config/index.ts');
const reader=new PostgresLoyverseAccounts(),queries=[];
const token='synthetic-provider-token/&"';
let rows,fail;
db.transaction=async(mutation,run)=>{assert.equal(mutation,false);return run();};
db.currentTransaction=()=>({query:async sql=>{queries.push(sql);if(fail)throw Error(token);return {rows:rows.map(row=>sql.includes('"accessToken"')?row:{id:row.id,shopName:row.shopName,active:row.active,sortOrder:row.sortOrder})};}});
const config={loyverse:{accountSource:'postgres',accounts:[]}};
function reset(){queries.length=0;fail=false;rows=[{id:'first',shopName:'First',storeId:null,accessToken:token,active:true,sortOrder:1},{id:'off',shopName:'Old',storeId:null,accessToken:null,active:false,sortOrder:2}];}
test.beforeEach(reset);
test('metadata uses credential-free SELECT and preserves API fields, ordering and disabled filtering',async()=>{
 assert.deepEqual(await listLoyverseAccounts(config),[{id:'first',shopName:'First'}]);
 assert.doesNotMatch(queries.join(' '),/accessToken|SELECT \*/);assert.match(queries[0],/ORDER BY "sortOrder"/);
});
test('provider credentials remain closure-bound and raw/URI/JSON escaped provider failures stay redacted',async()=>{
 const accounts=await createLoyverseAccounts(config);assert.equal(accounts[0].storeId,undefined);
 assert.deepEqual(Object.keys(accounts[0]),['id','shopName','storeId','service']);assert.ok(!JSON.stringify(accounts).includes(token));
 const original=global.fetch;global.fetch=async()=>new Response(`${token} ${encodeURIComponent(token)} ${JSON.stringify(token).slice(1,-1)}`,{status:401});
 try{await assert.rejects(accounts[0].service.getReceipts({}),error=>{assert.ok(!error.message.includes(token));assert.ok(!error.message.includes(encodeURIComponent(token)));assert.equal(error.cause,undefined);return true;});}finally{global.fetch=original;}
});
test('missing, malformed and unavailable storage fails closed without leaking driver values or falling back',async()=>{
 for(const invalid of [[],[{...rows[0],active:'true'}],[rows[0],{...rows[0]}],[{...rows[0],sortOrder:-1}],[{...rows[0],accessToken:null}]] ){
  rows=invalid;await assert.rejects(reader.readAccounts(),error=>!error.message.includes(token)&&!error.cause);
 }
 reset();fail=true;await assert.rejects(listLoyverseAccounts(config),/Check PostgreSQL configuration and permissions/);
 assert.equal(queries.length,1);
});
test('all-disabled configuration is valid and produces no active accounts',async()=>{
 rows=rows.filter(row=>!row.active);assert.deepEqual(await reader.listMetadata(),[]);assert.deepEqual(await reader.readAccounts(),[]);
});
test('postgres selection never evaluates the legacy token JSON; retired Sheets setting fails explicitly',()=>{
 const oldSource=process.env.LOYVERSE_ACCOUNT_SOURCE,oldJson=process.env.LOYVERSE_ACCOUNTS_JSON;
 try{
  process.env.LOYVERSE_ACCOUNT_SOURCE=' postgres ';process.env.LOYVERSE_ACCOUNTS_JSON='malformed';
  assert.equal(getConfig().loyverse.accountSource,'postgres');assert.deepEqual(getConfig().loyverse.accounts,[]);assert.equal('googleSheets' in getConfig(),false);
  process.env.LOYVERSE_ACCOUNT_SOURCE='sheet';assert.throws(getConfig,/must be env or postgres/);
  process.env.LOYVERSE_ACCOUNT_SOURCE='env';process.env.LOYVERSE_ACCOUNTS_JSON=JSON.stringify([{id:'env',shopName:'Env',accessToken:'synthetic-env'}]);assert.equal(getConfig().loyverse.accounts[0].id,'env');
 }finally{if(oldSource===undefined)delete process.env.LOYVERSE_ACCOUNT_SOURCE;else process.env.LOYVERSE_ACCOUNT_SOURCE=oldSource;if(oldJson===undefined)delete process.env.LOYVERSE_ACCOUNTS_JSON;else process.env.LOYVERSE_ACCOUNTS_JSON=oldJson;}
});
test('moved Google auth implementations and Drive behavior preserve predecessor bytes except import paths',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/postgres-accounts-before.json'));
 const moved=['GoogleAccessTokenProvider.ts','GoogleOAuthRefreshTokenAuth.ts','GoogleServiceAccountAuth.ts','const.ts','types.ts','utils/jwt.ts'];
 for(const name of moved){const old=fixture.edits['src/infrastructure/persistence/google-sheets/google-auth/'+name];assert.equal(fs.readFileSync('src/infrastructure/external/google-auth/'+name,'utf8'),old.before);}
 for(const name of ['createGoogleDriveServiceFromConfig.ts','types.ts']){const old=fixture.edits['src/infrastructure/files/google-drive/'+name];assert.equal(fs.readFileSync('src/infrastructure/files/google-drive/'+name,'utf8'),old.before.replaceAll('../../persistence/google-sheets/google-auth/','../../external/google-auth/'));}
 const originalFetch=global.fetch;process.env.STOCK_STORAGE='supabase';process.env.STOCK_STAGING_READ_ONLY='true';
 try{require('../src/infrastructure/runtime/staging-read-only.ts').installReadOnlyProviderGuard();return assert.rejects(global.fetch('https://sheets.googleapis.com/'),/External requests are disabled/);}finally{global.fetch=originalFetch;delete process.env.STOCK_STAGING_READ_ONLY;}
});
test('historical source layer is hash pinned and the old sheet reader supplies an independent output oracle',async()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/postgres-accounts-before.json'));
 for(const [file,edit] of Object.entries(fixture.edits)){
  assert.equal(crypto.createHash('sha256').update(edit.before).digest('hex'),edit.beforeSha256,file);
  assert.equal(fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null,edit.afterSha256,file);
 }
 const source=fixture.edits['src/infrastructure/configuration/google-sheets/loyverse-accounts.ts'].before,exports={};
 new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText).runInNewContext({exports,require:()=>({}),Error});
 const headers=['id','shopName','storeId','accessToken','active','sortOrder'];
 const old=await new exports.GoogleSheetsLoyverseAccounts({getValues:async()=>[headers,...rows.map(r=>headers.map(key=>r[key]??''))]}).readAccounts();
 assert.deepEqual(await reader.readAccounts(),structuredClone(old));
});
