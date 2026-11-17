/* eslint-disable @typescript-eslint/no-require-imports */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1','Synthetic disposable database only');
const {transaction,currentTransaction,closePool,PersistenceFailure}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const {createMovementStore}=require('../../src/modules/inventory/infrastructure/google-sheets/movements.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const {GoogleSheetsWorkforceStore}=require('../../src/modules/hr/infrastructure/google-sheets/workforce-store.ts');
const {listOrders}=require('../../src/modules/orders/server.ts');
const service=createPostgresService();
const q=(sql,values)=>currentTransaction().query(sql,values);
const order=(id,time)=>[id,'waiting_for_total_price','Synthetic','12.3400','original',time,'','','synthetic'];
test.after(closePool);

test('the selected physical schema and timestamp parsing are explicit, safe and session-independent',async()=>transaction(false,async()=>{
 assert.equal(Number((await q("SELECT count(*) FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'")).rows[0].count),process.env.STOCK_EXPECT_NO_ROW_ORDER==='true'?0:23);
 await q("SET LOCAL timezone='America/Los_Angeles'; SET LOCAL datestyle='SQL, DMY'");
 const r=(await q(`SELECT stock_operational.created_at_timestamp('2026-11-17 09:00:00')=stock_operational.created_at_timestamp('2026-11-17T02:00:00Z') AS local,
 stock_operational.created_at_timestamp('2026-11-17T09:00:00+07:00')=stock_operational.created_at_timestamp('2026-11-17T02:00:00Z') AS offsets,
 stock_operational.created_at_timestamp('17/11/2026') IS NULL AS ambiguous,
 stock_operational.created_at_timestamp('2026-02-30') IS NULL AS invalid,
 stock_operational.created_at_timestamp('') IS NULL AS blank`)).rows[0];
 assert.deepEqual(r,{local:true,offsets:true,ambiguous:true,invalid:true,blank:true});
}));

test('actual Orders list uses creation instants, ID ties, unknowns last; source strings unchanged',async()=>{
 await transaction(true,async()=>{
  for(const cells of [order('SR_SORT_Z','bad'),order('SR_SORT_B','2026-11-17T09:00:00+07:00'),order('SR_SORT_A','2026-11-17T02:00:00Z'),order('SR_SORT_OLD','2026-11-16'),order('SR_SORT_NULL','')])await service.orders.appendRows('A:I',[cells]);
 });
 await transaction(false,async()=>{
  const result=(await listOrders({googleSheetsService:service})).filter(r=>r.id.startsWith('SR_SORT_'));
  assert.deepEqual(result.map(r=>r.id),['SR_SORT_A','SR_SORT_B','SR_SORT_OLD','SR_SORT_NULL','SR_SORT_Z']);
  assert.equal(result[1].createdAt,'2026-11-17T09:00:00+07:00');
 });
});

test('ID handle targets the same record after an insertion and reorder; positional writes fail closed',async()=>transaction(true,async()=>{
 await service.orders.appendRows('A:I',[order('SR_TARGET','2026-11-10')]);
 const rows=await service.orders.readRows(),row=rows.find(r=>r[0]==='SR_TARGET');
 await service.orders.appendRows('A:I',[order('SR_EARLIER','2026-01-01')]);
 const ref=service.orders.referenceRow(row);
 await ref.update('E',['right ID']);await ref.update('F',['2027-01-01']);await ref.update('E',['still right ID']);
 assert.equal((await q("SELECT remark FROM stock_operational.orders WHERE id='SR_TARGET'")).rows[0].remark,'still right ID');
 assert.equal((await q("SELECT remark FROM stock_operational.orders WHERE id='SR_EARLIER'")).rows[0].remark,'original');
 await assert.rejects(service.orders.updateRows('E2',[['wrong']]),PersistenceFailure);
 await assert.rejects(service.orders.deleteRow(2),PersistenceFailure);
 assert.throws(()=>service.orders.referenceRow([...row]),PersistenceFailure);
}));

test('stale, changed-ID and archived references cannot mutate another record',async()=>{
 let stale;
 await transaction(true,async()=>{await service.orders.appendRows('A:I',[order('SR_STALE','2026-11-17')]);stale=service.orders.referenceRow((await service.orders.readRows()).find(r=>r[0]==='SR_STALE'));});
 await transaction(true,async()=>{await (await service.orders.referenceId('SR_STALE')).update('E',['newer']);});
 await assert.rejects(transaction(true,()=>stale.update('E',['stale'])),e=>e instanceof PersistenceFailure&&e.status===409);
 await assert.rejects(transaction(true,async()=> (await service.orders.referenceId('SR_STALE')).update('A',['SR_CHANGED'])),PersistenceFailure);
 await transaction(true,async()=>{await (await service.orders.referenceId('SR_STALE')).archive();});
 await assert.rejects(transaction(true,()=>stale.archive()),PersistenceFailure);
 await transaction(false,async()=>{assert.equal(await service.orders.referenceId('SR_STALE'),undefined);assert.equal((await q("SELECT remark FROM stock_operational.orders WHERE id='SR_STALE'")).rows[0].remark,'newer');});
});

test('hidden compensation IDs persist and append-only permissions are not widened',async()=>{
 await transaction(true,async()=>{
  await service.employees.appendRows('A:I',[['SR_EMP','Test','','active','','','2026-11-01','','synthetic']]);
  await service.employeeCompensations.appendRows('A:L',[
   ['SR_EMP','100','','2026-11-17','','synthetic','2026-11-01','salary','','','',''],
   ['SR_EMP','200','','2026-11-01','','synthetic','2026-11-01','salary','','','','']]);
 });
 const read=()=>transaction(false,async()=> (await q('SELECT migration_id,"baseSalary"::text AS salary FROM stock_operational.employee_compensations WHERE "employeeId"=$1 ORDER BY migration_id',['SR_EMP'])).rows);
 const before=await read();assert.equal(before.length,2);assert.notEqual(before[0].migration_id,before[1].migration_id);
 await transaction(false,async()=>{
  const rows=(await service.employeeCompensations.readRows()).filter(r=>r[0]==='SR_EMP');assert.equal(rows[0][1],'200');
  const old=(await new GoogleSheetsWorkforceStore(service).readCompensations()).list().filter(r=>r.employeeId==='SR_EMP');assert.deepEqual(old.map(r=>r.baseSalary),[200,100]);
 });
 await assert.rejects(transaction(true,async()=>{
  const row=(await service.employeeCompensations.readRows()).find(r=>r[0]==='SR_EMP');await service.employeeCompensations.referenceRow(row).update('B',['250']);
 }),PersistenceFailure);
 assert.deepEqual(await read(),before);
});

test('numeric ID allocation includes archived IDs, not sparse positions or current list length',async()=>transaction(true,async()=>{
 await service.userState.appendRows('A:H',[[ '8000','SR_ALLOC','OrderCreate','SR_TARGET','waiting_for_bill_image','2026-11-17','','']]);
 await (await service.userState.referenceId('8000')).archive();
 assert.deepEqual(await Promise.all([service.userState.nextRecordNumber(),service.userState.nextRecordNumber(),createPostgresService().userState.nextRecordNumber()]),[8001,8002,8003]);
 const snapshot=await service.userState.readRows();
 assert.equal(service.userState.identifierAfter(snapshot),8004);assert.equal(service.userState.identifierAfter(snapshot),8005);
}));

test('actual LINE order session resumes by opaque numeric ID, not row number; clear archives only that ID',async()=>transaction(true,async()=>{
 await service.userState.appendRows('A:H',[
  ['42','SR_LINE','OrderCreate','SR_TARGET','waiting_for_bill_image','2026-11-17','',''],
  ['43','SR_OTHER','OrderCreate','SR_TARGET','waiting_for_bill_image','2026-11-16','','']]);
 const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));
 const reference=sessions.orders.reference('42');
 await reference.update('waiting_for_total_price','2026-11-18','2026-11-18');
 const result=(await q('SELECT id,state,archived_at FROM stock_operational.user_state WHERE id IN ($1,$2) ORDER BY id',['42','43'])).rows;
 assert.equal(result[0].state,'waiting_for_total_price');assert.equal(result[1].state,'waiting_for_bill_image');
 await reference.clear();
 assert.equal(await service.userState.referenceId('42'),undefined);assert.ok(await service.userState.referenceId('43'));
}));

