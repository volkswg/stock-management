/* eslint-disable @typescript-eslint/no-require-imports -- Actual PostgreSQL owners with synthetic records and no providers. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {Client}=require('pg');
const rawQuery=Client.prototype.query;
Client.prototype.query=function(...args){
 const result=rawQuery.apply(this,args);
 return result?.catch?result.catch(error=>{console.error('Synthetic soft-delete SQL diagnostic:',error.code,error.message);throw error;}):result;
};
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {PostgresRecords}=require('../../src/infrastructure/persistence/postgres/records.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const sales=require('../../src/modules/sales/server.ts');
const orders=require('../../src/modules/orders/server.ts');
const expenses=require('../../src/modules/expenses/server.ts');
global.fetch=()=>{throw Error('Real providers forbidden in soft-delete acceptance');};
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const ownerUrl=new URL(process.env.STOCK_DATABASE_URL);ownerUrl.username='postgres';ownerUrl.password='';
const owner=new Client({connectionString:ownerUrl.toString()}),service=createPostgresService();
const tables=JSON.parse(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'tools/migration');from core import CATALOG;print(json.dumps(CATALOG))"],{env:{PATH:process.env.PATH},encoding:'utf8'}));
const command=run=>executeCommand('soft-delete-fixture',randomUUID(),hashIntent(randomUUID()),run);
const read=run=>transaction(false,run);
test.before(()=>owner.connect());
test.after(async()=>{await closePool();await owner.end();});

test('all23 tables soft-delete by stable ID, retain payload/revisions, hide reads and reject stale handles and resurrection',async()=>{
 const parents={orderId:['orders','SD_PARENT_ORDER'],shipmentId:['shipments','SD_PARENT_SHIPMENT'],employeeId:['employees','SD_PARENT_EMPLOYEE'],receiptId:['sales_receipts','SD_PARENT_RECEIPT'],movementMasterId:['movements','SD_PARENT_MOVEMENT'],shopId:['shops','SD_PARENT_SHOP'],categoryId:['expense_categories','SD_PARENT_CATEGORY']};
 for(const [table,id] of Object.values(parents))await owner.query(`INSERT INTO stock_operational.${table}(id) VALUES($1)`,[id]);
 for(const [table,spec] of Object.entries(tables)){
  const key=table==='employee_compensations'?'migration_id':'id';
  const id='SD_'+table;const values=spec.headers.map(h=>h==='id'?id:parents[h]?parents[h][1]:h==='createdAt'?'2026-11-19T00:00:00.123456Z':'');
  const media={order_items:{url:'imageUrl',reference:'imageMediaId'},order_bills:{url:'imageUrl',reference:'imageMediaId'},shipments:{url:'shippingBillUrl',reference:'shippingBillMediaId'},movement_details:{url:'productImageUrl',reference:'productImageMediaId'},stock_adjustments:{url:'photoUrl',reference:'photoMediaId'}}[table];
  const records=new PostgresRecords({table,headers:spec.headers,key,media});
  await command(()=>records.appendRows('',[values])).catch(error=>{error.message=table+': '+error.message;throw error;});
  const actual=(await owner.query(`SELECT * FROM stock_operational.${table} WHERE ${key==='migration_id'?'"employeeId"=$1':'id=$1'}`,[key==='migration_id'?parents.employeeId[1]:id])).rows[0];
  assert.ok(actual,table);const recordId=actual[key];
  const writable=(await owner.query('SELECT has_table_privilege($1,$2,$3) AS allowed',['stock_runtime','stock_operational.'+table,'UPDATE'])).rows[0].allowed;
  if(writable){
   await command(async()=>{
    const target=await records.referenceId(recordId);assert.ok(target,table);
    const stale=await records.referenceId(recordId);await target.archive();
    await assert.rejects(stale.archive(),e=>e.status===409);
   });
  }else{
   // Preserve the seven append-only runtime tables; never grant UPDATE merely
   // to make a synthetic delete pass. Authorized direct editors use the field.
   await assert.rejects(command(async()=>{await (await records.referenceId(recordId)).archive();}));
   await owner.query(`UPDATE stock_operational.${table} SET "deletedAt"=now() WHERE "${key}"=$1`,[recordId]);
  }
  const after=(await owner.query(`SELECT * FROM stock_operational.${table} WHERE "${key}"=$1`,[recordId])).rows[0];
  assert.ok(after.deletedAt,table);assert.equal(BigInt(after.revision),BigInt(actual.revision)+1n);
  const payload={...after},original={...actual};delete payload.deletedAt;delete payload.revision;delete original.deletedAt;delete original.revision;assert.deepEqual(payload,original,table);
  await read(async()=>{
   assert.equal(await records.referenceId(recordId),undefined,table);
   const active=await records.readRows();assert.ok(!active.slice(1).some(r=>r[0]===values[0]),table);
  });
  await assert.rejects(owner.query(`UPDATE stock_operational.${table} SET "deletedAt"=NULL WHERE "${key}"=$1`,[recordId]),/deleted record/);
  await assert.rejects(command(()=>currentTransaction().query(`DELETE FROM stock_operational.${table} WHERE "${key}"=$1`,[recordId])));
 }
});

test('existing deletion field hides raw app reads and blocks later edits; direct editor deletion behaves identically',async()=>{
 const id='SD_ORDER_DIRECT';await command(()=>orders.createOrder({googleSheetsService:service,id,createdBy:'synthetic'}));
 await owner.query('UPDATE stock_operational.orders SET "deletedAt"=now() WHERE id=$1',[id]);
 await read(async()=>{assert.equal(await service.orders.referenceId(id),undefined);assert.ok(!(await service.orders.readRows()).some(r=>r[0]===id));});
 await assert.rejects(owner.query('UPDATE stock_operational.orders SET remark=$1 WHERE id=$2',['forbidden',id]),/deleted record/);
 const rows=await owner.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='archived_at'");assert.equal(rows.rows[0].n,0);
});

test('actual Expense save/delete keeps its timestamps, payload and existing missing-record behavior',async()=>{
 await command(()=>expenses.saveExpenseMaster(service,'categories',{name:'SD Category',active:true}));
 const category=(await read(()=>expenses.listExpenseCategories(service))).find(c=>c.name==='SD Category');assert.ok(category);
 const id=await command(()=>expenses.saveExpense(service,{requestId:randomUUID(),month:'2026-11',expenseDate:'2026-11-19',scope:'SHARED',shopId:'',categoryId:category.id,name:'SD expense',amount:12.34,note:'retained'}));
 const before=(await owner.query('SELECT * FROM stock_operational.expenses WHERE id=$1',[id])).rows[0];
 await command(()=>expenses.removeExpense(service,id));
 const after=(await owner.query('SELECT * FROM stock_operational.expenses WHERE id=$1',[id])).rows[0];
 assert.ok(after.deletedAt);assert.ok(after.updatedAt);assert.equal(after.amount,before.amount);assert.equal(after.createdAt.getTime(),before.createdAt.getTime());
 await read(async()=>{assert.equal(await service.expenses.referenceId(id),undefined);assert.ok(!(await expenses.listExpenses({googleSheetsService:service,year:'2026'})).some(r=>r.id===id));});
 await command(async()=>{await assert.rejects(expenses.removeExpense(service,id),e=>e.status===404);});
});

test('actual cost override delete is repeatable and replacement preserves active-key uniqueness',async()=>{
 const input={googleSheetsService:service,accountId:'SD_ACCOUNT',month:'2026-11',averageItemCost:2.5,note:'retained',createdBy:'synthetic'};
 const first=await command(()=>sales.setSalesProfitCostOverride(input));
 assert.equal(await command(()=>sales.removeSalesProfitCostOverride(input)),true);
 assert.equal(await command(()=>sales.removeSalesProfitCostOverride(input)),false);
 const next=await command(()=>sales.setSalesProfitCostOverride({...input,averageItemCost:3}));assert.notEqual(next.id,first.id);
 const rows=(await owner.query('SELECT id,"deletedAt" FROM stock_operational.sales_profit_cost_overrides WHERE id IN ($1,$2)',[first.id,next.id])).rows;
 assert.ok(rows.find(r=>r.id===first.id).deletedAt);assert.equal(rows.find(r=>r.id===next.id).deletedAt,null);
});

test('cleared LINE sessions keep their identities/context and never reuse numeric IDs',async()=>{
 const snapshot=await read(()=>service.userState.readRows());const id=String(await command(()=>service.userState.nextRecordNumber()));
 await command(()=>service.userState.appendRows('',[[id,'SD_LINE','OrderCreate','SD_ORDER','waiting_for_bill_image','2026-11-19T00:00:00Z','','{"pending":"synthetic"}']]));
 const before=(await owner.query('SELECT * FROM stock_operational.user_state WHERE id=$1',[id])).rows[0];
 await command(async()=>{await (await service.userState.referenceId(id)).archive();});
 const after=(await owner.query('SELECT * FROM stock_operational.user_state WHERE id=$1',[id])).rows[0];
 assert.deepEqual(after.context,before.context);assert.equal(after.state,before.state);assert.ok(after.deletedAt);
 await read(async()=>assert.equal(await service.userState.referenceId(id),undefined));
 assert.ok(await command(()=>service.userState.nextRecordNumber())>Number(id));assert.ok(Array.isArray(snapshot));
});

test('new contract is private, rechecked across transactions and refuses partial deletion schemas',async()=>{
 const access=(await owner.query("SELECT has_function_privilege('anon','stock_operational.soft_delete_contract_v1()','EXECUTE') a,has_function_privilege('authenticated','stock_operational.soft_delete_contract_v1()','EXECUTE') b")).rows[0];assert.deepEqual(access,{a:false,b:false});
 await owner.query('ALTER TABLE stock_operational.orders RENAME COLUMN "deletedAt" TO sd_missing');
 try{await assert.rejects(read(()=>service.orders.readRows()),e=>e.status===503);}finally{await owner.query('ALTER TABLE stock_operational.orders RENAME COLUMN sd_missing TO "deletedAt"');}
 await read(()=>service.orders.readRows());
});
