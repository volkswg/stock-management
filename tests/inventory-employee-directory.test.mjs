import assert from "node:assert/strict";
import test from "node:test";
import {plain} from "./helpers/load-source.mjs";
import {directoryGraph,directorySheets} from "./helpers/employee-directory.mjs";
const fields=["id","name","phone","status","hiredDate","terminatedDate","createdAt","updatedAt","createdBy"];
const row=[" e "," Name ","phone","unrecognized","2026-01-01","","c","u","actor"];
test("original employee directory preserves header-prefix validation, empty/malformed rows and untrimmed five-field mapping",async()=>{
 for(const [rows,expected]of [[[],[]],[[fields],[]],[{},[]],[[[...fields,"extra"],row],[{id:" e ",name:" Name ",status:"unrecognized",hiredDate:"2026-01-01",terminatedDate:""}]],[[fields,[0,"skip"],[true,false,"",null,0,false]],[{id:"true",name:"false",status:"",hiredDate:"0",terminatedDate:"false"}]]]){
  const events=[],service=directorySheets({employees:rows,events}),g=directoryGraph({service});assert.deepEqual(plain(await g.legacy().listAdjustmentEmployees(service)),expected);assert.deepEqual(events,[["employees.read"]]);
 }
 const service=directorySheets({employees:[["wrong"]]}),g=directoryGraph({service});await assert.rejects(g.legacy().listAdjustmentEmployees(service),e=>e instanceof g.legacy().StockAdjustmentError&&e.status===503&&e.message==="Employee storage headers do not match.");
 for(const rows of [[fields,null],null,[null]]){const service=directorySheets({employees:rows}),g=directoryGraph({service});await assert.rejects(g.legacy().listAdjustmentEmployees(service));}
});
test("original employee reads remain pending and retain sync/getter/network failure identity without extra calls",async()=>{
 for(const phase of ["getter","call","reject"]){const error=new Error(phase),events=[];const service=phase==="getter"?{get employees(){events.push(phase);throw error;}}:{employees:{readRows(){events.push(phase);if(phase==="call")throw error;return Promise.reject(error);}}};const g=directoryGraph({service});let promise;assert.doesNotThrow(()=>{promise=g.legacy().listAdjustmentEmployees(service);});await assert.rejects(promise,e=>e===error);assert.deepEqual(events,[phase]);}
 let release,done=false;const service=directorySheets({employeeRead:()=>new Promise(resolve=>{release=resolve;})}),g=directoryGraph({service});const pending=g.legacy().listAdjustmentEmployees(service).then(x=>{done=true;return x;});await Promise.resolve();assert.equal(done,false);release([fields,row]);assert.equal((await pending)[0].id," e ");
});

test("saved-original and real composed directory match full row/getter/normalization failure behavior and preserve error class/export keys",async()=>{
 for(const value of [[],[fields],[fields,row],[[...fields,"extra"],[true,false,0,null,0,false]],{},[null],[fields,null],null]){
  const results=[];for(const original of [true,false]){const service=directorySheets({employees:value}),g=directoryGraph({original,service});try{results.push({ok:plain(await g.legacy().listAdjustmentEmployees(service))});}catch(e){results.push({name:e.name,message:e.message,status:e.status,domain:e instanceof g.legacy().StockAdjustmentError});}}assert.deepEqual(results[1],results[0]);
 }
 const original=directoryGraph({original:true}).legacy(),current=directoryGraph().legacy();assert.deepEqual(Object.keys(current),Object.keys(original));assert.equal(new current.StockAdjustmentError("m").status,400);assert.equal(new current.StockAdjustmentError("m").name,"Error");
 for(const phase of ["header","id","name","status","hire","term"]){
  const marker=new Error(phase);function data(events){const header=phase==="header"?{slice(){events.push("header");throw marker;}}:fields;const values=new Proxy(row,{get(target,key){const map={0:"id",1:"name",3:"status",4:"hire",5:"term"};if(map[key]){events.push(map[key]);if(map[key]===phase)throw marker;}return target[key];}});return [header,values];}
  const traces=[];for(const original of [true,false]){const events=[],service=directorySheets({employees:data(events)}),g=directoryGraph({original,service});await assert.rejects(g.legacy().listAdjustmentEmployees(service),e=>e===marker);traces.push(events);}assert.deepEqual(traces[1],traces[0]);
 }
});

