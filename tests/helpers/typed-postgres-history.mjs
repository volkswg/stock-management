import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const typedPostgresHistory=JSON.parse(readFileSync('tests/fixtures/typed-postgres-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreTypedPostgresSource(file,source){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const physical=readFileSync(file,'utf8'),current=source??physical,edit=typedPostgresHistory.edits[name];
 if(!edit)return current;
 assert.equal(hash(physical),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);
 return current===physical?edit.before:current;
}
