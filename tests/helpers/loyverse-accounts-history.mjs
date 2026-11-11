import assert from 'node:assert/strict';
import {restoreReceiptOverlapSource} from './receipt-overlap-history.mjs';
import {restoreWorkbookSource} from './loyverse-workbook-history.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const accountsHistory=JSON.parse(readFileSync('tests/fixtures/loyverse-accounts-before.json','utf8'));
export const accountNewFiles=accountsHistory.newFiles;
export const accountChanged=new Set(Object.keys(accountsHistory.edits));
const hash=value=>createHash('sha256').update(value).digest('hex');
// Exact bounded inverses only for this feature's reviewed edits. Historical tests
// retain their original hashes; current executable loaders always read real files.
export function restoreAccountSource(file,source=readFileSync(file,'utf8')) {
  source=restoreReceiptOverlapSource(file,source);
  source=restoreWorkbookSource(file,source);
  const edit=accountsHistory.edits[file];
  if(!edit)return source;
  const current=restoreWorkbookSource(file);
  assert.equal(hash(current),edit.afterHash,file);
  let restored=current;
  for(const change of edit.changes.toReversed()){
    assert.equal(restored.slice(change.afterStart,change.afterStart+change.after.length),change.after,file);
    restored=restored.slice(0,change.afterStart)+change.before+restored.slice(change.afterStart+change.after.length);
  }
  assert.equal(hash(restored),edit.beforeHash,file);
  // An older inverse can already have supplied its own immutable earlier version.
  return source===current?restored:source;
}
export function restoreEnvironmentTemplate(){
  const baseline=restoreAccountSource('.env.example');
  assert.equal(hash(baseline),accountsHistory.files['.env.example'].sha256);
  // PR42 intentionally simplified the template; its missing historical guard
  // reconciliation caused two pristine-main baseline failures. Keep the original
  // fixture assertions, validating both exact template versions rather than skipping them.
  const earlier=accountsHistory.beforePr42Env;
  assert.equal(hash(earlier.source),earlier.sha256);
  return earlier.source;
}
