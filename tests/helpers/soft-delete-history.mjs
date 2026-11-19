import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const fixture=JSON.parse(readFileSync('tests/fixtures/soft-delete-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreSoftDeleteSource(file){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const physical=readFileSync(file,'utf8'),edit=fixture.edits[name];
 if(!edit)return physical;
 assert.equal(hash(physical),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);
 return edit.before;
}
