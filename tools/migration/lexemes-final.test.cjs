/* eslint-disable @typescript-eslint/no-require-imports -- Actual released app and operator DDL on a fresh local database. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Providers forbidden in final lexeme acceptance');};
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Client}=require('pg');
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/lf_hot');url.username='postgres';
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
const {compareLineSelections}=require('./lexeme-line-proof.cjs');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const service=createPostgresService();
test.after(closePool);
test('released same service/pool crosses actual retirement with exact decimal storage,IDs,public orders and LINE outcomes',async()=>{
 const admin=new Client({connectionString:url.toString()});await admin.connect();
 const state={masterId:'LF_HOT_MASTER',itemId:'LF_HOT_ITEM',userId:'LF_HOT_USER',startedAt:'2026-11-18T00:00:00.123456Z',shop:'Synthetic',quantity:'1',remark:'',imageUrl:'',lastEventId:'LF_DONE',step:'product_image'};
 const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));
 const selection=()=>transaction(false,async()=>{const s=await sessions.movements.read();return JSON.parse(JSON.stringify([{user:state.userId,read:s.latestForReading(state.userId),write:s.findForWriting(()=>state.userId)}]));});
 const row=['LF_HOT_ORDER','waiting_for_total_price','Synthetic','9007199254740993.0100','before',state.startedAt,'','','synthetic'];
 try{
  await transaction(true,async()=>{
   await service.orders.appendRows('A:I',[row]);
   await service.userState.appendRows('A:H',[['99001',state.userId,'MovementCreate',state.masterId,state.step,state.startedAt,'',' '+JSON.stringify(state)+' ']]);
   const receipt=Array(26).fill('');receipt[0]='LF_HOT_RECEIPT';receipt[1]='2026-11-18';receipt[2]='synthetic';receipt[5]='SALE';receipt[25]=state.startedAt;
   await service.salesReceipts.appendRows('A:Z',[receipt]);
   await service.salesReceiptPayments.appendRows('A:J',[['LF_HOT_PAYMENT','LF_HOT_RECEIPT','0','','','','12.3400','','null',state.startedAt]]);
  });
  const before=await transaction(false,()=>orders.listOrders({googleSheetsService:service})),lineBefore=await selection();
  const target=(await admin.query('SELECT isolation_id::text,purpose,(SELECT value::text FROM stock_operational.revision WHERE singleton) revision FROM stock_operational.environment')).rows[0];
  assert.equal(target.purpose,'isolated-staging');assert.equal(target.isolation_id,process.env.STOCK_TARGET_ISOLATION_ID);
  for(const [k,v] of Object.entries({'stock.expected_isolation_id':target.isolation_id,'stock.expected_purpose':'isolated-staging','stock.allow_final_lexeme_removal':'reviewed-typed-retirement-v1','stock.lexeme_reviewed_revision':target.revision,'stock.lexeme_reviewed_source':'1'.repeat(40),'stock.lexeme_reviewed_fingerprint':'0'.repeat(64),'stock.lexeme_restore_verified':'51-tables-15-metadata-v1','stock.lexeme_semantics_verified':'exact-app-line-consumers-v1'}))await admin.query('SELECT set_config($1,$2,false)',[k,v]);
  await admin.query(fs.readFileSync('tools/migration/final-removal/20261118040625_remove_lexemes.sql','utf8'));
  await transaction(false,async()=>{
   assert.equal((await currentTransaction().query('SELECT stock_operational.lexeme_mapping_contract_v1() mode')).rows[0].mode,'typed');
   assert.deepEqual(await orders.listOrders({googleSheetsService:service}),before);
   assert.equal((await service.orders.readRows()).find(r=>r[0]===row[0])[3],row[3]);
   assert.equal((await service.salesReceiptPayments.readRows()).find(r=>r[0]==='LF_HOT_PAYMENT')[8],'null');
  });
  assert.equal((await compareLineSelections(lineBefore,await selection())).match,true);
  await transaction(true,async()=>await(await service.orders.referenceId(row[0])).update('E',['after']));
  await transaction(false,async()=>assert.equal((await orders.listOrders({googleSheetsService:service})).find(r=>r.id===row[0]).remark,'after'));
 }finally{await admin.end();}
});
