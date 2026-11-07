import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseGraph,expenseData,expenseInput} from './helpers/expenses-business.mjs';
import {plain} from './helpers/load-source.mjs';
async function scenario(original){const events=[],d=expenseData({original,events}),g=expenseGraph({original,service:d.service,events}),api=g.api();
 const list=plain(await api.listExpenses({googleSheetsService:d.service,year:'2026'}));assert.deepEqual(list.map(x=>x.id),['second','first']);assert.equal(list.reduce((s,x)=>s+x.amount,0),0.30000000000000004);
 const id=await api.saveExpense(d.service,expenseInput);assert.equal(await api.saveExpense(d.service,expenseInput),id);await assert.rejects(api.saveExpense(d.service,{...expenseInput,amount:1}),e=>e instanceof api.ExpenseError&&e.status===409);
 await api.saveExpense(d.service,{...expenseInput,id,requestId:undefined,amount:0},'other');await api.removeExpense(d.service,id);await assert.rejects(api.removeExpense(d.service,id),e=>e.status===404);
 await api.saveExpenseMaster(d.service,'shops',{name:'Other',active:true,loyverseAccountId:'new'});await api.saveExpenseMaster(d.service,'categories',{id:'C',name:'Updated',active:false});await assert.rejects(api.saveExpenseMaster(d.service,'shops',{name:'Other',active:true}),e=>e.status===409);
 return plain({list,data:d.data,events});}
test('original Expenses money/filter/order/reference/idempotency/soft-delete/master behavior and complete event trace are preserved',async()=>{assert.deepEqual(await scenario(false),await scenario(true));});
test('Expenses validation precedes IO and failures preserve identities, concurrency and pending-write timing',async()=>{
 for(const original of [true,false]){const events=[],d=expenseData({original,events}),api=expenseGraph({original,events}).api();
  for(const patch of [{amount:-1},{amount:1.001},{amount:Infinity},{expenseDate:'2026-02-30'},{scope:'SHARED'},{requestId:'bad'},{name:''}]){await assert.rejects(api.saveExpense(d.service,{...expenseInput,...patch}),e=>e instanceof api.ExpenseError&&e.status===400);assert.deepEqual(events,[]);}
  d.setFailure((op,name)=>op==='read'&&name==='expenses');await assert.rejects(api.listExpenses({googleSheetsService:d.service,year:'2026'}),e=>e===d.marker);assert.deepEqual(events.slice(-3),[['read','expenses','A:Z'],['read','shops','A:Z'],['read','categories','A:Z']]);d.setFailure();
  let release;const promise=new Promise(r=>release=r);d.setPending({name:'shops',promise});let done=false;const p=api.saveExpense(d.service,expenseInput).then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(events.some(e=>e[0]==='clock'),false);release();await p;assert.equal(done,true);
  d.data.expenses[0]=['wrong'];await assert.rejects(api.listExpenses({googleSheetsService:d.service,year:'2026'}),e=>e.status===503);
 }
});
test('original/current real Expense HTTP retains response contracts, status codes and composition order',async()=>{
 for(const [method,url,body] of [['GET','?month=2026-11'],['GET','?month=bad'],['POST','',expenseInput],['POST','',{amount:'12'}],['DELETE','',{id:'missing'}]]){
  const results=[];for(const original of [true,false]){const events=[],d=expenseData({original,events}),route=expenseGraph({original,service:d.service,events}).load('src/app/api/expenses/route.ts'),request=new Request('https://example.test/api/expenses'+url,{method,...(body?{body:JSON.stringify(body),headers:{'content-type':'application/json'}}:{})}),response=await route[method](request);results.push(plain({status:response.status,body:await response.json(),events}));}assert.deepEqual(results[1],results[0]);
 }
});

