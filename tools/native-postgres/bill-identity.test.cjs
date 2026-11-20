/* eslint-disable @typescript-eslint/no-require-imports -- Current TypeScript owners against a fresh synthetic final-schema PostgreSQL clone. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const {transaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
let loseCommit=false;
const driverQuery=Client.prototype.query;
Client.prototype.query=function(...args){
 const result=driverQuery.apply(this,args);
 return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return value;}):result;
};
global.fetch=()=>{throw Error('Providers forbidden in identity acceptance');};
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
const forward=fs.readFileSync('tools/migration/operator/20261120022134_order_bill_identity.sql','utf8'),inverse=fs.readFileSync('tools/migration/operator/rollback_order_bill_identity.sql','utf8');
const command=run=>executeCommand('bill-identity',randomUUID(),hashIntent(randomUUID()),run);
const scalar=async(sql,params)=>(await owner.query(sql,params)).rows[0].value;
async function fingerprint(){
 const tables=(await owner.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') ORDER BY 1,2")).rows;
 const result=[];
 for(const {schemaname,tablename} of tables){
  // Only the physical id type changes; compare its exact canonical text value.
  const expression=schemaname==='stock_operational'&&tablename==='order_bills'?"to_jsonb(t)||jsonb_build_object('id',t.id::text)":'to_jsonb(t)';
  result.push([schemaname,tablename,(await owner.query(`SELECT ${expression} value FROM "${schemaname}"."${tablename}" t ORDER BY (${expression})::text COLLATE "C"`)).rows]);
 }
 return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}
async function gates(){
 const revision=await scalar('SELECT value::text value FROM stock_operational.revision');
 for(const [key,value] of Object.entries({allow_bill_identity_conversion:'reviewed-order-bill-bigint-v1',allow_bill_identity_inverse:'reviewed-order-bill-bigint-v1',bill_identity_restore_verified:'business-and-config-v1',bill_identity_source:'1'.repeat(40),bill_identity_fingerprint:await fingerprint(),expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging',bill_identity_revision:revision}))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
}
async function refused(sql){try{await assert.rejects(owner.query(sql));}finally{await owner.query('ROLLBACK');}}
test.before(async()=>{
 await owner.connect();
 await owner.query("DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN CREATE ROLE stock_prod_backup NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_reader') THEN CREATE ROLE stock_prod_reader NOLOGIN; END IF; END$$;");
 await owner.query('GRANT USAGE ON SCHEMA stock_operational,stock_migration TO stock_prod_backup; GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational,stock_migration TO stock_prod_backup;');
 await owner.query(fs.readFileSync('supabase/migrations/20261119082351_private_loyverse_accounts.sql','utf8'));
 await owner.query('INSERT INTO stock_configuration.loyverse_accounts(id,"shopName","accessToken",active,"sortOrder") VALUES($1,$2,$3,true,1)',['synthetic','Synthetic','synthetic-only']);
});test.after(async()=>{await closePool();await owner.end();});
test('reviewed text-to-identity transition preserves all rows, permissions, string APIs and exact inverse',async t=>{
 await owner.query("DELETE FROM stock_operational.order_bills; INSERT INTO stock_operational.orders(id) VALUES('BI_PARENT') ON CONFLICT DO NOTHING; INSERT INTO stock_operational.order_bills(id,\"orderId\",\"createdAt\",\"deletedAt\") VALUES('2','BI_PARENT','2026-11-20T00:00:00Z',NULL),('10','BI_PARENT','2026-11-20T00:00:00Z',NULL),('99','BI_PARENT','2026-11-20T00:00:00Z','2026-11-20T00:00:00Z'); DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN CREATE ROLE stock_prod_backup NOLOGIN; END IF; END$$;");
 await t.test('compatibility allocator works on the unchanged text layout',async()=>{
  await command(async()=>assert.equal(await storage.orderBills.reserveIdentifier(),'100'));
  await transaction(false,async()=>assert.deepEqual((await storage.orderBills.all()).map(r=>r.id),['10','2']));
 });
 const before=await fingerprint();
 await t.test('approval, target, revision, aliases, overflow, incoming references and dependent views refuse safely',async()=>{
  await refused(forward);await gates();
  await owner.query("SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'");await refused(forward);await gates();
  await owner.query("SET stock.bill_identity_revision='-1'");await refused(forward);await gates();
  for(const id of ['01','not-numeric','9223372036854775807','9223372036854775808']){
   await owner.query('INSERT INTO stock_operational.order_bills(id,"orderId") VALUES($1,$2)',[id,'BI_PARENT']);await gates();await refused(forward);await owner.query('DELETE FROM stock_operational.order_bills WHERE id=$1',[id]);
  }
  await owner.query('CREATE TABLE public.bi_reference(id text REFERENCES stock_operational.order_bills(id))');await gates();await refused(forward);await owner.query('DROP TABLE public.bi_reference');
  await owner.query('CREATE VIEW public.bi_reference AS SELECT id FROM stock_operational.order_bills');await gates();await refused(forward);await owner.query('DROP VIEW public.bi_reference');
  await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational GRANT USAGE ON SEQUENCES TO lexeme_reader');await gates();await refused(forward);await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational REVOKE USAGE ON SEQUENCES FROM lexeme_reader');
  // A late failure also rolls back the DDL and newly created identity sequence.
  await gates();await refused(forward.replace('COMMIT;','SELECT 1/0; COMMIT;'));
  assert.equal(await scalar("SELECT format_type(atttypid,atttypmod) value FROM pg_attribute WHERE attrelid='stock_operational.order_bills'::regclass AND attname='id'"),'text');
  assert.equal(await scalar("SELECT to_regclass('stock_operational.order_bills_id_seq')::text value"),null);
 });
 // Fixture guard probes changed only the synthetic revision. Establish a new,
 // exact checkpoint after those probes before testing the successful operation.
 const checkpoint=await fingerprint();await gates();await owner.query(forward);assert.equal(await fingerprint(),checkpoint);
 await t.test('only order_bills changes and the immediate inverse restores exact text records',async()=>{
  assert.equal(await scalar("SELECT pg_get_serial_sequence('stock_operational.order_bills','id') value"),'stock_operational.order_bills_id_seq');
  assert.equal(await scalar("SELECT count(*)::text value FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='id' AND data_type='bigint'"),'1');
  assert.equal(await scalar("SELECT stock_operational.lexeme_mapping_contract_v1() value"),'typed');
  await gates();await owner.query(inverse);assert.equal(await fingerprint(),checkpoint);
  assert.equal(await scalar("SELECT to_regclass('stock_operational.order_bills_id_seq')::text value"),null);
  await gates();await owner.query(forward);assert.equal(await fingerprint(),checkpoint);
 });
 await t.test('runtime has nextval only, readers cannot advance, backup can capture sequence state',async()=>{
  for(const [role,privilege,expected] of [['stock_runtime','USAGE',true],['stock_runtime','UPDATE',false],['stock_prod_backup','SELECT',true],['stock_prod_reader','USAGE',false],['lexeme_reader','USAGE',false],['anon','USAGE',false],['authenticated','USAGE',false]])assert.equal(await scalar('SELECT has_sequence_privilege($1,$2,$3) value',[role,'stock_operational.order_bills_id_seq',privilege]),expected,role+privilege);
 });
 await t.test('application bill creation, exact retry, stale edits and soft delete retain behavior on bigint',async()=>{
  const key=randomUUID();let executions=0;
  const run=()=>executeCommand('bill-identity',key,hashIntent({order:'BI_PARENT'}),async()=>{executions++;return orders.createOrderBill({storage,orderId:'BI_PARENT',imageUrl:'https://example.invalid/bill',createdBy:'synthetic'});});
  loseCommit=true;await assert.rejects(run());
  const first=await run(),retry=await run();assert.equal(first.id,'100');assert.equal(executions,1);assert.deepEqual(retry,first);
  // The production application result and every projected ID remain strings.
  await transaction(false,async()=>{const rows=await storage.orderBills.all();assert.ok(rows.some(r=>r.id==='100'));assert.ok(rows.every(r=>typeof r.id==='string'));for(const id of ['0100','+100','9223372036854775808'])assert.equal(await storage.orderBills.find(id),undefined);});
  await assert.rejects(executeCommand('bill-identity',key,hashIntent({order:'changed'}),async()=>{}),e=>e.status===409);
  await command(async()=>{const record=await storage.orderBills.find('100'),stale=await storage.orderBills.find('100');await storage.orderBills.update(record,{createdBy:'edited'});await assert.rejects(storage.orderBills.update(stale,{createdBy:'lost'}),e=>e.status===409);await assert.rejects(storage.orderBills.update(record,{id:'101'}),e=>e.status===409);await storage.orderBills.softDelete(record);});
  await transaction(false,async()=>{assert.equal(await storage.orderBills.find('100'),undefined);assert.deepEqual((await storage.orderBills.all()).map(r=>r.id),['10','2']);});
 });
 await t.test('rollback consumes a sequence number and later writes invalidate the old inverse approval',async()=>{
  let reserved;await assert.rejects(command(async()=>{reserved=await storage.orderBills.reserveIdentifier();throw Error('rollback');}));
  const next=await command(()=>storage.orderBills.reserveIdentifier());assert.equal(BigInt(next),BigInt(reserved)+1n);
  await refused(inverse);
 });
 await t.test('direct inserts and parallel clients share one sequence without collisions or precision loss',async()=>{
  const clients=Array.from({length:6},()=>new Client({connectionString:url.toString()}));await Promise.all(clients.map(c=>c.connect()));
  try{const ids=await Promise.all(clients.map(async c=>(await c.query('INSERT INTO stock_operational.order_bills("orderId") VALUES($1) RETURNING id::text',['BI_PARENT'])).rows[0].id));assert.equal(new Set(ids).size,ids.length);assert.ok(ids.every(id=>BigInt(id)>100n));}finally{await Promise.all(clients.map(c=>c.end()));}
  await owner.query("SELECT setval('stock_operational.order_bills_id_seq',9007199254740993,true)");
  const id=await command(()=>storage.orderBills.reserveIdentifier());assert.equal(id,'9007199254740994');
  await command(()=>storage.orderBills.insert({id,orderId:'BI_PARENT'}));await transaction(false,async()=>assert.equal((await storage.orderBills.find(id)).id,id));
 });
 assert.notEqual(await fingerprint(),before);
});
