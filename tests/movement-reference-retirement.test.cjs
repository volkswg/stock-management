/* eslint-disable @typescript-eslint/no-require-imports -- Actual current feature owners with fake SQL, no credentials/providers. */
require('./helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const db=require('../src/infrastructure/persistence/postgres/database.ts');
const {inventoryTables}=require('../src/modules/inventory/infrastructure/postgres/tables.ts');
const {createMovementStore}=require('../src/modules/inventory/infrastructure/postgres/movements.ts');
const {createMovementJourneyAdapter}=require('../src/modules/inventory/infrastructure/postgres/movement-journeys.ts');
const record={id:'MD',movementMasterId:'M',shopName:'NJ',quantity:'3',remark:'note',fromLocation:'Home',toLocation:'NJ',productImageUrl:'',status:'created',createdAt:'',updatedAt:'',stockCounted:false,isNewArrival:false};
test('current movement SQL never selects or writes the retired relationship',async()=>{
 const queries=[],client={query:async(sql,values)=>{queries.push({sql,values});if(sql.includes('soft_delete_contract_v1'))return {rowCount:1,rows:[{deletion:'deletedAt',media:'id-only',mapping:'typed'}]};return {rowCount:1,rows:[{...record,__id:'MD',__revision:'1',revision:'2'}]};}};
 db.currentTransaction=()=>client;db.requireMutation=()=>client;
 const {movementDetails}=inventoryTables();assert.equal(Object.hasOwn(movementDetails.columns,'purchaseDetailId'),false);
 await movementDetails.prepare();const row=await movementDetails.find('MD');await movementDetails.insert(record);await movementDetails.update(row,{quantity:'4',remark:'edited'});
 assert.ok(queries.some(q=>q.sql.startsWith('SELECT t.')));assert.ok(queries.some(q=>q.sql.startsWith('INSERT')));assert.ok(queries.some(q=>q.sql.startsWith('UPDATE')));
 assert.ok(queries.every(q=>!q.sql.includes('purchaseDetailId')));
 await assert.rejects(movementDetails.update(row,{purchaseDetailId:'1'}),e=>e.status===409);
});
test('public movement response omits the retired field without reading the removed column',async()=>{
 const row={...record};Object.defineProperty(row,'purchaseDetailId',{get(){assert.fail('Retired database field read');}});
 const store=createMovementStore({movementDetails:{all:async()=>[row]}}),result=(await store.readDetails()).records()[0];
 assert.equal(Object.hasOwn(result,'purchaseDetailId'),false);assert.equal(result.quantity,'3');assert.equal(result.remark,'note');
});
test('LINE movement journey reads and inserts omit the internal retired field',async()=>{
 const saved=[];const adapter=createMovementJourneyAdapter({movementDetails:{all:async()=>[{...record}],select:async(_sql,values)=>[record].filter(row=>row.movementMasterId===values[0]),insert:async value=>saved.push(value)}});
 const rows=await adapter.store.readItems('M');assert.equal(rows.length,1);assert.equal(Object.hasOwn(rows[0],'purchaseDetailId'),false);
 await adapter.store.appendItem(()=>({id:'MD2',masterId:'M',shop:'NJ',quantity:'5',remark:'new',fromLocation:'Home',toLocation:'NJ',imageUrl:'',status:'created',createdAt:'',updatedAt:'',stockCounted:false,isNewArrival:false}));
 assert.equal(Object.hasOwn(saved[0],'purchaseDetailId'),false);assert.equal(saved[0].quantity,'5');
});
test('operator-only removal/inverse are reproducible and fail closed before dropping anything',()=>{
 const names=fs.readdirSync('tools/migration/operator').filter(n=>/^\d+_retire_movement_purchase_reference.sql$/.test(n));assert.equal(names.length,1);
 for(const [mode,name] of [['forward',names[0]],['inverse','rollback_movement_purchase_reference.sql']]){
  const sql=cp.execFileSync('python3',['tools/migration/movement-reference-retirement.py',mode],{encoding:'utf8'});assert.equal(sql,fs.readFileSync('tools/migration/operator/'+name,'utf8'));
  assert.match(sql,/movement_reference_revision/);assert.match(sql,/business-and-config-v1/);assert.match(sql,/expected_isolation_id/);assert.match(sql,/pg_advisory_xact_lock/);
  assert.doesNotMatch(sql,/CASCADE|SECURITY DEFINER|DISABLE TRIGGER|ALTER TABLE stock_migration|ALTER SEQUENCE|setval\(/);
 }
 assert.equal(fs.existsSync('supabase/migrations/'+names[0]),false);
 const sql=fs.readFileSync('tools/migration/operator/'+names[0],'utf8');assert.ok(sql.indexOf('"purchaseDetailId" IS NOT NULL')<sql.indexOf('DROP CONSTRAINT'));assert.match(sql,/pg_depend/);assert.match(sql,/Movement purchase reference is retired/);assert.match(sql,/DROP COLUMN "purchaseDetailId" RESTRICT/);
});
