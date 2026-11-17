/* eslint-disable @typescript-eslint/no-require-imports -- Offline application review, no provider or database writes. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseArgs}=require('node:util');
const {compareApplications}=require('./application-parity.cjs');
const {memoryService}=require('./local-write/oracle.cjs');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const {GoogleSheetsWorkforceStore}=require('../../src/modules/hr/infrastructure/google-sheets/workforce-store.ts');
const {currentCompensationsByEmployeeId}=require('../../src/modules/hr/domain/compensation.ts');
const catalog=require('./worksheets.json');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

function snapshots(lines){
 const metadata=lines.filter(r=>r.metadata).map(r=>r.metadata);assert.equal(metadata.length,1);
 assert.match(metadata[0].identity,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);assert.match(metadata[0].revision,/^\d+$/);
 assert.ok(['production','isolated-staging'].includes(metadata[0].purpose));
 const inventory=lines.filter(r=>r.inventory);assert.equal(inventory.length,Object.keys(catalog).length);
 assert.deepEqual(inventory.map(r=>r.inventory).sort(),Object.keys(catalog).sort());
 const variants=Object.fromEntries(['legacy','creation','latest'].map(v=>[v,Object.fromEntries(Object.keys(catalog).map(t=>[t,[]]))]));
 const identities=Object.fromEntries(['legacy','creation','latest'].map(v=>[v,Object.fromEntries(Object.keys(catalog).map(t=>[t,[]]))]));
 for(const r of lines.filter(r=>!r.metadata&&!r.inventory)){
  assert.ok(Object.hasOwn(variants,r.variant)&&Object.hasOwn(catalog,r.table)&&Array.isArray(r.cells)&&typeof r.recordId==='string'&&r.recordId.length);
  variants[r.variant][r.table].push(r.cells);
  identities[r.variant][r.table].push(r.recordId);
 }
 // Cardinality and exact per-table record multisets must match in every order.
 for(const entry of inventory){assert.ok(Number.isSafeInteger(entry.rows)&&entry.rows>=0);assert.equal(variants.legacy[entry.inventory].length,entry.rows);}
 for(const table of Object.keys(catalog)){
  for(const v of ['legacy','creation','latest'])assert.equal(new Set(identities[v][table]).size,identities[v][table].length);
  const paired=v=>variants[v][table].map((cells,i)=>hash([identities[v][table][i],cells])).sort();
  for(const v of ['creation','latest'])assert.deepEqual(paired(v),paired('legacy'));
 }
 const sheet=rows=>({version:1,spreadsheetId:'approved-postgres-review:'+metadata[0].identity,sheets:Object.fromEntries(Object.entries(catalog).map(([t,s])=>[t,{headers:s.headers,rows:rows[t],formattedRows:rows[t]}]))});
 const candidate={...variants.creation};
 for(const t of ['user_state','shipment_orders'])candidate[t]=[...variants.latest[t]].reverse();
 return {metadata:metadata[0],legacy:sheet(variants.legacy),candidate:sheet(candidate),oldRows:variants.legacy,newRows:candidate,identities};
}

async function review(lines,config){
 const s=snapshots(lines),realFetch=global.fetch;
 global.fetch=()=>{throw Error('Provider calls forbidden in ordinal review');};
 try{
  const parity=await compareApplications(s.legacy,s.candidate,config,{reviewCreationOrder:true});
  const users=[...new Set(s.oldRows.user_state.map(r=>r[1]).filter(Boolean))].sort();
  const movement=async rows=>{
   const service=memoryService(rows).service;
   const snapshot=await createSessionAdapter(service,createMovementJourneyAdapter(service)).movements.read();
   return users.map(user=>{const r=snapshot.latestForReading(user),w=snapshot.findForWriting(()=>user);return {user,read:r?{...r}:null,write:w?{...w}:null};});
  };
  const before=await movement(s.oldRows),after=await movement(s.newRows);
  const movementMatch=hash(before)===hash(after);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(config.asOf));
  const today=['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-');
  const compensation=async(rows,ids)=>{
   const snapshot=await new GoogleSheetsWorkforceStore(memoryService(rows).service).readCompensations();
   const entries=[...snapshot.entries()].slice(1);assert.equal(entries.length,ids.length);
   const keys=new WeakMap();entries.forEach((entry,i)=>{if(entry)keys.set(entry,ids[i]);});
   return [...currentCompensationsByEmployeeId(entries,today)].map(([employee,entry])=>({employee,recordId:keys.get(entry)})).sort((a,b)=>a.employee.localeCompare(b.employee));
  };
  const compBefore=await compensation(s.oldRows,s.identities.legacy.employee_compensations),compAfter=await compensation(s.newRows,s.identities.creation.employee_compensations);
  const compMatch=hash(compBefore)===hash(compAfter);
  const mismatches=Object.entries(parity.sections).filter(([,v])=>!v.match).map(([k])=>k);
  if(!movementMatch)mismatches.push('movementSessionSelection');
  if(!compMatch)mismatches.push('compensationSelection');
  return {version:1,scope:'offline-row-order-retirement-review',match:parity.match&&movementMatch&&compMatch,identity:s.metadata.identity,purpose:s.metadata.purpose,reviewedRevision:s.metadata.revision,coverage:parity.coverage,mismatchedSections:mismatches,sections:parity.sections,movementSessions:{match:movementMatch,before,after},compensationSelections:{match:compMatch,before:compBefore,after:compAfter},productionDropAuthorized:false,providerCalls:false};
 }finally{global.fetch=realFetch;}
}
module.exports={snapshots,review};
if(require.main===module)(async()=>{
 try{
  const {values}=parseArgs({options:Object.fromEntries(['snapshot','config','output'].map(k=>[k,{type:'string'}]))});
  assert.equal(Object.keys(values).length,3);
  const bytes=fs.readFileSync(values.snapshot),lines=bytes.toString().trim().split('\n').filter(Boolean).map(JSON.parse);
  const report=await review(lines,JSON.parse(fs.readFileSync(values.config)));
  report.sourceSnapshotSha256=crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(values.output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({match:report.match,mismatchedSections:report.mismatchedSections,providerCalls:false,productionDropAuthorized:false}));
  if(!report.match)process.exitCode=1;
 }catch{console.error('Ordinal retirement review refused or failed; inspect private artifacts. No provider/database write attempted.');process.exitCode=2;}
})();
