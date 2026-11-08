import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const syncHistory=JSON.parse(readFileSync('tests/fixtures/sales-sync-reliability-before.json','utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
// Historical-only inverse. Current executable sync and graph tests read actual
// files. Every approved after-image and all old fixtures are verified separately.
export function restoreSyncSource(file,source=readFileSync(file,'utf8')){
 const saved=syncHistory.files[file];if(!saved)return source;
 assert.equal(hash(saved.source),saved.sha256,file);
 assert.equal(hash(readFileSync(file)),saved.afterHash,file);
 return source===readFileSync(file,'utf8')?saved.source:source;
}
