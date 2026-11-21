/* eslint-disable @typescript-eslint/no-require-imports -- Execute current feature owners without providers or a database. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {withReceiptPayment,receiptPaymentRows}=require('../../src/modules/sales/infrastructure/postgres/receipt-payment.ts');
const {createReceiptSync}=require('../../src/modules/sales/infrastructure/postgres/receipt-sync.ts');
const {receipt}=require('../helpers/lean-sales-fixture.cjs');

test('a receipt projects one payment independent of product count; zero amount differs from no payment',()=>{
 const base={id:'receipt',syncedAt:'2026-11-01T00:00:00Z'};
 const value=withReceiptPayment(base,{id:'payment',paymentTypeId:'cash',paymentName:'Cash',paymentType:'CASH',moneyAmount:'0'});
 assert.deepEqual(receiptPaymentRows([value]),[{id:'payment',receiptId:'receipt',paymentTypeId:'cash',paymentName:'Cash',paymentType:'CASH',moneyAmount:'0',syncedAt:base.syncedAt}]);
 const absent=withReceiptPayment(base);assert.equal(absent.paymentId,null);assert.equal(absent.paymentCreatedAt,null);assert.deepEqual(receiptPaymentRows([absent]),[]);
});
test('payment projection preserves legacy microsecond order, unknown dates last and UTF-8 C ID ties',()=>{
 const row=(id,at)=>({id:'receipt-'+id,paymentId:id,paymentCreatedAt:at,paymentTypeId:'cash',paymentName:id,paymentType:'CASH',paymentAmount:'1',syncedAt:''});
 const input=[row('Z',''),row('A','2026-11-01T00:00:00.000002Z'),row('B','2026-11-01T00:00:00.000001Z'),row('Q','2026-11-01T00:00:00.000002Z'),row('C',null)];
 assert.deepEqual(receiptPaymentRows(input).map(p=>p.id),['B','A','Q','C','Z']);assert.equal(input[0].paymentId,'Z');
});
test('a split payment anywhere in a fetched batch is refused before store preparation or writes',async()=>{
 let stores=0;const storage=new Proxy({},{get(){stores++;throw Error('Storage must not be called');}});
 const input=[receipt({receipt_number:'one',payments:[{money_amount:10}]}),receipt({receipt_number:'split'})];
 const {source}=createReceiptSync(storage,{id:'synthetic',shopName:'Synthetic',service:{async getReceipts(){return input;}}});
 const fetched=await source.load('2026-11-01');assert.throws(()=>fetched.project('2026-11-02T00:00:00Z'),e=>e.status===409 && /multiple/.test(e.message));assert.equal(stores,0);assert.equal(input[1].payments.length,2);
});
