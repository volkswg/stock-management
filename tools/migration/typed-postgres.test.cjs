/* eslint-disable @typescript-eslint/no-require-imports -- Actual current adapter on disposable local PostgreSQL. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Providers forbidden in typed cleanup acceptance');};
const test=require('node:test'),assert=require('node:assert/strict'),{Client}=require('pg');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.ok(['/tc_retained','/tc_focused'].includes(url.pathname));
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const {listOrders}=require('../../src/modules/orders/server.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const {readMovementSession}=require('../../src/modules/line-workflows/application/sessions.ts');
const service=createPostgresService(),row=id=>[id,'waiting_for_total_price','Synthetic','9007199254740993.0100','before','2026-11-18T00:00:00.123456Z','','','synthetic'];
test.after(closePool);
if(url.pathname==='/tc_retained'){
 test('current adapter rejects the former retained layout before reads or writes; no legacy fallback',async()=>{
  const revision=()=>transaction(false,async()=>(await currentTransaction().query('SELECT value::text v FROM stock_operational.revision WHERE singleton')).rows[0].v);
  const before=await revision();
  await assert.rejects(transaction(false,()=>service.orders.readRows()),e=>e.status===503);
  await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[row('TC_REJECTED')])),e=>e.status===503);
  assert.equal(await revision(),before);
 });
}else{
 test('actual cleaned schema has zero old entrypoints and retains native timestamps and invoker guards',async()=>transaction(false,async()=>{
  const q=currentTransaction();assert.equal((await q.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='stock_operational'::regnamespace AND (proname ~ '^(input_|project_|column_input_|column_project_|column_compatible_)' OR proname='column_mapping_contract_v1')")).rows[0].n,0);
  assert.equal((await q.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'")).rows[0].n,47);
  assert.equal((await q.query("SELECT stock_operational.lexeme_mapping_contract_v1() mode")).rows[0].mode,'typed');
 }));
 test('current typed adapter preserves exact storage, public order output and actual LINE parsing',async()=>{
  const state={masterId:'TC_MASTER',itemId:'TC_ITEM',userId:'TC_USER',startedAt:'2026-11-18T00:00:00.123456Z',shop:'Synthetic',quantity:'1',remark:'',imageUrl:'',lastEventId:'TC_DONE',step:'product_image'};
  await transaction(true,async()=>{await service.orders.appendRows('A:I',[row('TC_ORDER')]);await service.userState.appendRows('A:H',[['99001',state.userId,'MovementCreate',state.masterId,state.step,state.startedAt,'',JSON.stringify(state)]]);});
  await transaction(false,async()=>{
   assert.equal((await service.orders.readRows())[1][3],row('TC_ORDER')[3]);
   assert.equal((await listOrders({googleSheetsService:service}))[0].remark,'before');
   const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));assert.deepEqual((await readMovementSession(sessions.movements,state.userId,'TC_NEW')).state,state);
  });
  await transaction(true,async()=>await(await service.orders.referenceId('TC_ORDER')).update('E',['after']));
  await transaction(false,async()=>assert.equal((await listOrders({googleSheetsService:service}))[0].remark,'after'));
 });
 test('capability is checked once per unit of work across services; no obsolete column discovery',async()=>{
  const original=Client.prototype.query,queries=[];Client.prototype.query=function(text,...args){queries.push(text);return original.call(this,text,...args);};
  try{await transaction(false,async()=>{await service.orders.readRows();await createPostgresService().userState.readRows();});}
  finally{Client.prototype.query=original;}
  assert.equal(queries.filter(q=>q==='SELECT stock_operational.lexeme_mapping_contract_v1() AS mode').length,1);
  assert.ok(queries.every(q=>typeof q==='string'&&!q.includes('information_schema')&&!q.includes('column_mapping_contract')&&!q.includes('pg_typeof')));
 });
 test('the same pool revalidates partial and missing schemas on later transactions without fallback',async()=>{
  url.username='postgres';const admin=new Client({connectionString:url.toString()});await admin.connect();
  try{
   await admin.query('ALTER TABLE stock_operational.orders ADD COLUMN unreviewed__lexeme text');
   await assert.rejects(transaction(false,()=>service.orders.readRows()),e=>e.status===503);
   await admin.query('ALTER TABLE stock_operational.orders DROP COLUMN unreviewed__lexeme RESTRICT');
   await transaction(false,()=>service.orders.readRows());
   await admin.query('ALTER FUNCTION stock_operational.lexeme_mapping_contract_v1() RENAME TO tc_missing_contract');
   await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[row('TC_MISSING')])),e=>e.status===503);
   await admin.query('ALTER FUNCTION stock_operational.tc_missing_contract() RENAME TO lexeme_mapping_contract_v1');
   await transaction(false,async()=>assert.equal(await service.orders.referenceId('TC_MISSING'),undefined));
  }finally{await admin.end();}
 });
}
