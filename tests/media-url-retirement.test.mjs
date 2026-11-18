import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {restoreMediaUrlSource} from './helpers/media-url-history.mjs';
import vm from 'node:vm';
import ts from 'typescript';
test('URL retirement scripts are reproducible, guarded and outside automatic migration discovery',()=>{
 for(const [phase,file] of [['compatibility','20261118180920_media_url_id_compatibility.sql'],['retirement','20261118180924_retire_media_url_columns.sql'],['rollback','rollback_media_url_columns.sql']]){
  const sql=readFileSync('tools/migration/operator/'+file,'utf8');assert.equal(sql,execFileSync('python3',['tools/migration/media-url-retirement.py',phase],{encoding:'utf8'}));
  for(const guard of ['stock.media_url_revision','stock.media_url_restore_verified','stock.media_url_fingerprint','stock.media_url_source','stock.media_url_alias_policy','stock.expected_isolation_id','stock.expected_purpose'])assert.ok(sql.includes(guard));
  assert.doesNotMatch(sql,/SECURITY DEFINER|CASCADE|CREATE ROLE|DROP TABLE|DELETE FROM/);
  if(phase==='compatibility')assert.doesNotMatch(sql,/DROP COLUMN|UPDATE stock_operational\./);
  if(phase==='retirement'){assert.equal((sql.match(/DROP COLUMN /g)||[]).length,5);assert.doesNotMatch(sql,/UPDATE stock_operational\.|DISABLE TRIGGER/);}
 }
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.ok(restoreMediaUrlSource('src/infrastructure/persistence/postgres/records.ts').includes('const columns = this.definition.headers;'));
});
test('actual adapter preserves predecessor SQL, switches to media ID writes only with a complete contract and rechecks later transactions',async()=>{
 const writes=[],queries=[];let active,mode='legacy';
 class PersistenceFailure extends Error{}
 const makeClient=()=>({async query(sql,values){queries.push(sql);
  if(sql.includes('lexeme_mapping_contract_v1()'))return {rows:[{mode:'typed'}]};
  if(sql.includes('to_regprocedure'))return {rows:[{present:mode!=='legacy'}]};
  if(sql.includes('media_record_contract_v1()'))return {rows:[{mode}]};
  writes.push({sql,values});return {rows:[],rowCount:1};}});
 const exports={};const code=ts.transpileModule(readFileSync('src/infrastructure/persistence/postgres/records.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script(code).runInNewContext({exports,WeakMap,Number,JSON,require:id=>id==='server-only'?{}:{currentTransaction:()=>active,requireMutation:()=>active,PersistenceFailure}});
 const definition={table:'order_items',headers:['id','imageUrl'],media:{url:'imageUrl',reference:'imageMediaId'}};
 const create=()=>new exports.PostgresRecords(definition).appendRows('A:B',[['synthetic','https://example.invalid/file']]);
 active=makeClient();await create();assert.match(writes.pop().sql,/\("id","imageUrl"\)/);
 mode='retained';active=makeClient();await create();await create();assert.match(writes.pop().sql,/\("id","imageMediaId"\)/);assert.equal(queries.filter(q=>q==='SELECT stock_operational.media_record_contract_v1() AS mode').length,1);
 mode='id-only';active=makeClient();await create();assert.match(writes.pop().sql,/\("id","imageMediaId"\)/);
 mode='partial';active=makeClient();const n=writes.length;await assert.rejects(create());assert.equal(writes.length,n);
 assert.throws(()=>new exports.PostgresRecords({...definition,media:{url:'missing',reference:'bad-column'}}));
});
test('both actual Order gallery formatters display media sourceUrl Drive aliases without changing external URL behavior',()=>{
 const aliases=['https://drive.google.com/open?id=FILE_123','https://drive.google.com/uc?export=view&id=FILE_123','https://drive.google.com/thumbnail?id=FILE_123&sz=w400','https://drive.google.com/file/d/FILE_123/view'];
 for(const [file,fn,expected] of [['OrderImageCard.tsx','getGoogleDriveThumbnailUrl','https://drive.google.com/thumbnail?id=FILE_123&sz=w1600'],['OrderImageGallery.tsx','getGoogleDrivePreviewUrl','https://lh3.googleusercontent.com/d/FILE_123?authuser=0']]){
  const source=readFileSync('src/modules/orders/ui/'+file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===fn);assert.ok(node);
  const code=ts.transpileModule('export '+node.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new vm.Script(code).runInNewContext({exports,encodeURIComponent});
  for(const alias of aliases)assert.equal(exports[fn](alias),expected);
  for(const external of ['https://example.invalid/image.jpg','https://drive.google.com.attacker.invalid/open?id=FILE_123','https://example.invalid/?id=FILE_123'])assert.equal(exports[fn](external),external);
 }
});
