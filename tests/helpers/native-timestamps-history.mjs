import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const nativeTimestampHistory=JSON.parse(readFileSync('tests/fixtures/native-timestamps-before.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreNativeTimestampSource(file,source){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const current=source??readFileSync(file,'utf8'),edit=nativeTimestampHistory.edits[name];
 if(!edit)return current;
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 if(hash(current)===edit.beforeSha256)return current;
 assert.equal(hash(current),edit.afterSha256,name);
 return edit.before;
}