test('Expense read/getter failures preserve phase, simultaneous-rejection precedence, retained master sheet and pending writes',async()=>{
 for(const blocked of ['expenses','shops','categories']){
  const outcomes=[];for(const original of [true,false]){
   const events=[],d=expenseData({original,events}),api=expenseGraph({original,events}).api(),marker=new Error('getter');
   const service=new Proxy(d.service,{get:(o,k)=>{events.push(['sheet',k]);if(k===(blocked==='categories'?'expenseCategories':blocked))throw marker;return o[k];}});
   await assert.rejects(api.listExpenses({googleSheetsService:service,year:'2026'}),e=>e===marker);outcomes.push(events);
  }assert.deepEqual(outcomes[1],outcomes[0]);
 }
 for(const pair of [['expenses','shops'],['shops','categories'],['expenses','categories']]){
  const outcomes=[];for(const original of [true,false]){const events=[],d=expenseData({original,events}),api=expenseGraph({original,events}).api();for(const name of pair){const property=name==='categories'?'expenseCategories':name;d.service[property]={readRows:()=>Promise.reject(new Error(name))};}try{await api.listExpenses({googleSheetsService:d.service,year:'2026'});}catch(e){outcomes.push(e.message);}}assert.equal(outcomes[1],outcomes[0]);
 }
 for(const original of [true,false]){
  const events=[],d=expenseData({original,events}),api=expenseGraph({original,events}).api();let accesses=0;const originalSheet=d.service.shops;Object.defineProperty(d.service,'shops',{get:()=>{accesses++;return originalSheet;}});await api.saveExpenseMaster(d.service,'shops',{name:'Other',active:true});assert.equal(accesses,1);
  const append=d.client.appendValues;let release,done=false;d.client.appendValues=async(...a)=>{await new Promise(r=>release=r);await append(...a);};const p=api.saveExpense(d.service,{...expenseInput,requestId:undefined}).then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);release();await p;assert.equal(done,true);
  // Deleting retains unknown trailing cells rather than rewriting a mapped record.
  d.data.expenses.at(-1).push('extra');await api.removeExpense(d.service,'EXP-fixed-id');assert.equal(d.data.expenses.at(-1).at(-1),'extra');
 }
});

test('actual original/current HR advance creation uses Expenses shops with identical money, idempotency, storage and validation traces',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');const results=[];
 for(const original of [true,false]){
  const events=[],d=expenseData({original,events}),provider=googleGraph({historical:original}),{PayrollRecordsSheet}=provider.load('src/externals/google/sheet/sheets/employee-advances/PayrollRecordsSheet.ts');
  const headers=(await import('./helpers/load-source.mjs')).loadSource('src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts');d.data.advances=[Array.from(headers.ADVANCE_HEADERS)];d.data.settlements=[Array.from(headers.SETTLEMENT_HEADERS)];d.service.employeeAdvances=new PayrollRecordsSheet(d.client,'advances');d.service.payrollSettlements=new PayrollRecordsSheet(d.client,'settlements');
  const graph=expenseGraph({original,events,service:d.service,externals:{'./manageEmployees':{listEmployees:async()=>{events.push(['employees']);return [{id:'E',status:'active',hiredDate:'2020-01-01',terminatedDate:''}];}}}}),api=graph.load('src/services/employees/manageSalaryAdvances.ts');
  const input={requestId:'00000000-0000-0000-0000-000000000000',employeeId:'E',shopId:'S',paidDate:'2026-11-06',payrollMonth:'2026-11',paidAmount:12.34,reference:' ref ',note:' note '};
  const advance=plain(await api.createSalaryAdvance(d.service,input));assert.equal(advance.paidAmount,12.34);assert.deepEqual(plain(await api.createSalaryAdvance(d.service,input)),advance);await assert.rejects(api.createSalaryAdvance(d.service,{...input,paidAmount:1}),e=>e.status===409);
  d.data.shops[1][2]=false;await assert.rejects(api.createSalaryAdvance(d.service,{...input,requestId:'10000000-0000-0000-0000-000000000000'}),e=>e.status===400);results.push(plain({advance,data:d.data,events}));
 }assert.deepEqual(results[1],results[0]);
});

test('Sales profit HTTP uses actual Expenses reads and actual unchanged Sales refund/profit query with identical totals and failures',async()=>{
 const {salesQueryGraph,salesQueryData}=await import('./helpers/inventory-sales-query.mjs');
 for(const fail of [false,true]){const results=[];for(const original of [true,false]){
  const events=[],d=expenseData({original,events}),sales=salesQueryGraph({original}),salesData=salesQueryData(sales.provider,events);Object.assign(d.service,salesData.service);d.data.shops[1][3]='shop';
  if(fail)d.setFailure((op,name)=>op==='read'&&name==='expenses');
  const query=sales.query(),graph=expenseGraph({original,events,service:d.service,externals:{'@/services/sales':{getGoogleSheetsProfitSummary:query.getGoogleSheetsProfitSummary,listSalesProfitCostOverrides:async()=>{events.push(['overrides']);return [];}}}}),response=await graph.load('src/app/api/sales/profit-summary/route.ts').GET(new Request('https://example.test/api/sales/profit-summary?year=2026'));
  assert.equal(response.status,fail?500:200);results.push(plain({status:response.status,body:await response.json(),events}));
 }assert.deepEqual(results[1],results[0]);}
});

