/* eslint-disable @typescript-eslint/no-require-imports -- Real owners on synthetic local PostgreSQL only. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Provider calls forbidden in timestamp acceptance');};
const test=require('node:test'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const {transaction,currentTransaction,requireMutation,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const {listOrders}=require('../../src/modules/orders/server.ts');
const hr=require('../../src/modules/hr/server.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const service=createPostgresService(),q=(sql,args)=>currentTransaction().query(sql,args),write=(sql,args)=>requireMutation().query(sql,args);
const order=(id,createdAt,updatedAt='',deletedAt='')=>[id,'waiting_for_total_price','Synthetic','12.3400','retained',createdAt,updatedAt,deletedAt,'synthetic'];
test.after(closePool);
test('all47 lifecycle columns retain their exact names as timestamptz; business dates and controls remain',async()=>transaction(false,async()=>{
 assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'")).rows[0].n),47);
 assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('created_at_instant','row_order','business_cells')")).rows[0].n),0);
 assert.equal((await q("SELECT data_type FROM information_schema.columns WHERE table_schema='stock_operational' AND table_name='employee_compensations' AND column_name='effectiveFrom'")).rows[0].data_type,'text');
 assert.equal((await q("SELECT bool_and(relrowsecurity) enabled FROM pg_class WHERE relnamespace='stock_operational'::regnamespace AND relkind='r'")).rows[0].enabled,true);
}));
test('actual named adapter round-trips offsets and microseconds, edits by ID and keeps wire fields as strings',async()=>transaction(true,async()=>{
 await service.orders.appendRows('A:I',[order('NT_OFFSET','2026-11-17T09:00:00.123456+07:00','2026-11-17 10:00:00')]);
 let rows=await service.orders.readRows(),row=rows.find(r=>r[0]==='NT_OFFSET');
 assert.equal(row[5],'2026-11-17T02:00:00.123456Z');assert.equal(row[6],'2026-11-17T03:00:00.000Z');assert.equal(row[7],'');
 const ref=service.orders.referenceRow(row);
 await service.orders.appendRows('A:I',[order('NT_EARLIER','2026-01-01')]);
 await ref.update('E',['only correct ID']);await ref.update('G',['2026-11-17T04:00:00.987654Z']);
 rows=await service.orders.readRows();row=rows.find(r=>r[0]==='NT_OFFSET');
 assert.equal(row[4],'only correct ID');assert.equal(row[5],'2026-11-17T02:00:00.123456Z');assert.equal(row[6],'2026-11-17T04:00:00.987654Z');
 await ref.update('H',['2026-11-18']);assert.equal((await listOrders({googleSheetsService:service})).some(r=>r.id==='NT_OFFSET'),false);
 await ref.update('H',['']);assert.equal((await listOrders({googleSheetsService:service})).some(r=>r.id==='NT_OFFSET'),true);
}));
test('direct native edits remain authoritative under different session timezone and DateStyle',async()=>transaction(true,async()=>{
 await q("SET LOCAL timezone='America/Los_Angeles'; SET LOCAL datestyle='SQL, DMY'");
 await write('UPDATE stock_operational.orders SET "createdAt"=$1::timestamptz,"updatedAt"=$2::timestamptz WHERE id=$3',['2026-11-18T00:00:00+07:00','2026-11-18T01:00:00.000001+07:00','NT_OFFSET']);
 const row=(await service.orders.readRows()).find(r=>r[0]==='NT_OFFSET');
 assert.equal(row[5],'2026-11-17T17:00:00.000Z');assert.equal(row[6],'2026-11-17T18:00:00.000001Z');
 assert.equal((await q("SELECT stock_operational.native_timestamp_text(stock_operational.native_timestamp_input('2026-11-18')) value")).rows[0].value,'2026-11-17T17:00:00.000Z');
}));
test('blanks and NULL remain unknown; equal instants use stable ID ties',async()=>transaction(true,async()=>{
 await service.orders.appendRows('A:I',[order('NT_SORT_B','2026-11-17T09:00:00+07:00'),order('NT_SORT_A','2026-11-17T02:00:00Z'),order('NT_SORT_NULL',null),order('NT_SORT_BLANK','')]);
 const rows=(await service.orders.readRows()).filter(r=>String(r[0]).startsWith('NT_SORT_'));
 assert.deepEqual(rows.map(r=>r[0]),['NT_SORT_A','NT_SORT_B','NT_SORT_BLANK','NT_SORT_NULL']);
 assert.equal(rows[2][5],'');assert.equal(rows[3][5],null);
}));
test('ambiguous, invalid and nonfinite inputs fail without inserting a record',async()=>{
 for(const value of ['17/11/2026','2026-02-30','Infinity','not-a-date',' ']){
  await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[order('NT_INVALID',value)])));
 }
 await assert.rejects(transaction(true,()=>write("UPDATE stock_operational.orders SET \"updatedAt\"='infinity'::timestamptz WHERE id='NT_OFFSET'")));
 await transaction(false,async()=>assert.equal(await service.orders.referenceId('NT_INVALID'),undefined));
});
test('Bangkok attendance day and month survive UTC serialization at a calendar boundary',async()=>transaction(true,async()=>{
 await service.employees.appendRows('A:I',[['NT_EMP','Synthetic','','active','','','2026-11-01','','synthetic']]);
 await service.employeeTimesheets.appendRows('A:G',[['NT_SHIFT','NT_EMP','account-synthetic','work','2026-11-01','2026-11-01','normal']]);
 const day=await hr.listEmployeeTimesheets({googleSheetsService:service,date:'2026-11-01'});
 assert.ok(day.some(r=>r.id==='NT_SHIFT'));
 const month=await hr.listEmployeeTimesheetsForMonth({googleSheetsService:service,month:'2026-11'});
 assert.ok(month.some(r=>r.id==='NT_SHIFT'));
}));
test('LINE latest selection, opaque IDs and state updates work with native timestamps',async()=>transaction(true,async()=>{
 await service.userState.appendRows('A:H',[
  ['95002','NT_LINE','OrderCreate','NT_OFFSET','waiting_for_bill_image','2026-11-17T09:00:00+07:00','',''],
  ['95001','NT_LINE','OrderCreate','NT_OFFSET','waiting_for_bill_image','2026-11-17T02:00:00Z','',''],
  ['95003','NT_LINE','OrderCreate','NT_OFFSET','waiting_for_bill_image','','','']]);
 const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));
 assert.equal((await sessions.orders.findLatest('NT_LINE','OrderCreate')).id,'95001');
 const ref=sessions.orders.reference('95001');
 await ref.update('waiting_for_total_price','2026-11-17T02:00:00Z','2026-11-18T02:00:00Z');
 assert.equal((await q('SELECT state FROM stock_operational.user_state WHERE id=$1',['95001'])).rows[0].state,'waiting_for_total_price');
 await ref.clear();assert.equal(await service.userState.referenceId('95001'),undefined);assert.ok(await service.userState.referenceId('95002'));
}));
test('formerly dateless tables default only new records and preserve first-observed native creation time',async()=>transaction(true,async()=>{
 await service.stockCounts.appendRows('A:I',[['NT_COUNT','2026-11','account','Synthetic','1','note','2026-11-17','','synthetic']]);
 const read=async()=>(await q('SELECT stock_operational.native_timestamp_text("createdAt") value FROM stock_operational.stock_counts WHERE id=$1',['NT_COUNT'])).rows[0].value;
 const before=await read();assert.ok(before);
 await (await service.stockCounts.referenceId('NT_COUNT')).update('F',['changed']);assert.equal(await read(),before);
}));
test('precise compensation creation wins over its millisecond-aligned predecessor without changing effective-date priority',async()=>transaction(true,async()=>{
 await service.employeeCompensations.appendRows('A:L',[
  ['NT_EMP','100','','2026-11-01T01:00:00.123Z','','synthetic','2026-11-01','monthly','','','',''],
  ['NT_EMP','200','','2026-11-01T01:00:00.123001Z','','synthetic','2026-11-01','monthly','','','','']]);
 const selected=(await hr.listEmployees({googleSheetsService:service})).find(e=>e.id==='NT_EMP').compensation.baseSalary;
 if(selected!==200)console.error('Synthetic microsecond compensation witness:',selected);
 assert.equal(selected,200);
}));
test('stock history one microsecond after a saved millisecond count is reported as newer',async()=>transaction(true,async()=>{
 const inventory=require('../../src/modules/inventory/server.ts'),account={id:'NT_MICRO_ACCOUNT',shopName:'Synthetic'};
 await service.stockCounts.appendRows('A:I',[['NT_MICRO_COUNT','2026-11',account.id,account.shopName,'0','','2026-11-01T01:00:00.123Z','','synthetic']]);
 await service.stockAdjustments.appendRows('A:Q',[['NT_MICRO_ADJUST',account.id,account.shopName,'2026-11-01','out','damage','','','1','Synthetic','','','','','2026-11-01T01:00:00.123001Z','synthetic',true]]);
 const rows=await inventory.getMonthlyStockCounts({googleSheetsService:service,accounts:[account],month:'2026-11'});
 const newer=rows[0].warnings.some(w=>w.startsWith('Adjustment history changed'));
 if(!newer)console.error('Synthetic microsecond stock warning witness:',newer);
 assert.ok(newer);
}));
