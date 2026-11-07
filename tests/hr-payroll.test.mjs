import test from 'node:test';import assert from 'node:assert/strict';
import {hrPayrollGraph,hrPayrollData,payrollInputs,advanceInput,hrTrace} from './helpers/hr-payroll.mjs';
import {plain} from './helpers/load-source.mjs';
async function financialScenario(original){const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,service:d.service,events,...payrollInputs()}),salary=g.salary();
 const advance=await salary.createSalaryAdvance(d.service,advanceInput,g.shops);assert.deepEqual(plain(await salary.createSalaryAdvance(d.service,advanceInput,g.shops)),plain(advance));
 const payroll=await g.calculate()({googleSheetsService:d.service,month:'2026-11'});assert.equal(payroll[0].workedDays,1);assert.equal(payroll[0].commission,20);assert.equal(payroll[0].grossPay,120);assert.equal(payroll[0].advanceDeduction,120);assert.equal(payroll[0].advanceBalance,20.25);assert.equal(payroll[0].totalPay,0);
 const settling=g.settle(),input={employeeId:'E',month:'2026-11',paidDate:'2026-11-07',reference:' ref ',revision:settling.payrollRevision(payroll[0])};await assert.rejects(settling.settleEmployeePayroll(d.service,{...input,revision:'stale'}),e=>e.status===409);
 const settlement=await settling.settleEmployeePayroll(d.service,input);assert.deepEqual(plain(await settling.settleEmployeePayroll(d.service,{...input,revision:'old'})),plain(settlement));const frozen=await g.calculate()({googleSheetsService:d.service,month:'2026-11'});assert.equal(frozen[0].settlement.id,settlement.id);const ledger=await salary.readSalaryLedger(d.service);assert.equal(salary.recoveredAmount(advance.id,ledger.settlements),120);
 return {payroll:plain(payroll),frozen:plain(frozen),data:d.data,events:hrTrace(events)};}
test('original/current payroll, advances and immutable settlements preserve exact financial outcomes, revisions and event order',async()=>{assert.deepEqual(await financialScenario(false),await financialScenario(true));});
test('original/current advance transitions preserve unpaid exclusions, stale checks, duplicates and partial writes',async()=>{
 const results=[];for(const original of [true,false]){const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,service:d.service,events,...payrollInputs()}),api=g.salary();const row=['A','E','S','2026-11-01','2026-11',100,0,'requested','','','note','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'];d.data.advances.push(row.slice(),row.slice());
  const input={id:'A',action:'pay',updatedAt:row[12],paidAmount:50.25,paidDate:'2026-11-02',reference:' ref '};await assert.rejects(api.transitionSalaryAdvance(d.service,{...input,updatedAt:'stale'}),e=>e.status===409);const paid=await api.transitionSalaryAdvance(d.service,input);assert.equal(paid.paidAmount,50.25);assert.deepEqual(plain(await api.transitionSalaryAdvance(d.service,input)),plain(paid));await assert.rejects(api.transitionSalaryAdvance(d.service,{id:'A',action:'cancel',updatedAt:paid.updatedAt}),e=>e.status===409);
  results.push({data:d.data,events:hrTrace(events)});
 }assert.deepEqual(results[1],results[0]);
});
test('original/current payroll sequencing and missing-sheet/header/error behavior remain exact',async()=>{
 for(const original of [true,false]){const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,service:d.service,events,...payrollInputs()});d.setFailure((op,name)=>op==='read'&&name==='advances');await assert.rejects(g.salary().readSalaryLedger(d.service),e=>e===d.marker);assert.deepEqual(events.slice(-2),[['read','advances','A:Z'],['read','settlements','A:Z']]);d.setFailure();d.data.advances=[];await g.salary().createSalaryAdvance(d.service,advanceInput,g.shops);assert.ok(events.some(e=>e[0]==='update'&&e[2]==='A1:M1'));d.data.advances[0]=['wrong'];await assert.rejects(g.salary().readSalaryLedger(d.service),e=>e.status===503);}
});

