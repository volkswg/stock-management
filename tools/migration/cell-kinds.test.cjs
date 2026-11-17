/* eslint-disable @typescript-eslint/no-require-imports -- Actual owners, new synthetic local databases only. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Providers forbidden in compatibility acceptance');};
const test=require('node:test'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const {transaction,currentTransaction,requireMutation,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts'),inventory=require('../../src/modules/inventory/server.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const service=createPostgresService(),q=(s,a)=>currentTransaction().query(s,a),write=(s,a)=>requireMutation().query(s,a);
const mode=process.env.STOCK_CK_CASE,retained=mode==='ck_retained';
const order=(id,remark='retained',price='9007199254740993.0100')=>[id,'waiting_for_total_price','Synthetic',price,remark,'2026-11-17T02:00:00.123Z','','','synthetic'];
test.after(closePool);
if(mode==='ck_partial'){
 test('installed partial schema fails closed rather than silently selecting legacy functions',async()=>{
  await assert.rejects(transaction(false,()=>service.orders.readRows()),e=>e.status===503);
 });
}else{
 test('explicit mode and all47 native fields,48 lexemes,IDs and existing RLS remain',async()=>transaction(false,async()=>{
  assert.equal((await q('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,retained?'retained':'final');
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='cell_kinds'")).rows[0].n),retained?23:0);
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name LIKE '%__lexeme'")).rows[0].n),48);
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'")).rows[0].n),47);
  assert.equal((await q("SELECT bool_and(relrowsecurity) enabled FROM pg_class WHERE relnamespace='stock_operational'::regnamespace AND relkind='r'")).rows[0].enabled,true);
 }));
 test('actual adapter create,partial edit,precision and stale revision preserve existing contracts',async()=>transaction(true,async()=>{
  await service.orders.appendRows('A:I',[order('CK_ORDER')]);
  let row=(await service.orders.readRows()).find(r=>r[0]==='CK_ORDER');assert.equal(row[3],'9007199254740993.0100');
  const first=service.orders.referenceRow(row),stale=await service.orders.referenceId('CK_ORDER');
  await first.update('E',['edited']);row=(await service.orders.readRows()).find(r=>r[0]==='CK_ORDER');
  assert.equal(row[4],'edited');assert.equal(row[3],'9007199254740993.0100');assert.equal(row[5],'2026-11-17T02:00:00.123Z');
  await assert.rejects(stale.update('E',['stale']),e=>e.status===409);
 }));
 test('native direct edits stay visible,clear optional remarks and retain unaffected numeric spelling',async()=>transaction(true,async()=>{
  await write('UPDATE stock_operational.orders SET remark=$1,"createdAt"=$2::timestamptz WHERE id=$3',['direct native edit','2026-11-17T09:00:00.123456+07:00','CK_ORDER']);
  let row=(await service.orders.readRows()).find(r=>r[0]==='CK_ORDER');assert.equal(row[4],'direct native edit');assert.equal(row[5],'2026-11-17T02:00:00.123456Z');
  await (await service.orders.referenceId('CK_ORDER')).update('E',['']);row=(await service.orders.readRows()).find(r=>r[0]==='CK_ORDER');assert.equal(row[4],'');assert.equal(row[3],'9007199254740993.0100');
 }));
 test('unknown dates,last ordering and soft-delete/archive guards remain',async()=>transaction(true,async()=>{
  await service.orders.appendRows('A:I',[order('CK_NULL_TIME')]);await write('UPDATE stock_operational.orders SET "createdAt"=NULL WHERE id=$1',['CK_NULL_TIME']);
  const rows=await service.orders.readRows();assert.equal(rows.at(-1)[0],'CK_NULL_TIME');
  const ref=await service.orders.referenceId('CK_NULL_TIME');await ref.update('H',['2026-11-18T02:00:00Z']);
  assert.equal((await orders.listOrders({googleSheetsService:service})).some(o=>o.id==='CK_NULL_TIME'),false);
  await ref.update('H',['']);await ref.archive();assert.equal(await service.orders.referenceId('CK_NULL_TIME'),undefined);
 }));
 test('LINE latest selection,context spelling and state update/clear use stable opaque IDs',async()=>transaction(true,async()=>{
  const context=' { "upload" : "synthetic", "unknown" : [1,true] } ';
  await service.userState.appendRows('A:H',[
   ['99002','CK_LINE','OrderCreate','CK_ORDER','waiting_for_bill_image','2026-11-17T02:00:00Z','',context],
   ['99001','CK_LINE','OrderCreate','CK_ORDER','waiting_for_bill_image','2026-11-17T02:00:00Z','',context]]);
  const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));assert.equal((await sessions.orders.findLatest('CK_LINE','OrderCreate')).id,'99001');
  assert.equal((await service.userState.readRows()).find(r=>r[0]==='99001')[7],context);
  await sessions.orders.reference('99001').update('waiting_for_total_price','2026-11-17T02:00:00Z','2026-11-18T02:00:00Z');
  assert.equal((await q('SELECT state FROM stock_operational.user_state WHERE id=$1',['99001'])).rows[0].state,'waiting_for_total_price');
  await sessions.orders.reference('99001').clear();assert.equal(await service.userState.referenceId('99001'),undefined);
 }));
 test('bad scalar values fail atomically and no operation can rename a business identity',async()=>{
  await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[order('CK_BAD',{})])));
  await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[order('CK_BAD','bad','not-a-number')])));
  await assert.rejects(transaction(true,async()=>{await(await service.orders.referenceId('CK_ORDER')).update('A',['renamed']);}));
  await transaction(false,async()=>assert.equal(await service.orders.referenceId('CK_BAD'),undefined));
 });
 if(retained){
  test('retained metadata preserves null,blank,mixed scalar identity and original short-row width',async()=>transaction(true,async()=>{
   const rows=[['CK_NULL','waiting_for_total_price',null,'1.0000',null],['CK_TYPES','waiting_for_total_price',42,1.25,true],['CK_SHORT','waiting_for_total_price']];
   await service.orders.appendRows('A:I',rows);
   const read=await service.orders.readRows();for(const input of rows)assert.deepEqual(read.find(r=>r[0]===input[0]),input);
   await (await service.orders.referenceId('CK_NULL')).update('E',['edited']);
   const row=(await service.orders.readRows()).find(r=>r[0]==='CK_NULL');assert.equal(row[2],null);assert.equal(row[3],'1.0000');
  }));
  test('true versus numeric1 inventory flags are preserved and clearly differ from the candidate projection',async()=>transaction(true,async()=>{
   await service.movementMasters.appendRows('A:H',[['CK_MASTER','synthetic','2026-11-17','','created','2','2026-11-17T02:00:00Z','']]);
   const item=(id,value)=>[id,'CK_MASTER','Synthetic','1','','','','','','created','2026-11-17T02:00:00Z','',value,value];
   await service.movementDetails.appendRows('A:N',[item('CK_BOOL',true),item('CK_NUMBER',1)]);
   const rows=await service.movementDetails.readRows();assert.equal(rows.find(r=>r[0]==='CK_BOOL')[12],true);assert.equal(rows.find(r=>r[0]==='CK_NUMBER')[12],1);
   const records=await inventory.getMovementItems({googleSheetsService:service,movementMasterId:'CK_MASTER'});assert.equal(records.find(r=>r.movementId==='CK_BOOL').stockCounted,true);assert.equal(records.find(r=>r.movementId==='CK_NUMBER').stockCounted,false);
   const result=(await q('SELECT stock_operational.project_movement_details(t) legacy,stock_operational.column_project_movement_details(t) candidate FROM stock_operational.movement_details t WHERE id=$1',['CK_NUMBER'])).rows[0];
   assert.equal(result.legacy[12],1);assert.equal(result.candidate[12],true);
   await (await service.movementDetails.referenceId('CK_NUMBER')).archive();
  }));
  test('predecessor mapper sees exact new writes and legacy writer results are visible to current adapter',async()=>transaction(true,async()=>{
   const input=order('CK_PREDECESSOR','rollback compatible',12.5);await service.orders.appendRows('A:I',[input]);
   assert.deepEqual((await q('SELECT stock_operational.project_orders(t) cells FROM stock_operational.orders t WHERE id=$1',['CK_PREDECESSOR'])).rows[0].cells,input);
   await write('UPDATE stock_operational.orders SET remark=$1 WHERE id=$2',['old writer','CK_PREDECESSOR']);
   assert.equal((await service.orders.readRows()).find(r=>r[0]==='CK_PREDECESSOR')[4],'old writer');
  }));
 }else{
  test('kindless candidate handles canonical booleans and JSON text without legacy decoding',async()=>transaction(true,async()=>{
   await service.movementMasters.appendRows('A:H',[['M','synthetic','2026-11-17','','created','1','2026-11-17T02:00:00Z','']]);
   await service.movementDetails.appendRows('A:N',[['CK_FINAL_BOOL','M','S','1','','','','','','created','2026-11-17T02:00:00Z','',true,false]]);
   const row=(await service.movementDetails.readRows()).find(r=>r[0]==='CK_FINAL_BOOL');assert.equal(row[12],true);assert.equal(row[13],false);
   assert.equal((await q('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,'final');
  }));
 }
}
