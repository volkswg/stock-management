import {readArchive} from "./helpers/retirement-history.mjs";
import {canonicalPath} from "./helpers/retirement-history.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, plain } from './helpers/load-source.mjs';
const old='src/externals/google/sheet/sheets/';
test('record worksheets preserve defaults, payload identities, RAW overrides, pending writes and original errors',async()=>{
 const base=loadSource("src/infrastructure/persistence/google-sheets/sheets/BaseGoogleSheet.ts");
 const records=loadSource(canonicalPath(old+'expenses/RecordsSheet.ts'),{imports:{'../BaseGoogleSheet':base}});
 for(const [file,name,mode] of [['expenses/RecordsSheet','RecordsSheet',undefined],['stock-adjustments/StockAdjustmentsSheet','StockAdjustmentsSheet','RAW'],['employee-advances/PayrollRecordsSheet','PayrollRecordsSheet','RAW']]){
  const C=name==='RecordsSheet'?records.RecordsSheet:loadSource(canonicalPath(old+file+'.ts'),{imports:{'../expenses/RecordsSheet':records}})[name];
  const events=[],values=[['=literal',0,false,null]],client={getValues:async(...a)=>{events.push(['read',...a]);return values;},appendValues:async(...a)=>events.push(['append',...a]),updateValues:async(...a)=>events.push(['update',...a])};
  const sheet=new C(client,"Records' Sheet");assert.ok(sheet instanceof records.RecordsSheet);assert.equal(await sheet.readRows(),values);await sheet.readRows('B2:C3');await sheet.appendRows('A:Z',values);await sheet.updateRows('B2:C3',values);
  assert.deepEqual(plain(events),[['read',"Records' Sheet",'A:Z'],['read',"Records' Sheet",'B2:C3'],['append',"Records' Sheet",'A:Z',values,...(mode?[mode]:[])],['update',"Records' Sheet",'B2:C3',values,...(mode?[mode]:[])]]);assert.equal(events[2][3],values);
  for(const method of ['appendValues','updateValues']){let release,done=false;client[method]=()=>new Promise(r=>release=r);const p=sheet[method==='appendValues'?'appendRows':'updateRows']('A1',values).then(()=>done=true);await Promise.resolve();assert.equal(done,false);release();await p;assert.equal(done,true);}
  for(const sync of [true,false])for(const [method,op] of [['getValues','readRows'],['appendValues','appendRows'],['updateValues','updateRows']]){const error=new Error('synthetic');let calls=0;client[method]=()=>{calls++;if(sync)throw error;return Promise.reject(error);};await assert.rejects(sheet[op]('A1',values),e=>e===error);assert.equal(calls,1);}
 }
});

test('legacy, feature, root and registry constructors retain one implementation and the exact inheritance chain',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');
 const {remainingBefore,expenseRecords}=await import('./helpers/remaining-worksheet-history.mjs');
 const g=googleGraph(),registry=g.registry(),R=g.load(canonicalPath(expenseRecords)).RecordsSheet;
 assert.equal(R,g.load(canonicalPath(old+'expenses/RecordsSheet.ts')).RecordsSheet);
 assert.equal(Object.getPrototypeOf(R),registry.BaseGoogleSheet);assert.equal(Object.getPrototypeOf(R.prototype),registry.BaseGoogleSheet.prototype);
 const settings=new Proxy({spreadsheetId:'synthetic',serviceAccountEmail:'email',serviceAccountPrivateKey:'synthetic'},{get:(o,k)=>o[k]??String(k)}),service=new registry.GoogleSheetsService(settings);
 for(const [file,e]of Object.entries(remainingBefore.moves)){
  const C=g.load(canonicalPath(e.to))[e.export];assert.equal(C,g.load(canonicalPath(file))[e.export]);assert.equal(C.prototype.constructor,C);
  if(C!==R){assert.equal(Object.getPrototypeOf(C),R);assert.equal(Object.getPrototypeOf(C.prototype),R.prototype);assert.ok(new C({},'test') instanceof R);}
 }
 for(const key of ['expenses','expenseCategories','shops'])assert.equal(service[key].constructor,R);
 assert.equal(service.stockAdjustments.constructor,g.load(canonicalPath(old+'stock-adjustments/StockAdjustmentsSheet.ts')).StockAdjustmentsSheet);
 for(const key of ['employeeAdvances','payrollSettlements'])assert.equal(service[key].constructor,g.load(canonicalPath(old+'employee-advances/PayrollRecordsSheet.ts')).PayrollRecordsSheet);
 assert.throws(()=>g.load("src/config/index.ts"),/Unapproved provider dependency/);
});

