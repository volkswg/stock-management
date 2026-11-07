import { createHRSourceLoader, hrSourceFiles } from "./hr-payroll-source.mjs";
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {googleGraph} from './google-infrastructure.mjs';
import {loadSource,plain} from './load-source.mjs';
export const expensesBefore=JSON.parse(readFileSync('tests/fixtures/expenses-business-before.json','utf8'));
export const legacyExpense='src/services/expenses/manageExpenses.ts';
export function expenseGraph({original=false,service,events=[],overrides={},externals={}}={}){
 const allowed=new Set(['contracts.ts','server.ts','domain/rules.ts','application/manage-expenses.ts','infrastructure/google-sheets/expense-store.ts','infrastructure/google-sheets/expenses/const.ts'].map(f=>'src/modules/expenses/'+f));
 let hrLoad;
 const cache=new Map(),headers=loadSource('src/modules/expenses/infrastructure/google-sheets/expenses/const.ts');
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-07T00:00:00Z']));if(!args.length)events.push(['clock']);}}
 function load(file){
  if(!original && hrSourceFiles.has(file)){
   hrLoad??=createHRSourceLoader({imports:{...externals,'@/modules/expenses/server':load('src/modules/expenses/server.ts')},globals:{Date:Clock,Error}});
   return hrLoad(file);
  }
  if(cache.has(file))return cache.get(file);
  assert.ok(allowed.has(file)||['src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts','src/services/employees/manageSalaryAdvances.ts','src/services/employees/salary-advance-shops.ts','src/app/api/employees/advances/route.ts','src/app/api/sales/profit-summary/route.ts',legacyExpense,'src/services/expenses/types.ts','src/services/expenses/index.ts','src/app/api/expenses/route.ts','src/app/api/expenses/masters/[kind]/route.ts'].includes(file),`Unapproved expense dependency: ${file}`);
  const source=overrides[file]??(original?expensesBefore.files[file]?.source:undefined)??readFileSync(file,'utf8'),exports={};cache.set(file,exports);
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date:Clock,Request,Response,URL,console:{error:(...a)=>events.push(['log',...a])},require(spec){
   if(Object.hasOwn(externals,spec))return externals[spec];
   if(spec==='server-only')return {};
   if(spec==='node:crypto')return {randomUUID:()=>{events.push(['uuid']);return 'fixed-id';}};
   if(spec==='next/server')return {NextResponse:Response};
   if(spec==='@/config')return {getConfig:()=>{events.push(['config']);return {loyverse:{accounts:[{id:'account',shopName:'Shop'}]}};}};
   if(spec==='@/externals/google/sheet')return {createGoogleSheetsServiceFromConfig:()=>{events.push(['factory']);return service;}};
   if(spec==='@/features/backend/shared/utils')return {isRecord:value=>!!value&&typeof value==='object'&&!Array.isArray(value)};
   if(spec==='@/modules/expenses/infrastructure/google-sheets/expenses/const')return headers;
   let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';return load(target);
  }});return exports;
 }
 return {load,api:()=>load(legacyExpense),headers};
}
export function expenseData({original=false,events=[]}={}){
 const g=googleGraph({historical:original}),{RecordsSheet}=g.load('src/externals/google/sheet/sheets/expenses/RecordsSheet.ts'),headers=loadSource('src/modules/expenses/infrastructure/google-sheets/expenses/const.ts');
 const row=(id,month,amount,deleted='')=>[id,month,month+'-06','S','SHOP','C',id,amount,'note','created','updated','actor',deleted];
 const data={expenses:[Array.from(headers.EXPENSE_HEADERS),row('old','2025-12',99),row('deleted','2026-11',99,'deleted'),row('first','2026-10',0.1),row('second','2026-11',0.2)],shops:[Array.from(headers.SHOP_HEADERS),['S','Shop',true,'account','c','u']],categories:[Array.from(headers.CATEGORY_HEADERS),['C','Category',true,'c','u']]};
 let failure,pending;const client={ensureWorksheet:async name=>events.push(['ensure',name]),getValues:async(name,range)=>{events.push(['read',name,range]);if(failure?.('read',name))throw marker;if(pending?.name===name)await pending.promise;return data[name].map(r=>r.slice());},appendValues:async(name,range,values)=>{events.push(['append',name,range,plain(values)]);if(failure?.('append',name))throw marker;if(pending?.name===name)await pending.promise;data[name].push(...plain(values));},updateValues:async(name,range,values)=>{events.push(['update',name,range,plain(values)]);if(failure?.('update',name))throw marker;const at=Number(/\d+/.exec(range)[0])-1;data[name].splice(at,values.length,...plain(values));}};
 const marker=new Error('synthetic failure'),service={expenses:new RecordsSheet(client,'expenses'),shops:new RecordsSheet(client,'shops'),expenseCategories:new RecordsSheet(client,'categories')};
 return {service,data,marker,client,setFailure:fn=>failure=fn,setPending:p=>pending=p};
}
export const expenseInput={month:'2026-11',expenseDate:'2026-11-06',scope:'SHOP',shopId:'S',categoryId:'C',name:' New ',amount:12.34,note:' note ',requestId:'00000000-0000-0000-0000-000000000000'};
