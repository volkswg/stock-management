/* eslint-disable @typescript-eslint/no-require-imports -- Actual native owners and real local PostgreSQL; no source overlays. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const driverQuery=Client.prototype.query;
Client.prototype.query=function(...args){
 const result=driverQuery.apply(this,args);
 return result?.catch?result.catch(error=>{console.error('Synthetic native SQL:',error.code,error.message);throw error;}):result;
};
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
global.fetch=()=>{throw Error('Providers forbidden in native acceptance');};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const url=new URL(process.env.STOCK_DATABASE_URL);url.username='postgres';url.password='';
const owner=new Client({connectionString:url.toString()}),storage=createBusinessDatabase();
const command=run=>executeCommand('native-records',randomUUID(),hashIntent(randomUUID()),run);
test.before(()=>owner.connect());test.after(async()=>{await closePool();await owner.end();});
test('all22 named projections preserve predecessor decimal scale, JSON text, booleans, timestamps and media; six histories remain append-only',async()=>{
 const parents={orderId:['orders','NP_PARENT_ORDER'],shipmentId:['shipments','NP_PARENT_SHIPMENT'],employeeId:['employees','NP_PARENT_EMPLOYEE'],receiptId:['sales_receipts','NP_PARENT_RECEIPT'],movementMasterId:['movements','NP_PARENT_MOVEMENT'],shopId:['shops','NP_PARENT_SHOP'],categoryId:['expense_categories','NP_PARENT_CATEGORY']};
 for(const [table,id] of Object.values(parents))await owner.query(`INSERT INTO stock_operational.${table}(id) VALUES($1)`,[id]);
 let appendOnly=0;
 for(const table of Object.values(storage)){
  const value=Object.fromEntries(Object.entries(table.columns).map(([name,field])=>[name,name==='deletedAt'?'':name==='id'?'NP_'+table.table:parents[name]?parents[name][1]:field.kind==='timestamp'?'2026-11-19T01:02:03.123456Z':field.kind==='numeric'?'9007199254740993.0100':field.kind==='bigint'?'9007199254740993':field.kind==='boolean'?false:field.kind==='jsonb'?' {"ไทย": [false, 1.2300]} ':field.kind==='media'?'https://example.invalid/native-image':name==='name'?'Native':'']));
  await command(()=>table.insert(value)).catch(error=>{console.error("Native table:",table.table);throw error;});
  const key=table.key;const condition=key==='migration_id'?'"employeeId"=$1':'id=$1';const lookup=key==='migration_id'?parents.employeeId[1]:value.id;
  // The independently retained predecessor projector is an owner-only ORACLE,
  // not executable by the tested runtime and not used in application queries.
  const before=(await owner.query(`SELECT "${key}" id,revision::text,stock_operational.typed_project_${table.table}(t) expected FROM stock_operational.${table.table} t WHERE ${condition}`,[lookup])).rows[0];
  assert.ok(before,table.table);
  await transaction(false,async()=>{
   const record=await table.find(before.id);assert.ok(record,table.table);
   // Retained historical projection keeps its empty ninth wire slot.
   const expected=table.table==='movement_details'?before.expected.filter((_,i)=>i!==8):before.expected;
   assert.deepEqual(Object.entries(record).filter(([name]) => !(table.table==='movement_details' && name==='shopId')).map(([,value])=>value),expected,table.table);
   if(table.table==='movement_details')assert.equal(record.shopId,Array.isArray(parents.shopId)?parents.shopId[1]:parents.shopId);
   for(const [name,field] of Object.entries(table.columns))if(field.kind==='numeric')assert.equal(record[name],'9007199254740993.0100',table.table+'.'+name);
  });
  const allowed=(await owner.query('SELECT has_table_privilege($1,$2,$3) allowed',['stock_runtime','stock_operational.'+table.table,'UPDATE'])).rows[0].allowed;
  if(allowed){
   await command(async()=>{
    const record=await table.find(before.id),stale=await table.find(before.id);
    await table.softDelete(record);await assert.rejects(table.softDelete(stale),e=>e.status===409);
   });
  }else{
   appendOnly++;
   await assert.rejects(command(async()=>table.softDelete(await table.find(before.id))));
   await owner.query(`UPDATE stock_operational.${table.table} SET "deletedAt"=now() WHERE "${key}"=$1`,[before.id]);
  }
  await transaction(false,async()=>assert.equal(await table.find(before.id),undefined));
  const after=(await owner.query(`SELECT revision::text,"deletedAt" FROM stock_operational.${table.table} WHERE "${key}"=$1`,[before.id])).rows[0];
  assert.equal(BigInt(after.revision),BigInt(before.revision)+1n);assert.ok(after.deletedAt);
 }
 assert.equal(appendOnly,6);
});
test('stable identities reject stale updates, cross-transaction handles and column injection without losing unrelated precision',async()=>{
 await command(()=>storage.orders.insert({id:'NP_EDIT',status:'complete',totalPrice:'9007199254740993.0100',remark:'before',createdAt:'2026-11-19T00:00:00.123456Z'}));
 let expired;
 await transaction(false,async()=>{expired=await storage.orders.find('NP_EDIT');});
 await assert.rejects(command(()=>storage.orders.update(expired,{remark:'expired'})),e=>e.status===409);
 await command(async()=>{
  const current=await storage.orders.find('NP_EDIT'),stale=await storage.orders.find('NP_EDIT');
  await storage.orders.update(current,{remark:'ไทย'});
  await assert.rejects(storage.orders.update(stale,{remark:'lost'}),e=>e.status===409);
  await assert.rejects(storage.orders.update(current,{'remark"=NULL--':'bad'}),e=>e.status===409);
  await storage.orders.update(current,{seller:'new'});
 });
 await transaction(false,async()=>{
  const record=await storage.orders.find('NP_EDIT');assert.equal(record.remark,'ไทย');assert.equal(record.totalPrice,'9007199254740993.0100');assert.equal(record.createdAt,'2026-11-19T00:00:00.123456Z');
 });
});
test('creation ordering keeps unknown dates last and C IDs ascending even when timestamps tie',async()=>{
 for(const [id,createdAt] of [['NP_SORT_Z','2026-11-19T00:00:00Z'],['NP_SORT_A','2026-11-19T00:00:00Z'],['NP_SORT_NULL','']])await command(()=>storage.orders.insert({id,status:'complete',createdAt}));
 await transaction(false,async()=>{
  const actual=(await storage.orders.all('descending')).filter(r=>String(r.id).startsWith('NP_SORT_')).map(r=>r.id);
  assert.deepEqual(actual,['NP_SORT_A','NP_SORT_Z','NP_SORT_NULL']);
 });
});
test('shared numeric reservations include cleared identities and remain safe across adapter instances',async()=>{
 await command(()=>storage.userState.insert({id:'9999',userId:'native',flowname:'Movement',context:'{}'}));
 await command(async()=>{const record=await storage.userState.find('9999');await storage.userState.softDelete(record);});
 await transaction(false,async()=>{
  const other=createBusinessDatabase();const [a,b]=await Promise.all([storage.userState.nextIdentifier(),other.userState.nextIdentifier()]);assert.deepEqual([a,b],[10000,10001]);
 });
});
test('current runtime cannot execute any legacy mapper and explicit Sheets selection fails closed',async()=>{
 await assert.rejects(transaction(false,()=>currentTransaction().query('SELECT stock_operational.typed_project_orders(t) FROM stock_operational.orders t LIMIT 1')));
 const old=process.env.STOCK_STORAGE;
 try{process.env.STOCK_STORAGE='google-sheets';await assert.rejects(transaction(false,()=>storage.orders.all()),e=>e.status===503);}finally{process.env.STOCK_STORAGE=old;}
});

test('all22 native projections preserve predecessor NULL defaults',async()=>{
 const parents={orderId:'NP_PARENT_ORDER',shipmentId:'NP_PARENT_SHIPMENT',employeeId:'NP_PARENT_EMPLOYEE',receiptId:'NP_PARENT_RECEIPT',movementMasterId:'NP_PARENT_MOVEMENT',shopId:'NP_PARENT_SHOP',categoryId:'NP_PARENT_CATEGORY'};
 for(const table of Object.values(storage)){
  const value=Object.fromEntries(Object.keys(table.columns).map(name=>[name,name==='id'?'NP_NULL_'+table.table:parents[name]||'']));
  await command(()=>table.insert(value));
  const key=table.key,condition=key==='migration_id'?'"employeeId"=$1':'id=$1';
  const row=(await owner.query(`SELECT "${key}" id,stock_operational.typed_project_${table.table}(t) expected FROM stock_operational.${table.table} t WHERE ${condition} AND "deletedAt" IS NULL`,[key==='migration_id'?parents.employeeId:value.id])).rows[0];assert.ok(row,table.table);
  await transaction(false,async()=>{
   const record=await table.find(row.id);assert.ok(record,table.table);assert.deepEqual(Object.entries(record).filter(([name])=>!(table.table==='movement_details'&&name==='shopId')).map(([,value])=>value),table.table==='movement_details'?row.expected.filter((_,i)=>i!==8):row.expected,table.table);if(table.table==='movement_details')assert.equal(record.shopId,parents.shopId);
  });
 }
});
