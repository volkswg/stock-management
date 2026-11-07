import { completionExtraFiles, completionNewFiles, assertCompletionHistory } from "./helpers/hr-application-history.mjs";
import { expectedHRDebts } from "./helpers/hr-payroll-history.mjs";
import { hrFiles, hrNewFiles, assertHRHistory } from "./helpers/hr-payroll-history.mjs";
import { expectedExpensesDebts } from "./helpers/expenses-business-history.mjs";
import { expensesFiles, expensesNewFiles, assertExpensesHistory } from "./helpers/expenses-business-history.mjs";
import { remainingFiles, remainingDestinations, assertRemainingHistory } from "./helpers/remaining-worksheet-history.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { plain } from './helpers/load-source.mjs';
import { googleGraph } from './helpers/google-infrastructure.mjs';
import { userStateBefore } from './helpers/user-state-worksheet-history.mjs';
const old='src/externals/google/sheet/sheets/user-state/';
test('LINE user-state worksheet retains exact defaults, mutable headers, argument identity, pending operations and original sync/async errors',async()=>{
 for(const historical of [true,false]){
  const g=googleGraph({historical}),{UserStateSheet:C}=g.load(old+'UserStateSheet.ts'),headers=g.load(old+'const.ts').USER_STATE_SHEET_HEADERS,values=[['id',0,null,false]],events=[];
  const client={getValues:async(...a)=>{events.push(['read',...a]);return values;},appendValues:async(...a)=>events.push(['append',...a]),updateValues:async(...a)=>events.push(['update',...a]),deleteRow:async(...a)=>events.push(['delete',...a])},sheet=new C(client,"LINE' State");assert.deepEqual(events,[]);assert.deepEqual(plain(headers),userStateBefore.headers);assert.equal(Object.isFrozen(headers),false);
  assert.equal(await sheet.readRows(),values);await sheet.readRows(' B2:C3 ');await sheet.appendRows('A:H',values);await sheet.updateRows('B2:H2',values);await sheet.deleteRow(0);headers.push('probe');try{await sheet.readRows();}finally{headers.pop();}await sheet.readRows();
  assert.deepEqual(plain(events),[['read',"LINE' State",'A:H'],['read',"LINE' State",' B2:C3 '],['append',"LINE' State",'A:H',values],['update',"LINE' State",'B2:H2',values],['delete',"LINE' State",0],['read',"LINE' State",'A:I'],['read',"LINE' State",'A:H']]);assert.equal(events[2][3],values);assert.equal(events[3][3],values);
  for(const [method,op]of [['getValues',()=>sheet.readRows()],['appendValues',()=>sheet.appendRows('A:H',values)],['updateValues',()=>sheet.updateRows('B2:H2',values)],['deleteRow',()=>sheet.deleteRow(7)]]){
   for(const sync of [true,false]){const marker=new Error(method);let calls=0;client[method]=()=>{calls++;if(sync)throw marker;return Promise.reject(marker);};let pending;assert.doesNotThrow(()=>{pending=op();});await assert.rejects(pending,e=>e===marker);assert.equal(calls,1);}
   let release,done=false;client[method]=()=>new Promise(r=>{release=r;});const p=op().then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);release(values);await p;assert.equal(done,true);
  }
 }
});

test('actual LINE movement session creation/read/update/delete and specific header-recovery behavior match original golden',async()=>{
 const {userStateWorkflow}=await import('./helpers/user-state-worksheet-workflow.mjs');for(const historical of [true,false])assert.deepEqual(await userStateWorkflow(historical),userStateBefore.workflow);
});

test('original/current real UserStateSheet and GoogleSheetsClient preserve quoted URLs, modes, deletion requests and failure identity',async()=>{
 const traces=[];for(const historical of [true,false]){const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,...init});if(failure)throw failure;return Response.json({values:[['row',0,null]],sheets:[{properties:{sheetId:9,title:"LINE' State"}}]});}}}),{GoogleSheetsClient}=g.load('src/externals/google/sheet/client/index.ts'),{UserStateSheet}=g.load(old+'UserStateSheet.ts'),sheet=new UserStateSheet(new GoogleSheetsClient({getAccessToken:async()=> 'synthetic-token'},'sheet/id'),"LINE' State");
 assert.deepEqual(plain(await sheet.readRows()),[['row',0,null]]);assert.ok(requests[0].url.endsWith(encodeURIComponent("'LINE'' State'!A:H")));await sheet.readRows('B2:H3');const values=[['id',0,null,false,'=formula']];await sheet.appendRows('A:H',values);await sheet.updateRows('B2:H2',values);await sheet.deleteRow(7);
 assert.deepEqual(requests.map(r=>r.method),['GET','GET','POST','PUT','GET','POST']);assert.ok(requests[2].url.endsWith(':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS'));assert.ok(requests[3].url.endsWith('?valueInputOption=USER_ENTERED'));assert.deepEqual(JSON.parse(requests[2].body),{values});assert.deepEqual(JSON.parse(requests[3].body),{values});assert.ok(requests[4].url.endsWith('?fields=sheets.properties(sheetId,title)'));assert.deepEqual(JSON.parse(requests[5].body),{requests:[{deleteDimension:{range:{sheetId:9,dimension:'ROWS',startIndex:6,endIndex:7}}}]});
 for(const op of [()=>sheet.readRows(),()=>sheet.appendRows('A:H',values),()=>sheet.updateRows('B2:H2',values),()=>sheet.deleteRow(7)]){failure=new Error('synthetic fetch');const n=requests.length;await assert.rejects(op(),e=>e===failure);assert.equal(requests.length,n+1);}traces.push(plain(requests));}
 assert.deepEqual(traces[1],traces[0]);
});

