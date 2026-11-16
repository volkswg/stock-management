/* eslint-disable @typescript-eslint/no-require-imports */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'), assert=require('node:assert/strict');
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
test.after(closePool);
test('actual record adapter writes, reads and archives without business_cells',async()=>{
 const service=createPostgresService();
 await transaction(true,async()=>{
  await service.orders.appendRows('A:I',[['NC_FINAL','draft','seller','12.3400','remark','2026-11-16','','','synthetic']]);
  let rows=await service.orders.readRows('A:I'); const index=rows.findIndex(r=>r[0]==='NC_FINAL');assert.ok(index>0);assert.equal(rows[index][3],'12.3400');
  await service.orders.updateRows(`E${index+1}`,[['updated']]);
  await service.orders.updateRows(`C${index+1}`,[[null]]);
  assert.equal((await service.orders.readRows('A:I'))[index][2],null);
  await currentTransaction().query("UPDATE stock_operational.orders SET remark='direct' WHERE id='NC_FINAL'");
  rows=await service.orders.readRows('A:I');assert.equal(rows[index][4],'direct');
  await service.orders.deleteRow(index+1);rows=await service.orders.readRows('A:I');assert.deepEqual(rows[index],[]);
 });
});
