import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const externalHistory=JSON.parse(readFileSync('tests/fixtures/external-infrastructure-before.json','utf8'));
export const externalNewFiles=[...Object.values(externalHistory.moves).map(e=>e.to),'src/infrastructure/external/line/index.ts','src/infrastructure/external/loyverse/index.ts'];
export const externalChanged=new Set([...Object.keys(externalHistory.moves),...Object.keys(externalHistory.edits)]);
const prior=new Map();
for(const name of ['orders-line-before','expenses-business-before','inventory-sales-query-before','movement-schema-before','inventory-employee-directory-before','remaining-worksheets-before','sales-application-before','inventory-application-before']){const d=JSON.parse(readFileSync(`tests/fixtures/${name}.json`,'utf8'));for(const [file,e]of Object.entries({...d.files,...d.edits,...d.splits,...d.moves}))if(e.source){const values=prior.get(file)??new Set();values.add(e.source);if(e.after)values.add(e.after);prior.set(file,values);}}
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreExternalSource(file,source=readFileSync(file,'utf8')){
 const move=externalHistory.moves[file];if(move){const old=externalHistory.files[file];assert.equal(hash(old.source),old.sha256,file);assert.equal(readFileSync(file,'utf8'),move.forward,file);assert.equal(readFileSync(move.to,'utf8'),old.source,move.to);if(prior.get(file)?.has(source)&&source!==move.forward)return source;assert.ok(source===move.forward||source===old.source,file);return old.source;}
 const edit=externalHistory.edits[file];if(edit){assert.equal(readFileSync(file,'utf8'),edit.after,file);if(prior.get(file)?.has(source)&&source!==edit.after)return source;assert.ok(source===edit.after||source===edit.source,file);return edit.source;}
 return source;
}
