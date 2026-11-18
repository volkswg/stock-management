import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {restoreTypedPostgresSource} from './typed-postgres-history.mjs';
export const lexemeHistory=JSON.parse(readFileSync('tests/fixtures/lexeme-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function restoreLexemeSource(file,source){
 const name=typeof file==='string'?file:file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const physical=restoreTypedPostgresSource(file),current=restoreTypedPostgresSource(file,source),edit=lexemeHistory.edits[name];
 if(!edit)return current;
 assert.equal(hash(physical),edit.afterSha256,name);
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 return current===physical?edit.before:current;
}