test("actual unchanged stock-adjustment HTTP GET retains 200/400/503/500 and simultaneous failure precedence",async()=>{
 for(const scenario of ["ok","invalid","headers","read","both_headers","both_reject","sync_getter"]){
  const outcomes=[];for(const original of [true,false]){const events=[],marker=new Error("network");const employees=scenario==="headers"||scenario==="both_headers"?[["wrong"]]:[fields,row];const service=directorySheets({events,employees,stock:scenario==="both_headers"?[["bad-stock"]]:[],employeeRead:scenario==="read"||scenario==="both_reject"?()=>Promise.reject(marker):undefined,stockRead:scenario==="both_reject"?()=>Promise.reject(marker):undefined});if(scenario==="sync_getter")Object.defineProperty(service,"employees",{get(){events.push(["employee.getter"]);throw marker;}});
   const g=directoryGraph({original,service,events}),route=g.load("src/app/api/stock-adjustments/route.ts");const response=await route.GET(new Request(`https://example.test/api/stock-adjustments?month=${scenario==="invalid"?"invalid":"2026-11"}`));outcomes.push({status:response.status,body:await response.json(),events});
  }assert.deepEqual(outcomes[1],outcomes[0],scenario);assert.equal(outcomes[0].status,scenario==="ok"?200:scenario==="invalid"?400:["headers","both_headers"].includes(scenario)?503:500);
 }
});

test("actual create adjustment retains employee/date/idempotency/validation decisions, writes and original HTTP 201/400/409/503 behavior",async()=>{
 const input={requestId:"11111111-1111-4111-8111-111111111111",accountId:"shop",date:"2026-11-05",direction:"out",reason:"employee_gift",employeeId:"e",quantity:2,notInLoyverse:true,itemDescription:" Item ",note:" note "};
 for(const scenario of ["valid","inactive_status","not_employed","missing","invalid","headers","unknown_shop","idempotent","conflict"]){const results=[];for(const original of [true,false]){
  const events=[],employee=["e","Name","phone",scenario==="inactive_status"?"terminated":"active",scenario==="not_employed"?"2026-12-01":"2026-01-01","","c","u","actor"],rows=scenario==="headers"?[["wrong"]]:scenario==="missing"?[fields]:[fields,employee];const stock=[],service=directorySheets({employees:rows,events,stock}),g=directoryGraph({original,service,events});
  if(["idempotent","conflict"].includes(scenario)){const headers=g.load("src/services/stock-adjustments/types.ts").ADJUSTMENT_HEADERS;stock.push(Array.from(headers),["SAJ-"+input.requestId,"shop","Shop",input.date,"out","employee_gift","e","Name",scenario==="conflict"?3:2,"Item","","note","","","2026-11-06T12:00:00.000Z","web-owner",true]);}
  const body={...input,...(scenario==="invalid"?{quantity:0}:{}),...(scenario==="unknown_shop"?{accountId:"unknown"}:{})};const response=await g.load("src/app/api/stock-adjustments/route.ts").POST(new Request("https://example.test/api/stock-adjustments",{method:"POST",body:JSON.stringify(body)}));results.push({status:response.status,body:await response.json(),events});
 }assert.deepEqual(results[1],results[0],scenario);assert.equal(results[0].status,["valid","inactive_status","idempotent"].includes(scenario)?201:scenario==="conflict"?409:scenario==="headers"?503:400);}
});

test("pure Inventory use case returns the injected promise unchanged; lazy composition constructs no employee reads or errors",async()=>{
 const g=directoryGraph(),execute=g.load("src/modules/inventory/application/list-adjustment-employees.ts").listAdjustmentEmployees;const promise=Promise.resolve([{id:"x"}]);let calls=0;assert.equal(execute({listEmployees(){calls++;return promise;}}),promise);assert.equal(calls,1);
 let accessed=0,errors=0;const service={get employees(){accessed++;throw new Error("lookup");}};const create=g.load("src/services/stock-adjustments/employee-directory.ts").createEmployeeDirectory;const port=create(service,()=>{errors++;return new Error("invalid");});assert.equal(accessed,0);assert.equal(errors,0);await assert.rejects(port.listEmployees(),/lookup/);assert.equal(accessed,1);assert.equal(errors,0);
});
