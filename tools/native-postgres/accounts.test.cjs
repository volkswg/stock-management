/* eslint-disable @typescript-eslint/no-require-imports -- Actual TS owners and pg; localhost synthetic DB only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{Client}=require('pg');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');
const ownerUrl=new URL(url);ownerUrl.username='postgres';ownerUrl.password='';
const owner=new Client({connectionString:ownerUrl.toString()});
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {listLoyverseAccounts,createLoyverseAccounts}=require('../../src/composition/loyverse-accounts.ts');
const config=require('../../src/config/index.ts').getConfig();
const metadata=[{id:'first',shopName:'First'},{id:'second',shopName:'Second'}];
global.fetch=async()=>{throw Error('Real providers forbidden');};
test.before(()=>owner.connect());test.after(async()=>{await closePool();await owner.end();});
test('real PostgreSQL reader returns matching metadata and provider-bound accounts in canonical order',async()=>{
 assert.deepEqual(await listLoyverseAccounts(config),metadata);
 const accounts=await createLoyverseAccounts(config);assert.equal(accounts[0].storeId,'store-1');assert.equal(accounts[1].storeId,undefined);
 assert.doesNotMatch(JSON.stringify(accounts),/synthetic-first|synthetic-second|accessToken/);
 const old=global.fetch;const calls=[];global.fetch=async(url,init)=>{calls.push({url,authorization:init.headers.Authorization});return Response.json({receipts:[]});};
 try{assert.deepEqual(await accounts[0].service.getReceipts({storeId:accounts[0].storeId}),[]);assert.equal(calls[0].authorization,'Bearer synthetic-first');assert.match(calls[0].url,/store_id=store-1/);}finally{global.fetch=old;}
});
test('account metadata HTTP response preserves fields and contains no tokens',async()=>{
 const route=require('../../src/app/api/loyverse/accounts/route.ts');
 const response=await route.GET(new Request('https://example.test/api/loyverse/accounts',{headers:{authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN}}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,accounts:metadata});
});
test('runtime cannot insert/update/delete configuration; RLS and public isolation are enforced',async()=>{
 for(const sql of ["INSERT INTO stock_configuration.loyverse_accounts(id,\"shopName\",active,\"sortOrder\") VALUES('bad','Bad',false,99)","UPDATE stock_configuration.loyverse_accounts SET active=false","DELETE FROM stock_configuration.loyverse_accounts"]){
  await assert.rejects(transaction(true,()=>currentTransaction().query(sql)));
 }
 for(const role of ['anon','authenticated']){await owner.query('SET ROLE '+role);try{await assert.rejects(owner.query('SELECT * FROM stock_configuration.loyverse_accounts'),e=>e.code==='42501');}finally{await owner.query('RESET ROLE');}}
});
test('read-only reader can serve metadata but cannot read tokens or write',async()=>{
 await closePool();const original=process.env.STOCK_DATABASE_URL;const readerUrl=new URL(original);readerUrl.username='stock_prod_reader';process.env.STOCK_DATABASE_URL=readerUrl.toString();process.env.STOCK_STAGING_READ_ONLY='true';
 const priorFetch=global.fetch;
 try{
  require('../../src/infrastructure/runtime/staging-read-only.ts').installReadOnlyProviderGuard();
  assert.deepEqual(await listLoyverseAccounts(config),metadata);await assert.rejects(createLoyverseAccounts(config),/PostgreSQL configuration and permissions/);
  await assert.rejects(global.fetch('https://sheets.googleapis.com/'),/External requests are disabled/);
 }finally{await closePool();process.env.STOCK_DATABASE_URL=original;delete process.env.STOCK_STAGING_READ_ONLY;global.fetch=priorFetch;}
 await owner.query('SET ROLE stock_prod_reader');try{await assert.rejects(owner.query('SELECT "accessToken" FROM stock_configuration.loyverse_accounts'),e=>e.code==='42501');await assert.rejects(owner.query('UPDATE stock_configuration.loyverse_accounts SET active=false'),e=>e.code==='42501');}finally{await owner.query('RESET ROLE');}
});
test('constraints reject invalid active credentials, identities and sort order; owner edits refresh updatedAt',async()=>{
 for(const values of [['duplicate','Duplicate','',true,40],['bad-order','Bad','token',true,-1],['bad-id ','Bad','token',true,40],['bad-max','Bad','token',true,9007199254740992]]){
  await assert.rejects(owner.query('INSERT INTO stock_configuration.loyverse_accounts(id,"shopName","accessToken",active,"sortOrder") VALUES($1,$2,$3,$4,$5)',values),e=>e.code==='23514');
 }
 await assert.rejects(owner.query('INSERT INTO stock_configuration.loyverse_accounts(id,"shopName",active,"sortOrder") VALUES($1,$2,false,10)',['duplicate-order','Duplicate']),e=>e.code==='23505');
 const before=(await owner.query('SELECT "updatedAt" FROM stock_configuration.loyverse_accounts WHERE id=$1',['first'])).rows[0].updatedAt;
 await owner.query('UPDATE stock_configuration.loyverse_accounts SET "shopName"=$1 WHERE id=$2',['First edited','first']);
 const after=(await owner.query('SELECT "updatedAt" FROM stock_configuration.loyverse_accounts WHERE id=$1',['first'])).rows[0].updatedAt;assert.ok(after>before);
 assert.equal((await listLoyverseAccounts(config))[0].shopName,'First edited');
 assert.equal((await owner.query('SELECT value FROM stock_operational.revision')).rows[0].value,'0');
});
