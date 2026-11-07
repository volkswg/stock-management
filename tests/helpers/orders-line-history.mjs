import {restoreExternalSource} from "./external-history.mjs";
import assert from 'node:assert/strict';
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from 'node:crypto';
export {ordersLineNewFiles} from './orders-line-ownership.mjs';
export const ordersLineBefore=JSON.parse(readFileSync('tests/fixtures/orders-line-before.json','utf8'));
export const ordersLineChanged=new Set([...Object.keys(ordersLineBefore.files),...Object.keys(ordersLineBefore.edits)]);
const hash=s=>createHash('sha256').update(s).digest('hex');
const prior=new Map();
for(const name of ['expenses-business-before','inventory-sales-query-before','movement-schema-before','inventory-employee-directory-before','remaining-worksheets-before','sales-application-before','inventory-application-before']){
 const d=JSON.parse(readFileSync(`tests/fixtures/${name}.json`,'utf8'));
 for(const [file,e] of Object.entries({...d.files,...d.edits,...d.splits,...d.moves})) if(e.source){const values=prior.get(file)??new Set();values.add(e.source);if(e.after)values.add(e.after);prior.set(file,values);}
}
export function restoreOrdersLineSource(file,source=readFileSync(file,'utf8')){
 source=restoreExternalSource(file,source);
 const saved=ordersLineBefore.files[file],edit=ordersLineBefore.edits[file];
 if(!saved&&!edit)return source;
 assert.equal(hash(restoreExternalSource(file)),ordersLineBefore.changedHashes[file],file);
 if(prior.get(file)?.has(source))return source;
 if(saved){assert.equal(hash(saved.source),saved.sha256,file);if(source===saved.source)return source;assert.equal(hash(source),ordersLineBefore.changedHashes[file],file);for(const [owner,expected]of Object.entries(ordersLineBefore.ownerHashes))assert.equal(hash(restoreExternalSource(owner)),expected,owner);return saved.source;}
 if(hash(source)===edit.sha256)return source;
 for(const c of edit.changes.toReversed()){assert.ok(c.to.length>0);assert.equal(source.split(c.to).length-1,1,file);source=source.replace(c.to,c.from);}
 assert.equal(hash(source),edit.sha256,file);return source;
}
