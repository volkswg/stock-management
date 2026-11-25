/* eslint-disable @typescript-eslint/no-require-imports -- Actual TypeScript transport with a closed synthetic SQL boundary. */
require('./helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const db=require('../src/infrastructure/persistence/postgres/database.ts');
const {NativeRecords}=require('../src/infrastructure/persistence/postgres/native-records.ts');
test.describe('order bill identity',()=>{
let type,identity,sequence,client,queries,next;
test.beforeEach(()=>{
 type='bigint';identity='d';sequence='stock_operational.order_bills_id_seq';next=100n;queries=[];
 client={query:async(sql,values)=>{
  queries.push({sql,values});
  if(sql.includes('soft_delete_contract_v1()'))return {rowCount:1,rows:[{deletion:'deletedAt',media:'id-only',mapping:'typed'}]};
  if(sql.includes('pg_attribute'))return {rowCount:1,rows:[{type,identity,sequence}]};
  if(sql.includes('nextval('))return {rowCount:1,rows:[{id:String(next++)}]};
  if(sql.includes('greatest('))return {rowCount:1,rows:[{next:'100'}]};
  return {rowCount:1,rows:[{__id:'2',__revision:'1',id:'2',revision:'2'}]};
 }};
 db.currentTransaction=()=>client;db.requireMutation=()=>client;
});
const table=()=>new NativeRecords('order_bills',{id:{column:'id',kind:'text'}},'id',true);
test('bigint reservation uses the owned sequence and preserves values beyond JavaScript number precision',async()=>{
 next=9007199254740993n;const t=table();assert.equal(await t.reserveIdentifier(),'9007199254740993');assert.equal(await t.reserveIdentifier(),'9007199254740994');
 assert.equal(queries.filter(q=>q.sql.includes('pg_attribute')).length,1);assert.equal(queries.filter(q=>q.sql.includes('nextval(')).length,2);assert.ok(!queries.some(q=>q.sql.includes('max(')));
 await assert.rejects(t.identifierSequence(),e=>e.status===503);
});
test('the current text layout retains the existing shared MAX allocation during compatibility deployment',async()=>{
 type='text';identity='';sequence=null;const t=table();assert.equal(await t.reserveIdentifier(),'100');assert.equal(await table().reserveIdentifier(),'101');assert.ok(!queries.some(q=>q.sql.includes('nextval(')));
});
test('numeric lookup preserves canonical string identity and the existing text tie-break',async()=>{
 const t=table();for(const value of ['01','+1','-1','1.0','1e0','0x1','', '9223372036854775808'])assert.equal(await t.find(value),undefined);
 assert.equal(queries.filter(q=>q.sql.includes('WHERE t.')).length,0);
 await t.find('2');assert.match(queries.at(-1).sql,/id"=\$1::text::bigint/);assert.deepEqual(queries.at(-1).values,['2']);
 await t.all();assert.match(queries.at(-1).sql,/::text COLLATE "C" ASC/);
});
test('bigint writes accept only canonical strings and keep stale/immutable-handle checks',async()=>{
 const t=table();await assert.rejects(t.insert({id:'01'}),e=>e.status===409);await t.insert({id:'9007199254740993'});assert.match(queries.at(-1).sql,/\$1::text::bigint/);assert.equal(queries.at(-1).values[0],'9007199254740993');
 const record=await t.find('2');await assert.rejects(t.update(record,{id:'3'}),e=>e.status===409);await t.softDelete(record);assert.match(queries.at(-1).sql,/id"=\$1::text::bigint AND revision=\$2/);
});
test('unexpected identity/type layouts fail closed',async()=>{
 for(const layout of [['integer','d',sequence],['bigint','a',sequence],['bigint','',null],['text','d',sequence]]){
  [type,identity,sequence]=layout;client={...client};await assert.rejects(table().reserveIdentifier(),e=>e.status===503);
 }
});
test('operator SQL is reproducible, gated, outside automatic migrations, and has a schema-only inverse',()=>{
 for(const [mode,file] of [['forward','20261120022134_order_bill_identity.sql'],['inverse','rollback_order_bill_identity.sql']]){
  const sql=cp.execFileSync('python3',['tools/migration/order-bill-identity.py',mode],{encoding:'utf8'});assert.equal(sql,fs.readFileSync('tools/migration/operator/'+file,'utf8'));assert.match(sql,/bill_identity_revision/);assert.match(sql,/business-and-config-v1/);assert.doesNotMatch(sql,/CASCADE|SECURITY DEFINER|DISABLE TRIGGER/);
 }
 assert.equal(fs.existsSync('supabase/migrations/20261120022134_order_bill_identity.sql'),false);
});
});
