import assert from 'node:assert/strict';
import {restoreWorkbookSource} from './loyverse-workbook-history.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const featuresHistory=JSON.parse(readFileSync('tests/fixtures/features-retirement-before.json','utf8'));
export const featureFiles=featuresHistory.files;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreFeatureSource(file,source){
  const removed=featureFiles[file];
  if(removed){assert.equal(existsSync(file),false,`Retired feature file recreated: ${file}`);assert.equal(hash(removed.source),removed.sha256,file);return source??removed.source;}
  source??=readFileSync(file,'utf8');
  source=restoreWorkbookSource(file,source);
  const edit=featuresHistory.edits[file];if(!edit)return source;
  const current=readFileSync(file,'utf8');assert.equal(hash(current),edit.afterHash,file);
  let restored=current;
  for(const change of edit.changes.toReversed()){
    assert.equal(restored.slice(change.afterStart,change.afterStart+change.after.length),change.after,file);
    restored=restored.slice(0,change.afterStart)+change.before+restored.slice(change.afterStart+change.after.length);
  }
  assert.equal(hash(restored),edit.beforeHash,file);
  return source===current?restored:source;
}
// Only archived source/mocking contexts use this translation. Live imports must
// resolve physical owners and cannot depend on a deleted namespace.
export function canonicalFeatureSpecifier(spec){
  if(typeof spec!=='string')return spec;
  const path=spec.startsWith('@/feature/')?'src/features/'+spec.slice('@/feature/'.length):spec.startsWith('@/')?'src/'+spec.slice(2):undefined;
  const saved=path&&(featureFiles[path+'.ts']??featureFiles[path+'/index.ts']);
  if(!saved)return spec;
  const owners=[...new Set(saved.exports.filter(e=>!e.typeOnly).map(e=>e.module))];
  assert.equal(owners.length,1,spec);return '@/'+owners[0].slice(4,-3);
}
