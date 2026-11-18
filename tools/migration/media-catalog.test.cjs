/* eslint-disable @typescript-eslint/no-require-imports -- Actual owners with real pg, synthetic fixtures and fake providers only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');
const rawQuery=Client.prototype.query;
Client.prototype.query=function(...args){
 const result=rawQuery.apply(this,args);
 return result?.catch?result.catch(error=>{console.error('Synthetic media SQL diagnostic:',error.code,error.message);throw error;}):result;
};
const {execFileSync}=require('node:child_process');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {executeUploadCommand,observeStagingDrive}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {registerUploadedMedia}=require('../../src/infrastructure/persistence/postgres/media.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts'),inventory=require('../../src/modules/inventory/server.ts'),shipments=require('../../src/modules/shipments/server.ts'),line=require('../../src/modules/line-workflows/server.ts');
global.fetch=()=>{throw Error('Live provider calls are forbidden in media acceptance');};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const ownerUrl=new URL(process.env.STOCK_DATABASE_URL);ownerUrl.username='postgres';ownerUrl.password='';
const owner=new Client({connectionString:ownerUrl.toString()}),service=createPostgresService();
test.before(()=>owner.connect());
test.after(async()=>{await closePool();await owner.end();});
const command=run=>executeCommand('media-fixture',randomUUID(),hashIntent(randomUUID()),run);
const read=sql=>transaction(false,async()=>(await currentTransaction().query(sql)).rows);
const driveUrl=id=>`https://drive.google.com/file/d/${id}/view`;
const file=(id,extra={})=>({id,name:id+'.jpg',webViewLink:driveUrl(id),...extra});
const uploadInput={fileName:'synthetic.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic-only')};
async function orderItem(id,url){
 return command(async()=>{
  const order=await orders.createOrder({googleSheetsService:service,id,createdBy:'synthetic'});
  const item=await orders.createOrderItem({googleSheetsService:service,orderId:order.id,imageUrl:url,quoteQuantity:'2',createdBy:'synthetic'});
  return {order,item};
 });
}
test('catalog has exactly the approved 11 columns, real restrictive FKs/indexes, RLS and no public access',async()=>{
 const columns=await owner.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='stock_operational' AND table_name='media' ORDER BY ordinal_position");
 assert.deepEqual(columns.rows.map(r=>r.column_name),['id','provider','providerFileId','sourceUrl','fileName','mimeType','sizeBytes','createdBy','createdAt','updatedAt','deletedAt']);
 assert.equal(columns.rows.filter(r=>r.data_type==='timestamp with time zone').length,3);
 const fks=await owner.query("SELECT conrelid::regclass::text AS table_name,confdeltype,convalidated FROM pg_constraint WHERE confrelid='stock_operational.media'::regclass");
 assert.equal(fks.rows.length,5);assert.ok(fks.rows.every(r=>r.confdeltype==='r'&&r.convalidated));
 const access=await owner.query("SELECT relrowsecurity,has_table_privilege('anon',oid,'SELECT') AS anon,has_table_privilege('authenticated',oid,'SELECT') AS authenticated,has_table_privilege('stock_runtime',oid,'DELETE') AS runtime_delete FROM pg_class WHERE oid='stock_operational.media'::regclass");
 assert.deepEqual(access.rows,[{relrowsecurity:true,anon:false,authenticated:false,runtime_delete:false}]);
 await assert.rejects(command(()=>currentTransaction().query('INSERT INTO stock_operational.media(provider,"sourceUrl","sizeBytes") VALUES($1,$2,$3)',['external_url','https://example.invalid/negative',-1])));
});
let shared;
test('all five actual business paths reference one Drive object while preserving each exact legacy URL',async()=>{
 const id='MC_SHARED',url=driveUrl(id),alias='https://drive.google.com/open?id='+id;
 shared=await orderItem('MC_ORDER_SHARED',url);
 await command(async()=>{
  await orders.createOrderBill({googleSheetsService:service,orderId:shared.order.id,imageUrl:alias,createdBy:'synthetic'});
  const shipment=await shipments.createShipment({googleSheetsService:service,poNumber:'MC_SYNTHETIC_PO',createdBy:'synthetic'});
  await currentTransaction().query('UPDATE stock_operational.shipments SET "shippingBillUrl"=$1 WHERE id=$2',[alias,shipment.id]);
  const identity={masterId:'MC_MOVEMENT_SHARED',userId:'synthetic',startedAt:'2026-11-18T01:00:00Z'};
  await inventory.synchronizeMovementJourney(service,identity);
  await inventory.appendMovementJourneyItem(service,()=>({id:'MC_MOVEMENT_ITEM',masterId:identity.masterId,shop:'Synthetic',quantity:'2',remark:'retained',fromLocation:'',toLocation:'',imageUrl:url,purchaseDetailId:'',status:'created',createdAt:identity.startedAt,updatedAt:identity.startedAt,stockCounted:true,isNewArrival:false}));
  await inventory.createStockAdjustment(service,[{id:'MC_ACCOUNT',shopName:'Synthetic'}],{requestId:randomUUID(),accountId:'MC_ACCOUNT',date:'2026-11-18',direction:'out',reason:'damage',quantity:1,itemDescription:'Synthetic',photoUrl:alias,note:'',notInLoyverse:true});
 });
 const media=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_SHARED'"))[0];assert.ok(media);assert.equal(media.fileName,null);assert.equal(media.mimeType,null);assert.equal(media.sizeBytes,null);
 for(const [table,urlColumn,refColumn] of [['order_items','imageUrl','imageMediaId'],['order_bills','imageUrl','imageMediaId'],['shipments','shippingBillUrl','shippingBillMediaId'],['movement_details','productImageUrl','productImageMediaId'],['stock_adjustments','photoUrl','photoMediaId']]){
  const rows=await owner.query(`SELECT "${urlColumn}" AS url,"${refColumn}" AS ref FROM stock_operational.${table} WHERE "${refColumn}"=$1`,[media.id]);
  assert.equal(rows.rows.length,1,table);assert.ok([url,alias].includes(rows.rows[0].url));
 }
 const records=await transaction(false,()=>service.orderItems.readRows());assert.ok(records.some(r=>r.includes(url)));assert.ok(!records[0].includes('imageMediaId'));
});
test('ID-only edits mirror URLs; URL-only edits mirror IDs; mismatched pairs roll back and clearing is explicit',async()=>{
 const {item}=await orderItem('MC_ORDER_SWITCH',driveUrl('MC_FIRST'));
 const next=await command(async()=> (await currentTransaction().query("SELECT stock_operational.media_for_location_v1('google_drive','MC_SECOND',$1) AS id",[driveUrl('MC_SECOND')])).rows[0].id);
 const before=(await owner.query('SELECT * FROM stock_operational.order_items WHERE id=$1',[item.id])).rows[0];
 await command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=$1 WHERE id=$2',[next,item.id]));
 const after=(await owner.query('SELECT * FROM stock_operational.order_items WHERE id=$1',[item.id])).rows[0];
 assert.equal(after.imageUrl,driveUrl('MC_SECOND'));assert.equal(after.imageMediaId,next);assert.equal(BigInt(after.revision),BigInt(before.revision)+1n);
 await assert.rejects(command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=$1,"imageUrl"=$2 WHERE id=$3',[before.imageMediaId,driveUrl('MC_UNRELATED'),item.id])));
 await command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=NULL WHERE id=$1',[item.id]));
 const cleared=(await owner.query('SELECT "imageUrl","imageMediaId" FROM stock_operational.order_items WHERE id=$1',[item.id])).rows[0];assert.deepEqual(cleared,{imageUrl:null,imageMediaId:null});
 await command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageUrl"=$1 WHERE id=$2',[driveUrl('MC_FIRST'),item.id]));
 assert.equal((await owner.query('SELECT "imageMediaId" FROM stock_operational.order_items WHERE id=$1',[item.id])).rows[0].imageMediaId,before.imageMediaId);
});
test('external and long historical URLs stay exact; fake Drive hostnames never acquire a Google identity',async()=>{
 for(const [i,url] of ['https://example.invalid/'+ 'x'.repeat(7000),'https://drive.google.com.attacker.invalid/file/d/MC_FAKE/view',' legacy unprofiled reference '].entries()){
  const {item}=await orderItem('MC_EXTERNAL_'+i,url);
  const rows=await owner.query('SELECT m.* FROM stock_operational.order_items i JOIN stock_operational.media m ON m.id=i."imageMediaId" WHERE i.id=$1',[item.id]);
  assert.equal(rows.rows[0].provider,'external_url');assert.equal(rows.rows[0].providerFileId,null);assert.equal(rows.rows[0].sourceUrl,url);
 }
});
test('shared media cannot be physically or softly deleted, including when a business reference is archived',async()=>{
 const linked=(await read("SELECT id FROM stock_operational.media WHERE \"providerFileId\"='MC_SHARED'"))[0].id;
 await assert.rejects(owner.query('DELETE FROM stock_operational.media WHERE id=$1',[linked]),e=>e.code==='23503');
 await assert.rejects(owner.query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=$1',[linked]));
 await command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET archived_at=now() WHERE id=$1',[shared.item.id]));
 await assert.rejects(owner.query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=$1',[linked]));
 const unused=(await owner.query("INSERT INTO stock_operational.media(provider,\"sourceUrl\") VALUES('external_url','https://example.invalid/unused') RETURNING id")).rows[0].id;
 await owner.query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=$1',[unused]);
 const fresh=await orderItem('MC_DELETED_REF',driveUrl('MC_ACTIVE'));
 await assert.rejects(command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=$1 WHERE id=$2',[unused,fresh.item.id])));
 const active=(await owner.query('SELECT "imageMediaId" FROM stock_operational.order_items WHERE id=$1',[fresh.item.id])).rows[0].imageMediaId;
 await assert.rejects(command(()=>currentTransaction().query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=$1',[active])));
});
test('confirmed browser upload metadata commits with its reference and exact retries do not upload again',async()=>{
 let uploads=0;const id='MC_BROWSER_UPLOAD',key=randomUUID();
 const drive={async uploadImage(){uploads++;return file(id);},async deleteFile(){assert.fail('Committed file deleted');},async checkConnection(){},async makeFileReadableByLink(){}};
 const run=()=>executeUploadCommand('MC_BROWSER',key,'intent',async()=>{
  const uploaded=await observeStagingDrive(drive).uploadImage(uploadInput);
  const order=await orders.createOrder({googleSheetsService:service,id:'MC_BROWSER_ORDER',createdBy:'web'});
  return orders.createOrderItem({googleSheetsService:service,orderId:order.id,imageUrl:uploaded.webViewLink,createdBy:'web'});
 });
 const first=await run(),retry=await run();assert.deepEqual(retry,first);assert.equal(uploads,1);
 const media=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_BROWSER_UPLOAD'"))[0];
 assert.equal(media.fileName,id+'.jpg');assert.equal(media.mimeType,uploadInput.contentType);assert.equal(media.sizeBytes,String(uploadInput.bytes.byteLength));assert.equal(media.createdBy,'web');
 assert.equal((await owner.query('SELECT "imageMediaId" FROM stock_operational.order_items WHERE id=$1',[first.id])).rows[0].imageMediaId,media.id);
});
test('rollback removes catalog metadata and cleans a confirmed new file; uncertainty never creates metadata or blindly retries',async()=>{
 let uploads=0,deletes=0;
 const drive={async uploadImage(){uploads++;return file('MC_ROLLED_BACK');},async deleteFile(){deletes++;},async checkConnection(){},async makeFileReadableByLink(){}};
 await assert.rejects(executeUploadCommand('MC_ROLLBACK',randomUUID(),'intent',async()=>{await observeStagingDrive(drive).uploadImage(uploadInput);throw Error('synthetic later save failed');}));
 assert.equal(deletes,1);assert.equal((await read("SELECT id FROM stock_operational.media WHERE \"providerFileId\"='MC_ROLLED_BACK'")).length,0);
 const key=randomUUID(),uncertain={...drive,async uploadImage(){uploads++;throw Error('synthetic provider accepted but acknowledgement lost');}};
 await assert.rejects(executeUploadCommand('MC_UNKNOWN',key,'intent',()=>observeStagingDrive(uncertain).uploadImage(uploadInput)));
 const count=uploads;
 await assert.rejects(executeUploadCommand('MC_UNKNOWN',key,'intent',()=>observeStagingDrive(uncertain).uploadImage(uploadInput)));
 assert.equal(uploads,count);
});
test('actual LINE order-image workflow links media with known metadata and survives regrouped redelivery',async()=>{
 let uploads=0;const replies=[];
 const bot={sendReply:async(token,messages)=>replies.push({token,messages}),downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic LINE image')})};
 const drive={async uploadImage(input){uploads++;return file('MC_LINE_UPLOAD',{name:input.fileName});},async deleteFile(){assert.fail('Committed LINE upload deleted');}};
 const args={lineBotService:bot,getGoogleSheetsService:()=>service,getGoogleDriveService:()=>drive,getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.invalid'};
 const event={type:'message',webhookEventId:'MC_LINE_CREATE',replyToken:'synthetic',timestamp:Date.parse('2026-11-18T02:00:00Z'),source:{type:'user',userId:'MC_LINE_USER'},message:{id:'MC_LINE_MESSAGE',type:'text',text:'create:order'}};
 await line.processLineWebhook({...args,events:[event]});
 const image={...event,webhookEventId:'MC_LINE_IMAGE',message:{id:'MC_LINE_IMAGE_CONTENT',type:'image'}};
 await line.processLineWebhook({...args,events:[image]});
 await line.processLineWebhook({...args,events:[{...image,replyToken:'redelivered',deliveryContext:{isRedelivery:true}}]});
 assert.equal(uploads,1);
 const media=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_LINE_UPLOAD'"))[0];assert.ok(media);assert.equal(media.mimeType,'image/jpeg');assert.equal(media.createdBy,'MC_LINE_USER');assert.equal(media.sizeBytes,String(Buffer.byteLength('synthetic LINE image')));
 assert.equal((await owner.query('SELECT count(*) FROM stock_operational.order_bills WHERE "imageMediaId"=$1',[media.id])).rows[0].count,'1');
});
test('catalog identities are immutable, metadata enrichment preserves known values and timestamps advance',async()=>{
 const before=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_BROWSER_UPLOAD'"))[0];
 await command(()=>registerUploadedMedia(file('MC_BROWSER_UPLOAD',{name:'changed-name'}),()=>({mimeType:'image/png',sizeBytes:99})));
 const after=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_BROWSER_UPLOAD'"))[0];assert.deepEqual(after,before);
 await assert.rejects(owner.query('UPDATE stock_operational.media SET "providerFileId"=$1 WHERE id=$2',['OTHER',before.id]));
 await owner.query('UPDATE stock_operational.media SET "fileName"=$1 WHERE id=$2',['reviewed-label.jpg',before.id]);
 const edited=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_BROWSER_UPLOAD'"))[0];assert.ok(edited.updatedAt>=before.updatedAt);assert.equal(edited.createdAt.getTime(),before.createdAt.getTime());
});
test('recovery requires the explicit media layout and fingerprints media rows as the 52nd private table',async()=>{
 const script="import sys;sys.path.insert(0,'tools/migration');import recovery;print(recovery.fingerprint_sql(include_media=True))";
 const sql=execFileSync('python3',['-c',script],{encoding:'utf8',env:{PATH:process.env.PATH}});
 const result=await owner.query(sql);const records=result.flatMap(r=>r.rows).map(r=>r.json_build_object);assert.equal(records.filter(r=>r.table).length,52);assert.equal(records.filter(r=>r.metadata).length,15);assert.ok(records.some(r=>r.table==='stock_operational.media'));
 const oldGuard=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'tools/migration');import recovery;print(recovery.history_guard_sql('revision'))"],{encoding:'utf8',env:{PATH:process.env.PATH}});
 await assert.rejects(owner.query(oldGuard),e=>e.code==='22012');
});
test('full attachment readers can read the catalog; an Orders-only reader gains no catalog access',async()=>{
 const grants=(await owner.query("SELECT has_table_privilege('media_test_reader','stock_operational.media','SELECT') AS full_reader,has_table_privilege('lexeme_reader','stock_operational.media','SELECT') AS orders_only")).rows[0];
 assert.deepEqual(grants,{full_reader:true,orders_only:false});
 await owner.query('BEGIN');
 try{await owner.query('SET LOCAL ROLE media_test_reader');assert.ok(Number((await owner.query('SELECT count(*) FROM stock_operational.media')).rows[0].count)>0);}finally{await owner.query('ROLLBACK');}
});
test('actual LINE movement photo saves one media reference and preserves quantity/note on redelivery',async()=>{
 let uploads=0;
 const args={lineBotService:{sendReply:async()=>{},downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic movement')})},getGoogleSheetsService:()=>service,
  getGoogleDriveService:()=>({async uploadImage(){uploads++;return file('MC_LINE_MOVEMENT');},async deleteFile(){assert.fail('Committed movement file deleted');}}),
  getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.invalid'};
 const event=(index,text,image=false)=>({type:'message',webhookEventId:'MC_MOVE_EVENT_'+index,replyToken:'synthetic',timestamp:Date.parse('2026-11-18T03:00:00Z'),source:{type:'user',userId:'MC_MOVE_USER'},message:{id:'MC_MOVE_CONTENT_'+index,type:image?'image':'text',...(image?{}:{text})}});
 for(const [i,text] of ['create:movement','create:new-movement','NJ','3 synthetic movement note'].entries())await line.processLineWebhook({...args,events:[event(i,text)]});
 const image=event(4,'',true),result=await line.processLineWebhook({...args,events:[image]});
 assert.equal(result.movementFailed,false);assert.equal(result.imageCounts().saved,1);
 await line.processLineWebhook({...args,events:[{...image,replyToken:'redelivery',deliveryContext:{isRedelivery:true}}]});
 assert.equal(uploads,1);
 const rows=await owner.query('SELECT d.quantity,d.remark,m."mimeType",m."createdBy" FROM stock_operational.movement_details d JOIN stock_operational.media m ON m.id=d."productImageMediaId" WHERE m."providerFileId"=$1',['MC_LINE_MOVEMENT']);
 assert.equal(rows.rows.length,1);assert.equal(Number(rows.rows[0].quantity),3);assert.match(rows.rows[0].remark,/synthetic movement note/);assert.equal(rows.rows[0].mimeType,'image/jpeg');assert.equal(rows.rows[0].createdBy,'MC_MOVE_USER');
});
test('partial catalog installation fails closed and cleans a known new upload without committing metadata',async()=>{
 const trigger=(await owner.query("SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='stock_operational.stock_adjustments'::regclass AND tgname='b_media_reference'")).rows[0].definition;
 await owner.query('DROP TRIGGER b_media_reference ON stock_operational.stock_adjustments');
 let removed=0;
 try{
  const drive={async uploadImage(){return file('MC_PARTIAL');},async deleteFile(){removed++;}};
  await assert.rejects(executeUploadCommand('MC_PARTIAL',randomUUID(),'intent',()=>observeStagingDrive(drive).uploadImage(uploadInput)));
  assert.equal(removed,1);assert.equal((await owner.query('SELECT count(*) FROM stock_operational.media WHERE "providerFileId"=$1',['MC_PARTIAL'])).rows[0].count,'0');
 }finally{await owner.query(trigger);}
});
