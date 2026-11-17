import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {restoreRowOrderSource,rowOrderHistory} from './helpers/row-order-history.mjs';
const require=createRequire(import.meta.url);
const {review}=require('../tools/migration/row-order-review.cjs');
const {recordSets}=require('../tools/migration/application-parity.cjs');
const catalog=require('../tools/migration/worksheets.json');
const config={months:['2026-11'],accounts:[],asOf:'2026-11-20T00:00:00+07:00'};
const digest=s=>createHash('sha256').update(s).digest('hex');
function fixture({legacy=[],creation=legacy,latest=[...creation].reverse()}={}){
 const lines=[{metadata:{identity:'11111111-2222-4333-8444-555555555555',purpose:'isolated-staging',revision:'17'}},...Object.keys(catalog).map(t=>({inventory:t,rows:t==='user_state'?legacy.length:0}))];
 for(const [variant,rows] of Object.entries({legacy,creation,latest}))for(const cells of rows)lines.push({table:'user_state',variant,recordId:cells[0],cells});
 return lines;
}
const session=(id,createdAt)=>[id,'WT_REVIEW','OrderCreate','WT_ORDER','waiting_for_bill_image',createdAt,'',''];
const movement=(id,createdAt)=>[id,'WT_REVIEW','MovementCreate','WT_MASTER','waiting_for_quantity',createdAt,'',''];

test('ID-only production transport and bounded historical inverse retain every original witness',()=>{
 assert.doesNotMatch(readFileSync('src/infrastructure/persistence/postgres/records.ts','utf8'),/row_order/);
 for(const [file,edit] of Object.entries(rowOrderHistory.edits)){
  assert.equal(digest(readFileSync(file,'utf8')),edit.afterSha256);
  assert.equal(digest(restoreRowOrderSource(file)),edit.beforeSha256);
 }
});
test('both ordinal operations stay outside automatic migrations and require exact operator evidence',()=>{
 assert.ok(readdirSync('supabase/migrations').every(n=>!n.endsWith('_remove_row_order.sql')&&!n.endsWith('_prepare_row_order_removal.sql')));
 const dir='tools/migration/final-removal/';
 const prep=readFileSync(dir+readdirSync(dir).find(n=>n.endsWith('_prepare_row_order_removal.sql')),'utf8');
 const final=readFileSync(dir+readdirSync(dir).find(n=>n.endsWith('_remove_row_order.sql')),'utf8');
 assert.match(prep,/ALTER SEQUENCE %s RESTART WITH %s/);assert.doesNotMatch(prep,/setval\(/);
 for(const key of ['stock.expected_isolation_id','stock.expected_purpose','stock.allow_final_row_order_removal','stock.row_order_reviewed_revision','stock.row_order_reviewed_source','stock.row_order_restore_verified'])assert.ok(final.includes(key));
 assert.doesNotMatch(final,/CASCADE|DISABLE TRIGGER|DISABLE ROW LEVEL SECURITY|SECURITY DEFINER/);
 assert.equal((final.match(/DROP COLUMN row_order RESTRICT/g)||[]).length,Object.keys(catalog).length);
 assert.match(final,/Validation function drift/);assert.match(final,/Unreviewed function/);
});
test('offline semantic review passes unchanged choices and detects a changed LINE order-session winner',async()=>{
 const old=session('11','2026-11-01'),next=session('12','2026-11-02');
 const pass=await review(fixture({legacy:[old,next]}),config);
 assert.equal(pass.match,true,JSON.stringify(pass.mismatchedSections));assert.equal(pass.reviewedRevision,'17');
 const changed=await review(fixture({legacy:[next,old],creation:[old,next],latest:[next,old]}),config);
 assert.equal(changed.match,false);assert.ok(changed.mismatchedSections.includes('lineSessions'));
 assert.equal(changed.productionDropAuthorized,false);assert.equal(changed.providerCalls,false);
});
test('offline review detects actual movement read/write session changes, including unknown creation dates',async()=>{
 const unknown=movement('90',''),known=movement('91','2026-11-02');
 const report=await review(fixture({legacy:[known,unknown],creation:[known,unknown],latest:[known,unknown]}),config);
 assert.equal(report.match,false);assert.ok(report.mismatchedSections.includes('movementSessionSelection'));
 assert.equal(report.movementSessions.before[0].read.id,'90');assert.equal(report.movementSessions.after[0].read.id,'91');
});
test('review refuses incomplete order variants and missing historical month coverage',async()=>{
 const row=session('11','2026-11-01');
 await assert.rejects(review(fixture({legacy:[row],creation:[],latest:[row]}),config));
 const lines=fixture();
 const order=['WT_OLD','complete','Synthetic',1,'','2020-01-01','','','synthetic'];
 lines.find(r=>r.inventory==='orders').rows=1;
 for(const variant of ['legacy','creation','latest'])lines.push({table:'orders',variant,recordId:order[0],cells:order});
 const result=await review(lines,config);assert.equal(result.match,false);assert.ok(result.coverage.missingMonths.includes('2020-01'));
});
test('review detects a hidden compensation ID change even when all public values are identical',async()=>{
 const lines=fixture(),employee=['WT_EMP','Synthetic','','active','','','2026-11-01','','synthetic'];
 const cells=['WT_EMP','100','','2026-11-01','','synthetic','2026-11-01','monthly','','','',''];
 lines.find(r=>r.inventory==='employees').rows=1;
 lines.find(r=>r.inventory==='employee_compensations').rows=2;
 for(const variant of ['legacy','creation','latest']){
  lines.push({table:'employees',variant,recordId:employee[0],cells:employee});
  for(const recordId of variant==='legacy'?['COMP-Z','COMP-A']:['COMP-A','COMP-Z'])lines.push({table:'employee_compensations',variant,recordId,cells});
 }
 const result=await review(lines,config);
 assert.equal(result.match,false);assert.ok(result.mismatchedSections.includes('compensationSelection'));
 assert.equal(result.compensationSelections.before[0].recordId,'COMP-Z');assert.equal(result.compensationSelections.after[0].recordId,'COMP-A');
});
test('creation-order review normalizes record collections without concealing positional or value changes',()=>{
 assert.deepEqual(recordSets([{id:'B',amount:2},{id:'A',amount:1}]),recordSets([{id:'A',amount:1},{id:'B',amount:2}]));
 assert.notDeepEqual(recordSets([1,2]),recordSets([2,1]));
 assert.notDeepEqual(recordSets([{id:'A',amount:1}]),recordSets([{id:'A',amount:2}]));
 assert.notDeepEqual(recordSets(new Date('2026-11-01')),recordSets(new Date('2026-11-02')));
});
