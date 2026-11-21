/* eslint-disable @typescript-eslint/no-require-imports -- Real current owners and PostgreSQL, synthetic localhost data only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {createSalesReader}=require('../../src/modules/sales/infrastructure/postgres/sales-reader.ts');
const {singleReceiptPayments}=require('../../src/modules/sales/infrastructure/postgres/receipt-payment.ts');
const sales=require('../../src/modules/sales/server.ts'),fixture=require('../../tests/helpers/lean-sales-fixture.cjs');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
global.fetch=()=>{throw Error('Real providers forbidden');};
const forward=fs.readFileSync('tools/migration/operator/20261121050044_single_receipt_payment.sql','utf8'),inverse=fs.readFileSync('tools/migration/operator/rollback_single_receipt_payment.sql','utf8');
const fingerprintSql=fs.readFileSync('tools/migration/single-receipt-payment-fingerprint.sql','utf8');
const columns=['paymentId','paymentTypeId','paymentName','paymentType','paymentAmount','paymentCreatedAt'];
const scalar=async(sql,params)=>Object.values((await owner.query(sql,params)).rows[0])[0];
const command=fn=>executeCommand('single-payment-test',randomUUID(),hashIntent('synthetic'),fn);
const account=(id,receipts)=>({id,shopName:'Synthetic shop',service:{async getReceipts(){return receipts;}}});
const sync=(a,key=randomUUID())=>executeCommand('single-payment-test',key,hashIntent(a.id),()=>sales.syncLoyverseDailySales({account:a,storage,salesDate:'2026-11-01'}));
async function gates(overrides={}) {
 const values={allow_receipt_payment_rebuild:'reviewed-single-receipt-payment-v1',allow_receipt_payment_inverse:'reviewed-single-receipt-payment-v1',payment_restore_verified:'business-and-config-v1',payment_source:'1'.repeat(40),expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging',payment_revision:await scalar('SELECT value::text FROM stock_operational.revision'),payment_fingerprint:await scalar(fingerprintSql),...overrides};
 for(const [key,value]of Object.entries(values))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
}
async function refused(sql,client=owner){try{await assert.rejects(client.query(sql));}finally{await client.query('ROLLBACK');}}
async function snapshot() {
 const result={};for(const table of ['sales_receipts','sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','commands','revision'])result[table]=(await owner.query(`SELECT to_jsonb(t) value FROM stock_operational.${table} t ORDER BY to_jsonb(t)::text COLLATE "C"`)).rows;
 result.sequences=(await owner.query("SELECT 'bills' name,last_value::text,is_called FROM stock_operational.order_bills_id_seq UNION ALL SELECT 'items',last_value::text,is_called FROM stock_operational.order_items_id_seq UNION ALL SELECT 'state',last_value::text,is_called FROM stock_operational.user_state_id_seq ORDER BY name")).rows;
 return result;
}
function oldFields(snapshot){const copy=structuredClone(snapshot);for(const row of copy.sales_receipts)for(const key of columns)delete row.value[key];return copy;}
async function reports(id='before') {
 return db.transaction(false,async()=>({
  daily:await sales.getGoogleSheetsDailySales({storage,accountId:id,salesDate:'2026-11-01'}),
  dashboard:await sales.getGoogleSheetsSalesDashboard({storage,accountIds:[id],fromDate:'2026-11-01',toDate:'2026-11-02'}),
  profit:await sales.getGoogleSheetsProfitSummary({storage,year:'2026',accounts:[{id,shopName:'Synthetic shop'}],expenses:[],costOverrides:[]}),
  payments:(await createSalesReader(storage).payments()).map(p=>Object.fromEntries(['id','receiptId','paymentTypeId','paymentName','paymentType','moneyAmount','syncedAt'].map(k=>[k,p[k]]))),
 }));
}
test.before(async()=>{await owner.connect();});test.after(async()=>{await db.closePool();await owner.end();});
test('single receipt payment rebuild, current reports, write fence, recovery inverse and failure atomicity',async t=>{
 await t.test('legacy reports read historical split payments; rebuild refuses without changing any rows',async()=>{
  await owner.query(`INSERT INTO stock_operational.sales_receipts(id,"salesDate","accountId","receiptType") VALUES('split','2026-11-01','split','SALE');
  INSERT INTO stock_operational.sales_receipt_payments(id,"receiptId","paymentName","moneyAmount") VALUES('split-a','split','Cash',2),('split-b','split','Card',3);`);
  assert.equal((await reports('split')).daily.paymentsByType.length,2);
  await gates();const before=await snapshot();await refused(forward);assert.deepEqual(await snapshot(),before);
  await owner.query("UPDATE stock_operational.sales_receipt_payments SET \"deletedAt\"=now() WHERE id='split-b'");await gates();await refused(forward);
  await owner.query("DELETE FROM stock_operational.sales_receipt_payments WHERE \"receiptId\"='split'; DELETE FROM stock_operational.sales_receipts WHERE id='split'");
 });
 await t.test('legacy sync accepts one/zero payments; split anywhere in batch rolls back command and every sales table',async()=>{
  const normal=fixture.singleReceipts();normal.push(fixture.receipt({receipt_number:'no-payment',payments:[]}),fixture.receipt({receipt_number:'zero-payment',payments:[{name:'Zero',money_amount:0}]}));
  const result=await sync(account('before',normal));assert.equal(result.receiptCount,5);assert.equal(result.paymentCount,4);
  const before=await snapshot();await assert.rejects(sync(account('split-new',[normal[0],fixture.receipt({receipt_number:'split-new'})])),e=>e.status===409);assert.deepEqual(await snapshot(),before);
  // Rich old details, microsecond ordering and a deleted receipt must survive.
  await owner.query(`UPDATE stock_operational.sales_receipts SET "customerId"='SYNTHETIC_OLD_DETAIL' WHERE "receiptNumber"='sale-1';
  UPDATE stock_operational.sales_receipt_payments SET "createdAt"='2026-11-01T00:00:00.000002Z',"paidAt"='old-detail',"paymentDetailsJson"='{"synthetic":true}' WHERE "receiptId" LIKE '%sale-1';
  UPDATE stock_operational.sales_receipt_payments SET "createdAt"='2026-11-01T00:00:00.000001Z' WHERE "receiptId" LIKE '%refund-1';
  INSERT INTO stock_operational.sales_receipts(id,"deletedAt") VALUES('deleted-receipt','2026-11-01T00:00:00Z');
  INSERT INTO stock_operational.sales_receipt_payments(id,"receiptId","moneyAmount","createdAt") VALUES('deleted-parent-payment','deleted-receipt',1,NULL);`);
 });
 await t.test('missing approval, wrong target, stale revision/fingerprint, partial schema and limited owner refuse',async()=>{
  const before=await snapshot();
  for(const override of [{allow_receipt_payment_rebuild:''},{expected_isolation_id:'00000000-0000-0000-0000-000000000000'},{payment_revision:'-1'},{payment_fingerprint:'f'.repeat(64)}]){await gates(override);await refused(forward);assert.deepEqual(await snapshot(),before);}
  await owner.query('ALTER TABLE stock_operational.sales_receipts ADD COLUMN "paymentId" text');await gates();await refused(forward);
  await assert.rejects(db.transaction(false,singleReceiptPayments),e=>e.status===503);await owner.query('ALTER TABLE stock_operational.sales_receipts DROP COLUMN "paymentId"');
  const limited=new Client({connectionString:process.env.STOCK_DATABASE_URL});await limited.connect();try{await refused(forward,limited);}finally{await limited.end();}
 });
 const before=await snapshot(),expected=await reports();
 await t.test('failure after backfill and ACL changes rolls everything back',async()=>{
  await gates();await refused(forward.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;'));assert.deepEqual(await snapshot(),before);
  assert.equal(await scalar("SELECT to_regprocedure('stock_operational.receipt_payment_storage_v1()') IS NULL"),true);assert.equal(await scalar("SELECT has_table_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT')"),true);
 });
 await gates();await owner.query(forward);
 await t.test('old IDs, fields, deleted rows, revisions and sequences are exact; reports and payment order match',async()=>{
  assert.deepEqual(oldFields(await snapshot()),before);
  const actual=await reports();
  // A deleted parent never contributed to reports, and its payment stays in the
  // retained ledger. Inline reader naturally omits that invisible projection.
  expected.payments=expected.payments.filter(p=>p.id!=='deleted-parent-payment');assert.deepEqual(actual,expected);
  assert.equal(await scalar("SELECT count(*)::int FROM stock_operational.sales_receipts WHERE id='deleted-receipt' AND \"paymentId\"='deleted-parent-payment'"),1);
  assert.equal(await scalar("SELECT has_any_column_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT')"),false);
  assert.equal(await scalar("SELECT has_function_privilege('anon','stock_operational.receipt_payment_storage_v1()','EXECUTE')"),false);
  assert.equal(await scalar("SELECT has_function_privilege('authenticated','stock_operational.receipt_payment_storage_v1()','EXECUTE')"),false);
  await assert.rejects(command(()=>db.currentTransaction().query("INSERT INTO stock_operational.sales_receipt_payments(id) VALUES('forbidden')")));
 });
 await t.test('new sync writes only receipt payment, keeps products separate, is idempotent and distinguishes zero from none',async()=>{
  const rows=fixture.singleReceipts();rows.push(fixture.receipt({receipt_number:'none',payments:[]}),fixture.receipt({receipt_number:'zero',payments:[{name:'Zero',money_amount:0}]}));
  const a=account('after',rows),key=randomUUID(),ledger=await scalar('SELECT count(*)::int FROM stock_operational.sales_receipt_payments');
  const first=await sync(a,key),again=await sync(a,key);assert.deepEqual(again,first);assert.equal(first.paymentCount,4);
  assert.equal(await scalar('SELECT count(*)::int FROM stock_operational.sales_receipt_payments'),ledger);
  assert.equal(await scalar("SELECT count(*)::int FROM stock_operational.sales_receipt_items WHERE \"receiptId\" LIKE 'RECEIPT-after-%'"),5);
  assert.equal(await scalar("SELECT count(*)::int FROM stock_operational.sales_receipts WHERE \"accountId\"='after' AND \"paymentId\" IS NOT NULL"),4);
  assert.equal(await scalar("SELECT \"paymentAmount\"::text FROM stock_operational.sales_receipts WHERE id='RECEIPT-after-zero'"),'0');
  assert.equal(await scalar("SELECT \"paymentCreatedAt\" IS NULL FROM stock_operational.sales_receipts WHERE id='RECEIPT-after-none'"),true);
  assert.equal(await scalar("SELECT \"paymentCreatedAt\" IS NOT NULL FROM stock_operational.sales_receipts WHERE id='RECEIPT-after-zero'"),true);
  const before=await snapshot();await assert.rejects(sync(account('after-split',[rows[0],fixture.receipt()])),e=>e.status===409);assert.deepEqual(await snapshot(),before);
 });
 await t.test('late sync failure after header/item writes rolls back all writes in single-payment mode',async()=>{
  const before=await snapshot(),broken={...storage,salesReceiptSyncs:{...storage.salesReceiptSyncs,all:()=>storage.salesReceiptSyncs.all(),prepare:()=>storage.salesReceiptSyncs.prepare(),insert:async()=>{throw Error('synthetic late failure');}}};
  await assert.rejects(command(()=>sales.syncLoyverseDailySales({account:account('late',fixture.singleReceipts()),storage:broken,salesDate:'2026-11-01'})),e=>e.status===503);assert.deepEqual(await snapshot(),before);
 });
 await t.test('unknown marker version fails closed instead of reading old payment rows',async()=>{
  await owner.query("CREATE OR REPLACE FUNCTION stock_operational.receipt_payment_storage_v1() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$SELECT 'unknown'::text$$");
  await assert.rejects(db.transaction(false,()=>createSalesReader(storage).payments()),e=>e.status===503);
  await owner.query("CREATE OR REPLACE FUNCTION stock_operational.receipt_payment_storage_v1() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$SELECT 'single-receipt-payment-v1'::text$$");
 });
 const beforeInverse=await snapshot(),newReports=await reports('after');
 await t.test('inverse is gated and atomic, then materializes new payments without changing historical rows/revisions',async()=>{
  await gates({allow_receipt_payment_inverse:''});await refused(inverse);await gates();await refused(inverse.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;'));assert.deepEqual(await snapshot(),beforeInverse);
  await gates();await owner.query(inverse);const after=await snapshot();assert.deepEqual(after.sales_receipts,oldFields(beforeInverse).sales_receipts);assert.deepEqual(after.sequences,beforeInverse.sequences);assert.deepEqual(after.revision,beforeInverse.revision);
  for(const row of beforeInverse.sales_receipt_payments)assert.deepEqual(after.sales_receipt_payments.find(r=>r.value.id===row.value.id),row);
  const actual=await reports('after');actual.payments=actual.payments.filter(p=>p.id!=='deleted-parent-payment');assert.deepEqual(actual,newReports);
  assert.equal(await scalar("SELECT has_table_privilege('stock_runtime','stock_operational.sales_receipt_payments','INSERT')"),true);
 });
 // Leave this owned synthetic copy inline for the independent dump/restore proof.
 await gates();await owner.query(forward);
});
