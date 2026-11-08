import {syncHarness} from './helpers/sales-sync-reliability.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ESLint} from 'eslint';
import ts from 'typescript';
import {accountGraph,accountRows,accountHeaders,envConfig,sheetConfig,accountsComposition,accountsReader,accountsBefore} from './helpers/loyverse-accounts.mjs';
import {accountsHistory,restoreAccountSource,accountNewFiles} from './helpers/loyverse-accounts-history.mjs';
import {loadSalesSource} from './helpers/sales-source.mjs';
import {loadExpenseSource} from './helpers/expenses-source.mjs';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';
import {restoreWorkbookSource,workbookHistory} from './helpers/loyverse-workbook-history.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(value).digest('hex');
const tokens=['synthetic-first-secret','synthetic-second-secret'];
const metadata=[{id:'first',shopName:'First Shop'},{id:'second',shopName:'Second Shop'}];
const clean=value=>{const text=JSON.stringify(value);for(const token of tokens)assert.ok(!text.includes(token),text);};

test('default/env configuration retains original account parsing, order, validation and legacy factory behavior', async()=>{
  for(const json of [undefined,'[]',JSON.stringify(envConfig().loyverse.accounts),JSON.stringify(envConfig().loyverse.accounts.toReversed().map(account=>({...account,active:false,sortOrder:0})))]){
    const before=accountGraph({original:true,env:{LOYVERSE_ACCOUNTS_JSON:json}}).load('src/config/index.ts').getConfig();
    const current=accountGraph({env:{LOYVERSE_ACCOUNTS_JSON:json}}).load('src/config/index.ts').getConfig();
    assert.deepEqual(plain(current.loyverse.accounts),plain(before.loyverse.accounts));
    assert.equal(current.loyverse.accountSource,'env');
  }
  for(const value of ['oops','{}','[{}]',JSON.stringify([envConfig().loyverse.accounts[0],envConfig().loyverse.accounts[0]])]){
    const errors=[];for(const original of [true,false]){try{accountGraph({original,env:{LOYVERSE_ACCOUNTS_JSON:value}}).load('src/config/index.ts').getConfig();assert.fail();}catch(error){errors.push(error.message);}}
    assert.equal(errors[1],errors[0]);clean(errors);
  }
  const runs=[];
  for(const original of [true,false]){
    const g=accountGraph({original}),accounts=original?g.load('src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts').createLoyverseAccountsFromConfig(envConfig()):await g.access().createLoyverseAccounts(envConfig());
    await accounts[0].service.getReceipts({storeId:accounts[0].storeId});
    runs.push(plain({accounts:accounts.map(({id,shopName,storeId})=>({id,shopName,storeId})),events:g.events}));
  }
  assert.deepEqual(runs[1],runs[0]);
});

test('sheet configuration never evaluates the JSON source and rejects unknown source settings without reflecting values',()=>{
  const env={LOYVERSE_ACCOUNT_SOURCE:' sheet ',GOOGLE_SHEETS_SPREADSHEET_ID:'operations'};
  Object.defineProperty(env,'LOYVERSE_ACCOUNTS_SPREADSHEET_ID',{get(){assert.fail('Removed account-workbook setting was read');}});
  Object.defineProperty(env,'LOYVERSE_ACCOUNTS_JSON',{get(){assert.fail('Sheet mode read the legacy credential source');}});
  const config=accountGraph({env}).load('src/config/index.ts').getConfig();
  assert.equal(config.loyverse.accountSource,'sheet');assert.equal(Object.hasOwn(config.loyverse,'accountsSpreadsheetId'),false);assert.deepEqual(plain(config.loyverse.accounts),[]);
  assert.throws(()=>accountGraph({env:{LOYVERSE_ACCOUNT_SOURCE:tokens[0]}}).load('src/config/index.ts').getConfig(),error=>!error.message.includes(tokens[0])&&/must be env or sheet/.test(error.message));
  assert.throws(()=>accountGraph().load('src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts').createLoyverseAccountsFromConfig(sheetConfig()),/require the server account reader/);
});