test('saved-original and moved worksheets with real Sheets client preserve URLs, modes, request bodies and transport errors',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');const traces=[];
 for(const historical of [true,false]){
  const requests=[];let failure;const g=googleGraph({historical,globals:{fetch:async(url,init)=>{requests.push({url,...init});if(failure)throw failure;return Response.json({values:[['row',0,null,false]]});}}});
  const {GoogleSheetsClient}=g.load("src/infrastructure/persistence/google-sheets/client/index.ts"),client=new GoogleSheetsClient({getAccessToken:async()=> 'synthetic'},'sheet/id');
  for(const [file,name,mode]of [['expenses/RecordsSheet','RecordsSheet','USER_ENTERED'],['stock-adjustments/StockAdjustmentsSheet','StockAdjustmentsSheet','RAW'],['employee-advances/PayrollRecordsSheet','PayrollRecordsSheet','RAW']]){
   const C=g.load(canonicalPath(old+file+'.ts'))[name],sheet=new C(client,"Records' Sheet"),values=[['=literal',0,null,false]];
   assert.deepEqual(plain(await sheet.readRows()),[['row',0,null,false]]);assert.ok(requests.at(-1).url.endsWith(encodeURIComponent("'Records'' Sheet'!A:Z")));
   await sheet.appendRows('A:Z',values);assert.ok(requests.at(-1).url.endsWith(`:append?valueInputOption=${mode}&insertDataOption=INSERT_ROWS`));assert.deepEqual(JSON.parse(requests.at(-1).body),{values});
   await sheet.updateRows('B2:C3',values);assert.ok(requests.at(-1).url.endsWith(`?valueInputOption=${mode}`));assert.equal(requests.at(-1).method,'PUT');
   failure=new Error('synthetic');const count=requests.length;await assert.rejects(sheet.updateRows('A1',values),e=>e===failure);assert.equal(requests.length,count+1);failure=undefined;
  }traces.push(plain(requests));
 }assert.deepEqual(traces[1],traces[0]);
});

test('schema leaves retain exact declarations and legacy exports share mutable header identities',async()=>{
 const {remainingBefore,assertRemainingHistory}=await import('./helpers/remaining-worksheet-history.mjs');
 for(const [file,e]of Object.entries(remainingBefore.splits)){
  assertRemainingHistory(file,e.sha256);const headers=loadSource(canonicalPath(e.to)),imports={['@/'+e.to.slice(4,-3)]:headers,'./manageEmployees':{},'@/services/expenses':{}};
  // Explicit header injection proves the old export aliases the one physical object.
  const legacy=loadSource(canonicalPath(file),{imports});for(const name of e.names){assert.equal(legacy[name],headers[name]);assert.equal(Object.isFrozen(headers[name]),false);headers[name].push('_probe');assert.equal(legacy[name].at(-1),'_probe');headers[name].pop();}
 }
});

