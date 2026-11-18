import {restoreMediaUrlSource} from './media-url-history.mjs';
import assert from 'node:assert/strict';
import {restoreRowOrderSource} from './row-order-history.mjs';
import {nativeTimestampHistory} from './native-timestamps-history.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const stableRecordHistory=JSON.parse(readFileSync('tests/fixtures/stable-record-ids-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreStableRecordSource(file,source) {
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const edit=stableRecordHistory.edits[name];
 if(!edit)return restoreRowOrderSource(file,source);
 const physical=readFileSync(file,'utf8'),current=restoreRowOrderSource(file,physical);
 assert.equal(hash(current),edit.afterSha256,name);
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 return source===undefined||source===physical||source===current?edit.before:source;
}
export function readStableRecordHistory(file,options) {
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 if(!stableRecordHistory.edits[name]&&!nativeTimestampHistory.edits[name]){
  if(!name?.startsWith('src/'))return readFileSync(file,options);
  const value=restoreMediaUrlSource(file);
  return typeof options==='string'||options?.encoding?value:Buffer.from(value);
 }
 const value=restoreStableRecordSource(file);
 return typeof options==='string'||options?.encoding?value:Buffer.from(value);
}
