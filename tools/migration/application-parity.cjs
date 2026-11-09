/* eslint-disable @typescript-eslint/no-require-imports -- Offline execution of current TypeScript application owners. */
// No business calculations live here. Only frozen transport data, clock and
// invocations of existing read-only applications; every provider call is denied.
require('../../tests/helpers/postgres-runtime.cjs');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {parseArgs}=require('node:util');
const {GoogleSheetsService}=require('../../src/composition/google-sheets/GoogleSheetsService.ts');
const catalog=require('./worksheets.json'),audit=require('./source-audit.json');
const orders=require('../../src/modules/orders/server.ts');
const shipments=require('../../src/modules/shipments/server.ts');
const inventory=require('../../src/modules/inventory/server.ts');
const expenses=require('../../src/modules/expenses/server.ts');
const hr=require('../../src/modules/hr/server.ts');
const payroll=require('../../src/modules/hr/payroll-server.ts');
const sales=require('../../src/modules/sales/server.ts');
const line=require('../../src/modules/line-workflows/server.ts');
const {GoogleSheetsOrderDetailShipmentProjection}=require('../../src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts');

function snapshotService(snapshot,formatted){
 if(snapshot.version!==1||JSON.stringify(Object.keys(snapshot.sheets).sort())!==JSON.stringify(Object.keys(catalog).sort()))throw new Error('Incomplete snapshot');
 const config={spreadsheetId:'offline-only',serviceAccountEmail:'offline@example.invalid',serviceAccountPrivateKey:'offline-never-used'};
 const rows={};
 for(const [table,spec] of Object.entries(catalog)){
  const sheet=snapshot.sheets[table];
  if(JSON.stringify(sheet.headers)!==JSON.stringify(spec.headers))throw new Error('Header mismatch');
  if(formatted&&(!Array.isArray(sheet.formattedRows)||sheet.formattedRows.length!==sheet.rows.length))throw new Error('Complete original formatted rows required');
  config[audit[table].configProperty]=table;
  rows[table]=[sheet.headers,...(formatted?sheet.formattedRows:sheet.rows)];
 }
 const service=new GoogleSheetsService(config),client=service.client;
 const forbidden=()=>{throw new Error('All writes and provider operations are forbidden in offline parity');};
 for(const name of Object.getOwnPropertyNames(Object.getPrototypeOf(client)))if(name!=='constructor')client[name]=forbidden;
 client.ensureWorksheet=async table=>{if(!rows[table])throw new Error('Missing frozen worksheet');};
 client.getValues=async(table,range)=>{
  const match=/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);
  if(!match||!rows[table])throw new Error('Unsupported offline range');
  const column=s=>[...s].reduce((value,c)=>value*26+c.charCodeAt(0)-64,0)-1;
  const first=Number(match[2]||1)-1,last=match[4]?Number(match[4]):match[3]?rows[table].length:match[2]?Number(match[2]):rows[table].length;
  return structuredClone(rows[table].slice(first,last).map(row=>row.slice(column(match[1]),column(match[3]||match[1])+1)));
 };
 client.getValuesBatch=async ranges=>Promise.all(ranges.map(({worksheetName,range})=>client.getValues(worksheetName,range)));
 return service;
}

const stable=value=>{
 if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Nonfinite application result');
 if(Array.isArray(value))return value.map(stable);
 if(Object.prototype.toString.call(value)==='[object Date]')return value.toISOString();
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
 return value;
};
const sha=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

