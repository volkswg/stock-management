/* eslint-disable @typescript-eslint/no-require-imports -- Actual app owners, disposable PostgreSQL and fake providers. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {executeUploadCommand,observeStagingDrive}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts'),inventory=require('../../src/modules/inventory/server.ts'),shipments=require('../../src/modules/shipments/server.ts');
global.fetch=()=>{throw Error('Real providers forbidden');};
const adminUrl=new URL(process.env.STOCK_DATABASE_URL);assert.equal(adminUrl.hostname,'127.0.0.1');adminUrl.username='postgres';adminUrl.password='';
const admin=new Client({connectionString:adminUrl.toString()}),service=createPostgresService();
test.before(()=>admin.connect());test.after(async()=>{await closePool();await admin.end();});
const command=run=>executeCommand('media-id-test',randomUUID(),hashIntent(randomUUID()),run);
const read=run=>transaction(false,run),url=id=>'https://drive.google.com/file/d/'+id+'/view';
let shared;
test('five actual feature paths store media IDs and return canonical URLs with their existing public fields',async()=>{
 const canonical=url('MU_SHARED'),alias='https://drive.google.com/open?id=MU_SHARED';
 shared=await command(async()=>{
  const order=await orders.createOrder({googleSheetsService:service,id:'MU_ORDER',createdBy:'synthetic'});
  const item=await orders.createOrderItem({googleSheetsService:service,orderId:order.id,imageUrl:canonical,quoteQuantity:'2',createdBy:'synthetic'});
  await orders.createOrderBill({googleSheetsService:service,orderId:order.id,imageUrl:alias,createdBy:'synthetic'});
  const shipment=await shipments.createShipment({googleSheetsService:service,poNumber:'MU_PO',createdBy:'synthetic'});
  await(await service.shipments.referenceId(shipment.id)).update('M',[alias]);
  const identity={masterId:'MU_MOVEMENT',userId:'synthetic',startedAt:'2026-11-19T00:00:00Z'};
  await inventory.synchronizeMovementJourney(service,identity);
  await inventory.appendMovementJourneyItem(service,()=>({id:'MU_DETAIL',masterId:identity.masterId,shop:'Synthetic',quantity:'2',remark:'before',fromLocation:'',toLocation:'',imageUrl:alias,purchaseDetailId:'',status:'created',createdAt:identity.startedAt,updatedAt:identity.startedAt,stockCounted:true,isNewArrival:false}));
  await inventory.createStockAdjustment(service,[{id:'MU_ACCOUNT',shopName:'Synthetic'}],{requestId:randomUUID(),accountId:'MU_ACCOUNT',date:'2026-11-19',direction:'out',reason:'damage',quantity:1,itemDescription:'Synthetic',photoUrl:alias,note:'',notInLoyverse:true});
  return {order,item};
 });
 const media=(await admin.query('SELECT * FROM stock_operational.media WHERE "providerFileId"=$1',['MU_SHARED'])).rows;assert.equal(media.length,1);assert.equal(media[0].sourceUrl,canonical);
 for(const [table,ref,serviceKey,position] of [['order_items','imageMediaId','orderItems',2],['order_bills','imageMediaId','orderBills',2],['shipments','shippingBillMediaId','shipments',12],['movement_details','productImageMediaId','movementDetails',7],['stock_adjustments','photoMediaId','stockAdjustments',10]]){
  assert.equal((await admin.query(`SELECT count(*)::int n FROM stock_operational.${table} WHERE "${ref}"=$1`,[media[0].id])).rows[0].n,1,table);
  const rows=await read(()=>service[serviceKey].readRows());assert.ok(rows.slice(1).some(r=>r[position]===canonical),table);assert.ok(!rows[0].includes(ref));
 }
 const detail=await read(()=>orders.getOrderDetail({googleSheetsService:service,orderId:shared.order.id,shipmentProjection:{readLinks:async()=>({findShipmentIdForOrder:()=>null}),readShipments:async()=>({findShipmentById:()=>null})}}));
 assert.ok(JSON.stringify(detail).includes(canonical));assert.ok(!JSON.stringify(detail).includes('imageMediaId'));
});
test('ID-based updates preserve unrelated values and retain same-record conflicts and explicit image clearing',async()=>{
 const before=(await admin.query('SELECT revision::text,"imageMediaId" FROM stock_operational.order_items WHERE id=$1',[shared.item.id])).rows[0];
 let stale;await read(async()=>{stale=await service.orderItems.referenceId(shared.item.id);});
 await command(async()=>{const ref=await service.orderItems.referenceId(shared.item.id);await ref.update('D',['3']);});
 const next=(await admin.query('SELECT revision::text,"imageMediaId" FROM stock_operational.order_items WHERE id=$1',[shared.item.id])).rows[0];assert.equal(next.imageMediaId,before.imageMediaId);assert.equal(BigInt(next.revision),BigInt(before.revision)+1n);
 await assert.rejects(command(()=>stale.update('D',['4'])),e=>e.status===409);
 await command(async()=>{await(await service.orderItems.referenceId(shared.item.id)).update('C',['']);});
 assert.equal((await admin.query('SELECT "imageMediaId" FROM stock_operational.order_items WHERE id=$1',[shared.item.id])).rows[0].imageMediaId,null);
 await read(async()=>assert.equal((await service.orderItems.readRows()).find(r=>r[0]===shared.item.id)[2],''));
});
test('external/long URLs stay exact and missing/deleted media cannot be linked or read silently',async()=>{
 const external='https://example.invalid/'+ 'x'.repeat(6000);
 const item=await command(()=>orders.createOrderItem({googleSheetsService:service,orderId:shared.order.id,imageUrl:external,createdBy:'synthetic'}));
 await read(async()=>assert.equal((await service.orderItems.readRows()).find(r=>r[0]===item.id)[2],external));
 await assert.rejects(command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=$1 WHERE id=$2',[randomUUID(),item.id])));
 const retired=(await admin.query('INSERT INTO stock_operational.media(provider,"sourceUrl","deletedAt") VALUES($1,$2,now()) RETURNING id',['external_url','https://example.invalid/deleted'])).rows[0].id;
 await assert.rejects(command(()=>currentTransaction().query('UPDATE stock_operational.order_items SET "imageMediaId"=$1 WHERE id=$2',[retired,item.id])));
 await assert.rejects(command(()=>currentTransaction().query('SELECT stock_operational.media_url_v1($1)',[retired])));
 await assert.rejects(admin.query('UPDATE stock_operational.media SET "deletedAt"=now() WHERE id=(SELECT "imageMediaId" FROM stock_operational.order_items WHERE id=$1)',[item.id]));
});
test('confirmed upload metadata, exact replay and uncertain uploads use the existing journals without extra provider calls',async()=>{
 let calls=0;const key=randomUUID(),intent=hashIntent('MU_UPLOAD'),input={fileName:'test.jpg',contentType:'image/jpeg',bytes:Buffer.from('fake')};
 const fake={uploadImage:async()=>{calls++;return {id:'MU_UPLOAD',name:'test.jpg',webViewLink:url('MU_UPLOAD')};},deleteFile:async()=>{},makeFileReadableByLink:async()=>{},checkConnection:async()=>{}};
 const run=()=>executeUploadCommand('media-id-upload',key,intent,async()=>{const uploaded=await observeStagingDrive(fake).uploadImage(input);return orders.createOrderItem({googleSheetsService:service,orderId:shared.order.id,imageUrl:uploaded.webViewLink,createdBy:'synthetic'});});
 const first=await run();assert.deepEqual(await run(),first);assert.equal(calls,1);
 const media=(await admin.query('SELECT * FROM stock_operational.media WHERE "providerFileId"=$1',['MU_UPLOAD'])).rows[0];assert.equal(media.fileName,'test.jpg');assert.equal(media.mimeType,'image/jpeg');assert.equal(media.sizeBytes,'4');
 const uncertain=randomUUID();let attempts=0;
 const fail=()=>executeUploadCommand('media-id-upload',uncertain,hashIntent('uncertain'),()=>observeStagingDrive({...fake,uploadImage:async()=>{attempts++;throw Error('unknown network outcome');}}).uploadImage(input));
 await assert.rejects(fail());await assert.rejects(fail(),e=>e.status===503);assert.equal(attempts,1);
});
test('record schema is revalidated on each transaction; missing capabilities fail closed without altering grants',async()=>{
 const mode=(await admin.query('SELECT stock_operational.media_record_contract_v1() mode')).rows[0].mode;assert.ok(['retained','id-only'].includes(mode));
 await admin.query('ALTER FUNCTION stock_operational.media_ref_for_url_v1(text) RENAME TO mu_missing');
 try{await assert.rejects(read(()=>service.orders.readRows()),e=>e.status===503);}finally{await admin.query('ALTER FUNCTION stock_operational.mu_missing(text) RENAME TO media_ref_for_url_v1');}
 await read(()=>service.orders.readRows());
 const fk='order_items_imageMediaId_fkey';
 const definition=(await admin.query("SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='stock_operational.order_items'::regclass AND conname=$1",[fk])).rows[0].definition;
 await admin.query('ALTER TABLE stock_operational.order_items DROP CONSTRAINT "'+fk+'"');
 try{await assert.rejects(read(()=>service.orderItems.readRows()),e=>e.status===503);}finally{await admin.query('ALTER TABLE stock_operational.order_items ADD CONSTRAINT "'+fk+'" '+definition);}
 const access=(await admin.query("SELECT has_table_privilege('anon','stock_operational.media','SELECT') a,has_table_privilege('authenticated','stock_operational.media','SELECT') b,has_function_privilege('media_test_reader','stock_operational.media_ref_for_url_v1(text)','EXECUTE') c")).rows[0];assert.deepEqual(access,{a:false,b:false,c:false});
});
test('full recovery still enumerates all52 private tables and15 security metadata sections after retirement or inverse',async()=>{
 const {execFileSync}=require('node:child_process');
 const sql=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'tools/migration');import recovery;print(recovery.fingerprint_sql(include_media=True))"],{encoding:'utf8',env:{PATH:process.env.PATH}});
 const rows=(await admin.query(sql)).flatMap(r=>r.rows).map(r=>r.json_build_object);
 assert.equal(rows.filter(r=>r.table).length,52);assert.equal(rows.filter(r=>r.metadata).length,15);
 assert.ok(rows.some(r=>r.table==='stock_operational.media'&&r.rows>0));
});
