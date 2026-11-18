/* eslint-disable @typescript-eslint/no-require-imports -- Actual application owners after a synthetic schema-only rollback. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeUploadCommand,observeStagingDrive}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
global.fetch=()=>{throw Error('Provider network is forbidden');};
test.after(closePool);
test('current app still uploads and saves on the supported pre-media schema after rollback',async()=>{
 await transaction(false,async()=>assert.equal((await currentTransaction().query("SELECT to_regclass('stock_operational.media') IS NULL AS absent")).rows[0].absent,true));
 let uploads=0;const service=createPostgresService();
 const item=await executeUploadCommand('MC_AFTER_ROLLBACK',randomUUID(),'intent',async()=>{
  const file=await observeStagingDrive({async uploadImage(){uploads++;return {id:'MC_ROLLBACK_FILE',name:'synthetic.jpg',webViewLink:'https://drive.google.com/file/d/MC_ROLLBACK_FILE/view'};},async deleteFile(){assert.fail('Committed file deleted');}}).uploadImage({fileName:'synthetic.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic')});
  const order=await orders.createOrder({googleSheetsService:service,id:'MC_ROLLBACK_ORDER',createdBy:'synthetic'});
  return orders.createOrderItem({googleSheetsService:service,orderId:order.id,imageUrl:file.webViewLink,createdBy:'synthetic'});
 });
 assert.equal(uploads,1);assert.equal(item.imageUrl,'https://drive.google.com/file/d/MC_ROLLBACK_FILE/view');
});
