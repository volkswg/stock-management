/* eslint-disable @typescript-eslint/no-require-imports -- Actual PostgreSQL owners; localhost synthetic fixtures and fake providers only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{Client}=require('pg');
const {transaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const line=require('../../src/modules/line-workflows/server.ts'),inventory=require('../../src/modules/inventory/server.ts');
const connection=new URL(process.env.STOCK_DATABASE_URL);assert.equal(connection.hostname,'127.0.0.1');connection.username='postgres';connection.password='';
const owner=new Client({connectionString:connection.toString()}),storage=createBusinessDatabase();
const migration=fs.readFileSync('supabase/migrations/20261122125311_movement_shop_ids.sql','utf8'),backfill=fs.readFileSync('tools/migration/operator/backfill_movement_shop_ids.sql','utf8');
global.fetch=()=>{throw Error('Real providers are forbidden in movement shop acceptance');};
let identity;
const query=async(sql,values)=>(await owner.query(sql,values)).rows;
const scalar=async(sql,values)=>Object.values((await query(sql,values))[0])[0];
const settings=async(map)=>{
 await owner.query("SELECT set_config('stock.movement_shop_install','reviewed-movement-shop-ids-v1',false),set_config('stock.movement_shop_backfill','reviewed-movement-shop-backfill-v1',false),set_config('stock.expected_isolation_id',$1,false),set_config('stock.expected_purpose','isolated-staging',false),set_config('stock.expected_revision',(SELECT value::text FROM stock_operational.revision),false),set_config('stock.movement_shop_map',$2,false)",[identity,JSON.stringify(map)]);
};
const rejects=async sql=>{await assert.rejects(owner.query(sql));await owner.query('ROLLBACK');};
const map=[{label:'NJ',shopId:'SHOP_MAP_A'},{label:'YY',shopId:'SHOP_MAP_B'},{label:'Gone',shopId:'SHOP_MAP_DELETED'}];
const context={masterId:'MOVE_MAP',itemId:'PENDING_MAP',userId:'user-map',step:'product_image',startedAt:'2026-11-22T00:00:00Z',shop:'NJ',quantity:'6',remark:'original ไทย note',imageUrl:'https://example.test/confirmed',lastEventId:'already-accounted'};
async function snapshot(){return{details:await query('SELECT to_jsonb(d)-\'shopId\' AS value FROM stock_operational.movement_details d ORDER BY id'),users:(await query('SELECT to_jsonb(u) AS value FROM stock_operational.user_state u ORDER BY id')).map(({value})=>{if(value.context){const c=typeof value.context==='string'?JSON.parse(value.context):value.context;delete c.shopId;value.context=c;}return value;}),revision:await query('SELECT * FROM stock_operational.revision'),shops:await query('SELECT to_jsonb(s) AS value FROM stock_operational.shops s ORDER BY id')};}
test.before(async()=>{
 await owner.connect();const env=(await query('SELECT isolation_id::text,purpose FROM stock_operational.environment'))[0];identity=env.isolation_id;assert.equal(env.purpose,'isolated-staging');assert.notEqual(identity,'349b9289-f684-4ec5-ac22-924b2be1946b');assert.equal(identity,process.env.STOCK_TARGET_ISOLATION_ID);
 assert.equal(await scalar("SELECT count(*)::int FROM stock_operational.movement_details"),0,'Fresh isolated copy must have no movement history');
 await owner.query(`INSERT INTO stock_operational.shops(id,name,active,"loyverseAccountId","deletedAt") VALUES('SHOP_MAP_A','Renamed destination',true,'acct-a',null),('SHOP_MAP_B','YY',true,'acct-b',null),('SHOP_MAP_DELETED','Historical destination',false,'acct-deleted','2026-11-01T00:00:00Z');
 INSERT INTO stock_operational.movements(id,status,"createdAt") VALUES('MOVE_MAP','in_progress','2026-11-01T00:00:00Z');
 INSERT INTO stock_operational.movement_details(id,"movementMasterId","shopName",quantity,remark,"fromLocation","toLocation","createdAt","deletedAt") VALUES('DETAIL_MAP_A','MOVE_MAP','NJ',7,'original note','Home','NJ','2026-11-01T00:00:00Z',null),('DETAIL_MAP_B','MOVE_MAP','YY',3,'deleted history','Home','YY','2026-11-01T00:00:00Z','2026-11-02T00:00:00Z'),('DETAIL_MAP_GONE','MOVE_MAP','Gone',2,'retained destination','Home','Gone','2026-11-01T00:00:00Z',null);`);
 await owner.query('INSERT INTO stock_operational.user_state(id,"userId",flowname,"referenceId",state,context) VALUES(9100001,$1,\'MovementCreate\',\'MOVE_MAP\',\'product_image\',$2)',['user-map',JSON.stringify(context)]);
});
test.after(async()=>{await closePool();await owner.end();});

test('schema install rejects missing opt-in, wrong identity and stale revision atomically',async()=>{
 const before=await snapshot();await rejects(migration);await settings(map);await owner.query("SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'");await rejects(migration);
 await settings(map);await owner.query("SET stock.expected_revision='-1'");await rejects(migration);assert.deepEqual(await snapshot(),before);
});
test('explicit backfill rejects ambiguous, unmapped, missing-master and conflicting IDs without partial changes',async()=>{
 const before=await snapshot();
 for(const invalid of [[map[0]], [...map,{label:' nj ',shopId:'SHOP_MAP_B'}],map.map(row=>row.label==='NJ'?{...row,shopId:'absent'}:row)]){await settings(invalid);await rejects(backfill);assert.deepEqual(await snapshot(),before);assert.equal(await scalar('SELECT count(*)::int FROM stock_operational.movement_details WHERE "shopId" IS NOT NULL'),0);}
 await settings(map);await owner.query("SET stock.expected_revision='-1'");await rejects(backfill);assert.deepEqual(await snapshot(),before);
});
test('malformed sessions and a late SQL failure roll back all references and trigger changes',async()=>{
 const before=await snapshot();
 await owner.query('BEGIN');await owner.query("UPDATE stock_operational.user_state SET context='[]'::jsonb WHERE id=9100001");await settings(map);await rejects(backfill);assert.deepEqual(await snapshot(),before);
 await owner.query('BEGIN');await owner.query(`UPDATE stock_operational.user_state SET context='{}'::jsonb WHERE id=9100001`);await settings(map);await rejects(backfill);assert.deepEqual(await snapshot(),before);
 await owner.query('BEGIN');await owner.query('UPDATE stock_operational.user_state SET context=NULL WHERE id=9100001');await settings(map);await rejects(backfill);assert.deepEqual(await snapshot(),before);
 await settings(map);await rejects(backfill.replace('ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;','SELECT 1/0; ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;'));assert.deepEqual(await snapshot(),before);
 assert.equal(await scalar("SELECT count(*)::int FROM pg_trigger WHERE tgrelid IN ('stock_operational.user_state'::regclass,'stock_operational.movement_details'::regclass) AND tgname IN ('a_validate','advance_revision') AND tgenabled='O'"),4);
});
test('approved backfill covers deleted history and unfinished sessions while preserving every old field and revision',async()=>{
 const before=await snapshot();await settings(map);await owner.query(backfill);assert.deepEqual(await snapshot(),before);
 assert.deepEqual(await query('SELECT id,"shopId" FROM stock_operational.movement_details ORDER BY id'),[{id:'DETAIL_MAP_A',shopId:'SHOP_MAP_A'},{id:'DETAIL_MAP_B',shopId:'SHOP_MAP_B'},{id:'DETAIL_MAP_GONE',shopId:'SHOP_MAP_DELETED'}]);
 const state=await scalar('SELECT context FROM stock_operational.user_state WHERE id=9100001');assert.deepEqual(state,{...context,shopId:'SHOP_MAP_A'});
 assert.equal(await scalar("SELECT count(*)::int FROM pg_trigger WHERE tgrelid IN ('stock_operational.user_state'::regclass,'stock_operational.movement_details'::regclass) AND tgname IN ('a_validate','advance_revision') AND tgenabled='O'"),4);
 const again=await snapshot();await settings(map);await owner.query(backfill);assert.deepEqual(await snapshot(),again,'Exact backfill replay must not mutate revisions or prior values');
 await settings(map.map(row=>row.label==='NJ'?{...row,shopId:'SHOP_MAP_B'}:row));await rejects(backfill);assert.deepEqual(await snapshot(),again);
});
test('FK prevents dangling destinations and hard-deleting referenced shops; runtime gets only reviewed column capabilities',async()=>{
 await assert.rejects(owner.query('UPDATE stock_operational.movement_details SET "shopId"=\'missing\' WHERE id=\'DETAIL_MAP_A\''),e=>e.code==='23503');
 await assert.rejects(owner.query("DELETE FROM stock_operational.shops WHERE id='SHOP_MAP_A'"),e=>e.code==='23503');
 assert.equal(await scalar("SELECT has_column_privilege('stock_runtime','stock_operational.movement_details','shopId','INSERT') AND has_column_privilege('stock_runtime','stock_operational.movement_details','shopId','UPDATE')"),true);
 assert.equal(await scalar("SELECT has_table_privilege('anon','stock_operational.movement_details','SELECT') OR has_table_privilege('authenticated','stock_operational.movement_details','SELECT')"),false);
});
test('actual LINE postback selection stores a master ID, and image redelivery saves once with the same ID',async()=>{
 let uploads=0;const replies=[],args={lineBotService:{sendReply:async(_,messages)=>replies.push(...messages),downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic only')})},getStorage:()=>storage,getGoogleDriveService:()=>({uploadImage:async()=>{uploads++;return{id:'SHOP_LINE_IMAGE',webViewLink:'https://drive.google.com/file/d/SHOP_LINE_IMAGE/view'};},deleteFile:async()=>assert.fail('Confirmed upload deleted')}),getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> ''};
 const event=(id,text)=>({type:'message',webhookEventId:id,replyToken:id,source:{userId:'shop-line-user'},message:{id,type:'text',text}});
 assert.equal((await line.processLineWebhook({...args,events:[event('shop-start','create:new-movement')]})).movementFailed,false);
 const buttons=replies.at(-1).quickReply.items,choice=buttons.find(item=>item.action.displayText==='Renamed destination');assert.ok(choice);assert.ok(buttons.every(item=>item.action.displayText!=='Historical destination'));
 const select={type:'postback',webhookEventId:'shop-select',replyToken:'reply-select',source:{userId:'shop-line-user'},postback:{data:choice.action.data}};
 await line.processLineWebhook({...args,events:[select]});await line.processLineWebhook({...args,events:[{...select,replyToken:'changed-reply'}]});
 await line.processLineWebhook({...args,events:[{...select,webhookEventId:'shop-select-late',replyToken:'late-tap'}]});
 const pending=await scalar(`SELECT context FROM stock_operational.user_state WHERE "userId"='shop-line-user' AND "deletedAt" IS NULL`);assert.equal(pending.step,'quantity');assert.equal(pending.quantity,'');
 await line.processLineWebhook({...args,events:[event('shop-quantity','8 preserved note')]});
 const image={...event('shop-photo',''),message:{id:'shop-photo-message',type:'image'}};
 assert.equal((await line.processLineWebhook({...args,events:[image]})).imageCounts().saved,1);
 await line.processLineWebhook({...args,events:[{...image,replyToken:'redelivered'}]});assert.equal(uploads,1);
 const rows=await query(`SELECT d."shopId",d."shopName",d.quantity,d.remark FROM stock_operational.movement_details d JOIN stock_operational.media m ON m.id=d."productImageMediaId" WHERE m."providerFileId"='SHOP_LINE_IMAGE'`);assert.equal(rows.length,1);assert.equal(rows[0].shopId,'SHOP_MAP_A');assert.equal(rows[0].shopName,'Renamed destination');assert.equal(Number(rows[0].quantity),8);assert.match(rows[0].remark,/preserved note/);
 // Stable-ID web edits preserve the destination and original image metadata.
 const detail=await scalar(`SELECT d.id FROM stock_operational.movement_details d JOIN stock_operational.media m ON m.id=d."productImageMediaId" WHERE m."providerFileId"='SHOP_LINE_IMAGE'`);
 await transaction(false,async()=>{const aliases=await inventory.readMovementShopAliases();assert.ok(aliases.some(row=>row.shopId==='SHOP_MAP_A'&&row.label==='NJ'));});
 assert.ok(detail);
});

test('existing native readers can still project every old movement field with the added ID column',async()=>{
 const {NativeRecords}=require('../../src/infrastructure/persistence/postgres/native-records.ts');
 const columns=Object.fromEntries(Object.entries(storage.movementDetails.columns).filter(([name])=>name!=='shopId'));
 const old=new NativeRecords('movement_details',columns);
 await transaction(false,async()=>{
  const previous=await old.all(),current=await storage.movementDetails.all();assert.equal(previous.length,current.length);
  assert.deepEqual(current.map(row=>Object.fromEntries(Object.entries(row).filter(([name])=>name!=='shopId'))),previous);
 });
});
