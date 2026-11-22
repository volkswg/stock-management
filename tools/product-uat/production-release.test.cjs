/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in real SQL guard acceptance on a disposable synthetic localhost copy only. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Client}=require('pg');
const url=new URL(process.env.STOCK_DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(process.env.STOCK_ALLOW_LOCAL_TEST_DATABASE,'true');assert.equal(url.username,'stock_test');assert.equal(url.password,'synthetic-only');
url.username='postgres';url.password='synthetic-only';
const client=new Client({connectionString:url.href});
const target='349b9289-f684-4ec5-ac22-924b2be1946b',staging='160669bd-2f6f-4490-9259-bada5a1d02c4';
const install=fs.readFileSync('tools/migration/operator/20261122110945_product_master_production_release.sql','utf8');
const inverse=fs.readFileSync('tools/migration/operator/20261122110945_product_master_production_rollback_empty.sql','utf8');
const scalar=async sql=>(await client.query(sql)).rows[0].value;
async function settings(mode='install',identity=target,revision){
 await client.query("SELECT set_config('stock.product_master_release',$1,false),set_config('stock.expected_isolation_id',$2,false),set_config('stock.expected_revision',$3,false)",['reviewed-product-master-production-'+mode+'-v1',identity,revision??await scalar('SELECT value::text AS value FROM stock_operational.revision')]);
}
async function rejects(sql){try{await assert.rejects(client.query(sql));}finally{await client.query('ROLLBACK');}}
async function baseline(){
 const tables=(await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') AND tablename<>'products' ORDER BY schemaname,tablename")).rows;
 const out=[];
 for(const {schemaname:s,tablename:t} of tables){assert.match(s,/^[a-z_]+$/);assert.match(t,/^[a-z_]+$/);const project=t==='order_items'?"to_jsonb(r)-'productId'":'to_jsonb(r)';out.push([s+'.'+t,await scalar(`WITH h AS (SELECT encode(sha256(convert_to((${project})::text,'UTF8')),'hex') h FROM ${s}.${t} r) SELECT encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''),'UTF8')),'hex') AS value FROM h`)]);}
 return out;
}
test('production Product Master install and empty inverse stay guarded and preserve existing records',async t=>{
 await client.connect();t.after(()=>client.end());
 const initial=(await client.query('SELECT isolation_id::text,purpose FROM stock_operational.environment WHERE singleton')).rows[0];
 assert.equal(initial.purpose,'isolated-staging');assert.equal(initial.isolation_id,process.env.STOCK_TARGET_ISOLATION_ID);assert.notEqual(initial.isolation_id,target);assert.notEqual(initial.isolation_id,staging);
 assert.equal(await scalar("SELECT to_regclass('stock_operational.products')::text AS value"),null);
 await t.test('missing approval, wrong identity and staging purpose refuse without adding columns',async()=>{
  await rejects(install);await settings('install');await rejects(install);
  await client.query('UPDATE stock_operational.environment SET isolation_id=$1,purpose=$2',[target,'production']);
  await settings('install',initial.isolation_id);await rejects(install);
  assert.equal(await scalar("SELECT to_regclass('stock_operational.products')::text AS value"),null);
 });
 const before=await baseline();const oldBodies=(await client.query("SELECT proname,md5(prosrc) hash FROM pg_proc WHERE oid IN ('stock_operational.media_record_contract_v1()'::regprocedure,'stock_operational.media_catalog_v1()'::regprocedure) ORDER BY proname")).rows;
 await t.test('stale revision and a late failure roll back all DDL and permission changes',async()=>{
  await settings('install',target,'999999999999');await rejects(install);await settings();await rejects(install.replace(/COMMIT;\s*$/,'SELECT 1/0;\nCOMMIT;'));assert.deepEqual(await baseline(),before);assert.equal(await scalar("SELECT to_regclass('stock_operational.products')::text AS value"),null);
 });
 await t.test('approved exact identity installs an empty catalogue and preserves rows and revisions',async()=>{
  await settings();await client.query(install);assert.deepEqual(await baseline(),before);assert.equal(await scalar('SELECT count(*)::int AS value FROM stock_operational.products'),0);assert.equal(await scalar('SELECT count(*)::int AS value FROM stock_operational.order_items WHERE "productId" IS NOT NULL'),0);
  assert.equal(await scalar("SELECT relrowsecurity AS value FROM pg_class WHERE oid='stock_operational.products'::regclass"),true);
  for(const role of ['anon','authenticated'])assert.equal(await scalar(`SELECT has_table_privilege('${role}','stock_operational.products','SELECT,INSERT,UPDATE,DELETE') AS value`),false);
  assert.equal(await scalar("SELECT has_column_privilege('stock_runtime','stock_operational.order_items','productId','UPDATE') AS value"),true);
 });
 await t.test('wrong rollback approval refuses; populated or archived catalogue cannot be dropped',async()=>{
  await settings();await rejects(inverse);await settings('rollback');
  await client.query('BEGIN');await client.query("INSERT INTO stock_operational.products(id,\"productName\",\"deletedAt\") VALUES(9000000001,'Synthetic rollback guard',now())");await settings('rollback');await rejects(inverse);
  assert.notEqual(await scalar("SELECT to_regclass('stock_operational.products')::text AS value"),null);assert.equal(await scalar('SELECT count(*)::int AS value FROM stock_operational.products'),0);assert.deepEqual(await baseline(),before);
 });
 await t.test('empty inverse restores both exact predecessor functions and all existing records',async()=>{
  await settings('rollback');await client.query(inverse);assert.deepEqual(await baseline(),before);assert.equal(await scalar("SELECT to_regclass('stock_operational.products')::text AS value"),null);
  assert.deepEqual((await client.query("SELECT proname,md5(prosrc) hash FROM pg_proc WHERE oid IN ('stock_operational.media_record_contract_v1()'::regprocedure,'stock_operational.media_catalog_v1()'::regprocedure) ORDER BY proname")).rows,oldBodies);
 });
 await client.query('UPDATE stock_operational.environment SET isolation_id=$1,purpose=$2',[initial.isolation_id,initial.purpose]);
});
