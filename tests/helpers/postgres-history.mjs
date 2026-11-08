import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const postgresHistory=JSON.parse(readFileSync('tests/fixtures/postgres-transition-before.json','utf8'));
export const postgresNewFiles=Object.freeze(Object.keys(postgresHistory.newFiles));
export const postgresHash=value=>createHash('sha256').update(value).digest('hex');
export function restorePostgresSource(file,source) {
 const name=typeof file==='string'?file: file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 const edit=postgresHistory.edits[name];
 if(!edit)return source??readFileSync(file,'utf8');
 const current=readFileSync(file,'utf8');
 assert.equal(postgresHash(edit.before),edit.beforeHash,name);
 assert.equal(postgresHash(current),edit.afterHash,name);
 // Earlier immutable versions can already have passed through an older inverse.
 return source===undefined||source===current?edit.before:source;
}
export function readPostgresHistory(file,options){
 const name=typeof file==='string'?file: file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 if(!postgresHistory.edits[name])return readFileSync(file,options);
 const value=restorePostgresSource(file);
 return typeof options==='string'||options?.encoding?value:Buffer.from(value);
}