test('private reader sorts explicitly, trims existing IDs/names, retains optional store filters and excludes disabled credentials',async()=>{
  const g=accountGraph(),Reader=g.reader().GoogleSheetsLoyverseAccounts;
  let reads=0;
  const accounts=await new Reader({getValues:async(tab,range)=>{assert.equal(tab,'loyverse_accounts');assert.equal(range,'A:F');reads++;return [...accountRows(),['','','','','','']];}}).readAccounts();
  assert.deepEqual(plain(accounts),plain(envConfig().loyverse.accounts));assert.equal(reads,1);
  const spaced=accountRows();spaced[3][0]=' first ';spaced[3][1]=' First Shop ';spaced[3][3]=' synthetic-first-secret ';
  assert.equal((await new Reader({getValues:async()=>spaced}).readAccounts())[0].id,'first');
  const differentOrder=[accountHeaders,['first','First Shop','store-1',tokens[0],true,100],['second','Second Shop','',tokens[1],true,0]];
  assert.deepEqual(plain((await new Reader({getValues:async()=>differentOrder}).readAccounts()).map(a=>a.id)),['second','first']);
  const disabled=[accountHeaders,['retained','Historical','','',false,0]];
  assert.deepEqual(plain(await new Reader({getValues:async()=>disabled}).readAccounts()),[]);
});

test('missing/invalid account storage fails closed on headers, required fields, duplicate IDs, active flags and unambiguous order',async()=>{
  const Reader=accountGraph().reader().GoogleSheetsLoyverseAccounts;
  const valid=['shop','Shop','','synthetic-first-secret',true,0];
  const cases=[[],[accountHeaders],[['wrong',...accountHeaders.slice(1)],valid],[accountHeaders,[]],
    ...[[0,''],[1,''],[3,''],[4,'yes'],[5,''],[5,-1],[5,1.5],[5,Number.MAX_SAFE_INTEGER+1],[2,123],[3,123]].map(([column,value])=>{const row=[...valid];row[column]=value;return [accountHeaders,row];}),
    [accountHeaders,valid,[...valid.slice(0,4),false,1]],
    [accountHeaders,valid,['other','Other','','s',true,0]],
    [accountHeaders,[...valid,'extra']],
  ];
  for(const rows of cases)await assert.rejects(new Reader({getValues:async()=>rows}).readAccounts(),error=>{clean([error.message,error.stack,error.cause]);return /Private Loyverse/.test(error.message);});
  assert.deepEqual(plain(await new Reader({getValues:async()=>[accountHeaders,['off','Off','','',false,0]]}).readAccounts()),[]);
});

test('sheet mode uses the configured workbook and existing service auth with read-only scope; missing access cannot fall back',async()=>{
  const config=sheetConfig();Object.defineProperty(config.loyverse,'accounts',{get(){assert.fail('Sheet mode used env accounts');}});
  const g=accountGraph();assert.deepEqual(plain(await g.access().listLoyverseAccounts(config)),metadata);
  assert.deepEqual(plain(g.events),[['account-auth',['https://www.googleapis.com/auth/spreadsheets.readonly']],['account-client','operations'],['account-read','loyverse_accounts','A:F']]);
  for(const spreadsheetId of ['https://example.test/book','../operations']){
    const invalid=sheetConfig();invalid.googleSheets.spreadsheetId=spreadsheetId;const f=accountGraph();
    await assert.rejects(f.access().listLoyverseAccounts(invalid));assert.deepEqual(f.events,[]);
  }
  const missing=sheetConfig();missing.googleSheets.spreadsheetId='';
  const absent=accountGraph();await assert.rejects(absent.access().listLoyverseAccounts(missing),/must identify the Loyverse account spreadsheet/);assert.deepEqual(absent.events,[]);
  for(const status of [400,403,404,429,500]){
    const failed=accountGraph({read:async()=>{throw new Error(`Google ${status}: ${tokens.join(' ')}`);}});
    await assert.rejects(failed.access().listLoyverseAccounts(config),error=>{clean([error.message,error.stack,error.cause]);return /Check spreadsheet access/.test(error.message);});
    assert.equal(failed.events.filter(e=>e[0]==='account-read').length,1);
  }
});

