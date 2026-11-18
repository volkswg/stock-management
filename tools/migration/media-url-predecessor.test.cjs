/* eslint-disable @typescript-eslint/no-require-imports -- Hash-bound preceding runtime on synthetic databases only. */
require('../../tests/helpers/postgres-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const before=JSON.parse(fs.readFileSync('tests/fixtures/media-url-before.json','utf8')).edits,loader=require.extensions['.ts'];
require.extensions['.ts']=function(module,file){const edit=before[path.relative(process.cwd(),file)];if(!edit)return loader(module,file);module._compile(ts.transpileModule(edit.before,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);};
const {closePool,transaction}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeUploadCommand}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {observeStagingDrive}=require('../../src/infrastructure/persistence/postgres/uploads.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
global.fetch=()=>{throw Error('Live providers forbidden');};test.after(closePool);
test('released PR84 app can upload, replay and read on compatibility schema and after the column-restoring inverse',async()=>{
 const service=createPostgresService(),key=randomUUID();let uploads=0;
 const fake={uploadImage:async()=>{uploads++;return {id:'MU_OLD_APP_UPLOAD',name:'old.jpg',webViewLink:'https://example.invalid/old-app-image'};},deleteFile:async()=>{},makeFileReadableByLink:async()=>{},checkConnection:async()=>{}};
 const run=()=>executeUploadCommand('media-old-runtime',key,'old-runtime-intent',async()=>{
  const order=await orders.createOrder({googleSheetsService:service,id:'MU_OLD_APP',createdBy:'synthetic'});
  const file=await observeStagingDrive(fake).uploadImage({fileName:'old.jpg',contentType:'image/jpeg',bytes:Buffer.from('fake')});
  return orders.createOrderItem({googleSheetsService:service,orderId:order.id,imageUrl:file.webViewLink,createdBy:'synthetic'});
 });
 const first=await run();assert.deepEqual(await run(),first);assert.equal(uploads,1);
 await transaction(false,async()=>assert.equal((await service.orderItems.readRows()).find(r=>r[0]===first.id)[2],'https://example.invalid/old-app-image'));
});
