/* eslint-disable @typescript-eslint/no-require-imports -- Real current LINE owners, synthetic local PostgreSQL and no real providers. */
const sessionPrimitives=require('../../tests/helpers/native-line-primitives.cjs');
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/postgres/sessions.ts');
const {readMovementSession}=require('../../src/modules/line-workflows/application/sessions.ts');
global.fetch=()=>{throw Error('Providers forbidden in session identity acceptance');};
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
const forwardName=fs.readdirSync('tools/migration/operator').filter(n=>/^\d+_user_state_identity.sql$/.test(n));assert.equal(forwardName.length,1);
const forward=fs.readFileSync('tools/migration/operator/'+forwardName[0],'utf8'),inverse=fs.readFileSync('tools/migration/operator/rollback_user_state_identity.sql','utf8');
const billForward=fs.readFileSync('tools/migration/operator/20261120022134_order_bill_identity.sql','utf8');
const scalar=async(sql,params)=>(await owner.query(sql,params)).rows[0].value;
const command=run=>executeCommand('user-state-identity',randomUUID(),hashIntent(randomUUID()),run);
async function gates(kind='user_state'){
 const prefix=kind==='bill'?'bill':'user_state',revision=await scalar('SELECT value::text value FROM stock_operational.revision');
 for(const [key,value] of Object.entries({['allow_'+prefix+'_identity_conversion']:'reviewed-'+(kind==='bill'?'order-bill':'user-state')+'-bigint-v1',['allow_'+prefix+'_identity_inverse']:'reviewed-'+(kind==='bill'?'order-bill':'user-state')+'-bigint-v1',[prefix+'_identity_restore_verified']:'business-and-config-v1',[prefix+'_identity_source']:'1'.repeat(40),[prefix+'_identity_fingerprint']:await fingerprint(),expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging',[prefix+'_identity_revision']:revision}))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
}
async function fingerprint(){
 const tables=(await owner.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') ORDER BY 1,2")).rows,result=[];
 for(const {schemaname,tablename} of tables){
  const expression=schemaname==='stock_operational'&&tablename==='user_state'?"to_jsonb(t)||jsonb_build_object('id',t.id::text)":'to_jsonb(t)';
  result.push([schemaname,tablename,(await owner.query(`SELECT ${expression} value FROM "${schemaname}"."${tablename}" t ORDER BY (${expression})::text COLLATE "C"`)).rows]);
 }
 return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}
async function refused(sql){try{await assert.rejects(owner.query(sql));}finally{await owner.query('ROLLBACK');}}
let loseCommit=false;
const originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return value;}):result;};
test.before(async()=>{
 await owner.connect();
 await owner.query("DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN CREATE ROLE stock_prod_backup NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_reader') THEN CREATE ROLE stock_prod_reader NOLOGIN; END IF; END$$;");
 await owner.query('GRANT USAGE ON SCHEMA stock_operational,stock_migration TO stock_prod_backup; GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational,stock_migration TO stock_prod_backup;');
 await owner.query(fs.readFileSync('supabase/migrations/20261119082351_private_loyverse_accounts.sql','utf8'));
 await owner.query("DELETE FROM stock_operational.user_state; INSERT INTO stock_operational.user_state(id,\"userId\",\"createdAt\",\"deletedAt\") VALUES('2','USI_TWO','2026-11-20T00:00:00Z',NULL),('10','USI_TEN','2026-11-20T00:00:00Z',NULL),('99','USI_DELETED','2026-11-20T00:00:00Z','2026-11-20T00:00:00Z');");
});
test.after(async()=>{await db.closePool();await owner.end();});
test('user-state identity preserves IDs, current LINE flows and the released order-bill identity',async t=>{
 await t.test('conversion refuses the older all-text bill contract',async()=>{await gates();await refused(forward);await gates('bill');await owner.query(billForward);});
 await t.test('the compatible app creates order and movement sessions on text before conversion',async()=>{
  await command(()=>sessionPrimitives.createDraftOrder({storage,createdBy:'USI_TEXT_ORDER'}));
  await command(()=>sessionPrimitives.saveMovementState(storage,{masterId:'USI_TEXT_MOVE',itemId:'MOVED-TEXT',userId:'USI_TEXT_MOVE_USER',step:'quantity',startedAt:'2026-11-20T00:00:00Z',shop:'NJ',quantity:'3',remark:'unchanged',imageUrl:'',lastEventId:'text-event'}));
  await db.transaction(false,async()=>assert.ok((await storage.userState.all()).every(r=>typeof r.id==='string')));
 });
 await t.test('unapproved/stale/aliased/overflow/FK/view/default-grant and late-failure attempts refuse atomically',async()=>{
  await gates();await owner.query("SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'");await refused(forward);await gates();
  await owner.query("SET stock.user_state_identity_revision='-1'");await refused(forward);await gates();
  for(const id of ['01','-1','not-numeric','9223372036854775807','9223372036854775808']){await owner.query('INSERT INTO stock_operational.user_state(id) VALUES($1)',[id]);await gates();await refused(forward);await owner.query('DELETE FROM stock_operational.user_state WHERE id=$1',[id]);}
  await owner.query('CREATE TABLE public.usi_reference(id text REFERENCES stock_operational.user_state(id))');await gates();await refused(forward);await owner.query('DROP TABLE public.usi_reference');
  await owner.query('CREATE VIEW public.usi_reference AS SELECT id FROM stock_operational.user_state');await gates();await refused(forward);await owner.query('DROP VIEW public.usi_reference');
  await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational GRANT USAGE ON SEQUENCES TO lexeme_reader');await gates();await refused(forward);await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational REVOKE USAGE ON SEQUENCES FROM lexeme_reader');
  const before=await fingerprint();await gates();await refused(forward.replace('COMMIT;','SELECT 1/0; COMMIT;'));assert.equal(await fingerprint(),before);
 });
 const before=await fingerprint();await gates();await owner.query(forward);assert.equal(await fingerprint(),before);
 await t.test('identity and exact inverse preserve every table, reference, revision and existing bill identity',async()=>{
  assert.equal(await scalar("SELECT pg_get_serial_sequence('stock_operational.order_bills','id') value"),'stock_operational.order_bills_id_seq');
  assert.equal(await scalar("SELECT pg_get_serial_sequence('stock_operational.user_state','id') value"),'stock_operational.user_state_id_seq');
  await gates();await owner.query(inverse);assert.equal(await fingerprint(),before);
  assert.equal(await scalar("SELECT format_type(atttypid,atttypmod) value FROM pg_attribute WHERE attrelid='stock_operational.user_state'::regclass AND attname='id'"),'text');
  assert.equal(await scalar("SELECT pg_get_serial_sequence('stock_operational.order_bills','id') value"),'stock_operational.order_bills_id_seq');
  await gates();await owner.query(forward);assert.equal(await fingerprint(),before);
 });
 await t.test('sequence includes deleted IDs; runtime gets USAGE only and backup SELECT only',async()=>{
  assert.equal(await scalar('SELECT last_value::text value FROM stock_operational.user_state_id_seq'),await scalar('SELECT greatest(max(id),1)::text value FROM stock_operational.user_state'));
  for(const [role,privilege,expected] of [['stock_runtime','USAGE',true],['stock_runtime','UPDATE',false],['stock_runtime','SELECT',false],['stock_prod_backup','SELECT',true],['stock_prod_backup','USAGE',false],['stock_prod_reader','USAGE',false],['anon','USAGE',false],['authenticated','USAGE',false]])assert.equal(await scalar('SELECT has_sequence_privilege($1,$2,$3) value',[role,'stock_operational.user_state_id_seq',privilege]),expected);
 });
 await t.test('read-only session/photo snapshots neither fail nor advance the sequence',async()=>{
  const next=await scalar('SELECT last_value::text value FROM stock_operational.user_state_id_seq');
  await db.transaction(false,async()=>{const adapter=createSessionAdapter(storage,{itemSnapshot:async()=>({items:()=>[]})});await adapter.movements.read();await adapter.photoContext();await readMovementSession(adapter.movements,'USI_TEXT_MOVE_USER','text-event');});
  assert.equal(await scalar('SELECT last_value::text value FROM stock_operational.user_state_id_seq'),next);
 });
 await t.test('uncertain order creation retries reuse the committed session without another reservation',async()=>{
  const key=randomUUID();let executions=0;
  const run=()=>executeCommand('USI_RETRY',key,hashIntent({user:'USI_RETRY_USER'}),async()=>{executions++;return sessionPrimitives.createDraftOrder({storage,createdBy:'USI_RETRY_USER'});});
  loseCommit=true;await assert.rejects(run());const beforeRetry=await scalar('SELECT last_value::text value FROM stock_operational.user_state_id_seq');const order=await run();assert.deepEqual(await run(),order);assert.equal(executions,1);
  assert.equal(await scalar('SELECT last_value::text value FROM stock_operational.user_state_id_seq'),beforeRetry);
  assert.equal(await scalar("SELECT count(*)::text value FROM stock_operational.user_state WHERE \"userId\"='USI_RETRY_USER'"),'1');
  await assert.rejects(executeCommand('USI_RETRY',key,hashIntent({user:'changed'}),async()=>{}),e=>e.status===409);
 });
 await t.test('existing movement resumes, deduplicates, updates and completes with the same session ID',async()=>{
  const before=(await owner.query("SELECT id::text id,context FROM stock_operational.user_state WHERE \"userId\"='USI_TEXT_MOVE_USER'")).rows[0];const state=before.context;
  await db.transaction(false,async()=>{const adapter=createSessionAdapter(storage,{itemSnapshot:async()=>({items:()=>[]})});assert.equal((await readMovementSession(adapter.movements,state.userId,state.lastEventId)).processed,true);});
  await command(()=>sessionPrimitives.saveMovementState(storage,{...state,quantity:'4',lastEventId:'bigint-event'}));
  const after=(await owner.query('SELECT id::text id,context FROM stock_operational.user_state WHERE id=$1',[before.id])).rows[0];assert.equal(after.id,before.id);assert.equal(after.context.quantity,'4');
  await command(()=>sessionPrimitives.saveMovementState(storage,{...state,step:'complete'}));await db.transaction(false,async()=>assert.equal(await storage.userState.find(before.id),undefined));
 });
 await t.test('stale and immutable session handles remain protected on bigint',async()=>{
  await command(async()=>{const first=await storage.userState.find('2'),stale=await storage.userState.find('2');await storage.userState.update(first,{state:'quantity'});await assert.rejects(storage.userState.update(stale,{state:'lost'}),e=>e.status===409);await assert.rejects(storage.userState.update(first,{id:'3'}),e=>e.status===409);});
 });
 await t.test('direct and parallel inserts have unique IDs; application IDs retain precision beyond 2^53',async()=>{
  const clients=Array.from({length:6},()=>new Client({connectionString:url.toString()}));await Promise.all(clients.map(c=>c.connect()));
  try{const ids=await Promise.all(clients.map(async(c,i)=>(await c.query('INSERT INTO stock_operational.user_state("userId") VALUES($1) RETURNING id::text',['USI_PARALLEL_'+i])).rows[0].id));assert.equal(new Set(ids).size,ids.length);}finally{await Promise.all(clients.map(c=>c.end()));}
  await owner.query("SELECT setval('stock_operational.user_state_id_seq',9007199254740993,true)");await command(()=>sessionPrimitives.createDraftOrder({storage,createdBy:'USI_PRECISE'}));
  assert.equal(await scalar("SELECT id::text value FROM stock_operational.user_state WHERE \"userId\"='USI_PRECISE'"),'9007199254740994');
  await db.transaction(false,async()=>assert.ok((await storage.userState.all()).every(r=>typeof r.id==='string')));
 });
 await t.test('rollback leaves a sequence gap, and later writes invalidate the original inverse approval',async()=>{
  let reserved;await assert.rejects(command(async()=>{reserved=await storage.userState.reserveIdentifier();throw Error('synthetic abort');}));const next=await command(()=>storage.userState.reserveIdentifier());assert.equal(BigInt(next),BigInt(reserved)+1n);await refused(inverse);
 });
});
