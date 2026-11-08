import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {syncHarness,coordinatorModel,salesDate,sampleReceipt,plain} from './helpers/sales-sync-reliability.mjs';
import {syncHistory,restoreSyncSource} from './helpers/sales-sync-reliability-history.mjs';
import {loadSalesSource} from './helpers/sales-source.mjs';
import {googleGraph} from './helpers/google-infrastructure.mjs';
const writes=w=>w.events.filter(e=>e[0]==='atomic');
const counts=w=>Object.values(w.data).map(rows=>rows.length-1);
const seed=async()=>{const w=syncHarness();await w.sync();return plain(w.data);};

test('atomic current sync preserves original projected rows, counts, Bangkok query and financial reports including refunds',async()=>{
 const receipts=[sampleReceipt,{...sampleReceipt,receipt_number:'refund',receipt_type:'REFUND',refund_for:'R/1',total_money:10,line_items:[],payments:[]}];
 const w=syncHarness({receipts});const output=await w.sync();assert.equal(output.receiptCount,2);assert.equal(writes(w).length,1);assert.deepEqual(counts(w),[2,1,1,1]);
 assert.equal((await w.sync()).outcome,'already_synced');assert.equal(writes(w).length,1);
 assert.equal(w.events.find(e=>e[0]==='loyverse')[1].receiptDateMin,'2026-10-31T17:00:00.000Z');
 // Execute the original adapter/application on identical inputs, not expected
 // fixtures generated from the new code. Only the old persistence is fake.
 const old={};for(const [name,rows]of Object.entries(w.data))old[name]=[rows[0]];
 const service=Object.fromEntries(Object.keys(old).map(name=>[name,{async readRows(range){return /1:.*1$/.test(range)?old[name].slice(0,1):old[name];},async updateRows(_range,rows){old[name][0]=rows[0];},async appendRows(_range,rows){old[name].push(...plain(rows));}}]));
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-08T01:00:00Z']));}}
 const original=loadSalesSource('src/modules/sales/server.ts',{originals:syncHistory.files,globals:{Date:Clock}});
 const prior=await original.syncLoyverseDailySales({account:w.account,googleSheetsService:service,salesDate});assert.deepEqual(plain(output),plain(prior));assert.deepEqual(plain(w.data),plain(old));
 for(const api of [original,w.api]){const reports=await Promise.all([api.getGoogleSheetsDailySales({accountId:'shop',salesDate,googleSheetsService:service}),api.getGoogleSheetsSalesDashboard({fromDate:salesDate,toDate:salesDate,googleSheetsService:service}),api.getGoogleSheetsProfitSummary({accounts:[{id:'shop',shopName:'Shop'}],year:'2026',costOverrides:[],expenses:[],googleSheetsService:service})]);if(api===original)w.originalReports=plain(reports);else assert.deepEqual(plain(reports),w.originalReports);}
});

test('all legacy partial permutations recover only missing receipt/item/payment rows without rewriting old timestamps',async()=>{
 const full=await seed(),names=Object.keys(full).slice(0,3);
 for(let mask=0;mask<8;mask++){
  const rows=structuredClone(full);rows.salesReceiptSyncs=rows.salesReceiptSyncs.slice(0,1);
  for(const [i,name]of names.entries()){if(!(mask&(1<<i)))rows[name]=rows[name].slice(0,1);}
  const before=structuredClone(rows),w=syncHarness({rows,clock:'2026-11-09T02:00:00Z'});await w.sync();assert.deepEqual(counts(w),[1,1,1,1]);
  for(const name of names)if(before[name].length>1)assert.deepEqual(w.data[name][1],before[name][1]);
  assert.equal(writes(w).length,1);assert.equal((await w.sync()).outcome,'already_synced');
 }
});

test('lost response after atomic commit verifies success and never appends again',async()=>{
 const w=syncHarness();w.state.mode='commit-timeout';assert.equal((await w.sync()).outcome,'synced');assert.equal(w.coordinator.backend.pending,null);assert.deepEqual(counts(w),[1,1,1,1]);
 assert.equal((await w.sync()).outcome,'already_synced');assert.equal(writes(w).length,1);
});

test('timeout with no visible outcome quarantines durably across independent instances and never resends',async()=>{
 const w=syncHarness();w.state.mode='timeout-before';await assert.rejects(w.sync(),/outcome unconfirmed/);assert.ok(w.coordinator.backend.pending);assert.deepEqual(counts(w),[0,0,0,0]);
 const restarted=coordinatorModel(w.coordinator.backend);w.state.mode='normal';await assert.rejects(w.sync({coordinator:restarted}),/outcome unconfirmed/);assert.equal(writes(w).length,1);
 await assert.rejects(w.sync({account:{...w.account,id:'other'},coordinator:restarted}),/quarantined/);assert.equal(writes(w).length,1);
});