test('master HTTP preserves category/shop operations, mapping exceptions, validation and 404/409/500 responses',async()=>{
 for(const [method,kind,body]of [['GET','shops'],['GET','categories'],['GET','bad'],['POST','shops',{name:'New',active:true,loyverseAccountId:'account'}],['POST','shops',{id:'S',name:'Edited',active:true,loyverseAccountId:'old-account'}],['POST','shops',{name:'New',active:true,loyverseAccountId:'unknown'}],['POST','categories',{name:'Category',active:true}],['POST','categories',{name:'',active:true}],['POST','shops',null]]){
  const results=[];for(const original of [true,false]){const events=[],d=expenseData({original,events});d.data.shops[1][3]='old-account';const graph=expenseGraph({original,service:d.service,events}),route=graph.load('src/app/api/expenses/masters/[kind]/route.ts');const response=await route[method](new Request('https://example.test/api/expenses/masters/'+kind,{method,...(method==='POST'?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({kind})});results.push(plain({status:response.status,body:await response.json(),events}));}assert.deepEqual(results[1],results[0]);
 }
});

test('truncated idempotency records and inherited inactive references retain original decisions without consuming IDs',async()=>{
 const results=[];for(const original of [true,false]){
  const events=[],d=expenseData({original,events}),api=expenseGraph({original,events}).api();
  d.data.expenses.push(['EXP-'+expenseInput.requestId,expenseInput.month,expenseInput.expenseDate,'S','SHOP','C','New',12.34]);
  await assert.rejects(api.saveExpense(d.service,{...expenseInput,note:'undefined'}),e=>e.status===409);assert.equal(events.some(e=>e[0]==='clock'||e[0]==='uuid'),false);
  d.data.shops[1][2]=false;d.data.categories[1][2]=false;
  await api.saveExpense(d.service,{...expenseInput,id:'first',requestId:undefined});
  await assert.rejects(api.saveExpense(d.service,{...expenseInput,requestId:undefined}),e=>e.status===400);
  results.push(plain({data:d.data,events}));
 }assert.deepEqual(results[1],results[0]);
});

test('HR advances HTTP retains GET projections and POST/PATCH status/error contracts through explicit shop-reader composition',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');
 for(const method of ['GET','POST','PATCH'])for(const invalid of [false,true]){
  const results=[];for(const original of [true,false]){
   const events=[],d=expenseData({original,events}),provider=googleGraph({historical:original}),{PayrollRecordsSheet}=provider.load('src/externals/google/sheet/sheets/employee-advances/PayrollRecordsSheet.ts');
   const headers=(await import('./helpers/load-source.mjs')).loadSource('src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts');d.data.advances=[Array.from(headers.ADVANCE_HEADERS)];d.data.settlements=[Array.from(headers.SETTLEMENT_HEADERS)];d.service.employeeAdvances=new PayrollRecordsSheet(d.client,'advances');d.service.payrollSettlements=new PayrollRecordsSheet(d.client,'settlements');
   if(invalid&&method==='GET')d.data.shops[0]=['wrong'];
   const employees={listEmployees:async()=>{events.push(['employees']);return [{id:'E',name:'Employee',status:'active',hiredDate:'2020-01-01',terminatedDate:''}];}};
   const graph=expenseGraph({original,service:d.service,events,externals:{'./manageEmployees':employees,'@/services/employees':employees}}),route=graph.load('src/app/api/employees/advances/route.ts');
   const input=invalid?{}:{requestId:'00000000-0000-0000-0000-000000000000',employeeId:'E',shopId:'S',paidDate:'2026-11-06',payrollMonth:'2026-11',paidAmount:12.34,reference:'ref',note:'note'};
   const response=await route[method](new Request('https://example.test/api/employees/advances',{method,...(method==='GET'?{}:{body:JSON.stringify(input)})}));
   results.push(plain({status:response.status,body:await response.json(),events}));
  }assert.deepEqual(results[1],results[0]);
 }
});