test('effective compensation, half/full attendance, leave/employment boundaries and bucket thresholds preserve original equations',async()=>{
 for(const netSales of [-1,0,99.99,100,149.99,150,200.005]){const results=[];for(const original of [true,false]){
  const events=[],d=hrPayrollData({original,events}),inputs=payrollInputs();inputs.sales.shopSeries[0].dailySales[0].netSales=netSales;
  inputs.employees.push({id:'M',name:'Monthly',status:'active',hiredDate:'2026-11-01',terminatedDate:'2026-11-30'});inputs.compensations.push({...inputs.compensations[0],employeeId:'M',baseSalary:1000,compensationType:'monthly'},{...inputs.compensations[0],effectiveFrom:'2026-11-02',baseSalary:200});
  inputs.attendance.push({...inputs.attendance[0],employeeId:'M',createdAt:'2026-11-01T01:00:00Z',workdayType:'half'},{...inputs.attendance[0],employeeId:'M',createdAt:'2026-11-01T02:00:00Z',workdayType:'half'});
  const g=hrPayrollGraph({original,events,service:d.service,...inputs});results.push(plain(await g.calculate()({googleSheetsService:d.service,month:'2026-11'})));
 }assert.deepEqual(results[1],results[0]);assert.equal(results[1].find(x=>x.employeeId==='M').workedDays,0.5);}
});

test('ledger corruption, duplicate conflicts, invalid snapshots, over-recovery and missing-sheet recovery retain exact errors',async()=>{
 for(const scenario of ['bad-advance','conflicting-advance','bad-json','bad-snapshot','bad-totals','over-recovery','missing-range','quota']){
  const results=[];for(const original of [true,false]){const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,events,service:d.service,...payrollInputs()}),api=g.salary();
   const row=['A','E','S','2026-11-01','2026-11',100,100,'paid','2026-11-01','ref','note','c','u'];d.data.advances.push(row);
   const snapshot={employeeId:'E',totalPay:0,grossPay:100,basePay:100,commission:0,advances:[{id:'A',amount:100,deduction:100,balance:0}],advanceDeduction:100};
   if(scenario==='bad-advance')row[6]=101;
   if(scenario==='conflicting-advance')d.data.advances.push([...row.slice(0,10),'other','c','u']);
   if(['bad-json','bad-snapshot','bad-totals','over-recovery'].includes(scenario)){if(scenario==='bad-totals')snapshot.grossPay=101;if(scenario==='bad-snapshot')snapshot.employeeId='other';d.data.settlements.push(['PAY','E','2026-11','2026-11-07','ref','c',scenario==='bad-json'?'{':JSON.stringify(snapshot)]);if(scenario==='over-recovery')d.data.settlements.push(['PAY2','E','2026-10','2026-11-07','ref','c',JSON.stringify(snapshot)]);}
   if(['missing-range','quota'].includes(scenario)){const originalRead=d.client.getValues;d.client.getValues=(name,range)=>name==='advances'?Promise.reject(new Error(scenario==='missing-range'?'Google Sheets API request failed: 400 Unable to parse range':'quota')):originalRead(name,range);}
   try{results.push({result:plain(await api.readSalaryLedger(d.service))});}catch(e){results.push({error:e.message,status:e.status});}
  }assert.deepEqual(results[1],results[0],scenario);
 }
});

test('advance duplicate updates and settlement append preserve nontransactional partial failures and pending read/write phases',async()=>{
 for(const original of [true,false]){
  const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,events,service:d.service,...payrollInputs()}),api=g.salary();
  const row=['A','E','S','2026-11-01','2026-11',100,0,'requested','','','note','c','2026-11-01T00:00:00Z'];d.data.advances.push(row.slice(),row.slice());let writes=0;
  d.setFailure(op=>op==='update'&&++writes===2);await assert.rejects(api.transitionSalaryAdvance(d.service,{id:'A',action:'pay',updatedAt:row[12],paidAmount:50,paidDate:'2026-11-02',reference:'ref'}),e=>e===d.marker);assert.equal(d.data.advances[1][7],'paid');assert.equal(d.data.advances[2][7],'requested');
  d.setFailure();d.data.advances.splice(1);let release,done=false;d.setBlock({name:'advances',promise:new Promise(r=>release=r)});const pending=api.createSalaryAdvance(d.service,advanceInput,g.shops).then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(events.filter(e=>e[0]==='append').length,0);release();await pending;
  d.setBlock();d.setFailure((op,name)=>op==='append'&&name==='settlements');const payroll=await g.calculate()({googleSheetsService:d.service,month:'2026-11'}),settle=g.settle();await assert.rejects(settle.settleEmployeePayroll(d.service,{employeeId:'E',month:'2026-11',paidDate:'2026-11-07',reference:'ref',revision:settle.payrollRevision(payroll[0])}),e=>e===d.marker);assert.equal(d.data.settlements.length,1);
 }
});

