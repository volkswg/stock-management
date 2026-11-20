/* eslint-disable @typescript-eslint/no-require-imports -- Current LINE owners with synthetic session stores and no providers. */
require('./helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {createSessionAdapter}=require('../src/modules/line-workflows/infrastructure/postgres/sessions.ts');
const {saveMovementState,readMovementSession}=require('../src/modules/line-workflows/application/sessions.ts');
const {MOVEMENT_FLOW}=require('../src/modules/line-workflows/contracts.ts');
function fixture(){
 const records=[],writes=[],erased=[];let reservations=0;
 const table={all:async()=>records,reserveIdentifier:async()=>{reservations++;await Promise.resolve();return String(9007199254740992n+BigInt(reservations));},insert:async value=>writes.push(value),update:async(record,value)=>writes.push({...value,id:record.id}),softDelete:async record=>erased.push(record.id)};
 const adapter=createSessionAdapter({userState:table},{itemSnapshot:async()=>({items:()=>[]})});
 return {records,writes,erased,adapter,reservations:()=>reservations};
}
const state={masterId:'MOVE-SYNTHETIC',itemId:'MOVED-SYNTHETIC',userId:'synthetic',step:'quantity',startedAt:'2026-11-20T00:00:00.000Z',shop:'NJ',quantity:'3',remark:'note',imageUrl:'',lastEventId:'event-1'};
const runtime={now:()=> '2026-11-20T01:00:00.000Z'};
test('read-only session and photo snapshots never allocate an identity',async()=>{
 const f=fixture();await f.adapter.movements.read();await f.adapter.photoContext();assert.deepEqual(await readMovementSession(f.adapter.movements,'synthetic','event-1'),{processed:false});assert.equal(f.reservations(),0);
});
test('new movement state awaits one precision-safe identity and preserves its exact context',async()=>{
 const f=fixture();await saveMovementState(f.adapter.movements,state,runtime);assert.equal(f.reservations(),1);assert.equal(f.writes[0].id,'9007199254740993');assert.deepEqual(JSON.parse(f.writes[0].context),state);assert.equal(f.writes[0].createdAt,state.startedAt);
});
test('updating or completing an existing movement retains its ID without reserving another',async()=>{
 const f=fixture();f.records.push({id:'7',flowname:MOVEMENT_FLOW,userId:state.userId,referenceId:state.masterId,state:state.step,createdAt:state.startedAt,context:JSON.stringify(state)});
 assert.equal((await readMovementSession(f.adapter.movements,state.userId,state.lastEventId)).processed,true);
 await saveMovementState(f.adapter.movements,{...state,quantity:'4'},runtime);assert.equal(f.writes[0].id,'7');assert.equal(f.reservations(),0);
 await saveMovementState(f.adapter.movements,{...state,step:'complete'},runtime);assert.deepEqual(f.erased,['7']);assert.equal(f.reservations(),0);
});
test('order and movement allocations share the database allocator and keep string precision',async()=>{
 const f=fixture();assert.equal(await f.adapter.orders.nextIdentifier(),'9007199254740993');const snapshot=await f.adapter.movements.read();assert.equal(await snapshot.nextIdentifier(),'9007199254740994');assert.equal(f.reservations(),2);
});
test('operator SQL is reproducible, gated, outside discovery, and preserves order-bill identity',()=>{
 for(const [mode,file] of [['forward','20261120065046_user_state_identity.sql'],['inverse','rollback_user_state_identity.sql']]){
  const sql=cp.execFileSync('python3',['tools/migration/user-state-identity.py',mode],{encoding:'utf8'});assert.equal(sql,fs.readFileSync('tools/migration/operator/'+file,'utf8'));assert.match(sql,/user_state_identity_revision/);assert.match(sql,/business-and-config-v1/);assert.doesNotMatch(sql,/CASCADE|SECURITY DEFINER|DISABLE TRIGGER|ALTER TABLE stock_operational.order_bills/);
 }
 assert.equal(fs.existsSync('supabase/migrations/20261120065046_user_state_identity.sql'),false);
});