test('actual movement quantity/remark/image edit remains ID-bound after another insert changes its position',async()=>transaction(true,async()=>{
 await service.movementMasters.appendRows('A:H',[['SR_MOVE','user','','','created','1','2026-11-17','']]);
 await service.movementDetails.appendRows('A:N',[['SR_DETAIL','SR_MOVE','shop','1','before','','','','','created','2026-11-17','','false','false']]);
 const store=createMovementStore(service),target=(await store.readDetails('edit')).find('SR_DETAIL','SR_MOVE'),edit=target.edit();
 await service.movementDetails.appendRows('A:N',[['SR_OTHER_DETAIL','SR_MOVE','shop','2','other','','','','','created','2020-01-01','','false','false']]);
 edit.quantity('5');edit.remark('after');edit.image('https://example.test/fake.png');await edit.save();
 const rows=(await q('SELECT id,quantity::text,remark,"productImageUrl" AS image FROM stock_operational.movement_details WHERE "movementMasterId"=$1 ORDER BY id',['SR_MOVE'])).rows;
 assert.deepEqual(rows.map(r=>[r.id,r.quantity,r.remark]),[['SR_DETAIL','5','after'],['SR_OTHER_DETAIL','2','other']]);assert.equal(rows[0].image,'https://example.test/fake.png');
}));

test('four formerly dateless tables keep their first-observed createdAt on updates',async()=>transaction(true,async()=>{
 for(const table of ['sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','stock_counts'])assert.ok((await q("SELECT 1 FROM information_schema.columns WHERE table_schema='stock_operational' AND table_name=$1 AND column_name='createdAt'",[table])).rowCount);
 await service.stockCounts.appendRows('A:I',[['SR_COUNT','2026-11','account','shop','1','note','2026-11-17','','synthetic']]);
 const before=(await q('SELECT "createdAt" AS value,created_at_instant::text AS instant FROM stock_operational.stock_counts WHERE id=$1',['SR_COUNT'])).rows[0];assert.ok(before.value&&before.instant);
 await (await service.stockCounts.referenceId('SR_COUNT')).update('F',['changed']);
 const after=(await q('SELECT "createdAt" AS value,created_at_instant::text AS instant FROM stock_operational.stock_counts WHERE id=$1',['SR_COUNT'])).rows[0];assert.deepEqual(after,before);
}));
