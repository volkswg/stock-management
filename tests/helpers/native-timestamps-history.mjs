import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {restoreCellKindsSource} from './cell-kinds-history.mjs';
export const nativeTimestampHistory=JSON.parse(readFileSync('tests/fixtures/native-timestamps-before.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreNativeTimestampSource(file,source){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const current=restoreCellKindsSource(file,source),edit=nativeTimestampHistory.edits[name];
 if(!edit)return current;
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 const physical=restoreCellKindsSource(file);
 assert.equal(hash(physical),edit.afterSha256,name);
 if(source!==undefined&&current!==physical&&current!==edit.before)return current;
 return edit.before;
}
