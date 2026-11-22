/* eslint-disable @typescript-eslint/no-require-imports -- Actual current owners, isolated synthetic PostgreSQL and fake providers only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts'),inventory=require('../../src/modules/inventory/server.ts');
global.fetch=()=>{throw Error('Providers forbidden in movement-reference retirement acceptance');};
const url=new URL(process.env.STOCK_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
const filename=fs.readdirSync('tools/migration/operator').find(n=>/^\d+_retire_movement_purchase_reference.sql$/.test(n));assert.ok(filename);
const forward=fs.readFileSync('tools/migration/operator/'+filename,'utf8'),inverse=fs.readFileSync('tools/migration/operator/rollback_movement_purchase_reference.sql','utf8');
const scalar=async(sql,params)=>(await owner.query(sql,params)).rows[0].value;
const command=run=>executeCommand('retired-movement-reference',randomUUID(),hashIntent(randomUUID()),run);
const retired=r=>r.schemaname==='stock_operational'&&r.tablename==='movement_details'||r.nspname==='stock_operational'&&r.relname==='movement_details';
async function fingerprint(){
 const tables=(await owner.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('stock_operational','stock_migration','stock_configuration') ORDER BY 1,2")).rows,result=[];
 for(const {schemaname,tablename} of tables){const value=schemaname==='stock_operational'&&tablename==='movement_details'?"to_jsonb(t)-'purchaseDetailId'":'to_jsonb(t)';result.push([schemaname,tablename,(await owner.query(`SELECT ${value} value FROM "${schemaname}"."${tablename}" t ORDER BY (${value})::text COLLATE "C"`)).rows]);}
 return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}
const metadataSql=cp.execFileSync('python3',['-c',"import sys;sys.path.insert(0,'tools/migration');import recovery;print('\\n'.join(s for s in recovery.fingerprint_sql(include_media=True).splitlines() if \"'metadata'\" in s))"],{encoding:'utf8'});
async function metadata(){const results=await owner.query(metadataSql);return Object.fromEntries(results.flatMap(r=>r.rows).map(r=>{const v=Object.values(r)[0];return [v.metadata,v.value];}));}
async function sequences(){return (await owner.query("SELECT 'bills' name,last_value::text value,is_called FROM stock_operational.order_bills_id_seq UNION ALL SELECT 'sessions',last_value::text,is_called FROM stock_operational.user_state_id_seq UNION ALL SELECT 'items',last_value::text,is_called FROM stock_operational.order_items_id_seq ORDER BY name")).rows;}
async function gates(kind='removal'){
 const shared={expected_isolation_id:process.env.STOCK_TARGET_ISOLATION_ID,expected_purpose:'isolated-staging'},revision=await scalar('SELECT value::text value FROM stock_operational.revision');
 const values=kind==='removal'?{...shared,allow_movement_reference_retirement:'reviewed-null-movement-reference-v1',allow_movement_reference_inverse:'reviewed-null-movement-reference-v1',movement_reference_restore_verified:'business-and-config-v1',movement_reference_source:'1'.repeat(40),movement_reference_fingerprint:await fingerprint(),movement_reference_revision:revision}: {...shared,['allow_'+kind+'_identity_conversion']:'reviewed-'+({bill:'order-bill',user_state:'user-state',item:'order-item'}[kind])+'-bigint-v1',[kind+'_identity_restore_verified']:'business-and-config-v1',[kind+'_identity_source']:'1'.repeat(40),[kind+'_identity_fingerprint']:await fingerprint(),[kind+'_identity_revision']:revision};
 for(const [key,value] of Object.entries(values))await owner.query('SELECT set_config($1,$2,false)',['stock.'+key,value]);
}
async function refused(sql,client=owner){try{await assert.rejects(client.query(sql));}finally{await client.query('ROLLBACK');}}
async function views(){
 const out=[];for(const [path,handler,context] of [['/api/movements',require('../../src/app/api/movements/route.ts').GET],['/api/movements/REF_MOVE',require('../../src/app/api/movements/[id]/route.ts').GET,{params:Promise.resolve({id:'REF_MOVE'})}],['/api/orders/REF_PARENT',require('../../src/app/api/orders/[id]/route.ts').GET,{params:Promise.resolve({id:'REF_PARENT'})}]]){
  const response=await handler(new Request('https://example.test'+path,{headers:{Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN}}),context);assert.equal(response.status,200,path);
  out.push({path,body:await response.json(),revision:response.headers.get('x-stock-revision'),edit:response.headers.get('x-stock-edit-revision'),scope:response.headers.get('x-stock-edit-scope')});
 }return out;
}
let loseCommit=false;const originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.then?result.then(value=>{if(args[0]==='COMMIT'&&loseCommit){loseCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return value;}):result;};
test.before(async()=>{
 await owner.connect();await owner.query("DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN CREATE ROLE stock_prod_backup NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_reader') THEN CREATE ROLE stock_prod_reader NOLOGIN; END IF; END$$;");
 await owner.query('GRANT USAGE ON SCHEMA stock_operational,stock_migration TO stock_prod_backup; GRANT SELECT ON ALL TABLES IN SCHEMA stock_operational,stock_migration TO stock_prod_backup;');if(!await scalar("SELECT to_regclass('stock_configuration.loyverse_accounts')::text value"))await owner.query(fs.readFileSync('supabase/migrations/20261119082351_private_loyverse_accounts.sql','utf8'));
 await owner.query('UPDATE stock_operational.movement_details SET "purchaseDetailId"=NULL WHERE "purchaseDetailId" IS NOT NULL; DELETE FROM stock_operational.order_items; DELETE FROM stock_operational.order_bills; DELETE FROM stock_operational.user_state;');
 await owner.query("INSERT INTO stock_operational.orders(id,status) VALUES('REF_PARENT','draft'); INSERT INTO stock_operational.order_items(id,\"orderId\") VALUES('999999','REF_PARENT'); INSERT INTO stock_operational.movements(id) VALUES('REF_MOVE'); INSERT INTO stock_operational.movement_details(id,\"movementMasterId\",quantity,remark) VALUES('REF_DETAIL','REF_MOVE',3,'original');");
 for(const [kind,name] of [['bill','20261120022134_order_bill_identity.sql'],['user_state','20261120065046_user_state_identity.sql'],['item','20261120082124_order_item_identity.sql']]){const table={bill:'order_bills',user_state:'user_state',item:'order_items'}[kind];const identity=await scalar("SELECT attidentity value FROM pg_attribute WHERE attrelid=$1::regclass AND attname='id' AND NOT attisdropped",['stock_operational.'+table]);if(identity!=='d'){await gates(kind);await owner.query(fs.readFileSync('tools/migration/operator/'+name,'utf8'));}}
});
test.after(async()=>{await db.closePool();await owner.end();});
test('unused movement reference retires safely with identical browser/LINE behavior and recoverable identities',async t=>{
 await t.test('current app reads and writes work with retained column; response omits the retired field',async()=>{
  await command(()=>inventory.appendMovementJourneyItem(storage,()=>({id:'REF_COMPAT',masterId:'REF_MOVE',shop:'NJ',quantity:'2',remark:'retained',fromLocation:'Home',toLocation:'NJ',imageUrl:'',status:'created',createdAt:'2026-11-20T00:00:00Z',updatedAt:'',stockCounted:false,isNewArrival:false})));
  assert.equal(await scalar("SELECT \"purchaseDetailId\" value FROM stock_operational.movement_details WHERE id='REF_COMPAT'"),null);
  const result=await views();const rows=result.find(r=>r.path==='/api/movements/REF_MOVE').body.records;assert.ok(rows.length);assert.ok(rows.every(row=>!Object.hasOwn(row,'purchaseDetailId')));
 });
 await t.test('unapproved/stale/wrong target and populated active or deleted references refuse',async()=>{
  await refused(forward);await gates();await owner.query("SET stock.movement_reference_revision='-1'");await refused(forward);await gates();await owner.query("SET stock.expected_isolation_id='00000000-0000-0000-0000-000000000000'");await refused(forward);
  await owner.query('UPDATE stock_operational.movement_details SET "purchaseDetailId"=999999 WHERE id=$1',['REF_DETAIL']);await gates();await refused(forward);await owner.query('UPDATE stock_operational.movement_details SET "purchaseDetailId"=NULL WHERE id=$1',['REF_DETAIL']);
  await owner.query("INSERT INTO stock_operational.movement_details(id,\"movementMasterId\",\"purchaseDetailId\",\"deletedAt\") VALUES('REF_DELETED','REF_MOVE',999999,'2026-11-20T00:00:00Z')");await gates();await refused(forward);await owner.query("DELETE FROM stock_operational.movement_details WHERE id='REF_DELETED'");
 });
 await t.test('unknown views, SQL functions, indexes, CHECKs, comments and defaults refuse',async()=>{
  for(const [create,drop] of [
   ['CREATE TABLE public.ref_child () INHERITS(stock_operational.movement_details)','DROP TABLE public.ref_child'],
   ['CREATE VIEW public.ref_dependency AS SELECT "purchaseDetailId" FROM stock_operational.movement_details','DROP VIEW public.ref_dependency'],
   ['CREATE FUNCTION public.ref_dependency(r stock_operational.movement_details) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN RETURN r."purchaseDetailId"; END$$','DROP FUNCTION public.ref_dependency(stock_operational.movement_details)'],
   ['CREATE INDEX ref_dependency ON stock_operational.movement_details("purchaseDetailId")','DROP INDEX stock_operational.ref_dependency'],
   ['ALTER TABLE stock_operational.movement_details ADD CONSTRAINT ref_dependency CHECK("purchaseDetailId" IS NULL)','ALTER TABLE stock_operational.movement_details DROP CONSTRAINT ref_dependency'],
   ['COMMENT ON COLUMN stock_operational.movement_details."purchaseDetailId" IS \'external reference\'','COMMENT ON COLUMN stock_operational.movement_details."purchaseDetailId" IS NULL'],
   ['ALTER TABLE stock_operational.movement_details ALTER COLUMN "purchaseDetailId" SET DEFAULT 999999','ALTER TABLE stock_operational.movement_details ALTER COLUMN "purchaseDetailId" DROP DEFAULT'],
  ]){await owner.query(create);await gates();await refused(forward);await owner.query(drop);}
 });
 const original=await fingerprint(),beforeMeta=await metadata(),beforeSequences=await sequences(),beforeViews=await views();
 await t.test('read-only/limited owners and late transaction failures cannot partially retire the field',async()=>{
  await gates();await owner.query('SET default_transaction_read_only=on');await refused(forward);await owner.query('SET default_transaction_read_only=off');
  const limited=new Client({connectionString:process.env.STOCK_DATABASE_URL});await limited.connect();try{await refused(forward,limited);}finally{await limited.end();}
  await gates();await refused(forward.replace('COMMIT;','SELECT 1/0; COMMIT;'));assert.equal(await fingerprint(),original);assert.deepEqual(await metadata(),beforeMeta);assert.deepEqual(await sequences(),beforeSequences);
 });
 await gates();await owner.query(forward);
 await t.test('only the reviewed column/FK/index and three function bodies change; all records and sequences remain',async()=>{
  assert.equal(await fingerprint(),original);assert.deepEqual(await sequences(),beforeSequences);assert.deepEqual(await views(),beforeViews);
  const actual=await metadata(),expected=structuredClone(beforeMeta);
  expected.columns=expected.columns.filter(r=>!(retired(r)&&r.attname==='purchaseDetailId'));
  expected.constraints=expected.constraints.filter(r=>!(r.relation==='stock_operational.movement_details'&&r.conname==='movement_details_purchaseDetailId_fkey'));
  expected.indexes=expected.indexes.filter(r=>!(retired(r)&&r.indexname==='movement_details_purchaseDetailId_idx'));
  const bodies=JSON.parse(cp.execFileSync('python3',['-c',"import json,runpy;m=runpy.run_path('tools/migration/movement-reference-retirement.py');print(json.dumps({s.split('(')[0]:[a,b] for (s,a),(_,b) in zip(m['BEFORE_FUNCTIONS'],m['AFTER_FUNCTIONS'])}))"],{encoding:'utf8'}));
  for(const fn of expected.functions)if(fn.nspname==='stock_operational'&&bodies[fn.proname]){const [before,after]=bodies[fn.proname];assert.equal(fn.definition.split(before).length,2);fn.definition=fn.definition.replace(before,after);}
  assert.deepEqual(actual,expected);assert.equal(await scalar("SELECT format_type(atttypid,atttypmod) value FROM pg_attribute WHERE attrelid='stock_migration.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped"),'text');
 });
 await t.test('retained owner-only mappings keep the blank ninth wire slot and reject hidden reference values',async()=>{
  const projected=await scalar("SELECT stock_operational.typed_project_movement_details(t) value FROM stock_operational.movement_details t WHERE id='REF_DETAIL'");assert.equal(projected.length,14);assert.equal(projected[8],'');assert.equal(projected[3],'3');
  const cells=['MAPPING_ID','REF_MOVE','NJ','7','note','Home','NJ','','','created','','',false,false];
  assert.equal(await scalar('SELECT (stock_operational.typed_input_movement_details($1::jsonb)).quantity::text value',[JSON.stringify(cells)]),'7');cells[8]='999999';await assert.rejects(owner.query('SELECT stock_operational.typed_input_movement_details($1::jsonb)',[JSON.stringify(cells)]));
 });
 await t.test('logical inverse restores NULL bigint/FK/index and prior functions; only restored attnum moves',async()=>{
  await owner.query(inverse);assert.equal(await fingerprint(),original);assert.deepEqual(await views(),beforeViews);assert.deepEqual(await sequences(),beforeSequences);
  const expected=structuredClone(beforeMeta),col=expected.columns.find(r=>retired(r)&&r.attname==='purchaseDetailId');const max=Math.max(...expected.columns.filter(retired).map(r=>r.attnum));expected.columns=expected.columns.filter(r=>r!==col);col.attnum=max+1;const last=expected.columns.findLastIndex(retired);expected.columns.splice(last+1,0,col);
  assert.deepEqual(await metadata(),expected);assert.equal(await scalar('SELECT count(*)::int value FROM stock_operational.movement_details WHERE "purchaseDetailId" IS NOT NULL'),0);await owner.query(forward);assert.deepEqual(await views(),beforeViews);
 });
 await t.test('movement edits keep quantities/remarks, reject stale handles, and lost COMMIT retries execute once',async()=>{
  const key=randomUUID(),intent=hashIntent({movement:'REF_DETAIL'});let executions=0;
  const run=()=>executeCommand('REF_RETRY',key,intent,async()=>{executions++;const row=await storage.movementDetails.find('REF_DETAIL'),stale=await storage.movementDetails.find('REF_DETAIL');await storage.movementDetails.update(row,{quantity:'8',remark:'after removal'});await assert.rejects(storage.movementDetails.update(stale,{remark:'lost edit'}),e=>e.status===409);return {id:row.id,quantity:'8',remark:'after removal'};});
  loseCommit=true;await assert.rejects(run());const saved=await run();assert.deepEqual(await run(),saved);assert.equal(executions,1);await assert.rejects(executeCommand('REF_RETRY',key,hashIntent('changed'),async()=>{}),e=>e.status===409);
  await db.transaction(false,async()=>{const row=await storage.movementDetails.find('REF_DETAIL');assert.equal(row.quantity,'8');assert.equal(row.remark,'after removal');assert.equal(Object.hasOwn(row,'purchaseDetailId'),false);});
 });
 await t.test('actual browser PATCH preserves response fields, exact retry and same-record conflict guards',async()=>{
  const path='/api/movements/REF_MOVE/items/REF_DETAIL',context={params:Promise.resolve({id:'REF_MOVE',itemId:'REF_DETAIL'})};
  const auth={Authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN},detail=require('../../src/app/api/movements/[id]/route.ts').GET,patch=require('../../src/app/api/movements/[id]/items/[itemId]/route.ts').PATCH;
  const current=await detail(new Request('https://example.test/api/movements/REF_MOVE',{headers:auth}),{params:Promise.resolve({id:'REF_MOVE'})});assert.equal(current.status,200);
  const key=randomUUID(),headers={...auth,'content-type':'application/json','Idempotency-Key':key,'x-stock-edit-scope':current.headers.get('x-stock-edit-scope'),'If-Match':current.headers.get('x-stock-edit-revision')};
  const request=(body,h=headers)=>new Request('https://example.test'+path,{method:'PATCH',headers:h,body:JSON.stringify(body)});
  const body={quantity:'9',remark:'HTTP after removal'},first=await patch(request(body),context);assert.equal(first.status,200);const result=await first.json();assert.equal(result.record.quantity,'9');assert.equal(result.record.remark,body.remark);assert.equal(Object.hasOwn(result.record,'purchaseDetailId'),false);assert.ok(result.records.every(row=>!Object.hasOwn(row,'purchaseDetailId')));
  const retry=await patch(request(body),context);assert.equal(retry.status,200);assert.deepEqual(await retry.json(),result);
  assert.equal((await patch(request({...body,quantity:'10'}),context)).status,409);
  const stale=await patch(request({...body,remark:'stale'},{...headers,'Idempotency-Key':randomUUID()}),context);assert.equal(stale.status,409);assert.equal((await stale.json()).code,'stock_revision_conflict');
  const missing={...headers};delete missing['Idempotency-Key'];assert.equal((await patch(request(body,missing),context)).status,428);
 });
 await t.test('order item identities remain precision-safe and later writes invalidate stale inverse approvals',async()=>{
  const item=await command(()=>orders.createOrderItem({storage,orderId:'REF_PARENT',imageUrl:'https://example.invalid/item',createdBy:'synthetic'}));assert.equal(typeof item.id,'string');assert.ok(BigInt(item.id)>999999n);
  await refused(inverse);assert.equal(await scalar("SELECT count(*)::int value FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped"),0);
 });
});
