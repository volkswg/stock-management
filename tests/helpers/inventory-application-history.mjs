import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{inventoryOwners}from'./inventory-source.mjs';
export const inventoryApplicationBefore=JSON.parse(readFileSync('tests/fixtures/inventory-application-before.json','utf8'));
const priorSources=new Map();
for(const name of ['expenses-business-before','inventory-sales-query-before','movement-schema-before','inventory-employee-directory-before','remaining-worksheets-before']){const d=JSON.parse(readFileSync(`tests/fixtures/${name}.json`,'utf8'));for(const [file,e]of Object.entries({...d.files,...d.edits,...d.splits,...d.moves})){if(e.source){const set=priorSources.get(file)??new Set();set.add(e.source);if(e.after)set.add(e.after);priorSources.set(file,set);}}}

export const inventoryApplicationFiles=inventoryOwners.filter(f=>Object.hasOwn(inventoryApplicationBefore.ownerHashes,f));
export const inventoryApplicationChanged=new Set([...Object.keys(inventoryApplicationBefore.files),...Object.keys(inventoryApplicationBefore.edits)]);
const hash=x=>createHash('sha256').update(x).digest('hex');
export function restoreInventoryApplicationSource(file,source=readFileSync(file,'utf8')){
 const edit=inventoryApplicationBefore.edits?.[file];
 if(edit) {
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),inventoryApplicationBefore.changedHashes[file],file);
  if(createHash('sha256').update(source).digest('hex')===edit.sha256||priorSources.get(file)?.has(source))return source;
  for(const change of edit.changes.toReversed()){assert.equal(source.split(change.to).length-1,1,file);source=source.replace(change.to,change.from);}
  assert.equal(createHash('sha256').update(source).digest('hex'),edit.sha256,file);return source;
 }
 const saved=inventoryApplicationBefore.files[file];if(!saved)return source;
 assert.equal(hash(saved.source),saved.sha256,file);
 if(source===saved.source||priorSources.get(file)?.has(source)){assert.equal(hash(readFileSync(file)),inventoryApplicationBefore.changedHashes[file],file);return source;}
 assert.equal(hash(source),inventoryApplicationBefore.changedHashes[file],file);
 for(const [owner,expected]of Object.entries(inventoryApplicationBefore.ownerHashes))assert.equal(hash(readFileSync(owner)),expected,owner);
 return saved.source;
}
export function assertInventoryApplicationHistory(file,expected){
 let source=restoreInventoryApplicationSource(file);if(hash(source)!==expected){
  // Exact reverse deltas of the earlier schema, query and employee-directory prerequisites.
  if(file==='src/modules/inventory/contracts.ts') {
   const prior=JSON.parse(readFileSync('tests/fixtures/remaining-worksheets-before.json','utf8'));const split=prior.splits['src/services/stock-adjustments/types.ts'];assert.equal(source,prior.edits[file].source+'\n'+split.contractDeclarations);source=prior.edits[file].source;
  }
  for(const name of ['inventory-sales-query-before','movement-schema-before','inventory-employee-directory-before']){
   const e=JSON.parse(readFileSync(`tests/fixtures/${name}.json`,'utf8')).files[file];if(!e?.changes)continue;
   for(const c of e.changes.toReversed()){assert.equal(source.split(c.to).length-1,1,file);source=source.replace(c.to,c.from);}
   assert.equal(source,e.source,file);if(hash(source)===expected)break;
  }
 }
 assert.equal(hash(source),expected,file);
}
