/* eslint-disable @typescript-eslint/no-require-imports -- Current owners, synthetic localhost PostgreSQL only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const driverQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=driverQuery.apply(this,args);return result?.catch?result.catch(error=>{if(this.user==='stock_test')console.error('Synthetic runtime SQL:',error.code,error.message);throw error;}):result;};
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {requireReceiptPayments}=require('../../src/modules/sales/infrastructure/postgres/receipt-payment.ts');
const {createSalesReader}=require('../../src/modules/sales/infrastructure/postgres/sales-reader.ts');
const sales=require('../../src/modules/sales/server.ts'),fixture=require('../../tests/helpers/lean-sales-fixture.cjs');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
global.fetch=()=>{throw Error('Real providers forbidden');};
const compatibility=fs.readFileSync('tools/migration/operator/20261121103218_receipt_payment_retirement_compatibility.sql','utf8');
const scalar=async(sql,params)=>Object.values((await owner.query(sql,params)).rows[0])[0];
const account=(id,rows)=>({id,shopName:'Synthetic shop',service:{async getReceipts(){return rows;}}});
const sync=(a,key=randomUUID(),store=storage)=>executeCommand('retired-payments',key,hashIntent(a.id),()=>sales.syncLoyverseDailySales({account:a,storage:store,salesDate:'2026-11-01'}));
async function reports(id='after'){
 return db.transaction(false,async()=>({
  daily:await sales.getGoogleSheetsDailySales({storage,accountId:id,salesDate:'2026-11-01'}),
  dashboard:await sales.getGoogleSheetsSalesDashboard({storage,accountIds:[id],fromDate:'2026-11-01',toDate:'2026-11-02'}),
  profit:await sales.getGoogleSheetsProfitSummary({storage,year:'2026',accounts:[{id,shopName:'Synthetic shop'}],expenses:[],costOverrides:[]}),
  payments:await createSalesReader(storage).payments(),
 }));
}
async function retained(){
 const result={};
 const tables=(await owner.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') AND NOT (schemaname='stock_operational' AND tablename='sales_receipt_payments') ORDER BY 1,2")).rows;
 for(const {schemaname,tablename}of tables)result[`${schemaname}.${tablename}`]=(await owner.query(`SELECT to_jsonb(t) value FROM "${schemaname}"."${tablename}" t ORDER BY to_jsonb(t)::text COLLATE "C"`)).rows;
 return result;
}
test.before(()=>owner.connect());test.after(async()=>{await db.closePool();await owner.end();});
test('current JSONB runtime works before and after operational payment table removal',async t=>{
 assert.equal(Object.hasOwn(storage,'salesReceiptPayments'),false);
 const before=await retained(),expected=await reports(),split=await reports('split');
 await t.test('operator-only guard compatibility refuses missing approval, wrong identity, stale revision and late failure',async()=>{
  const functions=async()=>(await owner.query("SELECT proname,prosrc,proacl::text,proowner::regrole::text,proconfig,prosecdef FROM pg_proc WHERE oid IN ('stock_operational.soft_delete_contract_v1()'::regprocedure,'stock_operational.lexeme_mapping_contract_v1()'::regprocedure) ORDER BY proname")).rows;
  const original=await functions();
  async function gates(overrides={}){
   const values={allow_payment_table_compatibility:'reviewed-jsonb-retirement-v1',payment_restore_verified:'business-and-config-v1',payment_source:'1'.repeat(40),expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging',payment_revision:await scalar('SELECT value::text FROM stock_operational.revision'),...overrides};
   for(const[key,value]of Object.entries(values))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
  }
  for(const override of [{allow_payment_table_compatibility:''},{expected_isolation_id:'00000000-0000-0000-0000-000000000000'},{payment_revision:'-1'}]){
   await gates(override);await assert.rejects(owner.query(compatibility));await owner.query('ROLLBACK');assert.deepEqual(await functions(),original);
  }
  await gates();await assert.rejects(owner.query(compatibility.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),e=>e.code==='22012');await owner.query('ROLLBACK');assert.deepEqual(await functions(),original);
  await gates();await owner.query(compatibility);
  const actual=await functions(),metadata=rows=>rows.map(row=>{const value={...row};delete value.prosrc;return value;});assert.deepEqual(metadata(actual),metadata(original));
  assert.deepEqual(await retained(),before);assert.deepEqual(await reports(),expected);
 });
 await t.test('absent, partial and unsupported JSONB layouts fail closed even while legacy rows exist',async()=>{
  for(const [change,restore]of [
   ['ALTER TABLE stock_operational.sales_receipts RENAME COLUMN payments TO payments_hidden','ALTER TABLE stock_operational.sales_receipts RENAME COLUMN payments_hidden TO payments'],
   ['ALTER FUNCTION stock_operational.receipt_payment_storage_v1() RENAME TO receipt_payment_storage_hidden','ALTER FUNCTION stock_operational.receipt_payment_storage_hidden() RENAME TO receipt_payment_storage_v1'],
  ]){
   await owner.query(change);
   try{await assert.rejects(db.transaction(false,()=>createSalesReader(storage).payments()),e=>e.status===503);}
   finally{await owner.query(restore);}
  }
  const original=await scalar("SELECT pg_get_functiondef('stock_operational.receipt_payment_storage_v1()'::regprocedure)");
  try{
   await owner.query("CREATE OR REPLACE FUNCTION stock_operational.receipt_payment_storage_v1() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$SELECT 'unknown'::text$$");
   await assert.rejects(db.transaction(false,requireReceiptPayments),e=>e.status===503);
  }finally{await owner.query(original);}
 });
 await t.test('RESTRICT refuses an unknown dependency and a late DDL failure rolls back',async()=>{
  await owner.query('CREATE VIEW public.payment_external_consumer AS SELECT id FROM stock_operational.sales_receipt_payments');
  await owner.query('BEGIN');
  await owner.query('DROP FUNCTION stock_operational.typed_input_sales_receipt_payments(jsonb),stock_operational.typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)');
  await assert.rejects(owner.query('DROP TABLE stock_operational.sales_receipt_payments RESTRICT'));
  await owner.query('ROLLBACK');await owner.query('DROP VIEW public.payment_external_consumer');
  await owner.query('BEGIN');
  await owner.query('DROP FUNCTION stock_operational.typed_input_sales_receipt_payments(jsonb),stock_operational.typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)');
  await owner.query('DROP TABLE stock_operational.sales_receipt_payments RESTRICT');await assert.rejects(owner.query('SELECT 1/0'));await owner.query('ROLLBACK');
  assert.notEqual(await scalar("SELECT to_regclass('stock_operational.sales_receipt_payments')::text"),null);
 });
 await owner.query('BEGIN');
 await owner.query('DROP FUNCTION stock_operational.typed_input_sales_receipt_payments(jsonb),stock_operational.typed_project_sales_receipt_payments(stock_operational.sales_receipt_payments)');
 await owner.query('DROP TABLE stock_operational.sales_receipt_payments RESTRICT');await owner.query('COMMIT');
 await owner.query('SELECT stock_operational.soft_delete_contract_v1(),stock_operational.media_record_contract_v1(),stock_operational.lexeme_mapping_contract_v1()');
 await t.test('all other rows, archive history and revisions are exact; split/refund/report output is identical',async()=>{
  assert.equal(await scalar("SELECT to_regclass('stock_operational.sales_receipt_payments')::text"),null);
  assert.equal(await scalar("SELECT to_regclass('stock_migration.sales_receipt_payments')::text"),'stock_migration.sales_receipt_payments');
  assert.deepEqual(await retained(),before);assert.deepEqual(await reports(),expected);assert.deepEqual(await reports('split'),split);
 });
 await t.test('remaining table trigger/type checks still fail closed after retirement',async()=>{
  for(const[change,restore]of [
   ['ALTER TABLE stock_operational.orders DISABLE TRIGGER a_validate','ALTER TABLE stock_operational.orders ENABLE TRIGGER a_validate'],
   ['ALTER TABLE stock_operational.orders RENAME COLUMN remark TO hidden_remark','ALTER TABLE stock_operational.orders RENAME COLUMN hidden_remark TO remark'],
  ]){
   await owner.query(change);
   try{await assert.rejects(reports(),e=>e.status===503);}finally{await owner.query(restore);}
  }
 });
 await t.test('sync, split payments, products, zero/none, completion and command replay work with no payment table',async()=>{
  const rows=fixture.receipts();rows.push(fixture.receipt({receipt_number:'none',payments:[]}),fixture.receipt({receipt_number:'zero',payments:[{name:'Zero',money_amount:0}]}));
  const a=account('retired',rows),key=randomUUID();
  const first=await sync(a,key);assert.equal(first.receiptCount,5);assert.equal(first.itemCount,5);assert.equal(first.paymentCount,6);assert.deepEqual(await sync(a,key),first);
  assert.equal((await sync(a)).outcome,'already_synced');
  assert.equal(await scalar("SELECT payments='[]'::jsonb FROM stock_operational.sales_receipts WHERE id='RECEIPT-retired-none'"),true);
  assert.equal(await scalar("SELECT payments->0->>'moneyAmount' FROM stock_operational.sales_receipts WHERE id='RECEIPT-retired-zero'"),'0');
  assert.equal((await reports('retired')).daily.totals.netSales,72);
 });
 await t.test('late completion failure rolls back receipts, products, embedded payments, commands and revisions',async()=>{
  const before=await retained();let reached=false;
  const broken={...storage,salesReceiptSyncs:{all:()=>storage.salesReceiptSyncs.all(),prepare:()=>storage.salesReceiptSyncs.prepare(),insert:async()=>{reached=true;throw Error('synthetic late failure');}}};
  await assert.rejects(sync(account('retired-failed',fixture.receipts()),randomUUID(),broken),e=>e.status===503);
  assert.equal(reached,true);assert.deepEqual(await retained(),before);
 });
});
