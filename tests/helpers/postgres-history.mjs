import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const postgresHistory=JSON.parse(readFileSync('tests/fixtures/postgres-transition-before.json','utf8'));
export const stagingSourceHashes=Object.freeze({"src/instrumentation.ts": "977e81fd13fb1d977c1b438fc767364ff7b97037c45d4cc9d035e88a31f5bd7a", "src/infrastructure/runtime/staging-read-only.ts": "05a56e33ecb52c6be045cbba48d33b4f2736435599dfecf5dbf238b8a2540e0a"});
export const postgresNewFiles=Object.freeze([...Object.keys(postgresHistory.newFiles),...Object.keys(stagingSourceHashes)]);
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
