import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const fixture=JSON.parse(readFileSync('tests/fixtures/media-url-before.json','utf8'));
export const mediaUrlFiles=new Set(Object.keys(fixture.edits));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreMediaUrlSource(file,source){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const physical=readFileSync(file,'utf8'),edit=fixture.edits[name];
 if(!edit)return source??physical;
 assert.equal(hash(physical),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);
 return source===undefined||source===physical?edit.before:source;
}
