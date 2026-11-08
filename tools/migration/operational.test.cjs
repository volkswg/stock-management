/* eslint-disable @typescript-eslint/no-require-imports -- Isolated CJS loader must install the TypeScript require hook before loading actual owners. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw new Error('Live provider network is forbidden in synthetic PostgreSQL tests');};
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool,Client}=require('pg');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
let loseNextCommit=false;
const originalQuery=Client.prototype.query;
Client.prototype.query=function(...args){
 const result=originalQuery.apply(this,args);
 return result?.catch?result.then(value=>{if(args[0]==='COMMIT'&&loseNextCommit){loseNextCommit=false;throw new Error('Synthetic lost COMMIT acknowledgement');}return value;}).catch(error=>{console.error('Synthetic SQL diagnostic:',error.code,error.message);throw error;}):result;
};
const {transaction,currentTransaction,requireMutation,closePool,PersistenceFailure}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {withPersistence}=require('../../src/composition/postgres/route.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const orders=require('../../src/modules/orders/server.ts');
const shipments=require('../../src/modules/shipments/server.ts');
const inventory=require('../../src/modules/inventory/server.ts');
const hr=require('../../src/modules/hr/server.ts');
const payroll=require('../../src/modules/hr/payroll-server.ts');
const expenses=require('../../src/modules/expenses/server.ts');
const sales=require('../../src/modules/sales/server.ts');
const line=require('../../src/modules/line-workflows/server.ts');
const service=createPostgresService();
const auth={Authorization:`Bearer ${process.env.STOCK_STAGING_AUTH_TOKEN}`};
const request=(key,body={},method='POST')=>new Request('https://example.test/api/synthetic',{method,headers:{...auth,'Idempotency-Key':key,'content-type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
let sequence=0;
async function command(run){return executeCommand('synthetic',`operation-${++sequence}`,hashIntent(sequence),async()=>{try{return await run();}catch(error){console.error('Synthetic application diagnostic:',error);throw error;}});}

test.after(closePool);

test('all seven feature table adapters are available; no IO without an explicit unit of work',async()=>{
 assert.equal(Object.values(service).filter(v=>v&&typeof v.readRows==='function').length,23);
 await assert.rejects(service.orders.readRows(),PersistenceFailure);
});

test('Orders, item/bill mappings, atomic rollback and preserved API records',async()=>{
 const created=await command(()=>orders.createOrder({googleSheetsService:service,id:'order-valid',seller:'S',totalPrice:12.34,createdBy:'synthetic'}));
 assert.equal(created.totalPrice,12.34);
 await command(async()=>{
  await orders.createOrderItem({googleSheetsService:service,orderId:created.id,imageUrl:'https://example.test/image',quoteQuantity:'3',createdBy:'synthetic'});
  await orders.createOrderBill({googleSheetsService:service,orderId:created.id,imageUrl:'https://example.test/bill',createdBy:'synthetic'});
 });
 const listed=await transaction(false,()=>orders.listOrders({googleSheetsService:service}));
 assert.equal(listed[0].id,created.id);
 await assert.rejects(command(async()=>{
  await orders.createOrder({googleSheetsService:service,id:'rolled-back',totalPrice:99,createdBy:'synthetic'});
  throw new Error('synthetic interruption');
 }));
 await transaction(false,async()=>{assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.orders WHERE id=$1',['rolled-back'])).rows[0].count,'0');});
});

test('concurrent exact retries execute once and replay the original response, including after a lost caller acknowledgement',async()=>{
 let executions=0;
 const handler=withPersistence(async()=>{
  executions++;
  const order=await orders.createOrder({googleSheetsService:service,totalPrice:88.01,createdBy:'synthetic'});
  return Response.json({order},{status:201});
 });
 const replies=await Promise.all(Array.from({length:8},()=>handler(request('same-operation-key',{price:88.01}))));
 const bodies=await Promise.all(replies.map(r=>r.json()));
 assert.ok(replies.every(r=>r.status===201));assert.equal(executions,1);
 assert.ok(bodies.every(b=>b.order.id===bodies[0].order.id));
 // Discard a completed response, as a caller would on connection loss.
 const replay=await handler(request('same-operation-key',{price:88.01}));
 assert.deepEqual(await replay.json(),bodies[0]);assert.equal(executions,1);
 const conflict=await handler(request('same-operation-key',{price:88.02}));assert.equal(conflict.status,409);
 const secondIntent=await handler(request('different-operation-key',{price:88.01}));assert.equal(secondIntent.status,201);assert.equal(executions,2);
});

test('handled HTTP failure rolls back all earlier writes; missing keys and auth fail before any application execution',async()=>{
 let ran=0;
 const handler=withPersistence(async()=>{ran++;await orders.createOrder({googleSheetsService:service,id:'handled-failure',createdBy:'synthetic'});return Response.json({error:'synthetic'},{status:409});});
 assert.equal((await handler(request('handled-failure-key'))).status,409);
 await transaction(false,async()=>{assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.orders WHERE id=$1',['handled-failure'])).rows[0].count,'0');});
 assert.equal((await handler(new Request('https://example.test/api/synthetic',{method:'POST'}))).status,401);
 assert.equal((await handler(new Request('https://example.test/api/synthetic',{method:'POST',headers:auth}))).status,428);
 assert.equal(ran,1);
});

test('Shipments create, link and read use existing business ports in one transaction',async()=>{
 const shipment=await command(()=>shipments.createShipment({googleSheetsService:service,poNumber:'PO-synthetic',createdBy:'synthetic'}));
 const linked=await command(()=>shipments.linkOrderToShipment({googleSheetsService:service,shipmentId:shipment.id,orderId:'order-valid',createdBy:'synthetic'}));
 assert.ok(linked);
 const result=await transaction(false,()=>shipments.listShipments({googleSheetsService:service}));assert.equal(result[0].id,shipment.id);
});

test('retained deletes, immutable archive, restricted runtime access and stale revisions',async()=>{
 await command(async()=>{
  await service.userState.appendRows('A:H',[['session-synthetic','user','OrderCreate','order-valid','waiting_for_bill_image','2026-11-09','2026-11-09','']]);
  await service.userState.deleteRow(2);
 });
 await transaction(false,async()=>{
  assert.deepEqual((await service.userState.readRows())[1],[]);
  const row=(await currentTransaction().query('SELECT archived_at FROM stock_operational.user_state WHERE id=$1',['session-synthetic'])).rows[0];assert.ok(row.archived_at);
 });
 const pool=new Pool({connectionString:process.env.STOCK_DATABASE_URL});
 await assert.rejects(pool.query('SELECT * FROM stock_migration.orders'),/permission denied/);
 await assert.rejects(pool.query('SELECT * FROM stock_operational.orders'),/permission denied/);
 await pool.end();
 await assert.rejects(transaction(false,()=>service.orders.appendRows('A:I',[['forbidden']])),PersistenceFailure);
});

let shopId,categoryId,employeeId;
test('Expenses and shop configuration retain amounts, master mappings and soft-deletion history',async()=>{
 await command(async()=>{
  await expenses.saveExpenseMaster(service,'shops',{name:'Synthetic shop',active:true,loyverseAccountId:'account-synthetic'});
  await expenses.saveExpenseMaster(service,'categories',{name:'Synthetic category',active:true});
  shopId=(await expenses.listExpenseShops(service))[0].id;
  categoryId=(await expenses.listExpenseCategories(service))[0].id;
  const id=await expenses.saveExpense(service,{requestId:'00000000-0000-0000-0000-000000000001',month:'2026-11',expenseDate:'2026-11-01',scope:'SHOP',shopId,categoryId,name:'Synthetic expense',amount:12.34,note:''});
  const rows=await expenses.listExpenses({googleSheetsService:service,year:'2026'});assert.equal(rows[0].amount,12.34);
  await expenses.removeExpense(service,id);assert.equal((await expenses.listExpenses({googleSheetsService:service,year:'2026'})).length,0);
  assert.ok((await currentTransaction().query('SELECT "deletedAt" FROM stock_operational.expenses WHERE id=$1',[id])).rows[0].deletedAt);
 });
});

test('HR employee/compensation history and Bangkok attendance transitions',async()=>{
 await command(async()=>{
  const employee=await hr.createEmployee({googleSheetsService:service,createdBy:'synthetic',input:{name:'Synthetic employee',phone:'',status:'active',hiredDate:'2020-01-01',terminatedDate:'',baseSalary:100,commission:0,compensationEffectiveFrom:'2020-01-01',compensationType:'daily',commissionType:'none',commissionBucketSales:0,commissionBucketAmount:0,commissionRoundupThreshold:0}});
  employeeId=employee.id;
  assert.equal(employee.compensation.baseSalary,100);
  const shift=await hr.clockInEmployee({googleSheetsService:service,date:'2026-11-01',employeeId,shopId,workdayType:'half'});
  assert.ok(shift.id);
  await hr.clockOutEmployee({googleSheetsService:service,timesheetId:shift.id});
  const entries=await hr.listEmployeeTimesheets({googleSheetsService:service,date:'2026-11-01'});
  assert.equal(entries[0].employeeId,employeeId);assert.equal(entries[0].workdayType,'half');assert.equal(entries[0].isOpen,false);
  await hr.updateEmployee({googleSheetsService:service,employeeId,input:{baseSalary:120,compensationEffectiveFrom:'2026-11-02'}});
  assert.equal((await hr.listEmployeeCompensations({googleSheetsService:service})).length,2);
 });
});

test('Payroll payments replay safely and stale revisions fail without overwriting',async()=>{
 await command(async()=>{
  const input={requestId:'00000000-0000-0000-0000-000000000002',employeeId,shopId,paidDate:'2026-11-01',payrollMonth:'2026-11',paidAmount:10,reference:'synthetic',note:''};
  const readers={listEmployees:()=>hr.listEmployees({googleSheetsService:service})},shops={listShops:()=>expenses.listExpenseShops(service)};
  const first=await payroll.createSalaryAdvance(service,input,readers,shops);
  const retry=await payroll.createSalaryAdvance(service,input,readers,shops);
  assert.equal(first.id,retry.id);assert.equal((await payroll.listSalaryAdvances(service)).length,1);
  await assert.rejects(payroll.transitionSalaryAdvance(service,{id:first.id,action:'cancel',updatedAt:'stale'}),/Refresh|changed/);
 });
});

test('Inventory movement transitions, retained deletion, counts and reversal totals',async()=>{
 const account={id:'account-synthetic',shopName:'Synthetic shop'};
 await command(async()=>{
  const identity={masterId:'movement-synthetic',userId:'user',startedAt:'2026-11-01T01:00:00.000Z'};
  await inventory.synchronizeMovementJourney(service,identity);
  await inventory.appendMovementJourneyItem(service,()=>({id:'movement-item-synthetic',masterId:identity.masterId,shop:account.shopName,quantity:'3',remark:'',fromLocation:'',toLocation:'',imageUrl:'https://example.test/photo',purchaseDetailId:'',status:'created',createdAt:identity.startedAt,updatedAt:identity.startedAt,stockCounted:true,isNewArrival:true}));
  await inventory.synchronizeMovementJourney(service,identity,true);
  const delivered=await inventory.markMovementDelivered({googleSheetsService:service,movementMasterId:identity.masterId});assert.ok(delivered);
  const count=await inventory.saveMonthlyStockCount({account,googleSheetsService:service,month:'2026-11',physicalCount:3,note:'',updatedBy:'synthetic'});assert.equal(count.physicalCount,3);
  const adjustment=await inventory.createStockAdjustment(service,[account],{requestId:'00000000-0000-0000-0000-000000000003',accountId:account.id,date:'2026-11-01',direction:'out',reason:'damage',quantity:1,itemDescription:'Synthetic item',photoUrl:'',note:'',notInLoyverse:true});
  await inventory.reverseStockAdjustment(service,{id:adjustment.id,note:'Synthetic reversal'});
  const totals=inventory.stockAdjustmentTotals(await inventory.listStockAdjustments(service),account.id,'2026-11');assert.equal(totals.adjustmentsOut,0);
  await inventory.deleteMovementItem({googleSheetsService:service,movementId:'movement-item-synthetic',movementMasterId:identity.masterId});
  assert.equal((await inventory.getMovementItems({googleSheetsService:service,movementMasterId:identity.masterId})).length,0);
 });
});

test('Loyverse receipt/items/payments/sync marker commit atomically and repeat sync preserves financial totals',async()=>{
 const receipt={receipt_number:'receipt-synthetic',receipt_type:'SALE',receipt_date:'2026-11-01T01:00:00.000Z',created_at:'2026-11-01T01:00:00.000Z',updated_at:'2026-11-01T01:00:00.000Z',total_money:12.34,total_tax:0,total_discount:0,line_items:[{id:'line-1',item_name:'Synthetic',quantity:2,price:6.17,total_money:12.34,cost:1,cost_total:2}],payments:[{money_amount:12.34,name:'Cash'}]};
 let loads=0;
 const account={id:'account-synthetic',shopName:'Synthetic shop',service:{async getReceipts(){loads++;return [receipt];}}};
 const first=await command(()=>sales.syncLoyverseDailySales({googleSheetsService:service,account,salesDate:'2026-11-01'}));assert.equal(first.outcome,'synced');
 const second=await command(()=>sales.syncLoyverseDailySales({googleSheetsService:service,account,salesDate:'2026-11-01'}));assert.equal(second.outcome,'already_synced');assert.equal(loads,1);
 await transaction(false,async()=>{
  const raw=(await currentTransaction().query('SELECT "totalMoney"::text value FROM stock_operational.sales_receipts')).rows;assert.deepEqual(raw.map(r=>r.value),['12.34']);
 });
});

test('LINE event idempotency survives regrouped redelivery; session clearing preserves historical identity',async()=>{
 const replies=[];
 const bot={sendReply:async(token,messages)=>{replies.push({token,messages});},downloadMessageContent:async()=>{throw new Error('not used');}};
 const args={lineBotService:bot,getGoogleSheetsService:()=>service,getGoogleDriveService:()=>undefined,getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.test'};
 const event={type:'message',webhookEventId:'line-event-synthetic-1',replyToken:'synthetic-token',timestamp:Date.parse('2026-11-01T01:00:00Z'),source:{type:'user',userId:'line-synthetic'},message:{id:'message-synthetic',type:'text',text:'create:order'}};
 await line.processLineWebhook({...args,events:[event]});
 await line.processLineWebhook({...args,events:[{...event,replyToken:'redelivery-token',deliveryContext:{isRedelivery:true}}]});
 assert.equal(replies.length,1);
 await command(async()=>{
  const session=await line.findLatestUserState({googleSheetsService:service,userId:'line-synthetic',flowname:'OrderCreate'});
  assert.ok(session,'actual create:order command must have created a workflow session');
  await line.completeOrderTotalPrice({googleSheetsService:service,orderId:session.referenceId,userStateId:session.id,userStateCreatedAt:session.createdAt,totalPrice:'25'});
  assert.equal(await line.findLatestUserState({googleSheetsService:service,userId:'line-synthetic',flowname:'OrderCreate'}),undefined);
  assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.orders WHERE "createdBy"=$1',['line-synthetic'])).rows[0].count,'1');
 });
 await transaction(false,async()=>{assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.commands WHERE kind=$1',['LINE'])).rows[0].count,'1');});
});

test('optional If-Match rejects stale views, while retry replay remains safe',async()=>{
 const reader=withPersistence(async()=>Response.json({ok:true}));
 const revision=(await reader(request('',{},'GET'))).headers.get('x-stock-revision');assert.ok(revision);
 const writer=withPersistence(async()=>{await orders.createOrder({googleSheetsService:service,createdBy:'synthetic'});return Response.json({ok:true});});
 const a=request('revision-command-a');a.headers.set('If-Match',revision);assert.equal((await writer(a)).status,200);
 const b=request('revision-command-b');b.headers.set('If-Match',revision);assert.equal((await writer(b)).status,409);
});


test('Payroll calculation, immutable settlement snapshot and repeat settlement preserve exact pay',async()=>{
 await command(async()=>{
  const readers=hr.createHRPayrollReaders(service,{readSales:async()=>({shopSeries:[]})});
  const rows=await payroll.calculateEmployeePayroll({googleSheetsService:service,month:'2026-11',readers});
  const row=rows.find(r=>r.employeeId===employeeId);assert.ok(row);
  assert.equal(row.basePay,60);assert.equal(row.advanceDeduction,10);assert.equal(row.totalPay,50);
  const input={employeeId,month:'2026-11',paidDate:'2026-11-08',reference:'Synthetic settlement',revision:payroll.payrollRevision(row)};
  const first=await payroll.settleEmployeePayroll(service,input,readers),again=await payroll.settleEmployeePayroll(service,input,readers);
  assert.equal(first.id,again.id);assert.equal(first.snapshot.totalPay,50);
  assert.equal((await payroll.listPayrollSettlements(service)).length,1);
 });
});

test('staging configuration cannot enable production writes and never falls back on failure',async()=>{
 const handler=withPersistence(async()=>{throw new Error('must not reach application');});
 const original=process.env.VERCEL_ENV;
 try{process.env.VERCEL_ENV='production';assert.equal((await handler(request('production-guard-key'))).status,503);}finally{if(original===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=original;}
 const prior=process.env.STOCK_DATABASE_URL;
 try{delete process.env.STOCK_DATABASE_URL;assert.equal((await handler(request('missing-config-key'))).status,503);}finally{process.env.STOCK_DATABASE_URL=prior;}
});


test('actual committed SQL followed by a lost COMMIT acknowledgement replays without a second mutation',async()=>{
 let executions=0;
 const run=()=>executeCommand('ambiguous-commit','ambiguous-commit-key',hashIntent({value:1}),async()=>{
  executions++;
  return orders.createOrder({googleSheetsService:service,id:'ambiguous-commit-order',totalPrice:1,createdBy:'synthetic'});
 });
 loseNextCommit=true;
 await assert.rejects(run(),PersistenceFailure);
 const replay=await run();assert.equal(replay.id,'ambiguous-commit-order');assert.equal(executions,1);
});

test('capacity and primary-key query plan measured on an explicitly synthetic 2000-row workload',async()=>{
 const start=performance.now();
 await command(async()=>{
  await requireMutation().query(`INSERT INTO stock_operational.orders(business_cells,row_order) SELECT jsonb_build_array('capacity-'||g::text,'complete','Synthetic',0,'','2026-11-01','2026-11-01','','synthetic'),1000+g FROM generate_series(1,2000) g`);
 });
 await transaction(false,async()=>{
  const plan=await currentTransaction().query("EXPLAIN (ANALYZE,FORMAT TEXT) SELECT id FROM stock_operational.orders WHERE id=$1",['capacity-1000']);
  const text=plan.rows.map(r=>r['QUERY PLAN']).join('\n');assert.match(text,/Index.*Scan/);
  const readStart=performance.now();
  const listed=await orders.listOrders({googleSheetsService:service});assert.ok(listed.length>=2000);
  console.log('Synthetic actual Orders list duration ms:',Math.round(performance.now()-readStart),'records:',listed.length);
  const capacity=await currentTransaction().query("SELECT sum(pg_total_relation_size(c.oid))::text AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock_operational'");
  console.log('Synthetic 2000-row write duration ms:',Math.round(performance.now()-start),'operational bytes:',capacity.rows[0].bytes,'plan:',text);
 });
});

test('actual Orders HTTP entrypoint selects PostgreSQL without Google credentials and replays its exact 201 body',async()=>{
 const route=require('../../src/app/api/orders/route.ts');
 const make=()=>new Request('https://example.test/api/orders',{method:'POST',headers:{...auth,'Idempotency-Key':'actual-order-route-key','content-type':'application/json'},body:JSON.stringify({seller:'HTTP synthetic',totalPrice:19.99})});
 const first=await route.POST(make()),again=await route.POST(make());
 assert.equal(first.status,201);assert.equal(again.status,201);assert.deepEqual(await first.json(),await again.json());
 const listed=await route.GET(new Request('https://example.test/api/orders',{headers:auth}));assert.equal(listed.status,200);
 const body=await listed.json();assert.ok(body.orders.some(o=>o.seller==='HTTP synthetic'));assert.equal(body.total,body.orders.length);
});

test('actual staging LINE HTTP still rejects an invalid signature before business persistence',async()=>{
 const route=require('../../src/app/api/line/webhook/route.ts');
 const result=await route.POST(new Request('https://example.test/api/line/webhook',{method:'POST',headers:{'x-line-signature':'invalid','content-type':'application/json'},body:JSON.stringify({events:[]})}));
 assert.equal(result.status,401);assert.deepEqual(await result.json(),{error:'Invalid LINE signature'});
});

test('wrong isolated-target metadata, destructive runtime SQL and immutable-history updates fail closed',async()=>{
 const previous=process.env.STOCK_TARGET_ISOLATION_ID;
 try{process.env.STOCK_TARGET_ISOLATION_ID='00000000-0000-0000-0000-000000000000';await assert.rejects(transaction(false,async()=>{}),PersistenceFailure);}finally{process.env.STOCK_TARGET_ISOLATION_ID=previous;}
 await assert.rejects(transaction(true,()=>requireMutation().query('DELETE FROM stock_operational.orders')),PersistenceFailure);
 await assert.rejects(transaction(true,()=>requireMutation().query('UPDATE stock_operational.payroll_settlements SET reference=$1',['forbidden'])),PersistenceFailure);
 await assert.rejects(transaction(true,()=>requireMutation().query('CREATE TABLE stock_operational.forbidden(id text)')),PersistenceFailure);
});
test('read-only requests enforce PostgreSQL READ ONLY and reject nested mutation upgrades',async()=>{
 await assert.rejects(transaction(false,()=>currentTransaction().query("INSERT INTO stock_operational.side_effects(key,state) VALUES('readonly-bypass','sending')")),PersistenceFailure);
 let ran=false;
 await assert.rejects(transaction(false,()=>transaction(true,async()=>{ran=true;})),PersistenceFailure);
 assert.equal(ran,false);
 await transaction(false,async()=>{
  assert.equal((await currentTransaction().query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  assert.equal((await currentTransaction().query("SELECT count(*) FROM stock_operational.side_effects WHERE key='readonly-bypass'")).rows[0].count,'0');
 });
});
test('spoofing the LINE URL cannot bypass ordinary handler authorization; no-content responses replay',async()=>{
 let ran=false;
 const handler=withPersistence(async()=>{ran=true;return Response.json({});});
 assert.equal((await handler(new Request('https://example.test/api/line/webhook',{method:'POST'}))).status,401);assert.equal(ran,false);
 const noContent=withPersistence(async()=>new Response(null,{status:204}));
 assert.equal((await noContent(request('no-content-command'))).status,204);
 assert.equal((await noContent(request('no-content-command'))).status,204);
});

test('failed LINE batches retain received/unprocessed image counters and stop before later events',async()=>{
 const event=index=>({type:'message',webhookEventId:`routing-failure-event-${index}`,replyToken:'synthetic',source:{type:'user',userId:'synthetic'},message:{id:`image-${index}`,type:'image'}});
 const result=await line.processLineWebhook({events:[event(1),event(2)],lineBotService:{sendReply:async()=>{},downloadMessageContent:async()=>{throw new Error('not used');}},getGoogleSheetsService:()=>{throw new Error('synthetic routing failure');},getGoogleDriveService:()=>undefined,getCreateMode:()=> 'quantity_photo',getPublicBaseUrl:()=> 'https://example.test'});
 assert.equal(result.movementFailed,true);assert.equal(result.imageCounts().received,2);assert.equal(result.imageCounts().unprocessed,1);assert.equal(result.imageCounts().failedBeforeRouting,1);
});

test('master name checks preserve existing JavaScript case semantics rather than imposing a database-locale identity',async()=>{
 await command(async()=>{
  const first=await expenses.saveExpenseMaster(service,'categories',{name:'İ',active:true});
  const second=await expenses.saveExpenseMaster(service,'categories',{name:'i',active:true});
  assert.notEqual(first,second);
  await assert.rejects(expenses.saveExpenseMaster(service,'categories',{name:' I ',active:true}),/already exists/);
 });
});

test('late asynchronous branches cannot write in autocommit after their request transaction rolls back',async()=>{
 let release,late;
 const gate=new Promise(resolve=>{release=resolve;});
 const handler=withPersistence(async()=>{
  const cached=currentTransaction();
  late=(async()=>{await gate;return cached.query("INSERT INTO stock_operational.orders(business_cells,row_order) VALUES($1::jsonb,999999)",[JSON.stringify(['late-order','complete','Synthetic',1,'','','','','synthetic'])]);})();
  await orders.createOrder({googleSheetsService:service,id:'early-failed-order',createdBy:'synthetic'});
  return Response.json({error:'synthetic failure'},{status:409});
 });
 assert.equal((await handler(request('late-asynchronous-key'))).status,409);
 const rejected=assert.rejects(late,PersistenceFailure);release();await rejected;
 await transaction(false,async()=>{assert.equal((await currentTransaction().query("SELECT count(*) FROM stock_operational.orders WHERE id IN ('late-order','early-failed-order')")).rows[0].count,'0');});
});
