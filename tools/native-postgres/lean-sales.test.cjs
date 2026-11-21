/* eslint-disable @typescript-eslint/no-require-imports -- Actual current sync/report owners on a fresh synthetic localhost database. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {executeCommand,hashIntent}=require('../../src/infrastructure/persistence/postgres/commands.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const sales=require('../../src/modules/sales/server.ts');
const {singleReceipts:receipts,unused}=require('../../tests/helpers/lean-sales-fixture.cjs');
const service=createBusinessDatabase(),account={id:'lean-test',shopName:'Synthetic shop',service:{async getReceipts(){loads++;return receipts();}}};let loads=0;
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');global.fetch=()=>{throw Error('Real providers forbidden');};
const command=fn=>executeCommand('lean-sales-test',crypto.randomUUID(),hashIntent('synthetic'),fn);
test.after(closePool);

test('actual sync persists only used values, retains stable receipt/item/payment identities and all sync counts',async()=>{
 const result=await command(()=>sales.syncLoyverseDailySales({account,storage:service,salesDate:'2026-11-01'}));assert.equal(result.outcome,'synced');assert.equal(result.receiptCount,3);assert.equal(result.itemCount,3);assert.equal(result.paymentCount,3);
 await transaction(false,async()=>{
  const checks=[['sales_receipts',['shopName','refundFor','order','source','storeId','employeeId','customerId','posDeviceId','diningOption','totalMoney','totalTax','totalDiscount','tip','surcharge','pointsEarned','pointsDeducted']],['sales_receipt_items',['lineItemId','price','totalMoney','cost','lineNote','lineDiscountsJson','lineTaxesJson','lineModifiersJson']],['sales_receipt_payments',['paymentIndex','paidAt','paymentDetailsJson']]];
  for(const[table,removed]of checks){const rows=(await currentTransaction().query(`SELECT to_jsonb(t) value FROM stock_operational.${table} t`)).rows;assert.ok(rows.length);for(const {value}of rows){assert.ok(value.id);assert.ok(value.syncedAt);for(const name of removed)assert.equal(value[name],null,table+'.'+name);assert.ok(!JSON.stringify(value).includes(unused));}}
  const id=(await currentTransaction().query('SELECT id FROM stock_operational.sales_receipts WHERE "receiptNumber"=$1',['sale-1'])).rows[0].id;assert.equal(id,'RECEIPT-lean-test-sale-1');
 });
});
test('daily reports, refund signs, payment splits, taxes, hourly sales, commission inputs and stock quantities remain correct',async()=>{
 await transaction(false,async()=>{
  const daily=await sales.getGoogleSheetsDailySales({storage:service,accountId:account.id,salesDate:'2026-11-01'});assert.equal(daily.receiptCount,2);assert.equal(daily.totals.netSales,18);assert.equal(daily.totals.grossProfit,10);assert.equal(daily.totals.taxes,1.26);assert.equal(daily.paymentsByType.reduce((n,r)=>n+r.netPayments,0),18);assert.equal(daily.hourlyGrossSales[9].grossSales,30);
  const dashboard=await sales.getGoogleSheetsSalesDashboard({storage:service,accountIds:[account.id],fromDate:'2026-11-01',toDate:'2026-11-01'});const day=dashboard.shopSeries[0].dailySales[0];assert.equal(day.netSales,18);assert.equal(day.itemsSold-day.itemsRefunded,2);
  const profit=await sales.getGoogleSheetsProfitSummary({storage:service,year:'2026',accounts:[{id:account.id,shopName:account.shopName}],expenses:[],costOverrides:[]});assert.equal(profit.totals.netSales,18);assert.equal(profit.totals.grossProfit,10);
 });
});
test('completed dates never refetch and empty dates still produce a complete zero-count marker',async()=>{
 const again=await command(()=>sales.syncLoyverseDailySales({account,storage:service,salesDate:'2026-11-01'}));assert.equal(again.outcome,'already_synced');assert.equal(loads,1);
 const empty={...account,service:{async getReceipts(){return [];}}};const zero=await command(()=>sales.syncLoyverseDailySales({account:empty,storage:service,salesDate:'2026-11-02'}));assert.equal(zero.receiptCount,0);
 await transaction(false,async()=>{const statuses=await sales.listSalesSyncStatus({storage:service,month:'2026-11',accountId:account.id});assert.ok(JSON.stringify(statuses).includes('2026-11-02'));const dashboard=await sales.getGoogleSheetsSalesDashboard({storage:service,accountIds:[account.id],fromDate:'2026-11-01',toDate:'2026-11-02'});assert.equal(dashboard.dailySales.length,2);assert.equal(dashboard.dailySales[1].netSales,0);});
});
test('a late sync-marker failure rolls back every new receipt, item and payment, and its command receipt',async()=>{
 let reachedMarker=false;const failedKey='lean-failed-sync-command';
 const failing={...account,id:'lean-failure'};const broken={...service,salesReceiptSyncs:{...service.salesReceiptSyncs,all:()=>service.salesReceiptSyncs.all(),prepare:()=>service.salesReceiptSyncs.prepare(),insert:async()=>{reachedMarker=true;throw Error('Synthetic final sync-marker failure');}}};
 await assert.rejects(executeCommand('lean-sales-test',failedKey,hashIntent('failed marker'),()=>sales.syncLoyverseDailySales({account:failing,storage:broken,salesDate:'2026-11-01'})),e=>e.status===503 && !e.message.includes('Synthetic final'));assert.equal(reachedMarker,true);
 await transaction(false,async()=>{assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.commands WHERE kind=$1 AND key=$2',['lean-sales-test',failedKey])).rows[0].count,'0');assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.sales_receipts WHERE "accountId"=$1',[failing.id])).rows[0].count,'0');assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.sales_receipt_items WHERE "receiptId" LIKE $1',['RECEIPT-lean-failure-%'])).rows[0].count,'0');assert.equal((await currentTransaction().query('SELECT count(*) FROM stock_operational.sales_receipt_payments WHERE "receiptId" LIKE $1',['RECEIPT-lean-failure-%'])).rows[0].count,'0');});
});
test('stopping collection does not erase old source details or change their reports',async()=>{
 const fingerprint=async()=>{const values=[];for(const table of ['sales_receipts','sales_receipt_items','sales_receipt_payments'])values.push((await currentTransaction().query(`SELECT to_jsonb(t) value FROM stock_operational.${table} t WHERE id=$1`,['lean-legacy'])).rows);return values;};
 const before=await command(async()=>{
  await currentTransaction().query('INSERT INTO stock_operational.sales_receipts(id,"salesDate","accountId","receiptType","receiptDate","customerId","totalMoney") VALUES($1,$2,$3,$4,$5,$6,27)',['lean-legacy','2026-10-01','legacy','SALE','2026-10-01T02:00:00Z',unused]);
  await currentTransaction().query('INSERT INTO stock_operational.sales_receipt_items(id,"receiptId","lineNote","lineModifiersJson") VALUES($1,$1,$2,$3::jsonb)',['lean-legacy',unused,JSON.stringify([{unused}])]);
  await currentTransaction().query('INSERT INTO stock_operational.sales_receipt_payments(id,"receiptId","paidAt","paymentDetailsJson") VALUES($1,$1,$2,$3::jsonb)',['lean-legacy','2026-10-01T02:00:00Z',JSON.stringify({unused})]);
  return fingerprint();
 });
 await command(()=>sales.syncLoyverseDailySales({account:{...account,id:'lean-another'},storage:service,salesDate:'2026-11-01'}));
 assert.deepEqual(await transaction(false,fingerprint),before);
});