test('two exact moves reconstruct complete original sources/ASTs and retain every other production and historical fixture byte',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs'),{default:ts}=await import('typescript'),{userStateHash,assertUserStateHistory,userStateFiles,userStateDestinations}=await import('./helpers/user-state-worksheet-history.mjs');
 for(const [file,hash]of Object.entries(userStateBefore.productionHashes)){if(completionExtraFiles.has(file))assertCompletionHistory(file,hash);else if(hrFiles.has(file))assertHRHistory(file,hash);else if(expensesFiles.has(file))assertExpensesHistory(file,hash);else if(remainingFiles.has(file))assertRemainingHistory(file,hash);else if(userStateFiles.has(file))assertUserStateHistory(file,hash);else assert.equal(userStateHash(readFileSync(file)),hash,file);}
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);assert.deepEqual(walk('src').filter(f=>!f.endsWith('.tsbuildinfo')&&!Object.hasOwn(userStateBefore.productionHashes,f)).sort(),[...completionNewFiles,...hrNewFiles,...expensesNewFiles,...remainingDestinations,...userStateDestinations].sort());
 for(const [file,hash]of Object.entries(userStateBefore.fixtureHashes))assert.equal(userStateHash(readFileSync(file)),hash,file);
 const all=walk('src').filter(f=>f.endsWith('.ts')).map(f=>readFileSync(f,'utf8')).join('\n'),printer=ts.createPrinter();for(const e of Object.values(userStateBefore.moves)){const ast=ts.createSourceFile(e.to,readFileSync(e.to,'utf8'),ts.ScriptTarget.Latest,true);assert.deepEqual(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>printer.printNode(ts.EmitHint.Unspecified,n,ast)),e.declarations);assert.equal((all.match(new RegExp(`export ${e.export==='UserStateSheet'?'class':'const'} ${e.export}\\b`,'g'))??[]).length,1);}
});

test('physical/legacy/index/registry class, prototype, header and export order identities are strict; aggregate batch mapping is unchanged',async()=>{
 const g=googleGraph(),registry=g.load('src/externals/google/sheet/index.ts'),index=g.load('src/externals/google/sheet/sheets/index.ts'),original=googleGraph({historical:true}),C=g.load(userStateBefore.moves[old+'UserStateSheet.ts'].to).UserStateSheet,headers=g.load(userStateBefore.moves[old+'const.ts'].to).USER_STATE_SHEET_HEADERS;
 for(const mod of [g.load(old+'UserStateSheet.ts'),index,registry])assert.equal(mod.UserStateSheet,C);for(const mod of [g.load(old+'const.ts'),registry])assert.equal(mod.USER_STATE_SHEET_HEADERS,headers);
 assert.equal(Object.hasOwn(index,'USER_STATE_SHEET_HEADERS'),false);assert.equal(Object.hasOwn(original.load('src/externals/google/sheet/sheets/index.ts'),'USER_STATE_SHEET_HEADERS'),false);
 assert.deepEqual(Object.keys(registry),Object.keys(original.load('src/externals/google/sheet/index.ts')));assert.deepEqual(Object.keys(index),Object.keys(original.load('src/externals/google/sheet/sheets/index.ts')));assert.equal(Object.getPrototypeOf(C),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(C.prototype),registry.BaseGoogleSheet.prototype);assert.equal(C.prototype.constructor,C);
 const settings=new Proxy({spreadsheetId:'fake',serviceAccountEmail:'fake',serviceAccountPrivateKey:'fake'},{get:(o,k)=>o[k]??String(k)}),service=new registry.GoogleSheetsService(settings);assert.equal(service.userState.constructor,C);assert.equal(Object.getPrototypeOf(service.userState),C.prototype);assert.equal(g.load(userStateBefore.moves[old+'UserStateSheet.ts'].to).UserStateSheet,C);
 const events=[],result=[[['session']],[['detail']]];service.client.getValuesBatch=async a=>{events.push(a);return result;};assert.equal(await service.readMovementRanges([{sheet:'userState',range:'A:H'},{sheet:'movementDetails',range:'A:N'}]),result);assert.deepEqual(plain(events),[[{worksheetName:'userStateWorksheetName',range:'A:H'},{worksheetName:'movementDetailWorksheetName',range:'A:N'}]]);
 for(const file of ['src/config/index.ts','src/modules/line-workflows/server.ts'])assert.throws(()=>g.load(file),/Unapproved provider dependency/);
});