test('late commit after timeout is recovered from durable intent by a later invocation, including failed verification reads',async()=>{
 const w=syncHarness();w.state.mode='post-read-fail';await assert.rejects(w.sync(),/outcome unconfirmed/);assert.equal(writes(w).length,1);assert.ok(w.coordinator.backend.pending);
 w.state.mode='normal';assert.equal((await w.sync({coordinator:coordinatorModel(w.coordinator.backend)})).outcome,'already_synced');assert.equal(w.coordinator.backend.pending,null);assert.equal(writes(w).length,1);
});

test('simultaneous same-key invocations from independent coordinators serialize before reads and publish once',async()=>{
 const w=syncHarness();let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);w.state.gate=async()=>{enter();await gate;};
 const first=w.sync();await entered;let finished=false;const second=w.sync({coordinator:coordinatorModel(w.coordinator.backend)}).then(r=>{finished=true;return r;});
 await new Promise(r=>setImmediate(r));assert.equal(finished,false);assert.equal(writes(w).length,1);release();const results=await Promise.all([first,second]);assert.deepEqual(results.map(r=>r.outcome),['synced','already_synced']);assert.deepEqual(counts(w),[1,1,1,1]);
});

test('different account/date keys still serialize shared workbook positions; unresolved writes block other keys',async()=>{
 const w=syncHarness();const other={...w.account,id:'other'};
 const results=await Promise.all([w.sync(),w.sync({account:other,coordinator:coordinatorModel(w.coordinator.backend)})]);assert.deepEqual(results.map(r=>r.outcome),['synced','synced']);assert.deepEqual(counts(w),[2,2,2,2]);
 assert.equal(new Set(w.data.salesReceipts.slice(1).map(row=>row[0])).size,2);
});

test('duplicate projected receipt/item IDs and sanitized ID collisions fail before any mutation',async()=>{
 const cases=[[sampleReceipt,sampleReceipt],[{...sampleReceipt,line_items:[sampleReceipt.line_items[0],sampleReceipt.line_items[0]]}],[sampleReceipt,{...sampleReceipt,receipt_number:'R?1'}]];
 for(const receipts of cases){const w=syncHarness({receipts});await assert.rejects(w.sync(),/Duplicate projected/);assert.equal(writes(w).length,0);assert.equal(w.coordinator.backend.pending,null);}
});

test('stored duplicate IDs, corrupt headers, row conflicts, unexpected children and empty-provider mismatches block without deleting history',async()=>{
 const full=await seed(),cases=[];
 for(const name of Object.keys(full)){const rows=structuredClone(full);if(name!=='salesReceiptSyncs')rows.salesReceiptSyncs=rows.salesReceiptSyncs.slice(0,1);rows[name].push(structuredClone(rows[name][1]??full.salesReceiptSyncs[1]));cases.push(rows);}
 const badHeader=structuredClone(full);badHeader.salesReceiptItems[0][2]='wrong';cases.push(badHeader);
 const conflict=structuredClone(full);conflict.salesReceiptSyncs.length=1;conflict.salesReceipts[1][18]='1000';cases.push(conflict);
 const orphan=structuredClone(full);orphan.salesReceiptSyncs.length=1;orphan.salesReceipts.length=1;orphan.salesReceiptItems.push([...orphan.salesReceiptItems[1]]);orphan.salesReceiptItems[2][0]='unexpected-child';cases.push(orphan);
 for(const rows of cases){const before=structuredClone(rows),w=syncHarness({rows});await assert.rejects(w.sync(),/Sales sync blocked/);assert.deepEqual(w.data,before);assert.equal(writes(w).length,0);}
 const rows=structuredClone(full);rows.salesReceiptSyncs.length=1;const w=syncHarness({rows,receipts:[]});await assert.rejects(w.sync(),/unexpected rows/);assert.equal(writes(w).length,0);
});

test('complete markers are verified for actual counts, duplicate rows and date/identity before already_synced',async()=>{
 const full=await seed();for(const modify of [d=>{d.salesReceiptSyncs[1][5]='2';},d=>{d.salesReceiptItems.length=1;},d=>{d.salesReceiptSyncs[1][1]='2026-11-02';},d=>{d.salesReceiptSyncs[1][4]='failed';}]){const rows=structuredClone(full);modify(rows);const w=syncHarness({rows});await assert.rejects(w.sync(),/Sales sync blocked/);assert.equal(writes(w).length,0);assert.ok(!w.events.some(e=>e[0]==='loyverse'));}
});

