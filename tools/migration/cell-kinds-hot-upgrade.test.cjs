/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic local upgrade with the actual released runtime. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Client}=require('pg');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/cf_hot');
url.username='postgres';
global.fetch=()=>{throw Error('Providers forbidden during hot upgrade acceptance');};
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
test('released app and existing pool cross retained-to-final DDL without a restart',async()=>{
 const admin=new Client({connectionString:url.toString()}),service=createPostgresService();await admin.connect();
 try{
  const row=['CF_HOT','waiting_for_total_price','Synthetic','12.3400','before','2026-11-17T02:00:00.123Z','','','synthetic'];
  await transaction(true,()=>service.orders.appendRows('A:I',[row]));
  await transaction(false,async()=>{
   assert.equal((await currentTransaction().query('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,'retained');
   assert.deepEqual((await service.orders.readRows()).find(r=>r[0]==='CF_HOT'),row);
  });
  const state=(await admin.query('SELECT isolation_id::text,purpose,(SELECT value::text FROM stock_operational.revision WHERE singleton) revision FROM stock_operational.environment')).rows[0];
  assert.equal(state.purpose,'isolated-staging');assert.equal(state.isolation_id,process.env.STOCK_TARGET_ISOLATION_ID);
  for(const [key,value] of Object.entries({
   'stock.expected_isolation_id':state.isolation_id,'stock.expected_purpose':'isolated-staging',
   'stock.allow_final_cell_kinds_removal':'reviewed-per-column-retirement-v1',
   'stock.cell_kinds_reviewed_revision':state.revision,'stock.cell_kinds_reviewed_source':'1'.repeat(40),
   'stock.cell_kinds_restore_verified':'51-tables-15-metadata-v1',
   'stock.cell_kinds_semantics_verified':'exact-app-line-optional-tails-v1',
  }))await admin.query('SELECT set_config($1,$2,false)',[key,value]);
  await admin.query(fs.readFileSync('tools/migration/final-removal/20261117174324_remove_cell_kinds.sql','utf8'));
  await transaction(false,async()=>{
   assert.equal((await currentTransaction().query('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,'final');
   assert.deepEqual((await service.orders.readRows()).find(r=>r[0]==='CF_HOT'),row);
  });
  await transaction(true,async()=>{await (await service.orders.referenceId('CF_HOT')).update('E',['after']);});
  await transaction(false,async()=>assert.deepEqual((await service.orders.readRows()).find(r=>r[0]==='CF_HOT'),row.map((v,i)=>i===4?'after':v)));
 }finally{await admin.end();await closePool();}
});
