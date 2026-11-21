/* eslint-disable @typescript-eslint/no-require-imports -- Execute current feature owners without providers or a database. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {withReceiptPayments,receiptPaymentRows}=require('../../src/modules/sales/infrastructure/postgres/receipt-payment.ts');
const {createReceiptSync}=require('../../src/modules/sales/infrastructure/postgres/receipt-sync.ts');
const {receipt}=require('../helpers/lean-sales-fixture.cjs');
const at='2026-11-01T00:00:00.000Z';
const payment=(id,amount='1',createdAt=at)=>({id,paymentTypeId:'cash',paymentName:'Cash',paymentType:'CASH',moneyAmount:amount,syncedAt:at,createdAt});
test('JSONB receipt supports zero, single and split payments with exact decimal text and stable IDs',()=>{
 const base={id:'synthetic',syncedAt:at},rows=[payment('one','9007199254740993.01'),{...payment('two','0'),paymentName:'Transfer',paymentTypeId:'transfer'}];
 const encoded=withReceiptPayments(base,rows),projected=receiptPaymentRows([encoded]);
 assert.equal(projected.length,2);assert.equal(projected[0].moneyAmount,'9007199254740993.01');assert.equal(projected[1].moneyAmount,'0');assert.equal(projected[1].paymentName,'Transfer');
 assert.equal(withReceiptPayments(base,[]).payments,'[]');assert.deepEqual(receiptPaymentRows([withReceiptPayments(base,[])]),[]);
 assert.equal(receiptPaymentRows([withReceiptPayments(base,[rows[0]])]).length,1);assert.equal(rows[0].createdAt,at);
});
test('global payment projection preserves microsecond order, NULLS LAST and UTF-8 C ID ties across receipts',()=>{
 const input=[withReceiptPayments({id:'later'},[payment('Z','1',null),payment('A','1','2026-11-01T00:00:00.000002Z')]),withReceiptPayments({id:'earlier'},[payment('B','1','2026-11-01T00:00:00.000001Z'),payment('Q','1','2026-11-01T00:00:00.000002Z'),payment('C','1',null)])];
 const original=JSON.stringify(input);assert.deepEqual(receiptPaymentRows(input).map(p=>p.id),['B','A','Q','C','Z']);assert.equal(JSON.stringify(input),original);
});
test('malformed arrays, numeric JSON amounts, missing fields and duplicate IDs fail closed without legacy fallback',()=>{
 for(const payments of ['null','{}','[null]','not json',JSON.stringify([{...payment('one'),moneyAmount:9007199254740992}]),JSON.stringify([{id:'missing-fields'}]),JSON.stringify([payment('same'),payment('same')])])assert.throws(()=>receiptPaymentRows([{id:'synthetic',payments}]),e=>e.status===503);
 const encoded=withReceiptPayments({id:'one'},[payment('duplicate')]);assert.throws(()=>receiptPaymentRows([encoded,{...encoded,id:'two'}]),e=>e.status===503);
 assert.throws(()=>withReceiptPayments({id:'synthetic'},[{...payment('x'),moneyAmount:1}]),e=>e.status===503);
});
test('split payments in fetched batches retain every stable identity and count without mutating the provider payload',async()=>{
 let stores=0;const storage=new Proxy({},{get(){stores++;throw Error('Storage must not be called during projection');}});
 const input=[receipt({receipt_number:'one',payments:[{money_amount:10}]}),receipt({receipt_number:'split'})],original=JSON.stringify(input);
 const {source}=createReceiptSync(storage,{id:'synthetic',shopName:'Synthetic',service:{async getReceipts(){return input;}}});
 const result=(await source.load('2026-11-01')).project(at);assert.equal(result.paymentCount,3);assert.equal(result.receiptCount,2);assert.equal(stores,0);assert.equal(JSON.stringify(input),original);
});
test('invalid provider payment containers/entries are refused before store access',async()=>{
 for(const payments of [{not:'an array'},[null],[[]]]){
  const {source}=createReceiptSync({}, {id:'synthetic',shopName:'Synthetic',service:{async getReceipts(){return [receipt({payments})];}}});
  const batch=await source.load('2026-11-01');assert.throws(()=>batch.project(at),e=>e.status===409);
 }
});