test('actual original/current payroll, settlement and advance HTTP preserve routes, statuses, errors and financial JSON',async()=>{
 for(const [route,method,input]of [['payroll','GET',null],['payroll/settle','POST',{}],['advances','GET',null],['advances','POST',advanceInput],['advances','PATCH',{}]]){
  const results=[];for(const original of [true,false]){const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,events,service:d.service,...payrollInputs()}),routeModule=g.load('src/app/api/employees/'+route+'/route.ts');const response=await routeModule[method](new Request('https://example.test/api/employees/'+route+(route==='payroll'?'?month=2026-11':''),{method,...(method==='GET'?{}:{body:JSON.stringify(input)})}));results.push(plain({status:response.status,body:await response.json(),events:hrTrace(events)}));}assert.deepEqual(results[1],results[0]);
 }
});

test('actual employee/compensation/attendance worksheet reads and initialization remain outside HR core with identical payroll results',async()=>{
 const {googleGraph}=await import('./helpers/google-infrastructure.mjs');const results=[];
 for(const original of [true,false]){
  const events=[],d=hrPayrollData({original,events}),provider=googleGraph({historical:original}),registry=provider.load('src/externals/google/sheet/index.ts');
  for(const [property,klass,headers,rows]of [['employees','EmployeesSheet','EMPLOYEE_HEADERS',[['E','Employee','','active','2020-01-01','','c','u','actor']]],['employeeCompensations','EmployeeCompensationsSheet','EMPLOYEE_COMPENSATION_HEADERS',[['E',100,0,'c','u','actor','2020-01-01','daily','sales_bucket',100,10,50]]],['employeeTimesheets','EmployeeTimesheetsSheet','EMPLOYEE_TIMESHEET_HEADERS',[['T','E','S','work','2026-11-01T01:00:00Z','2026-11-01T02:00:00Z','full']]]]){
   d.data[property]=[Array.from(registry[headers]),...rows];d.service[property]=new registry[klass](d.client,property);
  }
  const g=hrPayrollGraph({original,events,service:d.service,...payrollInputs(),realReaders:true}),payroll=await g.calculate()({googleSheetsService:d.service,month:'2026-11'});assert.equal(payroll[0].grossPay,120);
  assert.deepEqual(events.slice(0,4),[['ensure','employeeCompensations'],['read','employeeCompensations','A1:L1'],['read','employees','A:I'],['read','employeeCompensations','A:L']]);
  results.push(plain({payroll,events:hrTrace(events),data:d.data}));
 }assert.deepEqual(results[1],results[0]);
});

test('pending salary append and oversized immutable snapshots preserve original write/clock boundaries',async()=>{
 for(const original of [true,false]){
  const events=[],d=hrPayrollData({original,events}),inputs=payrollInputs(),g=hrPayrollGraph({original,events,service:d.service,...inputs});const append=d.client.appendValues;let release,done=false;
  d.client.appendValues=async(...args)=>{await new Promise(r=>release=r);return append(...args);};const p=g.salary().createSalaryAdvance(d.service,advanceInput,g.shops).then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(d.data.advances.length,1);release();await p;assert.equal(done,true);
  d.client.appendValues=append;inputs.employees[0].name='N'.repeat(50000);const payroll=await g.calculate()({googleSheetsService:d.service,month:'2026-11'}),settle=g.settle();const before=events.length;await assert.rejects(settle.settleEmployeePayroll(d.service,{employeeId:'E',month:'2026-11',paidDate:'2026-11-07',reference:'ref',revision:settle.payrollRevision(payroll[0])}),e=>e.message.includes('snapshot size limit'));assert.equal(d.data.settlements.length,1);assert.equal(events.slice(before).some(e=>e[0]==='ensure'),false);
 }
});

test('settlement payment fields retain their original evaluation after header preparation and sheet method lookup',async()=>{
 const results=[];for(const original of [true,false]){
  const events=[],d=hrPayrollData({original,events}),g=hrPayrollGraph({original,events,service:d.service,...payrollInputs()}),payroll=await g.calculate()({googleSheetsService:d.service,month:'2026-11'}),settle=g.settle();
  let currentEmployee='E',release;const input={get employeeId(){events.push(['payment-field',currentEmployee]);return currentEmployee;},month:'2026-11',paidDate:'2026-11-07',reference:'ref',revision:settle.payrollRevision(payroll[0])};
  const ensure=d.client.ensureWorksheet;d.client.ensureWorksheet=async name=>{await ensure(name);if(name==='settlements')await new Promise(r=>release=r);};const pending=settle.settleEmployeePayroll(d.service,input);await new Promise(r=>setImmediate(r));assert.equal(typeof release,'function');currentEmployee='changed-after-prepare';release();const result=await pending;
  assert.equal(result.employeeId,'E');assert.equal(d.data.settlements[1][1],'changed-after-prepare');results.push(plain({result,data:d.data,events:hrTrace(events)}));
 }assert.deepEqual(results[1],results[0]);
});