async function compareApplications(source,operational,config){
 if(source.spreadsheetId!==operational.spreadsheetId)throw new Error('Workbook identity mismatch');
 if(!Array.isArray(config.months)||!config.months.length||config.months.some(m=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))||!Array.isArray(config.accounts))throw new Error('Explicit months and credential-free accounts required');
 if(config.accounts.some(a=>Object.keys(a).some(k=>!['id','shopName'].includes(k))||typeof a.id!=='string'||typeof a.shopName!=='string'))throw new Error('Only account metadata is permitted');
 if(new Set(config.accounts.map(a=>a.id)).size!==config.accounts.length)throw new Error('Duplicate account metadata');
 if(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(config.asOf)||!Number.isFinite(Date.parse(config.asOf)))throw new Error('Explicit offset-aware frozen clock required');
 const RealDate=global.Date,realFetch=global.fetch,instant=Date.parse(config.asOf);
 const requiredMonths=new Set(),requiredAccounts=new Set();
 const transactionalDates={orders:['createdAt'],shipments:['createdAt','shippedAt','deliveredAt'],movements:['packingDate','deliverDateTime','createdAt'],sales_receipts:['salesDate'],sales_receipt_syncs:['salesDate'],stock_counts:['month'],stock_adjustments:['date'],employee_timesheets:['createdAt'],employee_advances:['requestedDate','payrollMonth','paidDate'],payroll_settlements:['month','paidDate'],expenses:['month','expenseDate'],sales_profit_cost_overrides:['month']};
 for(const [table,sheet] of Object.entries(source.sheets))for(const row of sheet.rows){
  for(const column of ['accountId','loyverseAccountId']){const index=sheet.headers.indexOf(column);if(index>=0&&row[index])requiredAccounts.add(String(row[index]));}
  for(const column of transactionalDates[table]||[]){
   const value=row[sheet.headers.indexOf(column)];if(!value)continue;
   if(/^\d{4}-\d{2}/.test(value))requiredMonths.add(value.slice(0,7));
   if(/T/.test(value)&&Number.isFinite(RealDate.parse(value))){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).formatToParts(new RealDate(value));
    requiredMonths.add(parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value);
   }
  }
 }
 const coverage={missingMonths:[...requiredMonths].filter(m=>!config.months.includes(m)).sort(),missingAccounts:[...requiredAccounts].filter(id=>!config.accounts.some(a=>a.id===id)).sort()};
 global.Date=class extends RealDate{constructor(...args){if(args.length)super(...args);else super(instant);}static now(){return instant;}};
 global.fetch=()=>{throw new Error('Provider access forbidden during offline parity');};
 try{
  const sections={};
  const read=async service=>{
   const result={};const call=async(name,run)=>{try{const value=await run();sha(value);result[name]={ok:true,value};}catch{result[name]={ok:false,error:'Reader failed; inspect approved source types and business prerequisites privately.'};}};
   await call('orders',()=>orders.listOrders({googleSheetsService:service}));
   await call('orderDetails',async()=>Promise.all((await orders.listOrders({googleSheetsService:service})).map(order=>orders.getOrderDetail({googleSheetsService:service,orderId:order.id,shipmentProjection:new GoogleSheetsOrderDetailShipmentProjection(service)}))));
   await call('shipments',()=>shipments.listShipments({googleSheetsService:service}));
   await call('movements',()=>inventory.listMovements({googleSheetsService:service,filter:{}}));
   await call('movementItems',async()=>Promise.all((await inventory.listMovements({googleSheetsService:service,filter:{}})).map(m=>inventory.getMovementItems({googleSheetsService:service,movementMasterId:m.id}))));
   await call('adjustments',()=>inventory.listStockAdjustments(service));
   await call('employees',()=>hr.listEmployees({googleSheetsService:service}));
   await call('compensation',()=>hr.listEmployeeCompensations({googleSheetsService:service}));
   await call('advances',()=>payroll.listSalaryAdvances(service));
   await call('settlements',()=>payroll.listPayrollSettlements(service));
   await call('shops',()=>expenses.listExpenseShops(service));await call('categories',()=>expenses.listExpenseCategories(service));
   const users=source.sheets.user_state.rows.map(row=>[row[1],row[2]]);
   await call('lineSessions',()=>Promise.all(users.map(([userId,flowname])=>line.findLatestUserState({googleSheetsService:service,userId,flowname}))));
   for(const year of new Set(config.months.map(m=>m.slice(0,4)))){
    await call(`expenses:${year}`,()=>expenses.listExpenses({googleSheetsService:service,year}));
    await call(`costOverrides:${year}`,()=>sales.listSalesProfitCostOverrides({googleSheetsService:service,year}));
    await call(`profit:${year}`,async()=>sales.getGoogleSheetsProfitSummary({googleSheetsService:service,year,accounts:config.accounts,costOverrides:await sales.listSalesProfitCostOverrides({googleSheetsService:service,year}),expenses:await expenses.listExpenses({googleSheetsService:service,year})}));
   }
   for(const month of config.months){
    await call(`attendance:${month}`,()=>hr.listEmployeeTimesheetsForMonth({googleSheetsService:service,month}));
    await call(`stock:${month}`,()=>inventory.getMonthlyStockCounts({googleSheetsService:service,accounts:config.accounts,month}));
    await call(`payroll:${month}`,()=>payroll.calculateEmployeePayroll({googleSheetsService:service,month,readers:hr.createHRPayrollReaders(service,sales.createSalesDashboardReader(service))}));
    const fromDate=month+'-01',toDate=new RealDate(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
    await call(`sales:${month}`,()=>sales.getGoogleSheetsSalesDashboard({googleSheetsService:service,accountIds:config.accounts.map(a=>a.id),fromDate,toDate}));
    await call(`sync:${month}`,()=>Promise.all(config.accounts.map(a=>sales.listSalesSyncStatus({googleSheetsService:service,accountId:a.id,month}))));
   }
   return result;
  };
  const left=await read(snapshotService(source,true)),right=await read(snapshotService(operational,false));
  for(const name of Object.keys(left))sections[name]={match:left[name].ok&&right[name].ok&&sha(left[name].value)===sha(right[name].value),source:left[name],operational:right[name]};
  return {version:1,scope:'offline-original-application-read-parity',match:!coverage.missingMonths.length&&!coverage.missingAccounts.length&&Object.values(sections).every(s=>s.match),coverage,sections,asOf:config.asOf,months:config.months,cutoverReady:false,hostedRuntimeVerified:false};
 }finally{global.Date=RealDate;global.fetch=realFetch;}
}

module.exports={compareApplications};
if(require.main===module)(async()=>{
 try{
  const {values}=parseArgs({options:Object.fromEntries(['source','operational','config','output'].map(k=>[k,{type:'string'}]))});
  if(Object.values(values).length!==4)throw new Error('Four explicit private paths required');
  const result=await compareApplications(...['source','operational','config'].map(k=>JSON.parse(fs.readFileSync(values[k],'utf8'))));
  fs.writeFileSync(values.output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({match:result.match,sections:Object.keys(result.sections).length,cutoverReady:false}));
  if(!result.match)process.exitCode=1;
 }catch{console.error('Application parity failed. Inspect restricted artifacts; no provider request or mutation was attempted.');process.exitCode=2;}
})();
