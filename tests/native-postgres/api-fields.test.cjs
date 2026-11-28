/* eslint-disable @typescript-eslint/no-require-imports -- Real feature/HTTP owners, synthetic stores and no credentials or providers. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {beforeSalesNaming}=require('../helpers/sales-naming-history.cjs');
const expenseOwner=require('../../src/modules/expenses/server.ts');
const inventoryOwner=require('../../src/modules/inventory/server.ts');
const salesOwner=require('../../src/modules/sales/server.ts');
const {PostgresExpenseStore}=require('../../src/modules/expenses/infrastructure/postgres/expense-store.ts');
const {createMovementStore}=require('../../src/modules/inventory/infrastructure/postgres/movements.ts');
const {createSalesReports}=require('../../src/modules/sales/application/reports.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const at='2026-11-01T00:00:00.000Z';
function evaluate(file,source,imports={}){
 const exports={};const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,URL,Date,Intl,console:{error(){}},require(name){if(name==='server-only')return {};assert.ok(Object.hasOwn(imports,name),`Unstubbed dependency: ${name}`);return imports[name];}},{filename:file});return exports;
}
function fixture(){
 const expense=(id,extra={})=>({id,month:'2026-11',expenseDate:'2026-11-01',shopId:'SHOP',scope:'SHOP',categoryId:'CAT',name:id,amount:20,note:'',createdAt:at,updatedAt:at,createdBy:'synthetic',deletedAt:'',...extra});
 const rows={expenses:[expense('shop'),expense('offline',{shopId:'OFF',amount:7}),expense('shared',{scope:'SHARED',shopId:'',categoryId:'SHARED',amount:5}),expense('missing',{shopId:'missing',categoryId:'missing',amount:3}),expense('deleted',{amount:88,deletedAt:at}),expense('other-year',{amount:99,month:'2025-11'}),expense('december',{month:'2026-12',amount:1})],shops:[{id:'SHOP',name:'Mapped shop',active:true,loyverseAccountId:'AC',createdAt:at,updatedAt:at},{id:'OFF',name:'Offline shop',active:false,loyverseAccountId:'',createdAt:at,updatedAt:at}],expenseCategories:[{id:'CAT',name:'Rent',active:true,createdAt:at,updatedAt:at},{id:'SHARED',name:'Shared overhead',active:false,createdAt:at,updatedAt:at}],movementMasters:[{id:'M',userId:'U',packingDate:'2026-11-01',deliverDateTime:'',status:'created',totalQuantity:'7',createdAt:at,updatedAt:at}],movementDetails:[{id:'D1',movementMasterId:'M',shopName:'Mapped shop',quantity:'3',remark:'note',fromLocation:'Home',toLocation:'Shop',productImageUrl:'https://example.invalid/movement',status:'created',createdAt:at,updatedAt:at,stockCounted:false,isNewArrival:true},{id:'D2',movementMasterId:'M',shopName:'Mapped shop',quantity:'4',remark:'other',fromLocation:'Home',toLocation:'Shop',productImageUrl:'',status:'created',createdAt:at,updatedAt:at,stockCounted:false,isNewArrival:false}]};
 const writes=[];const storage=Object.fromEntries(Object.entries(rows).map(([table,records])=>[table,{prepare:async()=>{},all:async()=>records.filter(r=>!r.deletedAt),select:async(sql,values)=>records.filter(r=>!r.deletedAt && (Array.isArray(values[0])?values[0].includes(r[sql.includes('movementMasterId')?'movementMasterId':'id']):String(r[sql.includes('movementMasterId')?'movementMasterId':'id']).toUpperCase()===String(values[0]).toUpperCase())),insert:async value=>{writes.push({table,operation:'insert',value});records.push({...value});},update:async(record,patch)=>{writes.push({table,operation:'update',patch});Object.assign(record,patch);},softDelete:async record=>{record.deletedAt=at;}}]));
 return {rows,storage,writes};
}
function previousExpenses(){const file='src/modules/expenses/application/manage-expenses.ts';return evaluate(file,beforeSalesNaming(file).toString(),{'../domain/rules':require('../../src/modules/expenses/domain/rules.ts')});}
async function canonical(f){return expenseOwner.listExpenses({storage:f.storage,year:'2026'});}
const withoutAliases=rows=>rows.map(row=>{const result={...row};delete result.accountId;delete result.category;return result;}); // Removed only at the old comparison boundary.

test('expense DTOs retain canonical values/filtering/sorting and omit both derived aliases',async()=>{
 const f=fixture(),current=await canonical(f),previous=await previousExpenses().listExpenses({store:new PostgresExpenseStore(f.storage),year:'2026'});
 assert.equal(current.length,5);assert.equal(current[0].id,'december');
 assert.deepEqual(plain(current),plain(withoutAliases(previous)));
 for(const expense of current){assert.equal(Object.hasOwn(expense,'accountId'),false);assert.equal(Object.hasOwn(expense,'category'),false);assert.ok(Object.hasOwn(expense,'shopId'));assert.ok(Object.hasOwn(expense,'categoryId'));}
});

test('canonical expense reads no longer require or evaluate master readers',async()=>{
 const f=fixture(),{listExpenses}=require('../../src/modules/expenses/application/manage-expenses.ts');
 const store={readExpenses:async()=>f.rows.expenses};Object.defineProperties(store,{readShops:{get(){assert.fail('Unneeded shop read');}},readCategories:{get(){assert.fail('Unneeded category read');}}});
 assert.equal((await listExpenses({store,year:'2026'})).length,5);
});

test('report-only projection preserves mapped, offline, shared, inactive and missing master behavior',async()=>{
 const f=fixture(),expenses=await canonical(f),shops=await expenseOwner.listExpenseShops(f.storage),categories=await expenseOwner.listExpenseCategories(f.storage),original=JSON.stringify({expenses,shops,categories});
 const projected=salesOwner.projectProfitExpenses(expenses,shops,categories);
 const old=await previousExpenses().listExpenses({store:new PostgresExpenseStore(f.storage),year:'2026'});
 const fields=['id','month','scope','amount','name','note','accountId','category'];
 assert.deepEqual(plain(projected),plain(old.map(row=>Object.fromEntries(fields.map(key=>[key,row[key]])))));
 assert.equal(projected.find(row=>row.id==='shop').accountId,'AC');assert.equal(projected.find(row=>row.id==='offline').accountId,'OFF');assert.equal(projected.find(row=>row.id==='missing').category,'missing');
 assert.equal(projected.find(row=>row.id==='shared').category,'Shared overhead');assert.equal(JSON.stringify({expenses,shops,categories}),original);
});

function route(file,f,{previous=false}={}){
 const expenseBindings=previous?{...expenseOwner,listExpenses:({year})=>previousExpenses().listExpenses({store:new PostgresExpenseStore(f.storage),year})}:expenseOwner;
 const emptyReader=()=>({receipts:async()=>[],items:async()=>[],payments:async()=>[],syncs:async()=>[]});
 const reports=previous?evaluate('src/modules/sales/application/reports.ts',beforeSalesNaming('src/modules/sales/application/reports.ts').toString()).createSalesReports(emptyReader):createSalesReports(emptyReader);
 const sales={projectProfitExpenses:salesOwner.projectProfitExpenses,listSalesProfitCostOverrides:async()=>[],[previous?'getGoogleSheetsProfitSummary':'getProfitSummary']:input=>reports[previous?'getGoogleSheetsProfitSummary':'getProfitSummary'](input)};
 const imports={'@/composition/postgres/route':{withPersistence:handler=>handler},'next/server':{NextResponse:Response},'@/composition/postgres/service':{createBusinessDatabase:()=>f.storage},'@/modules/expenses/server':expenseBindings,'@/modules/inventory/server':inventoryOwner,'@/modules/sales/server':sales,'@/shared/lib/is-record':require('../../src/shared/lib/is-record.ts'),'@/config':{getConfig:()=>({})},'@/composition/loyverse-accounts':{listLoyverseAccounts:async()=>[{id:'AC',shopName:'Mapped account'}]}};
 return evaluate(file,previous?beforeSalesNaming(file).toString():fs.readFileSync(file,'utf8'),imports);
}
const context=(id='M',itemId='D1')=>({params:Promise.resolve({id,itemId})});
const request=(pathname,method='GET',body)=>new Request('https://example.test'+pathname,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});

test('actual expense GET omits aliases while retaining masters, month filtering, validation and totals',async()=>{
 const f=fixture(),file='src/app/api/expenses/route.ts',api=route(file,f),old=route(file,f,{previous:true});
 const actual=await api.GET(request('/api/expenses?month=2026-11')),before=await old.GET(request('/api/expenses?month=2026-11'));
 assert.equal(actual.status,200);const body=await actual.json(),expected=await before.json();expected.expenses=withoutAliases(expected.expenses);assert.deepEqual(body,expected);assert.equal(body.expenses.length,4);
 assert.equal((await api.GET(request('/api/expenses?month=bad'))).status,400);
});

test('actual profit GET retains all financial values and shared-category labels using canonical expenses',async()=>{
 const f=fixture(),file='src/app/api/sales/profit-summary/route.ts';
 const current=await route(file,f).GET(request('/api/sales/profit-summary?year=2026')),old=await route(file,f,{previous:true}).GET(request('/api/sales/profit-summary?year=2026'));
 assert.equal(current.status,200);assert.equal(old.status,200);const actual=await current.json(),expected=await old.json();expected.source='postgres';assert.deepEqual(actual,expected);
 assert.equal(actual.totals.expenses,33);assert.equal(actual.months.find(month=>month.month==='2026-11').sharedExpenses[0].category,'Shared overhead');
});

test('movement read mapping removes only the dummy API field and never reads the retired column',async()=>{
 const f=fixture();for(const row of f.rows.movementDetails)Object.defineProperty(row,'purchaseDetailId',{get(){assert.fail('Retired column read');}});
 const file='src/modules/inventory/infrastructure/postgres/movements.ts',old=evaluate(file,beforeSalesNaming(file).toString(),{'../../domain/movement-rules':require('../../src/modules/inventory/domain/movement-rules.ts')}).createMovementStore(f.storage);
 const current=(await createMovementStore(f.storage).readDetails()).records(),previous=(await old.readDetails()).records();
 const expected=previous.map(row=>{assert.equal(row.purchaseDetailId,'');const result={...row};delete result.purchaseDetailId;return result;});
 assert.deepEqual(plain(current),plain(expected));assert.ok(current.every(row=>!Object.hasOwn(row,'purchaseDetailId')));
});

test('actual movement GET, quantity PATCH and DELETE responses consistently omit the retired field',async()=>{
 const f=fixture(),detail=route('src/app/api/movements/[id]/route.ts',f),items=route('src/app/api/movements/[id]/items/[itemId]/route.ts',f);
 const read=await detail.GET(request('/api/movements/M'),context());assert.equal(read.status,200);assert.ok((await read.json()).records.every(row=>!Object.hasOwn(row,'purchaseDetailId')));
 const patch=await items.PATCH(request('/api/movements/M/items/D1','PATCH',{quantity:'5'}),context());assert.equal(patch.status,200);const body=await patch.json();assert.equal(body.record.quantity,'5');assert.equal(Object.hasOwn(body.record,'purchaseDetailId'),false);assert.ok(body.records.every(row=>!Object.hasOwn(row,'purchaseDetailId')));assert.equal(f.rows.movementMasters[0].totalQuantity,'9');
 const deleted=await items.DELETE(request('/api/movements/M/items/D2','DELETE'),context('M','D2'));assert.equal(deleted.status,200);const after=await deleted.json();assert.equal(after.records.length,1);assert.equal(after.records[0].movementId,'D1');assert.equal(Object.hasOwn(after.records[0],'purchaseDetailId'),false);
 assert.equal((await detail.GET(request('/api/movements/missing'),context('missing'))).status,404);
});

test('expense create/retry/delete still use canonical identifiers and never persist supplied aliases',async()=>{
 const f=fixture(),api=route('src/app/api/expenses/route.ts',f),input={requestId:'00000000-0000-0000-0000-000000000001',month:'2026-11',expenseDate:'2026-11-02',shopId:'SHOP',scope:'SHOP',categoryId:'CAT',name:'New',amount:2,note:'',accountId:'wrong',category:'wrong'};
 const a=await api.POST(request('/api/expenses','POST',input)),b=await api.POST(request('/api/expenses','POST',input));assert.equal(a.status,200);assert.equal(b.status,200);const saved=await a.json();assert.deepEqual(await b.json(),saved);
 const writes=f.writes.filter(w=>w.operation==='insert');assert.equal(writes.length,1);assert.equal(writes[0].value.shopId,'SHOP');assert.equal(writes[0].value.categoryId,'CAT');assert.equal(Object.hasOwn(writes[0].value,'accountId'),false);assert.equal(Object.hasOwn(writes[0].value,'category'),false);
 assert.equal((await api.DELETE(request('/api/expenses','DELETE',{id:saved.id}))).status,200);assert.equal(f.rows.expenses.find(row=>row.id===saved.id).deletedAt!=='',true);
});
