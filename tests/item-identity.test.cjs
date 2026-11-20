/* eslint-disable @typescript-eslint/no-require-imports -- Current transport and feature owners with synthetic boundaries. */
require('./helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const db=require('../src/infrastructure/persistence/postgres/database.ts');
// Four old coupled-reference witnesses exercise the exact pre-cleanup transport.
// The retired relationship has no current feature-map consumer. Item creation
// and operator reproducibility below still execute current physical owners.
const vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const prior=JSON.parse(fs.readFileSync('tests/fixtures/safe-compatibility-cleanup-before.json')).edits['src/infrastructure/persistence/postgres/native-records.ts'];
assert.equal(crypto.createHash('sha256').update(prior.before).digest('hex'),prior.beforeSha256);
const priorExports={};
new vm.Script(ts.transpileModule(prior.before,{fileName:'native-records.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({exports:priorExports,require:name=>{if(name==='server-only')return {};assert.equal(name,'./database');return db;}});
const {NativeRecords}=priorExports;
const {createOrderAttachmentStore}=require('../src/modules/orders/infrastructure/postgres/order-attachments.ts');
const {createOrderItem}=require('../src/modules/orders/application/order-attachments.ts');
let client,type,identity,queries;
function nextTransaction(){client={query:async(sql,values)=>{
 queries.push({sql,values});
 if(sql.includes('soft_delete_contract_v1()'))return {rowCount:1,rows:[{deletion:'deletedAt',media:'id-only',mapping:'typed'}]};
 if(sql.includes('pg_attribute'))return {rowCount:1,rows:[{type,identity}]};
 return {rowCount:1,rows:[{__id:'MD-SYNTHETIC',__revision:'1',id:'MD-SYNTHETIC',purchaseDetailId:'2',revision:'2'}]};
}};db.currentTransaction=()=>client;db.requireMutation=()=>client;}
test.beforeEach(()=>{type='bigint';identity='';queries=[];nextTransaction();});
const references=()=>new NativeRecords('movement_details',{id:{column:'id',kind:'text'},purchaseDetailId:{column:'purchaseDetailId',kind:'identity-reference'}});
test('actual item creation reserves a string ID without JavaScript precision loss',async()=>{
 const inserted=[];let allocated=0;const storage={orderItems:{reserveIdentifier:async()=>{allocated++;return '9007199254740993';},insert:async value=>inserted.push(value)}};
 const item=await createOrderItem({store:createOrderAttachmentStore(storage),orderId:'ORDER-SYNTHETIC',imageUrl:'https://example.invalid/image',createdBy:'synthetic',runtime:{now:()=> '2026-11-20T00:00:00Z'}});
 assert.equal(item.id,'9007199254740993');assert.equal(inserted[0].id,item.id);assert.equal(allocated,1);
});
test('historical text references retain their original binds and nullable/blank behavior',async()=>{
 type='text';const t=references();for(const value of ['2','01','',null]){await t.insert({id:'MD-SYNTHETIC',purchaseDetailId:value});assert.doesNotMatch(queries.at(-1).sql,/::bigint/);assert.equal(queries.at(-1).values[1],value);}
 assert.equal(queries.filter(q=>q.sql.includes('pg_attribute')).length,1);
});
test('historical bigint references use explicit casts but project the existing string API field',async()=>{
 const t=references();await t.insert({id:'MD-SYNTHETIC',purchaseDetailId:'9007199254740993'});assert.match(queries.at(-1).sql,/nullif\(\$2::text,''\)::bigint/);assert.equal(queries.at(-1).values[1],'9007199254740993');
 for(const value of ['',null])await t.insert({id:'MD-SYNTHETIC',purchaseDetailId:value});
 const row=await t.find('MD-SYNTHETIC');assert.equal(row.purchaseDetailId,'2');await t.update(row,{purchaseDetailId:'9007199254740994'});assert.match(queries.at(-1).sql,/nullif\(\$1::text,''\)::bigint/);assert.equal(queries.at(-1).values[0],'9007199254740994');
 assert.ok(queries.some(q=>q.sql.includes('t."purchaseDetailId"::text')));
});
test('historical aliases, overflow and unsafe numeric references reject before any mutation query',async()=>{
 const t=references();for(const value of ['01','+1','-1','1.0','1e0','0x1','9223372036854775808',9007199254740992])await assert.rejects(t.insert({id:'MD-SYNTHETIC',purchaseDetailId:value}),e=>e.status===409);
 assert.equal(queries.filter(q=>q.sql.startsWith('INSERT')).length,0);
});
test('historical reference layouts are scoped to transactions and unsupported/identity references fail closed',async()=>{
 const t=references();type='text';await t.insert({id:'MD-SYNTHETIC',purchaseDetailId:'2'});type='bigint';nextTransaction();await t.insert({id:'MD-SYNTHETIC',purchaseDetailId:'2'});assert.match(queries.at(-1).sql,/::bigint/);assert.equal(queries.filter(q=>q.sql.includes('pg_attribute')).length,2);
 for(const layout of [['integer',''],['numeric',''],['uuid',''],['bigint','d']]){[type,identity]=layout;nextTransaction();await assert.rejects(references().prepare(),e=>e.status===503);}
});
test('coupled operator SQL is reproducible, gated, outside discovery, and preserves earlier identities',()=>{
 const names=fs.readdirSync('tools/migration/operator').filter(n=>/^\d+_order_item_identity.sql$/.test(n));assert.equal(names.length,1);
 for(const [mode,file] of [['forward',names[0]],['inverse','rollback_order_item_identity.sql']]){
  const sql=cp.execFileSync('python3',['tools/migration/order-item-identity.py',mode],{encoding:'utf8'});assert.equal(sql,fs.readFileSync('tools/migration/operator/'+file,'utf8'));assert.match(sql,/item_identity_revision/);assert.match(sql,/business-and-config-v1/);assert.match(sql,/LOCK TABLE stock_operational.order_items,stock_operational.movement_details/);
  assert.equal((sql.match(/DROP CONSTRAINT "movement_details_purchaseDetailId_fkey"/g)||[]).length,1);assert.equal((sql.match(/ADD CONSTRAINT "movement_details_purchaseDetailId_fkey"/g)||[]).length,1);assert.doesNotMatch(sql,/CASCADE|SECURITY DEFINER|DISABLE TRIGGER|ALTER TABLE stock_operational.(order_bills|user_state)/);
 }
 assert.equal(fs.existsSync('supabase/migrations/'+names[0]),false);
});
