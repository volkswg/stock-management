/* eslint-disable @typescript-eslint/no-require-imports -- Actual runtime on an independently restored synthetic database. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createBusinessDatabase}=require('../../src/composition/postgres/service.ts');
const sales=require('../../src/modules/sales/server.ts');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
global.fetch=()=>{throw Error('Real providers forbidden');};
test.after(db.closePool);
test('restored table-absent database serves the same report and historical split through current owners',async()=>{
 await db.transaction(false,async()=>{
  const storage=createBusinessDatabase();
  assert.equal((await db.currentTransaction().query("SELECT to_regclass('stock_operational.sales_receipt_payments') IS NULL absent")).rows[0].absent,true);
  const daily=await sales.getDailySales({storage,accountId:'retired',salesDate:'2026-11-01'});assert.equal(daily.totals.netSales,72);
  const split=await sales.getDailySales({storage,accountId:'split',salesDate:'2026-11-01'});assert.deepEqual(split.paymentsByType.map(p=>[p.name,p.netPayments]).sort(),[['Card',3],['Cash',2]]);
 });
});
