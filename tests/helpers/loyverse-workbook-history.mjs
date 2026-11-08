import {restoreSyncSource} from './sales-sync-reliability-history.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const workbookHistory=JSON.parse(readFileSync('tests/fixtures/loyverse-workbook-before.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
// Reconcile only the approved workbook-selection/template change before older
// immutable source guards. Current executable loaders read the actual source.
export function restoreWorkbookSource(file,source=readFileSync(file,'utf8')){
  source=restoreSyncSource(file,source);
  const edit=workbookHistory.edits[file];if(!edit)return source;
  const current=readFileSync(file,'utf8');assert.equal(hash(current),edit.afterHash,file);
  let restored=current;
  for(const change of edit.changes.toReversed()){
    assert.equal(restored.slice(change.afterStart,change.afterStart+change.after.length),change.after,file);
    restored=restored.slice(0,change.afterStart)+change.before+restored.slice(change.afterStart+change.after.length);
  }
  assert.equal(hash(restored),edit.beforeHash,file);
  return source===current?restored:source;
}