test('provider failures leave no intent/writes; a retry with restored provider succeeds',async()=>{
 const w=syncHarness();const error=new Error('offline provider');w.state.providerError=error;await assert.rejects(w.sync(),e=>e===error);assert.equal(w.coordinator.backend.pending,null);assert.equal(writes(w).length,0);w.state.providerError=null;await w.sync();assert.deepEqual(counts(w),[1,1,1,1]);
});

test('invalid atomic requests, excessive payload/cells and insufficient grid capacity are rejected before intent or POST',async()=>{
 const w=syncHarness();w.state.capacity=1;await assert.rejects(w.sync(),/grid/);assert.equal(writes(w).length,0);assert.equal(w.coordinator.backend.pending,null);
 w.state.capacity=100000;w.account.service.getReceipts=async()=>[{...sampleReceipt,line_items:[{...sampleReceipt.line_items[0],line_note:'x'.repeat(1_600_000)}]}];await assert.rejects(w.sync(),/safe limits/);assert.equal(writes(w).length,0);assert.equal(w.coordinator.backend.pending,null);
 const Client=googleGraph({globals:{TextEncoder,fetch:()=>assert.fail('No provider calls for invalid batch')}}).load('src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts').GoogleSheetsClient;
 const c=new Client({getAccessToken:()=>assert.fail('No auth for invalid batch')},'book');
 for(const updates of [[{worksheetName:'s',range:'A1:B1',values:[['one']]}],[{worksheetName:'s',range:'A1:A1',values:[['a']]},{worksheetName:'s',range:'A2:A2',values:[['b']]}],[{worksheetName:'s',range:'A0:A1',values:[['a']]}],[{worksheetName:'s',range:'A1:A1',values:[[NaN]]}]])await assert.rejects(c.batchUpdateWorkbookValues(updates,()=>assert.fail('Invalid intent')),/Invalid/);
});

test('rejected atomic request and post-write corruption never publish a success response or retry blindly',async()=>{
 for(const mode of ['reject','normal']){const w=syncHarness();w.state.mode=mode;if(mode==='normal')w.state.afterPost=d=>{d.salesReceiptPayments.length=1;};await assert.rejects(w.sync(),/outcome unconfirmed/);assert.ok(w.coordinator.backend.pending);assert.equal(writes(w).length,1);await assert.rejects(w.sync(),/Sales sync blocked/);assert.equal(writes(w).length,1);}
});

test('absent coordinator blocks the production entrypoint before source, auth or Sheets IO',async()=>{
 const w=syncHarness();await assert.rejects(w.sync({coordinator:undefined}),/durable workbook\/account\/date coordinator/);assert.equal(w.events.length,0);
});