test('sheet mode uses only the existing workbook, ignores the removed override, and keeps metadata/token handling and env rollback unchanged',async()=>{
  for(const oldValue of [undefined,'','private-accounts']){
    const config=sheetConfig();config.googleSheets.spreadsheetId=' operations ';
    if(oldValue!==undefined)config.loyverse.accountsSpreadsheetId=oldValue;
    Object.defineProperty(config.loyverse,'accounts',{get(){assert.fail('Sheet lookup used env credentials');}});
    const g=accountGraph({config}),accounts=await g.access().createLoyverseAccounts(config);
    assert.deepEqual(plain(accounts.map(({id,shopName})=>({id,shopName}))),metadata);clean(accounts);
    assert.equal(g.events.find(event=>event[0]==='account-client')[1],'operations');
    assert.deepEqual(plain(g.events.find(event=>event[0]==='account-read')),['account-read','loyverse_accounts','A:F']);
    const response=await g.load('src/app/api/loyverse/accounts/route.ts').GET();assert.equal(response.status,200);
    const json=await response.json();assert.deepEqual(json,{ok:true,accounts:metadata});clean([json,g.events.filter(event=>event[0]==='log')]);
  }
  const ignored=sheetConfig();Object.defineProperty(ignored.loyverse,'accountsSpreadsheetId',{get(){assert.fail('Removed override was read');}});
  assert.deepEqual(plain(await accountGraph().access().listLoyverseAccounts(ignored)),metadata);
  const failed=accountGraph({read:async()=>{throw new Error(tokens[0]);}});
  await assert.rejects(failed.access().listLoyverseAccounts(sheetConfig()),error=>{clean(error.message);return /Check spreadsheet access/.test(error.message);});
  assert.deepEqual(failed.events.filter(event=>event[0]==='account-client'),[['account-client','operations']]);
  const config=envConfig();Object.defineProperty(config.loyverse,'accountsSpreadsheetId',{get(){assert.fail('Env mode read the override');}});Object.defineProperty(config.googleSheets,'spreadsheetId',{get(){assert.fail('Env mode read the operational ID');}});
  assert.deepEqual(plain(await accountGraph().access().listLoyverseAccounts(config)),metadata);
  for(const [file,entry]of Object.entries(workbookHistory.files))assert.equal(hash(restoreWorkbookSource(file)),entry.sha256,file);
  for(const [file,expected]of Object.entries(workbookHistory.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
});

test('metadata and configured capabilities never serialize credentials; errors from every client operation and construction are redacted',async()=>{
  class Client {
    constructor({accessToken}){this.privateToken=accessToken;}
    async getReceipts(){throw Object.assign(new Error(`${tokens[0]} ${encodeURIComponent(tokens[1])}`),{cause:tokens[0],data:tokens[1]});}
    async getReceipt(){return this.getReceipts();}async getSalesByItem(){return this.getReceipts();}async checkConnection(){return this.getReceipts();}
  }
  const g=accountGraph({Client}),accounts=await g.access().createLoyverseAccounts(sheetConfig());
  clean(accounts);assert.deepEqual(plain(await g.access().listLoyverseAccounts(sheetConfig())),metadata);
  for(const method of ['getReceipts','getReceipt','getSalesByItem','checkConnection']){
    await assert.rejects(accounts[0].service[method](),error=>{clean([error.message,error.stack,error.cause,Object.keys(error)]);assert.equal(error.cause,undefined);return error.message.includes('[REDACTED]');});
  }
  class Failed {constructor(){throw new Error(tokens[0]);}}
  await assert.rejects(accountGraph({Client:Failed}).access().createLoyverseAccounts(envConfig()),error=>error.message==='[REDACTED]');
  const escaped='synthetic/"\\ credential',config=envConfig();config.loyverse.accounts[0].accessToken=escaped;
  for(const reflected of [encodeURIComponent(escaped),JSON.stringify(escaped)]){
    class Reflected {async getReceipts(){throw new Error(reflected);}}
    const [account]=await accountGraph({Client:Reflected}).access().createLoyverseAccounts(config);
    await assert.rejects(account.service.getReceipts(),error=>error.message.includes('[REDACTED]')&&!error.message.includes(escaped)&&!error.message.includes(encodeURIComponent(escaped)));
  }
  clean(accounts);assert.ok(!g.events.some(e=>e[0]==='log'));
});

test('a pending private read delays clients and returns no partial directory; failed reads have no retry or writes',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),g=accountGraph({read:()=>gate});let complete=false;
  const pending=g.access().createLoyverseAccounts(sheetConfig()).then(value=>{complete=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(complete,false);assert.ok(!g.events.some(e=>e[0]==='loyverse-client'));
  release(accountRows());assert.equal((await pending).length,2);assert.equal(g.events.filter(e=>e[0]==='account-read').length,1);
});

function salesFixture(){return syncHarness();}

const receipt={receipt_number:'R/1',receipt_type:'SALE',receipt_date:'2026-11-01T01:00:00Z',created_at:'c',updated_at:'u',total_money:99.987654,line_items:[{id:'i',item_id:'item',item_name:'Item',quantity:3,gross_total_money:120,total_money:99.987654,total_discount:20.012346,cost_total:11.1,line_taxes:[],line_discounts:[],line_modifiers:[]}],payments:[{payment_type_id:'cash',money_amount:99.987654,payment_details:{}}]};

test('env/sheet accounts drive the same real Sales sync, refunds, daily/dashboard/profit totals, store filters and idempotent writes',async()=>{
  const runs=[];
  for(const mode of ['env','sheet']){
    const queries=[];class Client {async getReceipts(query){queries.push(plain(query));return [receipt,{...receipt,receipt_number:'refund',receipt_type:'REFUND',refund_for:'R/1',total_money:10,line_items:[],payments:[]}];}}
    const g=accountGraph({Client}),account=(await g.access().createLoyverseAccounts(mode==='env'?envConfig():sheetConfig()))[0],w=salesFixture();
    const sync=await w.api.syncLoyverseDailySales({account,googleSheetsService:w.service,coordinator:w.coordinator,salesDate:'2026-11-01'});
    const retry=await w.api.syncLoyverseDailySales({account,googleSheetsService:w.service,coordinator:w.coordinator,salesDate:'2026-11-01'});
    const daily=await w.api.getGoogleSheetsDailySales({accountId:'first',googleSheetsService:w.service,coordinator:w.coordinator,salesDate:'2026-11-01'});
    const dashboard=await w.api.getGoogleSheetsSalesDashboard({googleSheetsService:w.service,fromDate:'2026-11-01',toDate:'2026-11-30'});
    const profit=await w.api.getGoogleSheetsProfitSummary({accounts:metadata,costOverrides:[],expenses:[],googleSheetsService:w.service,year:'2026'});
    runs.push(plain({sync,retry,daily,dashboard,profit,queries,data:w.data,events:w.events}));
  }
  assert.deepEqual(runs[1],runs[0]);assert.equal(runs[1].sync.receiptCount,2);assert.equal(runs[1].retry.outcome,'already_synced');
  assert.equal(runs[1].queries[0].storeId,'store-1');assert.equal(runs[1].queries[0].receiptDateMin,'2026-10-31T17:00:00.000Z');clean(runs);
});

test('Expenses Shop Master keeps its schema and existing disabled-account mappings while rejecting new disabled mappings',async()=>{
  const records=[['id','name','active','loyverseAccountId','createdAt','updatedAt'],['existing','Historical','TRUE','disabled','created','updated']],events=[];
  const rows={async readRows(){return records;},async updateRows(range,values){events.push(['update',range,plain(values)]);records[Number(/\d+/.exec(range)[0])-1]=values[0];},async appendRows(range,values){events.push(['append',range,plain(values)]);records.push(...values);}};
  const service={shops:rows},expenses=loadExpenseSource('src/modules/expenses/server.ts',{imports:{'node:crypto':{randomUUID:()=> 'new-id'}}});
  const g=accountGraph({config:sheetConfig(),imports:{'@/composition/google-sheets':{createGoogleSheetsServiceFromConfig:()=>service},'@/modules/expenses/server':expenses}});
  const route=g.load('src/app/api/expenses/masters/[kind]/route.ts'),context={params:Promise.resolve({kind:'shops'})};
  const get=await route.GET(new Request('https://example.test'),context),body=await get.json();assert.equal(body.ok,true);assert.deepEqual(body.accounts,metadata);assert.equal(body.records[0].loyverseAccountId,'disabled');clean(body);
  const save=async input=>route.POST(new Request('https://example.test',{method:'POST',body:JSON.stringify(input)}),context);
  assert.equal((await save({id:'existing',name:'Renamed',active:true,loyverseAccountId:'disabled',accessToken:tokens[0]})).status,200);
  assert.equal((await save({name:'New',active:true,loyverseAccountId:'disabled'})).status,400);
  assert.equal((await save({name:'New',active:true,loyverseAccountId:'first'})).status,200);clean(events);
  assert.equal(records[1].length,6);assert.equal(records[1][3],'disabled');
  const before=events.length,unavailable=accountGraph({config:sheetConfig(),read:async()=>{throw new Error('no access');},imports:{'@/composition/google-sheets':{createGoogleSheetsServiceFromConfig:()=>service},'@/modules/expenses/server':expenses}});
  const rejected=await unavailable.load('src/app/api/expenses/masters/[kind]/route.ts').POST(new Request('https://example.test',{method:'POST',body:JSON.stringify({name:'No mapping',active:true})}),context);
  assert.equal(rejected.status,500);assert.equal(events.length,before);
});

test('account API confidentiality holds for successful metadata, missing access, disabled accounts and raw provider errors',async()=>{
  for(const read of [undefined,async()=>{throw new Error(tokens[0]);}]){
    const g=accountGraph({config:sheetConfig(),read}),response=await g.load('src/app/api/loyverse/accounts/route.ts').GET();
    assert.equal(response.status,read?500:200);const body=await response.json();clean([body,g.events]);
    if(!read)assert.deepEqual(body,{ok:true,accounts:metadata});
  }
  const off=accountGraph({config:sheetConfig(),rows:[accountHeaders,['off','Off','','',false,0]],imports:{'@/modules/sales/server':loadSalesSource('src/modules/sales/server.ts')}});
  const disabled=await off.load('src/app/api/loyverse/daily-sales/route.ts').GET(new Request('https://example.test?date=2026-11-01'));
  assert.equal(disabled.status,503);assert.equal((await disabled.json()).error,'No active Loyverse accounts are configured.');
  class Client {async getReceipts(){throw new Error(`Loyverse 401 ${tokens[0]}`);}}
  const g=accountGraph({config:sheetConfig(),Client,imports:{'@/modules/sales/server':loadSalesSource('src/modules/sales/server.ts')}});
  const failed=await g.load('src/app/api/loyverse/daily-sales/route.ts').GET(new Request('https://example.test?date=2026-11-01'));
  assert.equal(failed.status,502);const json=await failed.json();assert.equal(json.error,'Loyverse 401 [REDACTED]');clean([json,g.events]);
});

test('all affected HTTP methods preserve original env-mode validation, JSON, statuses and operation order',async()=>{
  const business={
    isValidBangkokSalesDate:()=>true,getLoyverseReceiptsForSalesDate:async()=>[],syncLoyverseDailySales:async()=>({outcome:'synced',receiptCount:0}),
    getGoogleSheetsDailySales:async()=>({hourlyGrossSales:[],rows:[],paymentsByType:[],totals:{},receiptCount:0}),listSalesSyncStatus:async()=>({rows:[],summary:{}}),getGoogleSheetsSalesDashboard:async()=>({rows:[]}),getGoogleSheetsProfitSummary:async()=>({rows:[]}),listSalesProfitCostOverrides:async()=>[],
    setSalesProfitCostOverride:async()=>({id:'cost'}),removeSalesProfitCostOverride:async()=>true,
    listExpenses:async()=>[],listExpenseShops:async()=>[],listExpenseCategories:async()=>[],saveExpenseMaster:async()=> 'master',
    getMonthlyStockCounts:async()=>[],saveMonthlyStockCount:async()=>undefined,validStockMonth:()=>true,listStockAdjustments:async()=>[],listAdjustmentEmployees:async()=>[],createStockAdjustment:async()=>({id:'adjustment'}),
    listEmployees:async()=>[],listEmployeeTimesheets:async()=>[],listEmployeeTimesheetsForMonth:async()=>[],clockInEmployee:async()=>({id:'time'}),addEmployeeLeave:async()=>({id:'leave'}),updateEmployeeTimesheet:async()=>({id:'time'}),EmployeeTimesheetStatus:{Work:'work',Leave:'leave'},
  };
  class FakeError extends Error {}business.ExpenseError=FakeError;business.StockAdjustmentError=FakeError;business.EmployeeTimesheetDateConflictError=FakeError;business.EmployeeTimesheetValidationError=FakeError;
  const cases=[['loyverse/accounts','GET'],['loyverse/daily-sales','GET'],['loyverse/daily-sales/sync','POST',{account:'first',date:'2026-11-01'}],['sales/daily-sales','GET'],['sales/dashboard','GET'],['sales/profit-summary','GET'],['sales/sync-status','GET'],['sales/profit-summary/cost-overrides','POST',{accountId:'first',month:'2026-11',averageItemCost:2}],['sales/profit-summary/cost-overrides','DELETE',{accountId:'first',month:'2026-11'}],['expenses/masters/[kind]','GET'],['expenses/masters/[kind]','POST',{name:'Shop',active:true,loyverseAccountId:'first'}],['stock-counts','GET'],['stock-counts','PUT',{accountId:'first',month:'2026-11',physicalCount:3}],['stock-adjustments','GET'],['stock-adjustments','POST',{}],['employees/timesheets','GET'],['employees/timesheets','POST',{employeeId:'E',shopId:'first',date:'2026-11-01',status:'work',workdayType:'half'}],['employees/timesheets/summary','GET'],['employees/timesheets/[id]','PUT',{employeeId:'E',shopId:'first',date:'2026-11-01',status:'work',workdayType:'half'}]];
  for(const [path,method,body]of cases){const outcomes=[];
    for(const original of [true,false]){
      const events=[],imports={'@/composition/google-sheets':{createGoogleSheetsServiceFromConfig:()=>{events.push(['factory']);return {};}}};
      for(const feature of ['sales','expenses','inventory','hr'])imports[`@/modules/${feature}/server`]=business;
      const g=accountGraph({original,events,imports}),route=g.load(`src/app/api/${path}/route.ts`);
      const response=await route[method](new Request('https://example.test?date=2026-11-01&month=2026-11&year=2026',{method,...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({kind:'shops',id:'time'})});
      const json=await response.json();clean(json);outcomes.push(plain({status:response.status,json,events}));
    }
    assert.deepEqual(outcomes[1],outcomes[0],path+' '+method);
  }
});

test('new source has exact pre-feature inverses and every inherited fixture stays byte-identical',()=>{
  for(const [file,saved]of Object.entries(accountsBefore.files))assert.equal(hash(restoreAccountSource(file)),saved.sha256,file);
  for(const [file,expected]of Object.entries(accountsHistory.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
  for(const file of accountNewFiles)assert.equal(hash(restoreWorkbookSource(file)),accountsHistory.newHashes[file],file);
  assert.equal(ts.transpileModule(readFileSync('src/shared/types/loyverse-account.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.trim(),'export {};');
});

test('current account/browser/runtime/type boundaries reject secret storage reachability and raw configuration/provider bypasses',async()=>{
  const graph=userStateGraph();for(const types of [false,true]){
    graph.modules(types);const seen=new Set(),active=[];
    function visit(file){assert.ok(!active.includes(file),[...active,file].join(' -> '));if(seen.has(file))return;active.push(file);graph.deps(file,types).forEach(visit);active.pop();seen.add(file);}graph.all.forEach(visit);
    for(const root of graph.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))))assert.equal(graph.trace(root,types,p=>p.startsWith('src/config/')||p.startsWith('src/composition/')||p.startsWith('src/infrastructure/')),null,root);
  }
  const eslint=new ESLint();
  for(const [filePath,code]of [
    ['src/app/api/loyverse/accounts/route.ts','export const x=config.loyverse.accounts;'],
    ['src/app/api/loyverse/accounts/route.ts','export const x=config["loyverse"]["accounts"];'],
    ['src/app/api/loyverse/accounts/route.ts','export const x=process.env.LOYVERSE_ACCOUNTS_JSON;'],
    ['src/app/api/loyverse/accounts/route.ts','import {createLoyverseAccountsFromConfig} from "@/infrastructure/external/loyverse";export {createLoyverseAccountsFromConfig};'],
    ['src/app/api/loyverse/accounts/route.ts',`export {GoogleSheetsLoyverseAccounts} from "@/${accountsReader.slice(4,-3)}";`],
    ['src/app/api/loyverse/accounts/route.ts',`import Private = require("@/${accountsReader.slice(4,-3)}");export {Private};`],
    ['src/modules/sales/ui/probe.tsx',`export type X=import("@/${accountsReader.slice(4,-3)}").GoogleSheetsLoyverseAccounts;`],
    [accountsReader,'export class Reader {}'],[accountsComposition,'export const secret=1;'],
    ['src/shared/types/loyverse-account.ts','export const token="bad";'],
    ['src/shared/types/loyverse-account.ts','export type LoyverseAccountMetadata={id:string;shopName:string;accessToken:string};'],
  ]){const [r]=await eslint.lintText(code,{filePath});assert.ok(r.errorCount>0,code);}
});
