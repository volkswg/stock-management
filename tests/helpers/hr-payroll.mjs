import { completionNewFiles } from "./hr-application-history.mjs";
import { restoreHRSource } from "./hr-payroll-history.mjs";
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {googleGraph} from './google-infrastructure.mjs';
import {loadSource,plain} from './load-source.mjs';
export const payrollBefore=JSON.parse(readFileSync('tests/fixtures/hr-payroll-before.json','utf8'));
export const salaryFile='src/services/employees/manageSalaryAdvances.ts',calculationFile='src/services/employees/calculateEmployeePayroll.ts',settlementFile='src/services/employees/settleEmployeePayroll.ts';
export function hrPayrollGraph({original=false,events=[],service,employees=[],compensations=[],attendance=[],sales={shopSeries:[]},failure,globals={},overrides={},realReaders=false}={}){
 const allowed=new Set([...completionNewFiles,"src/modules/hr/server.ts","src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts","src/modules/hr/infrastructure/google-sheets/employees/const.ts","src/modules/hr/infrastructure/google-sheets/employee-compensations/const.ts","src/modules/hr/infrastructure/google-sheets/employee-timesheets/const.ts",'src/services/employees/manageEmployees.ts','src/services/employees/manageEmployeeTimesheets.ts','src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts',salaryFile,calculationFile,settlementFile,'src/services/employees/payroll-composition.ts',...['contracts.ts','payroll-server.ts','domain/salary-rules.ts','domain/payroll-calculation.ts','application/salary-advances.ts','application/calculate-payroll.ts','application/settle-payroll.ts','infrastructure/google-sheets/salary-store.ts','infrastructure/payroll-revision.ts'].map(f=>'src/modules/hr/'+f),'src/app/api/employees/advances/route.ts','src/app/api/employees/payroll/route.ts','src/app/api/employees/payroll/settle/route.ts']);
 const headers=loadSource('src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts'),cache=new Map();
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-07T00:00:00Z']));if(!args.length)events.push(['clock']);}static now(){events.push(['now']);return Date.parse('2026-11-07T00:00:00Z');}}
 const read=(name,value)=>(...args)=>{events.push([name,...args]);if(failure?.name===name)return Promise.reject(failure.error);return Promise.resolve(value);};
 const employeeFunctions={listEmployees:read('employees',employees),listEmployeeCompensations:read('compensations',compensations)},timesheetFunctions={EmployeeTimesheetStatus:{Work:'work',Leave:'leave'},listEmployeeTimesheetsForMonth:read('attendance',attendance)},salesFunctions={getGoogleSheetsSalesDashboard:read('sales',sales)},shops={listShops:read('shops',[{id:'S',active:true}])};
 function load(file){assert.ok(allowed.has(file),`Unapproved HR dependency ${file}`);if(cache.has(file))return cache.get(file);const source=overrides[file]??(original?(payrollBefore.files[file]?.source??(payrollBefore.types[file]?restoreHRSource(file):undefined)):undefined)??readFileSync(file,'utf8'),exports={};cache.set(file,exports);
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date:Clock,Request,Response,URL,fetch:()=>assert.fail('Live IO forbidden'),console:{error:(...a)=>events.push(['log',...a])},...globals,require(spec){
   if(spec==='server-only')return {};
   if(spec==='node:crypto')return {createHash,randomUUID:()=>assert.fail('No workforce ID generation expected')};
   if(spec==='next/server')return {NextResponse:Response};
   if(spec==='@/config')return {getConfig:()=>{events.push(['config']);return {};}};
   if(spec==='@/externals/google/sheet')return {...(realReaders?googleGraph({historical:original}).load('src/externals/google/sheet/index.ts'):{}),createGoogleSheetsServiceFromConfig:()=>{events.push(['factory']);return service;}};
   if(spec==='@/modules/hr/server' && !realReaders)return {...load('src/modules/hr/contracts.ts'),...load('src/modules/hr/domain/attendance-rules.ts'),createHRPayrollReaders:(service,sales)=>({employees:{listEmployees:()=>employeeFunctions.listEmployees({googleSheetsService:service})},compensations:{listCompensations:()=>employeeFunctions.listEmployeeCompensations({googleSheetsService:service})},attendance:{listAttendance:month=>timesheetFunctions.listEmployeeTimesheetsForMonth({googleSheetsService:service,month})},sales}),...employeeFunctions};
   if(spec==='@/externals/google/sheet/sheets/employees/const')return load('src/modules/hr/infrastructure/google-sheets/employees/const.ts');
   if(spec==='./manageEmployees')return realReaders?load('src/services/employees/manageEmployees.ts'):employeeFunctions;
   if(spec==='@/services/employees')return {...employeeFunctions,...load(calculationFile)};
   if(spec==='./manageEmployeeTimesheets')return realReaders?load('src/services/employees/manageEmployeeTimesheets.ts'):timesheetFunctions;
   if(spec==='@/modules/sales/server')return {createSalesDashboardReader:service=>({readSales:input=>salesFunctions.getGoogleSheetsSalesDashboard({...input,googleSheetsService:service})})};
   if(spec==='@/services/sales'||spec==='@/services/sales/getGoogleSheetsDailySales')return salesFunctions;
   if(spec==='@/modules/expenses/server')return {listExpenseShops:()=>shops.listShops()};
   if(spec==='./salary-advance-shops'||spec==='@/services/employees/salary-advance-shops')return {createSalaryAdvanceShops:()=>shops};
   if(spec==='@/modules/hr/infrastructure/google-sheets/employee-advances/const')return headers;
   let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';return load(target);
  }});return exports;
 }
 return {load,salary:()=>load(salaryFile),calculate:()=>load(calculationFile).calculateEmployeePayroll,settle:()=>load(settlementFile),shops,headers,cache};
}
export function hrPayrollData({events=[],original=false}={}){
 const g=googleGraph({historical:original}),{PayrollRecordsSheet}=g.load('src/externals/google/sheet/sheets/employee-advances/PayrollRecordsSheet.ts'),headers=loadSource('src/modules/hr/infrastructure/google-sheets/employee-advances/const.ts');
 const data={advances:[Array.from(headers.ADVANCE_HEADERS)],settlements:[Array.from(headers.SETTLEMENT_HEADERS)]};let failure,block;const marker=new Error('synthetic sheet failure');
 const client={ensureWorksheet:async name=>{events.push(['ensure',name]);if(failure?.('ensure',name))throw marker;},getValues:async(name,range)=>{events.push(['read',name,range]);if(failure?.('read',name))throw marker;if(block?.name===name)await block.promise;return data[name].map(row=>row.slice());},appendValues:async(name,range,values,mode)=>{events.push(['append',name,range,plain(values),mode]);if(failure?.('append',name))throw marker;if(block?.name===name)await block.promise;data[name].push(...plain(values));},updateValues:async(name,range,values,mode)=>{events.push(['update',name,range,plain(values),mode]);if(failure?.('update',name))throw marker;const at=Number(/\d+/.exec(range)[0])-1;values.forEach((r,i)=>data[name][at+i]=Array.from(r));}};
 const service={employeeAdvances:new PayrollRecordsSheet(client,'advances'),payrollSettlements:new PayrollRecordsSheet(client,'settlements')};
 return {service,data,marker,client,setFailure:f=>failure=f,setBlock:b=>block=b};
}
export function payrollInputs(){return {employees:[{id:'E',name:'Employee',status:'active',hiredDate:'2020-01-01',terminatedDate:''},{id:'X',name:'Departed',status:'inactive',hiredDate:'2020-01-01',terminatedDate:'2026-10-31'}],compensations:[{employeeId:'E',effectiveFrom:'2020-01-01',baseSalary:100,compensationType:'daily',commissionType:'sales_bucket',commissionBucketSales:100,commissionBucketAmount:10,commissionRoundupThreshold:50}],attendance:[{employeeId:'E',shopId:'S',status:'work',createdAt:'2026-11-01T01:00:00Z',workdayType:'half'},{employeeId:'E',shopId:'S',status:'work',createdAt:'2026-11-01T02:00:00Z',workdayType:'full'},{employeeId:'E',shopId:'S',status:'leave',createdAt:'2026-11-02T01:00:00Z',workdayType:null}],sales:{shopSeries:[{accountId:'S',shopName:'Shop',dailySales:[{salesDate:'2026-11-01',netSales:150}]}]}};}
export const advanceInput={requestId:'00000000-0000-0000-0000-000000000000',employeeId:'E',shopId:'S',paidDate:'2026-11-01',payrollMonth:'2026-11',paidAmount:140.25,reference:' ref ',note:' note '};
// Keep traces stable without serializing the fake service's methods.
export const hrTrace=events=>plain(events.map(e=>['employees','compensations','attendance','sales'].includes(e[0])?[e[0],...e.slice(1).map(arg=>arg&&typeof arg==='object'?Object.fromEntries(Object.entries(arg).filter(([key])=>key!=='googleSheetsService')):arg)]:e));
