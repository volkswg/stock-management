import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {harness,uuid,uuid2,input} from './helpers/product-master.mjs';
const nonce=i=>`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`;
const allocation=w=>[...w.state.metadata.values()].reduce((size,record)=>size+[...record.metadataKey].length+[...record.metadataValue].length,0);

test('review blocker: actual permanent guards exhaust 30000 key/value characters before 200 creates; failed writes/cancellations retain all business data',async t=>{
 const w=harness();let created=0,failed;
 for(let i=1;i<=200;i++){
  const values={...input,productCode:`C${i}`,productName:`P${i}`};
  try{await w.products.create(nonce(i),values,'staff',false);created++;}
  catch(error){assert.match(error.message,/outcome is not yet confirmed/);failed={i,values};break;}
 }
 t.diagnostic(`${created} creates consume ${allocation(w)} metadata characters; the next create and cancellation fail closed.`);
 assert.ok(failed,'Current guard design must not be represented as sustainable');assert.ok(created>50&&created<200);assert.equal(w.state.sheets.products.length,created+1);assert.equal(w.state.metadata.size,created);assert.ok(allocation(w)<=30000);
 const before=JSON.stringify(w.state.sheets),markers=JSON.stringify([...w.state.metadata]);
 await assert.rejects(w.products.create(nonce(failed.i),failed.values,'staff',false),/outcome is not yet confirmed/);
 await assert.rejects(w.products.cancelCreation(nonce(failed.i),'staff'),/outcome is not yet confirmed/);
 assert.equal(JSON.stringify(w.state.sheets),before);assert.equal(JSON.stringify([...w.state.metadata]),markers);
 const replay=await w.products.create(nonce(1),{...input,productCode:'C1',productName:'P1'},'staff',false);assert.equal(replay.id,`PROD-${nonce(1)}`);assert.equal(JSON.stringify(w.state.sheets),before);
});

test('fake provider enforces separate spreadsheet/sheet character budgets and counts both metadata keys and values',async()=>{
 const w=harness();const create=(metadataId,key,value,location)=>({createDeveloperMetadata:{developerMetadata:{metadataId,metadataKey:key,metadataValue:value,visibility:'DOCUMENT',location}}});
 await w.client.updateSpreadsheet([create(1,'a'.repeat(20),'b'.repeat(29980),{spreadsheet:true}),create(2,'sheet','x'.repeat(29995),{sheetId:0}),create(3,'sheet','x'.repeat(29995),{sheetId:1})]);assert.equal(w.state.metadata.size,3);
 for(const location of [{spreadsheet:true},{sheetId:0},{sheetId:1}]){await assert.rejects(w.client.updateSpreadsheet([create(4,'k','v',location)]),/400/);assert.equal(w.state.metadata.size,3);}
 assert.equal(w.state.sheets.products.length,1);
});

test('review blocker: deleting a guard permits an already-in-flight duplicate append; read-check-write cleanup is unsafe',async()=>{
 const w=harness();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let first=true;
 w.state.gate=async()=>{if(first){first=false;entered();await gate;}};
 const pending=w.products.create(uuid,input,'staff',false);await started;await w.products.create(uuid,input,'staff',false);assert.equal(w.state.sheets.products.length,2);
 // Deliberately unsafe proposed GC, tested offline only. The late HTTP request
 // has already passed its business preflight and can still reach Google.
 w.state.metadata.clear();release();await assert.rejects(pending,/duplicate records/);
 assert.equal(w.state.sheets.products.filter(row=>row[0]===`PROD-${uuid}`).length,2);
});

test('ambiguous timeout followed by an empty read cannot justify reclaiming guards or forgetting a creation cancellation',async()=>{
 const w=harness();w.state.mode='timeout-late';await assert.rejects(w.products.create(uuid,input,'staff',false),/outcome is not yet confirmed/);assert.equal(w.state.sheets.products.length,1);const late=w.state.lateCommit;
 w.state.mode='normal';assert.equal((await w.products.cancelCreation(uuid,'staff')).outcome,'cancelled');const marker=JSON.stringify([...w.state.metadata]);
 assert.equal((await late()).status,400);assert.equal(w.state.sheets.products.length,1);assert.equal(JSON.stringify([...w.state.metadata]),marker);
 await assert.rejects(w.products.create(uuid,input,'staff',false),error=>error.name==='ProductCreationCancelledError');
});

test('a committed creation with failed verification recovers through the original guard without another append',async()=>{
 const w=harness();w.state.failVerification=true;
 await assert.rejects(w.products.create(uuid2,input,'staff',false),/outcome is not yet confirmed/);assert.equal(w.state.sheets.products.length,2);const writes=w.events.filter(event=>event[0]==='commit').length;
 const fresh=w.load('src/modules/products/server.ts').createProductsService(w.client,()=> '2026-11-09T06:00:00.000Z');assert.equal((await fresh.create(uuid2,input,'staff',false)).id,`PROD-${uuid2}`);assert.equal(w.state.sheets.products.length,2);assert.equal(w.events.filter(event=>event[0]==='commit').length,writes);
});

test('guard review preserves the initial PR47 source witness and all46 inherited fixtures byte-for-byte',()=>{
 const hash=value=>createHash('sha256').update(value).digest('hex');const witness=JSON.parse(readFileSync('tests/fixtures/product-master-before.json','utf8'));
 assert.equal(hash(readFileSync('tests/fixtures/product-master-before.json')),'9bcca972af9eb022c921fdc9782a06f62008b074a1c8b27a9fce8fc76f1bd7fe');
 for(const [file,expected]of Object.entries(witness.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
 for(const [file,expected]of Object.entries(witness.newHashes))assert.equal(hash(readFileSync(file)),expected,file);
 assert.equal(Object.keys(witness.fixtureHashes).length+1,46);
});