test('actual resolved runtime/type graphs retain prerequisites, browser debts and cycle baseline; exact worksheet lint rejects bypasses',async()=>{
 const {readFileSync}=await import('node:fs'),{userStateGraph}=await import('./helpers/user-state-worksheet-graph.mjs'),{userStateDestinations}=await import('./helpers/user-state-worksheet-history.mjs'),{ESLint}=await import('eslint'),current=userStateGraph(),before=userStateGraph(Object.fromEntries(Object.entries(userStateBefore.moves).map(([f,e])=>[f,e.source])));
 const target=p=>p.startsWith('src/modules/line-workflows/'),roots=['src/services/stock-counts/manageStockCounts.ts','src/services/movements/manageMovements.ts','src/services/stock-adjustments/manageStockAdjustments.ts','src/services/sales/getGoogleSheetsDailySales.ts'];
 function cycles(g,types){const seen=new Set(),active=[],out=[];function visit(f){if(active.includes(f)){out.push([...active.slice(active.indexOf(f)),f]);return;}if(seen.has(f))return;active.push(f);g.deps(f,types).forEach(visit);active.pop();seen.add(f);}g.all.forEach(visit);return out;}
 const clients=current.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))),known=JSON.parse(readFileSync('tests/fixtures/inventory-worksheets-before.json','utf8')).browserBaseline.map(e=>e.root).filter(root=>expectedHRDebts(expectedExpensesDebts([root])).length).sort();
 for(const types of [false,true]){
  current.modules(types);assert.deepEqual(cycles(current,types),cycles(before,types));assert.deepEqual(cycles(current,types),[]);assert.deepEqual(userStateBefore.graphBaseline.runtimeCycles,[]);assert.equal(userStateBefore.graphBaseline.typeCycles.length,1);
  for(const root of roots)assert.equal(current.trace(root,types,target),null,root);
  const canonical=f=>Object.values(userStateBefore.moves).find(e=>e.to===f)?Object.entries(userStateBefore.moves).find(([,e])=>e.to===f)[0]:f;
  function closure(g,root){const seen=new Set();function visit(f){if(seen.has(f))return;seen.add(f);g.deps(f,types).forEach(visit);}visit(root);return [...new Set([...seen].map(canonical))].sort();}
  for(const root of clients)assert.deepEqual(closure(current,root),closure(before,root),root);
  const debts=[];for(const root of clients){const path=current.trace(root,types,target);if(types&&path)debts.push(root);else assert.equal(path,null,root);}assert.deepEqual(debts.sort(),types?known:[]);
  for(const file of current.all.filter(f=>f.startsWith('src/infrastructure/')))assert.equal(current.trace(file,types,p=>p.startsWith('src/modules/')),null,file);
  // A legacy mixed index is traversed, never accepted as a boundary.
  const query='src/services/sales/getGoogleSheetsDailySales.ts',saved=JSON.parse(readFileSync('tests/fixtures/inventory-sales-query-before.json','utf8'));
  const regression=userStateGraph({[query]:saved.files[query].source});assert.ok(regression.trace(roots[0],types,target));
  const physical=userStateDestinations.find(f=>f.endsWith('UserStateSheet.ts'));
  for(const source of ['export { StockCountsSheet } from "@/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet";','export { getOrderDetail } from "@/modules/orders/server";'])assert.throws(()=>userStateGraph({[physical]:source}).modules(types),/line-workflows->(?:inventory|orders)|Cycle/);
  assert.throws(()=>userStateGraph({[physical]:`export { UserStateSheet } from "@/externals/google/sheet/sheets/user-state/UserStateSheet";`}).modules(types),/Cycle/);
 }
 assert.match(readFileSync('src/services/movements/manageMovements.ts','utf8'),/from "\.\/worksheet-schema"/);assert.match(readFileSync(roots[0],'utf8'),/from "@\/services\/sales\/getGoogleSheetsDailySales"/);
 const eslint=new ESLint(),bad=['import type { IGoogleSheetsService } from "@/externals/google/sheet"; export type X=IGoogleSheetsService;','import { x } from "../../../../../../modules/inventory/server"; export {x};','export { x } from "@/config";','const x=import("@/config"); export {x};','const x=require("node:fs"); export {x};','export type X=import("@/externals/google/sheet/types").GoogleSheetRow;','import { GoogleSheetRow } from "@/infrastructure/persistence/google-sheets/types"; export const x=GoogleSheetRow;','export const x=Date.now();','import x = require("@/config"); export {x};'];
 for(const file of userStateDestinations){const [ok]=await eslint.lintText(readFileSync(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));for(const source of bad){const [r]=await eslint.lintText(source,{filePath:file});assert.ok(r.errorCount>0,`${file}: ${source}`);}}
});
