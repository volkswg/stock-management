/* eslint-disable @typescript-eslint/no-require-imports -- Actual owners on disposable local PostgreSQL only. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Providers forbidden in lexeme compatibility acceptance');};
const test=require('node:test'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const {listOrders}=require('../../src/modules/orders/server.ts');
const {readMovementSession}=require('../../src/modules/line-workflows/application/sessions.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const {Client}=require('pg');
const fs=require('node:fs');
const mode=process.env.STOCK_LX_CASE,typed=mode==='lx_typed';
const service=createPostgresService(),q=(s,a)=>currentTransaction().query(s,a);
const order=id=>[id,'waiting_for_total_price','Synthetic','0012.3400','note','2026-11-18T02:00:00.123456Z','','','synthetic'];
test.after(closePool);
if(mode==='lx_partial'){
 test('partial lexeme schema fails closed without falling back to the old mapper',async()=>{
  await transaction(false,async()=>assert.equal((await q('SELECT stock_operational.column_mapping_contract_v1() mode')).rows[0].mode,'final'));
  await assert.rejects(transaction(false,()=>service.orders.readRows()),e=>e.status===503);
 });
}else if(mode==='lx_incomplete'){
 test('zero columns with retained validators fail before typed mapping is enabled',async()=>{
  const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.pathname,'/lx_incomplete');url.username='postgres';
  const admin=new Client({connectionString:url.toString()});await admin.connect();
  try{await assert.rejects(admin.query('SELECT stock_operational.lexeme_mapping_contract_v1()'),/Incomplete lexeme function retirement/);}finally{await admin.end();}
  await assert.rejects(transaction(false,()=>q('SELECT stock_operational.lexeme_mapping_contract_v1()')),e=>e.status===503&&!e.message.includes('Incomplete lexeme'));
  await assert.rejects(transaction(false,()=>service.orders.readRows()),e=>e.status===503);
 });
}else if(mode==='lx_hot'){
 test('same service and pool cross the synthetic retained-to-typed transition',async()=>{
  const url=new URL(process.env.STOCK_DATABASE_URL);url.username='postgres';const admin=new Client({connectionString:url.toString()});await admin.connect();
  try{
   await transaction(true,()=>service.orders.appendRows('A:I',[order('LX_HOT')]));
   await transaction(false,async()=>assert.equal((await service.orders.readRows()).find(r=>r[0]==='LX_HOT')[3],'0012.3400'));
   await admin.query("SET stock.local_lexeme_fixture='synthetic-only'");
   // psql-only Unix-socket fixture is invoked by the parent acceptance harness.
   // A TCP admin must fail its independent connection guard.
   const fixture=fs.readFileSync(process.env.STOCK_LX_FIXTURE,'utf8');
   await assert.rejects(admin.query(fixture));await admin.query('ROLLBACK');
   const {execFileSync}=require('node:child_process');
   execFileSync('docker',['exec','-i',process.env.STOCK_LX_CONTAINER,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','lx_hot'],{input:"SET stock.local_lexeme_fixture='synthetic-only';\n"+fixture});
   await transaction(false,async()=>{assert.equal((await q('SELECT stock_operational.lexeme_mapping_contract_v1() mode')).rows[0].mode,'typed');assert.equal((await service.orders.readRows()).find(r=>r[0]==='LX_HOT')[3],'12.3400');});
   await transaction(true,async()=>await(await service.orders.referenceId('LX_HOT')).update('E',['after']));
   await transaction(false,async()=>{const row=(await listOrders({googleSheetsService:service})).find(r=>r.id==='LX_HOT');assert.equal(row.totalPrice,12.34);assert.equal(row.remark,'after');});
  }finally{await admin.end();}
 });
}else{
 test('explicit capability,48retained-or0candidate columns,47timestamps and RLS',async()=>transaction(false,async()=>{
  assert.equal((await q('SELECT stock_operational.lexeme_mapping_contract_v1() mode')).rows[0].mode,typed?'typed':'retained');
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND right(column_name,8)='__lexeme'")).rows[0].n),typed?0:48);
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name IN ('createdAt','updatedAt','deletedAt') AND data_type='timestamp with time zone'")).rows[0].n),47);
  assert.equal((await q("SELECT bool_and(relrowsecurity) enabled FROM pg_class WHERE relnamespace='stock_operational'::regnamespace AND relkind='r'")).rows[0].enabled,true);
 }));
 test('create,partial edits,archive and stale-reference protection preserve public order behavior',async()=>{
  await transaction(true,()=>service.orders.appendRows('A:I',[order('LX_ORDER')]));
  await transaction(true,async()=>{
   const row=(await service.orders.readRows()).find(r=>r[0]==='LX_ORDER');assert.equal(row[3],typed?'12.3400':'0012.3400');
   const first=service.orders.referenceRow(row),stale=await service.orders.referenceId('LX_ORDER');await first.update('E',['edited']);
   await assert.rejects(stale.update('E',['stale']));
  });
  await transaction(false,async()=>{const v=(await listOrders({googleSheetsService:service})).find(r=>r.id==='LX_ORDER');assert.equal(v.totalPrice,12.34);assert.equal(v.remark,'edited');assert.equal(v.createdAt,'2026-11-18T02:00:00.123456Z');});
 });
 test('large decimal/integer values stay exact and missing values remain blank',async()=>transaction(true,async()=>{
  const row=order('LX_PRECISION');row[3]='9007199254740993.0100';await service.orders.appendRows('A:I',[row]);
  assert.equal((await service.orders.readRows()).find(r=>r[0]==='LX_PRECISION')[3],row[3]);
  await service.salesReceiptSyncs.appendRows('A:I',[['LX_SYNC','2026-11-18','account','Synthetic','synced','9007199254740993','0','1','2026-11-18']]);
  const sync=(await service.salesReceiptSyncs.readRows()).find(r=>r[0]==='LX_SYNC');assert.equal(sync[5],'9007199254740993');
  const empty=order('LX_BLANK');empty[3]='';await service.orders.appendRows('A:I',[empty]);assert.equal((await service.orders.readRows()).find(r=>r[0]==='LX_BLANK')[3],'');
 }));
 test('JSON stays text at the LINE boundary and a real movement session remains readable',async()=>transaction(true,async()=>{
  const state={masterId:'LX_MASTER',itemId:'LX_ITEM',userId:'LX_LINE',startedAt:'2026-11-18T02:00:00Z',shop:'Synthetic',quantity:'1',remark:'note',imageUrl:'',lastEventId:'',step:'product_image'};
  const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));
  const text=' '+JSON.stringify(state)+' ';
  await service.userState.appendRows('A:H',[['99101','LX_LINE','MovementCreate','LX_MASTER',state.step,state.startedAt,'',text]]);
  const row=(await service.userState.readRows()).find(r=>r[0]==='99101');assert.equal(typeof row[7],'string');assert.deepEqual(JSON.parse(row[7]),state);
  if(!typed)assert.equal(row[7],text);
  const movement=await readMovementSession(sessions.movements,'LX_LINE','new-event');assert.deepEqual(movement.state,state);
 }));
 test('JSON null remains distinct from blank in typed candidate input',async()=>transaction(true,async()=>{
  await service.userState.appendRows('A:H',[['99102','LX_NULL','OrderCreate','LX_ORDER','complete','2026-11-18','','null'],['99103','LX_EMPTY','OrderCreate','LX_ORDER','complete','2026-11-18','','']]);
  const rows=await service.userState.readRows();assert.equal(rows.find(r=>r[0]==='99102')[7],'null');assert.equal(rows.find(r=>r[0]==='99103')[7],'');
 }));
 test('boolean aliases are retained unchanged before removal and never silently become true in the candidate',async()=>{
  await transaction(true,()=>service.movementMasters.appendRows('A:H',[['LX_MASTER','synthetic','2026-11-18','','created','1','2026-11-18','']]));
  const item=(id,flag)=>[id,'LX_MASTER','Synthetic','1','','','','','','created','2026-11-18','',flag,flag];
  await transaction(true,()=>service.movementDetails.appendRows('A:N',[item('LX_BOOL',true),item('LX_FALSE',false)]));
  if(typed)for(const v of [1,'1','t','yes',' true '])await assert.rejects(transaction(true,()=>service.movementDetails.appendRows('A:N',[item('LX_AMBIGUOUS',v)])));
  else await transaction(true,async()=>{await service.movementDetails.appendRows('A:N',[item('LX_ALIAS',1)]);assert.equal((await service.movementDetails.readRows()).find(r=>r[0]==='LX_ALIAS')[12],'1');});
  await transaction(false,async()=>{const rows=await service.movementDetails.readRows();assert.equal(rows.find(r=>r[0]==='LX_BOOL')[12],true);assert.equal(rows.find(r=>r[0]==='LX_FALSE')[12],false);});
 });
 test('direct typed edits remain visible; invalid values and identity changes fail atomically',async()=>{
  await transaction(true,()=>q('UPDATE stock_operational.orders SET remark=$1,"totalPrice"=22.50 WHERE id=$2',['direct','LX_ORDER']));
  await transaction(false,async()=>{const row=(await listOrders({googleSheetsService:service})).find(r=>r.id==='LX_ORDER');assert.equal(row.totalPrice,22.5);assert.equal(row.remark,'direct');});
  await assert.rejects(transaction(true,()=>service.orders.appendRows('A:I',[order('LX_INVALID').map((v,i)=>i===3?'bad':v)])));
  await assert.rejects(transaction(true,async()=>await(await service.orders.referenceId('LX_ORDER')).update('A',['changed'])));
  await transaction(true,async()=>await(await service.orders.referenceId('LX_ORDER')).archive());
  await transaction(false,async()=>{assert.equal(await service.orders.referenceId('LX_ORDER'),undefined);assert.equal(await service.orders.referenceId('LX_INVALID'),undefined);});
 });
}
