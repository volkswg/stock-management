import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {restoreNativeTimestampSource,nativeTimestampHistory} from './helpers/native-timestamps-history.mjs';
import {restoreCellKindsSource} from './helpers/cell-kinds-history.mjs';
const script='tools/migration/final-removal/20261117085310_native_lifecycle_timestamps.sql';
test('native lifecycle source has one bounded predecessor and stays compatible with retained text timestamps',()=>{
 assert.equal(Object.keys(nativeTimestampHistory.edits).length,7);
 assert.deepEqual(nativeTimestampHistory.newSourceFiles,['src/shared/lib/utc-timestamp.ts']);
 assert.deepEqual(Object.keys(nativeTimestampHistory.newSourceHashes),nativeTimestampHistory.newSourceFiles);
 for(const [name,entry] of Object.entries(nativeTimestampHistory.edits)){
  const source=restoreCellKindsSource(name);
  assert.equal(createHash('sha256').update(source).digest('hex'),entry.afterSha256);
  assert.equal(restoreNativeTimestampSource(name),entry.before);
  if(name.endsWith('/records.ts')){
   assert.doesNotMatch(source,/created_at_instant|row_order/);
   assert.match(source,/pg_typeof\("createdAt"\)='timestamptz'::regtype/);
  }
 }
 for(const [name,hash] of Object.entries(nativeTimestampHistory.newSourceHashes))assert.equal(createHash('sha256').update(readFileSync(name,'utf8')).digest('hex'),hash);
});
test('comparison keys preserve microsecond chronology and existing wire representations',()=>{
 const require=createRequire(import.meta.url);require('./helpers/postgres-runtime.cjs');
 const {utcTimestampComparisonKey:key}=require('../src/shared/lib/utc-timestamp.ts');
 assert.equal(key('2026-11-17T00:00:00.123Z'),key('2026-11-17T00:00:00.123000Z'));
 assert.ok(key('2026-11-17T00:00:00.123001Z')>key('2026-11-17T00:00:00.123Z'));
 assert.ok(key('2026-11-17T00:00:00.122999Z')<key('2026-11-17T00:00:00.123Z'));
 assert.equal(key(''), '');assert.equal(key('legacy'), 'legacy');assert.equal(key('2026-11-17T07:00:00+07:00'),'2026-11-17T07:00:00+07:00');
});
test('operator SQL is reproducible and absent from automatic migrations',()=>{
 const result=spawnSync('python3',['tools/migration/native-timestamps.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,readFileSync(script,'utf8'));
 assert.ok(readdirSync('supabase/migrations').every(name=>!name.endsWith('_native_lifecycle_timestamps.sql')));
});
test('native transition is guarded, atomic and retires only redundant creation metadata',()=>{
 const sql=readFileSync(script,'utf8');
 for(const key of ['stock.expected_isolation_id','stock.expected_purpose','stock.allow_native_timestamps','stock.timestamp_reviewed_revision','stock.timestamp_reviewed_source','stock.timestamp_restore_verified'])assert.ok(sql.includes(key));
 assert.equal((sql.match(/ TYPE timestamptz USING /g)||[]).length,47);
 assert.equal((sql.match(/DROP COLUMN created_at_instant RESTRICT/g)||[]).length,23);
 assert.equal((sql.match(/DROP TRIGGER b_created_at_instant/g)||[]).length,23);
 assert.doesNotMatch(sql,/CASCADE|DISABLE TRIGGER|SECURITY DEFINER|BYPASSRLS|CREATE ROLE/);
 assert.match(sql,/Unconvertible timestamp/);assert.match(sql,/mapper\/validator drift/);
 assert.match(sql,/BEGIN ISOLATION LEVEL READ COMMITTED;/);
 assert.ok(sql.lastIndexOf("value::text=current_setting('stock.timestamp_reviewed_revision'")>sql.indexOf('LOCK TABLE'));
 assert.doesNotMatch(sql,/WHERE archived_at IS NULL|SET "createdAt"=now/);
});