test('new worksheet graph is feature neutral in both modes and lint rejects private, legacy, erased and dynamic bypasses',async()=>{
 const {userStateGraph}=await import('./helpers/user-state-worksheet-graph.mjs'),{remainingDestinations}=await import('./helpers/remaining-worksheet-history.mjs'),{ESLint}=await import('eslint');
 const g=userStateGraph(),eslint=new ESLint();
 for(const types of [false,true]){
  g.modules(types);
  for(const file of remainingDestinations){const owner=/^src\/modules\/([^/]+)\//.exec(file)?.[1];assert.equal(g.trace(file,types,p=>p.startsWith('src/externals/')||p.startsWith('src/services/')||p.startsWith('src/app/')||p.startsWith('src/modules/')&&!p.startsWith(`src/modules/${owner}/`)),null,file);}
  for(const root of g.all.filter(f=>/^\s*['"]use client['"]/.test(readArchive(f,'utf8'))))assert.equal(g.trace(root,false,p=>remainingDestinations.includes(p)),null,root);
 }
 for(const file of remainingDestinations){const [ok]=await eslint.lintText(readArchive(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));
  for(const code of ['import type { IGoogleRowsSheet } from "@/externals/google/sheet/types"; export type X=IGoogleRowsSheet;','export { RecordsSheet } from "@/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet";','export type X=import("@/config").AppConfig;','const x=require("node:fs"); export {x};']){const [bad]=await eslint.lintText(code,{filePath:file});assert.ok(bad.errorCount>0,`${file}: ${code}`);}
 }
});

test('actual Expense use case and original/current record transport retain cents, filters, ordering, idempotency and failures',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');const results=[];
 for(const historical of [true,false]){
  const headers=loadSource("src/modules/expenses/infrastructure/google-sheets/expenses/const.ts"),events=[],g=googleGraph({historical}),{RecordsSheet}=g.load(canonicalPath(old+'expenses/RecordsSheet.ts'));
  const row=(id,month,amount,deleted='')=>[id,month,month+'-06','S','SHOP','C',id,amount,'note','created','updated','actor',deleted];
  const data={expenses:[Array.from(headers.EXPENSE_HEADERS),row('old','2025-12',99),row('deleted','2026-11',99,'deleted'),row('first','2026-10',0.1),row('second','2026-11',0.2)],shops:[Array.from(headers.SHOP_HEADERS),['S','Shop',true,'account','c','u']],categories:[Array.from(headers.CATEGORY_HEADERS),['C','Category',true,'c','u']]};
  let failure;const client={getValues:async(name,range)=>{events.push(['read',name,range]);return data[name].map(r=>r.slice());},appendValues:async(name,range,values)=>{events.push(['append',name,range,plain(values)]);if(failure)throw failure;data[name].push(...plain(values));},updateValues:async(name,range,values)=>{events.push(['update',name,range,plain(values)]);if(failure)throw failure;const at=Number(/\d+/.exec(range)[0])-1;data[name].splice(at,values.length,...plain(values));}};
  const service={expenses:new RecordsSheet(client,'expenses'),shops:new RecordsSheet(client,'shops'),expenseCategories:new RecordsSheet(client,'categories')};
  class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-07T00:00:00Z']));}}
  const api=loadSource("src/services/expenses/manageExpenses.ts",{imports:{'./types':headers,'node:crypto':{randomUUID:()=> 'fixed-id'}},globals:{Date:Clock,Error}});
  const list=plain(await api.listExpenses({googleSheetsService:service,year:'2026'}));assert.deepEqual(list.map(x=>x.id),['second','first']);assert.deepEqual(list.map(x=>x.amount),[0.2,0.1]);assert.equal(list.reduce((sum,x)=>sum+x.amount,0),0.30000000000000004);assert.equal(list[0].accountId,'account');assert.equal(list[0].category,'Category');
  const input={month:'2026-11',expenseDate:'2026-11-06',scope:'SHOP',shopId:'S',categoryId:'C',name:'  New  ',amount:12.34,note:' note ',requestId:'00000000-0000-0000-0000-000000000000'};
  const id=await api.saveExpense(service,input);assert.equal(id,'EXP-'+input.requestId);const writes=()=>events.filter(e=>e[0]==='append'||e[0]==='update').length;
  assert.equal(await api.saveExpense(service,input),id);assert.equal(writes(),1);await assert.rejects(api.saveExpense(service,{...input,amount:1}),e=>e.status===409);assert.equal(writes(),1);
  failure=new Error('write failure');await assert.rejects(api.saveExpense(service,{...input,requestId:undefined}),e=>e===failure);failure=undefined;
  await api.removeExpense(service,id);assert.equal(data.expenses.at(-1)[12],'2026-11-07T00:00:00.000Z');
  data.expenses[0]=['wrong'];await assert.rejects(api.listExpenses({googleSheetsService:service,year:'2026'}),e=>e.status===503);
  results.push(plain({list,data,events}));
 }assert.deepEqual(results[1],results[0]);
});

test('actual payroll ledger through original/current PayrollRecordsSheet preserves deductions, snapshots and exported header order',async()=>{
 const {remainingBefore}=await import('./helpers/remaining-worksheet-history.mjs'),{googleGraph}=await import('./helpers/google-infrastructure.mjs'),{default:ts}=await import('typescript'),vm=await import('node:vm');
 const file='src/services/employees/manageSalaryAdvances.ts',saved=remainingBefore.splits[file],headers=loadSource(canonicalPath(saved.to)),imports={'./manageEmployees':{},'@/services/expenses':{},['@/'+saved.to.slice(4,-3)]:headers};
 const original={};new vm.Script(ts.transpileModule(saved.source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({exports:original,Error,Date,require:s=>{assert.ok(Object.hasOwn(imports,s),s);return imports[s];}});
 const current=loadSource(canonicalPath(file),{imports,globals:{Error}});assert.deepEqual(Object.keys(current),Object.keys(original));const results=[];
 for(const historical of [true,false]){
  const api=historical?original:current,g=googleGraph({historical}),{PayrollRecordsSheet}=g.load(canonicalPath(old+'employee-advances/PayrollRecordsSheet.ts')),events=[];
  const data={advances:[Array.from(headers.ADVANCE_HEADERS),['A','E','S','2026-09-01','2026-09',100.25,100.25,'paid','2026-09-01','ref','note','c','u']],settlements:[Array.from(headers.SETTLEMENT_HEADERS)]};
  const client={getValues:async(name,range)=>{events.push(['read',name,range]);return data[name];}},service={employeeAdvances:new PayrollRecordsSheet(client,'advances'),payrollSettlements:new PayrollRecordsSheet(client,'settlements')};
  const ledger=await api.readSalaryLedger(service),deductions=api.calculateAdvanceDeductions(ledger.advances,ledger.settlements,'E','2026-11',70.1);assert.equal(deductions.advanceDeduction,70.1);
  const marker=new Error('quota');client.getValues=()=>Promise.reject(marker);await assert.rejects(api.readSalaryLedger(service),e=>e===marker);
  results.push(plain({ledger,deductions,events}));
 }assert.deepEqual(results[1],results[0]);
});
