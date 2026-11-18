import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const artifact='tools/migration/operator/20261118135558_media_catalog_compatibility.sql';
test('media schema is reproducible, operator-only and has no checksum/status columns or URL retirement',()=>{
 const sql=readFileSync(artifact,'utf8');
 assert.equal(sql,execFileSync('python3',['tools/migration/media-catalog.py'],{encoding:'utf8'}));
 const table=sql.split('CREATE TABLE stock_operational.media (')[1].split('CREATE UNIQUE INDEX')[0];
 assert.doesNotMatch(table,/\b(status|sha256)\b/);
 assert.equal((sql.match(/ADD COLUMN "/g)||[]).length,5);
 assert.equal((sql.match(/ON DELETE RESTRICT/g)||[]).length,5);
 assert.equal((sql.match(/CREATE TRIGGER b_media_reference/g)||[]).length,5);
 assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
 assert.doesNotMatch(sql,/SECURITY DEFINER|DROP COLUMN|DROP TABLE|DELETE FROM|GRANT.*TO (anon|authenticated)/);
 for(const gate of ['stock.allow_media_catalog','stock.media_restore_verified','stock.media_reviewed_revision','stock.media_reviewed_source','stock.expected_isolation_id','stock.expected_purpose'])assert.ok(sql.includes(gate),gate);
 assert.ok(sql.indexOf('LOCK TABLE')<sql.indexOf('value::text=current_setting'));
 for(const table of ['order_items','order_bills','movement_details','shipments','stock_adjustments'])assert.ok(sql.includes(`ALTER TABLE stock_operational.${table} ENABLE TRIGGER a_validate;`));
});
test('catalog registration preserves the absent-schema branch and rejects partial/unsupported installation',async()=>{
 async function run({present=false,contract=false,version='media-v1'}={}){
  let reads=0,writes=0,metadataReads=0;const exports={};
  class PersistenceFailure extends Error{}
  const client={async query(sql){reads++;if(sql.includes('to_regclass'))return {rows:[{table_present:present,contract_present:contract}]};if(sql.includes('media_catalog_v1()'))return {rows:[{version}]};writes++;return {rows:[{id:'synthetic-media-id'}]};}};
  const code=ts.transpileModule(readFileSync('src/infrastructure/persistence/postgres/media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script(code).runInNewContext({exports,WeakMap,Number,require(spec){if(spec==='server-only')return {};assert.equal(spec,'./database');return {currentTransaction:()=>client,requireMutation:()=>client,PersistenceFailure};}});
  const register=()=>exports.registerUploadedMedia({id:'FILE',webViewLink:'https://example.invalid/file'},()=>{metadataReads++;return {sizeBytes:12};});
  if(present!==contract||!['media-v1','media-v2'].includes(version))await assert.rejects(register());else{await register();await register();}
  return {reads,writes,metadataReads};
 }
 assert.deepEqual(await run(),{reads:1,writes:0,metadataReads:0});
 assert.equal((await run({present:true})).writes,0);
 assert.equal((await run({contract:true})).writes,0);
 assert.equal((await run({present:true,contract:true,version:'unsupported'})).writes,0);
 assert.deepEqual(await run({present:true,contract:true}),{reads:6,writes:4,metadataReads:2});
 assert.deepEqual(await run({present:true,contract:true,version:'media-v2'}),{reads:6,writes:4,metadataReads:2});
});
