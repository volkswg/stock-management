import {restoreMediaUrlSource,mediaUrlFiles} from './media-url-history.mjs';
import {readStableRecordHistory,restoreStableRecordSource,stableRecordHistory} from "./stable-record-ids-history.mjs";
import {nativeTimestampHistory} from './native-timestamps-history.mjs';
import assert from 'node:assert/strict';
import {restoreReceiptOverlapSource} from './receipt-overlap-history.mjs';
import {restoreUploadCleanupSource,uploadCleanupHistory} from './upload-cleanup-history.mjs';
import {restoreUploadOutcomesSource,uploadOutcomesHistory,mediaCatalogHistory,restoreOrderCreateKeySource,orderCreateKeyHistory} from './upload-outcomes-history.mjs';
const readFileSync=readStableRecordHistory;
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const postgresHistory=JSON.parse(readFileSync('tests/fixtures/postgres-transition-before.json','utf8'));
export const stagingSourceHashes=Object.freeze({"src/instrumentation.ts": "977e81fd13fb1d977c1b438fc767364ff7b97037c45d4cc9d035e88a31f5bd7a", "src/infrastructure/runtime/staging-read-only.ts": "05a56e33ecb52c6be045cbba48d33b4f2736435599dfecf5dbf238b8a2540e0a"});
export const postgresNewFiles=Object.freeze([...mediaCatalogHistory.newSourceFiles,...nativeTimestampHistory.newSourceFiles,...stableRecordHistory.newSourceFiles,...Object.keys(postgresHistory.newFiles),...Object.keys(stagingSourceHashes),...Object.keys(uploadCleanupHistory.newFiles),...Object.keys(uploadOutcomesHistory.newFiles)]);
export const postgresHash=value=>createHash('sha256').update(value).digest('hex');
export function restorePostgresSource(file,source) {
 const name=typeof file==='string'?file: file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 if(mediaUrlFiles.has(name))source=restoreMediaUrlSource(file,source);
 if(stableRecordHistory.edits[name]||nativeTimestampHistory.edits[name])source=restoreStableRecordSource(file,source);
 if(name==='src/infrastructure/external/loyverse/LoyverseService.ts')return restoreReceiptOverlapSource(name,source??readFileSync(file,'utf8'));
 const edit=postgresHistory.edits[name];
 if(!edit)return restoreOrderCreateKeySource(name,source??readFileSync(file,'utf8'));
 const rawCurrent=readFileSync(file,'utf8'),current=restoreUploadCleanupSource(name,restoreUploadOutcomesSource(name,rawCurrent));
 assert.equal(postgresHash(edit.before),edit.beforeHash,name);
 assert.equal(postgresHash(current),edit.afterHash,name);
 // Earlier immutable versions can already have passed through an older inverse.
 return source===undefined||source===current||source===rawCurrent?edit.before:source;
}
export function readPostgresHistory(file,options){
 const name=typeof file==='string'?file: file instanceof URL?relative(process.cwd(),fileURLToPath(file)):undefined;
 if(!postgresHistory.edits[name]&&!orderCreateKeyHistory.edits[name]&&name!=='src/infrastructure/external/loyverse/LoyverseService.ts')return readFileSync(file,options);
 const value=restorePostgresSource(file);
 return typeof options==='string'||options?.encoding?value:Buffer.from(value);
}
