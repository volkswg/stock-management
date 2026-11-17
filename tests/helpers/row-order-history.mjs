import assert from 'node:assert/strict';
import {restoreNativeTimestampSource} from './native-timestamps-history.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const rowOrderHistory=JSON.parse(readFileSync('tests/fixtures/row-order-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreRowOrderSource(file,source) {
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const current=restoreNativeTimestampSource(file,source),edit=rowOrderHistory.edits[name];
 if(!edit)return current;
 assert.equal(hash(current),edit.afterSha256,name);
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 return edit.before;
}