test('approved source inverses and all inherited historical fixtures remain byte-identical',()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex');for(const [file,saved]of Object.entries(syncHistory.files))assert.equal(hash(restoreSyncSource(file)),saved.sha256,file);
 for(const [file,expected]of Object.entries(syncHistory.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
});

test('write API retains validation/status/JSON and existing unauthenticated boundary; unavailable coordinator fails closed without leaking provider data',async()=>{
 const {accountGraph,envConfig}=await import('./helpers/loyverse-accounts.mjs');const w=syncHarness();
 const g=accountGraph({config:envConfig(),imports:{'@/composition/google-sheets':{createGoogleSheetsServiceFromConfig:()=>w.service},'@/modules/sales/server':w.api}});
 const route=g.load('src/app/api/loyverse/daily-sales/sync/route.ts');
 const post=body=>route.POST(new Request('https://example.test/api/loyverse/daily-sales/sync',{method:'POST',body:JSON.stringify(body)}));
 assert.equal((await post(null)).status,400);assert.equal((await post({account:'first',date:'invalid'})).status,400);assert.equal((await post({account:'absent',date:salesDate})).status,404);
 // No Authorization/cookie supplied. This intentionally characterizes, rather
 // than changes, the inherited public write policy for separate security review.
 const response=await post({account:'first',date:salesDate});assert.equal(response.status,502);const body=await response.json();assert.deepEqual(Object.keys(body).sort(),['error','ok']);assert.equal(body.ok,false);assert.match(body.error,/durable workbook\/account\/date coordinator/);assert.equal(w.events.length,0);
 assert.doesNotMatch(JSON.stringify([body,g.events.filter(e=>e[0]==='log')]),/synthetic-first-secret|synthetic-second-secret|synthetic-google-token/);
});

test('a genuinely late visible commit resolves quarantine without another POST; competing retries cannot resend an invisible write',async()=>{
 const w=syncHarness();w.state.mode='timeout-before';const results=await Promise.allSettled([w.sync(),w.sync({coordinator:coordinatorModel(w.coordinator.backend)})]);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(writes(w).length,1);assert.deepEqual(counts(w),[0,0,0,0]);
 // Deliver the original request only now, after its timeout and failed readback.
 for(const entry of writes(w)[0][1].data){const [,name,start]=/^'(.+)'!A(\d+)/.exec(entry.range);entry.values.forEach((row,i)=>w.data[name][Number(start)-1+i]=plain(row));}
 w.state.mode='normal';assert.equal((await w.sync({coordinator:coordinatorModel(w.coordinator.backend)})).outcome,'already_synced');assert.equal(writes(w).length,1);assert.equal(w.coordinator.backend.pending,null);
});

test('pending payload changes, failed durable intent and mutated projected counts cannot trigger a write',async()=>{
 const w=syncHarness();w.state.mode='timeout-before';await assert.rejects(w.sync(),/outcome unconfirmed/);w.account.service.getReceipts=async()=>[{...sampleReceipt,total_money:101}];await assert.rejects(w.sync(),/Pending payload differs/);assert.equal(writes(w).length,1);
 const intentFailure=syncHarness();const bad={run:(_key,work)=>work({pendingFingerprint:null,beginWrite:async()=>{throw new Error('synthetic-private-journal-failure');},confirmWrite:async()=>assert.fail('No confirmed write')})};await assert.rejects(intentFailure.sync({coordinator:bad}),error=>/durable intent failed/.test(error.message)&&!error.message.includes('synthetic-private'));assert.equal(writes(intentFailure).length,0);
 const receipts=[structuredClone(sampleReceipt)],changed=syncHarness({receipts});const read=changed.service.salesReceipts.readRows.bind(changed.service.salesReceipts);let n=0;changed.service.salesReceipts.readRows=async(...args)=>{if(++n===2)receipts.push({...sampleReceipt,receipt_number:'later'});return read(...args);};await assert.rejects(changed.sync(),/Projected counts changed/);assert.equal(writes(changed).length,0);
});

test('empty provider dates and empty worksheets publish headers/counts atomically; payload/cell and capacity checks precede durable intent',async()=>{
 const empty=syncHarness({rows:{salesReceipts:[],salesReceiptItems:[],salesReceiptPayments:[],salesReceiptSyncs:[]},receipts:[]});const result=await empty.sync();assert.deepEqual([result.receiptCount,result.itemCount,result.paymentCount],[0,0,0]);assert.deepEqual(counts(empty),[0,0,0,1]);assert.equal(writes(empty).length,1);assert.equal((await empty.sync()).outcome,'already_synced');
 const Client=googleGraph({globals:{TextEncoder,fetch:()=>assert.fail('Limit check must precede IO')}}).load('src/infrastructure/persistence/google-sheets/client/GoogleSheetsClient.ts').GoogleSheetsClient;const client=new Client({},'book');await assert.rejects(client.batchUpdateWorkbookValues([{worksheetName:'s',range:'A1:A50001',values:Array.from({length:50001},()=>['x'])}],()=>assert.fail('Limit check must precede intent')),/safe limits/);
});

test('real scoped lint forbids independent sync mutations and retains provider/private import exclusions',async()=>{
 const {ESLint}=await import('eslint'),eslint=new ESLint(),filePath='src/modules/sales/infrastructure/google-sheets/receipt-sync.ts';
 const [actual]=await eslint.lintText(readFileSync(filePath,'utf8'),{filePath});assert.equal(actual.errorCount,0,JSON.stringify(actual.messages));
 for(const method of ['appendRows','updateRows','appendValues','updateValues','clear','deleteRow']){const [result]=await eslint.lintText(`export const bad=(sheet: {${method}():void})=>sheet.${method}();`,{filePath});assert.ok(result.messages.some(m=>m.ruleId==='no-restricted-syntax'),method);}
 const [bad]=await eslint.lintText('export {PayrollRecordsSheet} from "@/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet";',{filePath});assert.ok(bad.errorCount);
});

test('occupied append destinations, including blank-displaying formulas, are never overwritten or journaled',async()=>{
 for(const cell of ['=""','historical',0,false]){const w=syncHarness();w.state.beforeDestinationRead=data=>{data.salesReceipts.push([cell]);};await assert.rejects(w.sync(),/target grid contains existing data/);assert.equal(writes(w).length,0);assert.equal(w.coordinator.backend.pending,null);assert.deepEqual(w.data.salesReceipts[1],[cell]);}
});
