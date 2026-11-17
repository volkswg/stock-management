/* eslint-disable @typescript-eslint/no-require-imports -- Real current owners and new synthetic local databases only. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Providers forbidden in final retirement acceptance');};
const test=require('node:test'),assert=require('node:assert/strict');
const {Client}=require('pg'),originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.catch?result.catch(error=>{console.error('Synthetic final acceptance SQL diagnostic:',error.code,error.message);throw error;}):result;};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const {transaction,currentTransaction,requireMutation,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const inventory=require('../../src/modules/inventory/server.ts'),hr=require('../../src/modules/hr/server.ts'),shipments=require('../../src/modules/shipments/server.ts'),expenses=require('../../src/modules/expenses/server.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const catalog=require('./worksheets.json'),service=createPostgresService(),q=(s,a)=>currentTransaction().query(s,a),write=(s,a)=>requireMutation().query(s,a);
const now='2026-11-17T02:00:00.123Z';
test.after(closePool);
function legacySheet(headers,rows){
 const all=[headers,...rows];
 const read=async(range='A:ZZ')=>{const m=/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);assert.ok(m);const col=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;return all.slice(Number(m[2]||1)-1,m[4]?Number(m[4]):m[3]?all.length:m[2]?Number(m[2]):all.length).map(r=>r.slice(col(m[1]),col(m[3]||m[1])+1));};
 return {readRows:read,readSelectionRows:read,readReversedCreationRows:read,ensureExists:async()=>{}};
}
test('physical retirement leaves no encoding columns or procedural decoders, with existing controls intact',async()=>transaction(false,async()=>{
 assert.equal((await q('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,'final');
 assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='cell_kinds'")).rows[0].n),0);
 assert.equal((await q("SELECT to_regprocedure('stock_operational.cell_projection(jsonb,text,text,text)') absent")).rows[0].absent,null);
 assert.equal(Number((await q("SELECT count(*) n FROM pg_proc WHERE pronamespace='stock_operational'::regnamespace AND proname<>'column_mapping_contract_v1' AND prosrc LIKE '%cell_kinds%'")).rows[0].n),0);
 assert.equal((await q("SELECT bool_and(relrowsecurity) enabled FROM pg_class WHERE relnamespace='stock_operational'::regnamespace AND relkind='r'")).rows[0].enabled,true);
}));
test('historical missing movement flags preserve inventory DTOs rather than becoming true',async()=>transaction(true,async()=>{
 const master=['CF_MASTER','synthetic','2026-11-17','','created','1',now,''];await service.movementMasters.appendRows('A:H',[master]);
 const short=['CF_SHORT','CF_MASTER','Synthetic','1','','Home','Synthetic','','','created',now,''];
 await service.movementDetails.appendRows('A:N',[short]);
 const legacy={...service,movementDetails:legacySheet(catalog.movement_details.headers,[short])};
 const input={movementMasterId:'CF_MASTER'};
 assert.deepEqual(await inventory.getMovementItems({...input,googleSheetsService:service}),await inventory.getMovementItems({...input,googleSheetsService:legacy}));
 const item=(await inventory.getMovementItems({...input,googleSheetsService:service}))[0];assert.equal(item.stockCounted,false);assert.equal(item.isNewArrival,false);
}));
test('numeric1 and true retain different flag meanings using only existing value spelling',async()=>transaction(true,async()=>{
 const item=(id,flag)=>[id,'CF_MASTER','Synthetic','1','','','','','','created',now,'',flag,flag];
 await service.movementDetails.appendRows('A:N',[item('CF_TRUE',true),item('CF_ONE',1)]);
 const rows=await inventory.getMovementItems({googleSheetsService:service,movementMasterId:'CF_MASTER'});
 assert.equal(rows.find(r=>r.movementId==='CF_TRUE').stockCounted,true);assert.equal(rows.find(r=>r.movementId==='CF_ONE').stockCounted,false);
 const stored=(await q('SELECT "stockCounted","stockCounted__lexeme" FROM stock_operational.movement_details WHERE id=$1',['CF_ONE'])).rows[0];
 assert.equal(stored.stockCounted,true);assert.equal(stored.stockCounted__lexeme,'1');
 await (await service.movementDetails.referenceId('CF_ONE')).update('E',['ordinary edit']);
 assert.equal((await inventory.getMovementItems({googleSheetsService:service,movementMasterId:'CF_MASTER'})).find(r=>r.movementId==='CF_ONE').stockCounted,false);
 await write('UPDATE stock_operational.movement_details SET "stockCounted"=false WHERE id=$1',['CF_ONE']);
 await write('UPDATE stock_operational.movement_details SET "stockCounted"=true WHERE id=$1',['CF_ONE']);
 assert.equal((await inventory.getMovementItems({googleSheetsService:service,movementMasterId:'CF_MASTER'})).find(r=>r.movementId==='CF_ONE').stockCounted,true);
}));
test('short compensation and attendance rows preserve explicit business defaults',async()=>transaction(true,async()=>{
 await service.employees.appendRows('A:I',[['CF_EMP','Synthetic','','active','','',now,'','synthetic']]);
 const compensation=['CF_EMP',100,2,now,'','synthetic','2026-11-01','monthly'];
 const shift=['CF_SHIFT','CF_EMP','shop','work',now,now];
 await service.employeeCompensations.appendRows('A:L',[compensation]);await service.employeeTimesheets.appendRows('A:G',[shift]);
 const legacy={...service,employeeCompensations:legacySheet(catalog.employee_compensations.headers,[compensation]),employeeTimesheets:legacySheet(catalog.employee_timesheets.headers,[shift])};
 assert.deepEqual(await hr.listEmployeeCompensations({googleSheetsService:service}),await hr.listEmployeeCompensations({googleSheetsService:legacy}));
 assert.deepEqual(await hr.listEmployeeTimesheets({googleSheetsService:service,date:'2026-11-17'}),await hr.listEmployeeTimesheets({googleSheetsService:legacy,date:'2026-11-17'}));
}));
test('short shipment bill and expense deletion fields preserve current public fields and visibility',async()=>transaction(true,async()=>{
 const row=['CF_SHIP','draft','Synthetic','PO-CF',0,'','','',now,'','','synthetic'];await service.shipments.appendRows('A:M',[row]);
 const legacy={...service,shipments:legacySheet(catalog.shipments.headers,[row])};
 const a=await shipments.listShipments({googleSheetsService:service,includeOrders:false}),b=await shipments.listShipments({googleSheetsService:legacy,includeOrders:false});assert.ok(a.length);assert.deepEqual(a,b);
 await service.expenseCategories.appendRows('A:E',[['CF_CATEGORY','Synthetic',true,now,'']]);
 const expense=['CF_EXP','2026-11','2026-11-17','','SHARED','CF_CATEGORY','Synthetic',12.34,'note',now,'','synthetic'];await service.expenses.appendRows('A:M',[expense]);
 assert.deepEqual(await expenses.listExpenses({googleSheetsService:service,year:'2026'}),await expenses.listExpenses({googleSheetsService:{...service,expenses:legacySheet(catalog.expenses.headers,[expense])},year:'2026'}));
}));
test('seven-field order LINE state keeps lookup, opaque IDs, update and clear behavior',async()=>transaction(true,async()=>{
 const row=['99001','CF_USER','OrderCreate','CF_ORDER','waiting_for_bill_image',now,''];await service.userState.appendRows('A:H',[row]);
 const a=createSessionAdapter(service,createMovementJourneyAdapter(service));
 const legacy={...service,userState:legacySheet(catalog.user_state.headers,[row])},b=createSessionAdapter(legacy,createMovementJourneyAdapter(legacy));
 assert.deepEqual(await a.orders.findLatest('CF_USER','OrderCreate'),await b.orders.findLatest('CF_USER','OrderCreate'));
 await a.orders.reference('99001').update('waiting_for_total_price',now,now);assert.equal((await a.orders.findLatest('CF_USER','OrderCreate')).state,'waiting_for_total_price');
 await a.orders.reference('99001').clear();assert.equal(await a.orders.findLatest('CF_USER','OrderCreate'),undefined);
}));
test('numeric LINE identifiers cannot become newly visible text sessions; no partial record remains',async()=>{
 await assert.rejects(transaction(true,()=>service.userState.appendRows('A:H',[['CF_INVALID',42,'OrderCreate','CF_ORDER','waiting_for_bill_image',now,'','']])));
 await transaction(false,async()=>assert.equal(await service.userState.referenceId('CF_INVALID'),undefined));
});
test('precise numeric and JSON spellings, stable identity, archive and stale revision guards survive',async()=>transaction(true,async()=>{
 await service.orders.appendRows('A:I',[['CF_ORDER','waiting_for_total_price','Synthetic','9007199254740993.0100','before',now,'','','synthetic']]);
 const stale=await service.orders.referenceId('CF_ORDER');await (await service.orders.referenceId('CF_ORDER')).update('E',['after']);
 assert.equal((await service.orders.readRows()).find(r=>r[0]==='CF_ORDER')[3],'9007199254740993.0100');
 await assert.rejects(stale.update('E',['stale']),e=>e.status===409);
 await assert.rejects((await service.orders.referenceId('CF_ORDER')).update('A',['renamed']),e=>e.status===409);
 const context=' { "amount":9007199254740993.01, "step":"synthetic" } ';
 await service.userState.appendRows('A:H',[['99002','CF_USER','OrderCreate','CF_ORDER','waiting_for_bill_image',now,'',context]]);
 assert.equal((await service.userState.readRows()).find(r=>r[0]==='99002')[7],context);
 await (await service.orders.referenceId('CF_ORDER')).archive();assert.equal(await service.orders.referenceId('CF_ORDER'),undefined);
}));
