/* eslint-disable @typescript-eslint/no-require-imports -- Closed loaders execute current TS owners and hash-pinned predecessor mappings, without IO. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript');
const mapping=require('../../src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts');
const {salesTables}=require('../../src/modules/sales/infrastructure/postgres/tables.ts');
const {createSalesReports}=require('../../src/modules/sales/application/reports.ts');
const ids=require('../../src/modules/sales/domain/receipt-ids.ts');
const {receipt,receipts,unused}=require('../helpers/lean-sales-fixture.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
function before(name) {
 const e=JSON.parse(fs.readFileSync('tests/fixtures/lean-loyverse-before.json')).edits[name];
 assert.equal(crypto.createHash('sha256').update(e.before).digest('hex'),e.beforeSha256);
 const exports={};new vm.Script(ts.transpileModule(e.before,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({exports,require(name){if(name==='server-only')return {};assert.equal(name,'@/infrastructure/persistence/postgres/native-records');return require('../../src/infrastructure/persistence/postgres/native-records.ts');}});return exports;
}
function records(mapper,input=receipts()) {
 const result={receipts:[],items:[],payments:[],syncs:[]},at='2026-11-02T00:00:00.000Z';
 for(const r of input){const id=ids.createSalesReceiptId('synthetic-account',r.receipt_number);result.receipts.push(mapper.salesReceiptToRecord({id,accountId:'synthetic-account',shopName:'Synthetic shop',salesDate:'2026-11-01',receipt:r,syncedAt:at}));
  r.line_items.forEach((item,i)=>result.items.push(mapper.salesReceiptItemToRecord({id:ids.createSalesReceiptItemId(id,item.id,i),receiptId:id,item,syncedAt:at})));
  r.payments.forEach((payment,i)=>result.payments.push(mapper.salesReceiptPaymentToRecord({id:ids.createSalesReceiptPaymentId(id,i),receiptId:id,paymentIndex:i,payment,syncedAt:at})));
 }
 for(const day of ['2026-11-01','2026-11-02'])result.syncs.push({id:ids.createSalesReceiptSyncId('synthetic-account',day),salesDate:day,accountId:'synthetic-account',shopName:'Synthetic shop',status:'complete',receiptCount:String(day.endsWith('01')?input.length:0),itemCount:String(day.endsWith('01')?result.items.length:0),paymentCount:String(day.endsWith('01')?result.payments.length:0),syncedAt:at});
 return result;
}
const reports=data=>createSalesReports(()=>Object.fromEntries(Object.entries(data).map(([key,value])=>[key,async()=>value])));

test('lean sync omits exactly the 27 unused persisted fields and leaves incoming receipts untouched',()=>{
 const input=receipts(),original=JSON.stringify(input),data=records(mapping,input),old=records(before('src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts'),input);
 assert.equal(JSON.stringify(input),original);assert.ok(JSON.stringify(old).includes(unused));assert.ok(!JSON.stringify(data).includes(unused));
 const tables=salesTables();
 const reductions=[['salesReceipts','receipts',16,10],['salesReceiptItems','items',8,13],['salesReceiptPayments','payments',3,7]];
 for(const [table,kind,removed,kept] of reductions){assert.equal(Object.keys(old[kind][0]).length-Object.keys(data[kind][0]).length,removed);assert.equal(Object.keys(data[kind][0]).length,kept);for(const row of data[kind])assert.ok(Object.keys(row).every(key=>table==='salesReceiptPayments'?['id','receiptId','paymentTypeId','paymentName','paymentType','moneyAmount','syncedAt'].includes(key):Object.hasOwn(tables[table].columns,key)));
  if(table==='salesReceiptPayments')assert.equal(Object.hasOwn(tables,table),false);}
 assert.deepEqual(data.syncs,old.syncs);
});
test('daily sales, refunds, product grouping, payments, taxes and Bangkok hourly totals match the full predecessor payload',async()=>{
 const old=records(before('src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts')),lean=records(mapping);
 const input={accountId:'synthetic-account',salesDate:'2026-11-01',storage:{}};
 const expected=await reports(old).getDailySales(input),actual=await reports(lean).getDailySales(input);
 assert.deepEqual(plain(actual),plain(expected));assert.equal(actual.receiptCount,2);assert.equal(actual.totals.netSales,18);assert.equal(actual.totals.costOfGoods,8);assert.equal(actual.totals.taxes,1.26);assert.equal(actual.totals.itemsSold-actual.totals.itemsRefunded,2);assert.equal(actual.hourlyGrossSales[9].grossSales,30);assert.equal(actual.paymentsByType.reduce((n,r)=>n+r.netPayments,0),18);
});
test('dashboard, zero-sales completion and profit with expenses/overrides match the full predecessor data',async()=>{
 const old=reports(records(before('src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts'))),lean=reports(records(mapping));
 const input={accountIds:['synthetic-account'],fromDate:'2026-11-01',toDate:'2026-11-02',storage:{}};
 const dashboard=await lean.getSalesDashboard(input);assert.deepEqual(plain(dashboard),plain(await old.getSalesDashboard(input)));assert.equal(dashboard.dailySales.length,2);assert.equal(dashboard.dailySales[1].netSales,0);
 const profit={year:'2026',accounts:[{id:'synthetic-account',shopName:'Synthetic shop'}],expenses:[{id:'expense',month:'2026-11',accountId:'synthetic-account',scope:'SHOP',amount:2,name:'Synthetic',category:'Synthetic',note:''}],costOverrides:[{id:'cost',month:'2026-11',accountId:'synthetic-account',averageItemCost:5,note:'',createdAt:'',updatedAt:'',createdBy:''}],storage:{}};
 assert.deepEqual(plain(await lean.getProfitSummary(profit)),plain(await old.getProfitSummary(profit)));
});
test('missing optional provider details and identity fallbacks preserve all report values',async()=>{
 const r=receipt({line_items:[{id:'',quantity:0,item_id:null,variant_id:null,item_name:'Fallback',sku:'FALLBACK'}],payments:[{name:'Fallback',money_amount:0}]});
 const old=records(before('src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts'),[r]),lean=records(mapping,[r]);
 const input={accountId:'synthetic-account',salesDate:'2026-11-01',storage:{}};assert.deepEqual(plain(await reports(lean).getDailySales(input)),plain(await reports(old).getDailySales(input)));assert.equal(lean.items[0].id,old.items[0].id);assert.equal(lean.payments[0].id,old.payments[0].id);
});
test('every report input field remains in the lean stored records',()=>{
 const source=ts.createSourceFile('reports.ts',fs.readFileSync('src/modules/sales/application/reports.ts','utf8'),ts.ScriptTarget.Latest,true);
 const data=records(mapping),owners={receipt:data.receipts[0],item:data.items[0],payment:data.payments[0],sync:data.syncs[0]};let reads=0;
 function visit(n){if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&owners[n.expression.text]){assert.ok(Object.hasOwn(owners[n.expression.text],n.name.text),`${n.expression.text}.${n.name.text} was dropped`);reads++;}ts.forEachChild(n,visit);}visit(source);assert.ok(reads>40);
});
