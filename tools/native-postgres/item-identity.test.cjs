/* eslint-disable @typescript-eslint/no-require-imports -- Real current owners against a fresh synthetic PostgreSQL clone; fake providers only. */
const sessionPrimitives=require('../../tests/helpers/native-line-primitives.cjs');
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const orders=require('../../src/modules/orders/server.ts'),inventory=require('../../src/modules/inventory/server.ts'),line=require('../../src/modules/line-workflows/server.ts');
global.fetch=()=>{throw Error('Real providers forbidden in item identity acceptance');};
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
const name=fs.readdirSync('tools/migration/operator').filter(n=>/^\d+_order_item_identity.sql$/.test(n));assert.equal(name.length,1);
const forward=fs.readFileSync('tools/migration/operator/'+name[0],'utf8'),inverse=fs.readFileSync('tools/migration/operator/rollback_order_item_identity.sql','utf8');
const fkName='"movement_details_purchaseDetailId_fkey"';
const scalar=async(sql,params)=>(await owner.query(sql,params)).rows[0].value;
const command=run=>executeCommand('item-identity',randomUUID(),hashIntent(randomUUID()),run);
const read=run=>db.transaction(false,run);
async function fingerprint(){
 const tables=(await owner.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') ORDER BY 1,2")).rows,result=[];
 for(const {schemaname,tablename} of tables){
  const expression=schemaname==='stock_operational'&&tablename==='order_items'?"to_jsonb(t)||jsonb_build_object('id',t.id::text)":schemaname==='stock_operational'&&tablename==='movement_details'?"to_jsonb(t)||jsonb_build_object('purchaseDetailId',t.\"purchaseDetailId\"::text)":'to_jsonb(t)';
  result.push([schemaname,tablename,(await owner.query(`SELECT ${expression} value FROM "${schemaname}"."${tablename}" t ORDER BY (${expression})::text COLLATE "C"`)).rows]);
 }
 return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}
async function gates(prefix='item',review='order-item'){
 const values={['allow_'+prefix+'_identity_conversion']:'reviewed-'+review+'-bigint-v1',['allow_'+prefix+'_identity_inverse']:'reviewed-'+review+'-bigint-v1',[prefix+'_identity_restore_verified']:'business-and-config-v1',[prefix+'_identity_source']:'1'.repeat(40),[prefix+'_identity_fingerprint']:await fingerprint(),[prefix+'_identity_revision']:await scalar('SELECT value::text value FROM stock_operational.revision'),expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging'};
 for(const [key,value] of Object.entries(values))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
}
async function refused(sql){try{await assert.rejects(owner.query(sql));}finally{await owner.query('ROLLBACK');}}
const typeOf=async(table,column)=>scalar("SELECT format_type(atttypid,atttypmod) value FROM pg_attribute WHERE attrelid=$1::regclass AND attname=$2 AND NOT attisdropped",['stock_operational.'+table,column]);
async function sequences(){return (await owner.query("SELECT 'bills' name,last_value::text value,is_called FROM stock_operational.order_bills_id_seq UNION ALL SELECT 'sessions',last_value::text,is_called FROM stock_operational.user_state_id_seq ORDER BY name")).rows;}
async function httpViews(){
 const routes=[['/api/orders/ITEM_PARENT',require('../../src/app/api/orders/[id]/route.ts').GET,{params:Promise.resolve({id:'ITEM_PARENT'})}],['/api/movements',require('../../src/app/api/movements/route.ts').GET]];
 const rows=[];for(const [path,handler,context] of routes){const response=await handler(new Request('https://example.test'+path,{headers:{Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN}}),context);assert.equal(response.status,200,path);rows.push({path,body:await response.json(),edit:response.headers.get('x-stock-edit-revision'),scope:response.headers.get('x-stock-edit-scope'),revision:response.headers.get('x-stock-revision')});}
 const response=await withPersistence(async()=>Response.json({ok:true}))(new Request('https://example.test/api/orders',{headers:{Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN}}));assert.equal(response.status,200);rows.push({path:'/api/orders',edit:response.headers.get('x-stock-edit-revision'),revision:response.headers.get('x-stock-revision')});return rows;
}
let loseCommit=false;
const originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return value;}):result;};
test.before(async()=>{
 await owner.connect();await owner.query("DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN CREATE ROLE stock_prod_backup NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_reader') THEN CREATE ROLE stock_prod_reader NOLOGIN; END IF; END$$;");
 await owner.query('GRANT USAGE ON SCHEMA stock_operational,stock_migration TO stock_prod_backup; GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational,stock_migration TO stock_prod_backup;');
 await owner.query(fs.readFileSync('supabase/migrations/20261119082351_private_loyverse_accounts.sql','utf8'));
 await owner.query('UPDATE stock_operational.movement_details SET "purchaseDetailId"=NULL WHERE "purchaseDetailId" IS NOT NULL; DELETE FROM stock_operational.order_items; DELETE FROM stock_operational.order_bills; DELETE FROM stock_operational.user_state;');
 await owner.query("INSERT INTO stock_operational.orders(id,status) VALUES('ITEM_PARENT','draft') ON CONFLICT DO NOTHING; INSERT INTO stock_operational.order_items(id,\"orderId\",\"createdAt\",\"deletedAt\") VALUES('2','ITEM_PARENT','2026-11-20T00:00:00Z',NULL),('10','ITEM_PARENT','2026-11-20T00:00:00Z',NULL),('99','ITEM_PARENT','2026-11-20T00:00:00Z','2026-11-20T00:00:00Z'); INSERT INTO stock_operational.movements(id) VALUES('ITEM_MOVE'); INSERT INTO stock_operational.movement_details(id,\"movementMasterId\",\"purchaseDetailId\") VALUES('ITEM_DETAIL','ITEM_MOVE','2'),('ITEM_BLANK','ITEM_MOVE',NULL);");
 await gates('bill','order-bill');await owner.query(fs.readFileSync('tools/migration/operator/20261120022134_order_bill_identity.sql','utf8'));
 await gates('user_state','user-state');await owner.query(fs.readFileSync('tools/migration/operator/20261120065046_user_state_identity.sql','utf8'));
});
test.after(async()=>{await db.closePool();await owner.end();});
test('coupled item identity preserves references, existing identities, app/LINE behavior and exact inverse',async t=>{
 const fk=await scalar("SELECT pg_get_constraintdef(oid) value FROM pg_constraint WHERE conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey'");
 await t.test('compatible text-layout item creation and nullable movement links retain string APIs',async()=>{
  await command(async()=>{const item=await orders.createOrderItem({storage,orderId:'ITEM_PARENT',imageUrl:'https://example.invalid/item',createdBy:'text'});assert.equal(item.id,'100');await inventory.appendMovementJourneyItem(storage,()=>({id:'ITEM_TEXT_DETAIL',masterId:'ITEM_MOVE',purchaseDetailId:item.id,shop:'NJ',quantity:'3',remark:'unchanged',fromLocation:'Home',toLocation:'NJ',imageUrl:'',status:'created',createdAt:'2026-11-20T00:00:00Z',updatedAt:'',stockCounted:false,isNewArrival:false}));});
  await read(async()=>{assert.equal((await storage.movementDetails.find('ITEM_TEXT_DETAIL')).purchaseDetailId,'100');assert.equal((await storage.movementDetails.find('ITEM_BLANK')).purchaseDetailId,'');});
 });
 await owner.query("INSERT INTO stock_operational.order_items(id,\"orderId\",\"deletedAt\") VALUES('9999','ITEM_PARENT','2026-11-20T00:00:00Z'); INSERT INTO stock_operational.movement_details(id,\"movementMasterId\",\"purchaseDetailId\") VALUES('ITEM_ARCHIVED_REF','ITEM_MOVE','9999');");
 await t.test('unapproved, stale, unknown relationships, aliases, overflow and late failures refuse atomically',async()=>{
  await refused(forward);await gates();await owner.query("SET stock.item_identity_revision='-1'");await refused(forward);await gates();await owner.query("SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'");await refused(forward);await gates();
  for(const id of ['01','-1','not-numeric','9223372036854775807','9223372036854775808']){await owner.query('INSERT INTO stock_operational.order_items(id,"orderId") VALUES($1,$2)',[id,'ITEM_PARENT']);await gates();await refused(forward);await owner.query('DELETE FROM stock_operational.order_items WHERE id=$1',[id]);}
  await owner.query('CREATE TABLE public.item_reference(id text REFERENCES stock_operational.order_items(id))');await gates();await refused(forward);await owner.query('DROP TABLE public.item_reference');
  await owner.query('ALTER TABLE stock_operational.movement_details DROP CONSTRAINT '+fkName);await owner.query('ALTER TABLE stock_operational.movement_details ADD CONSTRAINT '+fkName+' FOREIGN KEY("purchaseDetailId") REFERENCES stock_operational.order_items(id) ON DELETE CASCADE');await gates();await refused(forward);await owner.query('ALTER TABLE stock_operational.movement_details DROP CONSTRAINT '+fkName);await owner.query('ALTER TABLE stock_operational.movement_details ADD CONSTRAINT '+fkName+' '+fk);
  await owner.query('CREATE VIEW public.item_reference AS SELECT "purchaseDetailId" FROM stock_operational.movement_details');await gates();await refused(forward);await owner.query('DROP VIEW public.item_reference');
  await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational GRANT USAGE ON SEQUENCES TO lexeme_reader');await gates();await refused(forward);await owner.query('ALTER DEFAULT PRIVILEGES IN SCHEMA stock_operational REVOKE USAGE ON SEQUENCES FROM lexeme_reader');
  const before=await fingerprint();await gates();await refused(forward.replace('COMMIT;','SELECT 1/0; COMMIT;'));assert.equal(await fingerprint(),before);assert.equal(await typeOf('order_items','id'),'text');assert.equal(await typeOf('movement_details','purchaseDetailId'),'text');assert.equal(await scalar("SELECT to_regclass('stock_operational.order_items_id_seq')::text value"),null);
 });
 const before=await fingerprint(),beforeSequences=await sequences(),beforeViews=await httpViews();await gates();await owner.query(forward);
 await t.test('one atomic conversion preserves all records, FK behavior, API JSON, ordering and edit tokens',async()=>{
  assert.equal(await fingerprint(),before);assert.equal(await typeOf('order_items','id'),'bigint');assert.equal(await typeOf('movement_details','purchaseDetailId'),'bigint');assert.deepEqual(await sequences(),beforeSequences);assert.deepEqual(await httpViews(),beforeViews);assert.equal(await scalar("SELECT pg_get_constraintdef(oid) value FROM pg_constraint WHERE conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey'"),fk);
 });
 await t.test('the exact inverse restores both text columns and the original FK without changing other identities',async()=>{
  await gates();await owner.query(inverse);assert.equal(await fingerprint(),before);assert.deepEqual(await httpViews(),beforeViews);assert.deepEqual(await sequences(),beforeSequences);assert.equal(await typeOf('order_items','id'),'text');assert.equal(await typeOf('movement_details','purchaseDetailId'),'text');await gates();await owner.query(forward);assert.deepEqual(await httpViews(),beforeViews);
 });
 await t.test('new sequence seeds above deleted IDs; runtime USAGE and backup SELECT are narrowly scoped',async()=>{
  assert.equal(await scalar('SELECT last_value::text value FROM stock_operational.order_items_id_seq'),await scalar('SELECT greatest(max(id),1)::text value FROM stock_operational.order_items'));assert.ok(BigInt(await scalar('SELECT last_value::text value FROM stock_operational.order_items_id_seq'))>BigInt(await scalar('SELECT max(id)::text value FROM stock_operational.order_items WHERE \"deletedAt\" IS NULL')));
  for(const [role,privilege,expected] of [['stock_runtime','USAGE',true],['stock_runtime','SELECT',false],['stock_runtime','UPDATE',false],['stock_prod_backup','SELECT',true],['stock_prod_backup','USAGE',false],['stock_prod_reader','USAGE',false],['anon','USAGE',false],['authenticated','USAGE',false]])assert.equal(await scalar('SELECT has_sequence_privilege($1,$2,$3) value',[role,'stock_operational.order_items_id_seq',privilege]),expected);
 });
 await t.test('lost-COMMIT retry reuses the created item and movement link without reserving again',async()=>{
  const key=randomUUID();let executions=0;const run=()=>executeCommand('ITEM_RETRY',key,hashIntent({order:'ITEM_PARENT'}),async()=>{executions++;const item=await orders.createOrderItem({storage,orderId:'ITEM_PARENT',imageUrl:'https://example.invalid/retry',createdBy:'retry'});await storage.movementDetails.insert({id:'ITEM_RETRY_DETAIL',movementMasterId:'ITEM_MOVE',purchaseDetailId:item.id});return item;});
  loseCommit=true;await assert.rejects(run());const sequence=await scalar('SELECT last_value::text value FROM stock_operational.order_items_id_seq'),first=await run();assert.deepEqual(await run(),first);assert.equal(executions,1);assert.equal(await scalar('SELECT last_value::text value FROM stock_operational.order_items_id_seq'),sequence);await read(async()=>assert.equal((await storage.movementDetails.find('ITEM_RETRY_DETAIL')).purchaseDetailId,first.id));await assert.rejects(executeCommand('ITEM_RETRY',key,hashIntent({order:'changed'}),async()=>{}),e=>e.status===409);
 });
 await t.test('reference updates, blank/NULL clearing, stale handles and invalid aliases retain safety',async()=>{
  await command(async()=>{const row=await storage.movementDetails.find('ITEM_DETAIL'),stale=await storage.movementDetails.find('ITEM_DETAIL');await storage.movementDetails.update(row,{purchaseDetailId:'10'});await assert.rejects(storage.movementDetails.update(stale,{remark:'lost'}),e=>e.status===409);for(const bad of ['01','+2','-2','2.0','9223372036854775808',9007199254740992])await assert.rejects(storage.movementDetails.update(row,{purchaseDetailId:bad}),e=>e.status===409);await storage.movementDetails.update(row,{purchaseDetailId:''});assert.equal((await storage.movementDetails.find('ITEM_DETAIL')).purchaseDetailId,'');await storage.movementDetails.update(row,{purchaseDetailId:null});});
  await assert.rejects(command(()=>storage.movementDetails.insert({id:'ITEM_ORPHAN',movementMasterId:'ITEM_MOVE',purchaseDetailId:'1234567'})));
  await assert.rejects(owner.query("DELETE FROM stock_operational.order_items WHERE id=(SELECT \"purchaseDetailId\" FROM stock_operational.movement_details WHERE id='ITEM_TEXT_DETAIL')"));
 });
 await t.test('the original deferred FK still permits a reference before its parent inside one transaction',async()=>{
  await owner.query("BEGIN; INSERT INTO stock_operational.movement_details(id,\"movementMasterId\",\"purchaseDetailId\") VALUES('ITEM_DEFERRED','ITEM_MOVE',500); INSERT INTO stock_operational.order_items(id,\"orderId\") VALUES(500,'ITEM_PARENT'); COMMIT;");
  await read(async()=>assert.equal((await storage.movementDetails.find('ITEM_DEFERRED')).purchaseDetailId,'500'));
 });
 await t.test('parallel default inserts remain unique and item/reference APIs preserve IDs beyond 2^53',async()=>{
  const clients=Array.from({length:6},()=>new Client({connectionString:url.toString()}));await Promise.all(clients.map(c=>c.connect()));try{const ids=await Promise.all(clients.map(async c=>(await c.query('INSERT INTO stock_operational.order_items("orderId") VALUES($1) RETURNING id::text',['ITEM_PARENT'])).rows[0].id));assert.equal(new Set(ids).size,6);}finally{await Promise.all(clients.map(c=>c.end()));}
  await owner.query("SELECT setval('stock_operational.order_items_id_seq',9007199254740993,true)");await command(async()=>{const item=await orders.createOrderItem({storage,orderId:'ITEM_PARENT',imageUrl:'https://example.invalid/precise',createdBy:'precision'});assert.equal(item.id,'9007199254740994');await storage.movementDetails.insert({id:'ITEM_PRECISE',movementMasterId:'ITEM_MOVE',purchaseDetailId:item.id});assert.equal((await storage.movementDetails.find('ITEM_PRECISE')).purchaseDetailId,item.id);});
 });
 await t.test('actual LINE product-image creation and redelivery use one precision-safe item identity',async()=>{
  let uploads=0;const bot={sendReply:async()=>{},downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic product')})};const drive={async uploadImage(){uploads++;const id='ITEM_LINE_FILE_'+uploads;return {id,name:id+'.jpg',webViewLink:'https://drive.google.com/file/d/'+id+'/view'};},async deleteFile(){assert.fail('Committed item image deleted');}};
  const args={lineBotService:bot,getStorage:()=>storage,getGoogleDriveService:()=>drive,getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.invalid'};
  const event={type:'message',webhookEventId:'ITEM_LINE_CREATE',replyToken:'synthetic',timestamp:Date.parse('2026-11-20T00:00:00Z'),source:{type:'user',userId:'ITEM_LINE_USER'},message:{id:'ITEM_LINE_COMMAND',type:'text',text:'create:order'}};
  await line.processLineWebhook({...args,events:[event]});await command(async()=>{const session=await sessionPrimitives.findLatestUserState({storage,userId:'ITEM_LINE_USER',flowname:'OrderCreate'});await sessionPrimitives.completeOrderBill({storage,orderId:session.referenceId,userStateId:session.id,userStateCreatedAt:session.createdAt});});
  const image={...event,webhookEventId:'ITEM_LINE_PRODUCT',message:{id:'ITEM_LINE_PRODUCT_BYTES',type:'image'}};await line.processLineWebhook({...args,events:[image]});await line.processLineWebhook({...args,events:[{...image,replyToken:'redelivery',deliveryContext:{isRedelivery:true}}]});assert.equal(uploads,1);
  const row=(await owner.query("SELECT id::text id FROM stock_operational.order_items WHERE \"createdBy\"='ITEM_LINE_USER'")).rows;assert.equal(row.length,1);assert.ok(BigInt(row[0].id)>9007199254740993n);
 });
 await t.test('rollback leaves a reservation gap and later writes invalidate the original inverse approval',async()=>{let id;await assert.rejects(command(async()=>{id=await storage.orderItems.reserveIdentifier();throw Error('synthetic abort');}));const next=await command(()=>storage.orderItems.reserveIdentifier());assert.equal(BigInt(next),BigInt(id)+1n);await refused(inverse);});
});
