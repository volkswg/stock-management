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
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeUploadCommand,observeStagingDrive}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts'),line=require('../../src/modules/line-workflows/server.ts');
global.fetch=()=>{throw Error('Live provider calls are forbidden in media acceptance');};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const ownerUrl=new URL(process.env.STOCK_DATABASE_URL);ownerUrl.username='postgres';ownerUrl.password='';
const owner=new Client({connectionString:ownerUrl.toString()}),service=createBusinessDatabase();
test.before(()=>owner.connect());
test.after(async()=>{await closePool();await owner.end();});
const read=sql=>transaction(false,async()=>(await currentTransaction().query(sql)).rows);
const driveUrl=id=>`https://drive.google.com/file/d/${id}/view`;
const file=(id,extra={})=>({id,name:id+'.jpg',webViewLink:driveUrl(id),...extra});
const uploadInput={fileName:'synthetic.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic-only')};

test('confirmed browser upload metadata commits with its reference and exact retries do not upload again',async()=>{
 let uploads=0;const id='MC_BROWSER_UPLOAD',key=randomUUID();
 const drive={async uploadImage(){uploads++;return file(id);},async deleteFile(){assert.fail('Committed file deleted');},async checkConnection(){},async makeFileReadableByLink(){}};
 const run=()=>executeUploadCommand('MC_BROWSER',key,'intent',async()=>{
  const uploaded=await observeStagingDrive(drive).uploadImage(uploadInput);
  const order=await orders.createOrder({storage:service,id:'MC_BROWSER_ORDER',createdBy:'web'});
  return orders.createOrderItem({storage:service,orderId:order.id,imageUrl:uploaded.webViewLink,createdBy:'web'});
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
 const args={lineBotService:bot,getStorage:()=>service,getGoogleDriveService:()=>drive,getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.invalid'};
 const event={type:'message',webhookEventId:'MC_LINE_CREATE',replyToken:'synthetic',timestamp:Date.parse('2026-11-18T02:00:00Z'),source:{type:'user',userId:'MC_LINE_USER'},message:{id:'MC_LINE_MESSAGE',type:'text',text:'create:order'}};
 await line.processLineWebhook({...args,events:[event]});
 const image={...event,webhookEventId:'MC_LINE_IMAGE',message:{id:'MC_LINE_IMAGE_CONTENT',type:'image'}};
 await line.processLineWebhook({...args,events:[image]});
 await line.processLineWebhook({...args,events:[{...image,replyToken:'redelivered',deliveryContext:{isRedelivery:true}}]});
 assert.equal(uploads,1);
 const media=(await read("SELECT * FROM stock_operational.media WHERE \"providerFileId\"='MC_LINE_UPLOAD'"))[0];assert.ok(media);assert.equal(media.mimeType,'image/jpeg');assert.equal(media.createdBy,'MC_LINE_USER');assert.equal(media.sizeBytes,String(Buffer.byteLength('synthetic LINE image')));
 assert.equal((await owner.query('SELECT count(*) FROM stock_operational.order_bills WHERE "imageMediaId"=$1',[media.id])).rows[0].count,'1');
});
test('actual LINE movement photo saves one media reference and preserves quantity/note on redelivery',async()=>{
 let uploads=0;
 const args={lineBotService:{sendReply:async()=>{},downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic movement')})},getStorage:()=>service,
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
