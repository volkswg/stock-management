import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lexemeHistory,restoreLexemeSource} from './helpers/lexeme-history.mjs';
const file='tools/migration/compatibility/20261118022702_lexeme_compatibility.sql';
test('lexeme compatibility has one exact source inverse and actual fail-closed capability handling',()=>{
 assert.deepEqual(Object.keys(lexemeHistory.edits),['src/infrastructure/persistence/postgres/records.ts']);
 for(const [name,e] of Object.entries(lexemeHistory.edits)){
  const current=readFileSync(name,'utf8');assert.equal(createHash('sha256').update(current).digest('hex'),e.afterSha256);
  assert.equal(restoreLexemeSource(name),e.before);assert.match(current,/lexeme_mapping_contract_v1/);
  assert.match(current,/mode !== "typed" && c.endsWith/);assert.doesNotMatch(current,/catch\s*\(/);
 }
});
test('additive artifact is reproducible and cannot drop columns or rewrite existing data/functions',()=>{
 const r=spawnSync('python3',['tools/migration/lexemes.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const sql=readFileSync(file,'utf8');assert.equal(sql,r.stdout);
 assert.equal((sql.match(/CREATE FUNCTION /g)||[]).length,47);
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.doesNotMatch(sql,/DROP (?:COLUMN|TABLE|FUNCTION)|ALTER TABLE|CREATE OR REPLACE|UPDATE stock_|DISABLE|CASCADE|SECURITY DEFINER|CREATE ROLE/);
 for(const name of ['stock.expected_isolation_id','stock.expected_purpose','stock.allow_lexeme_compatibility'])assert.ok(sql.includes(name));
 assert.match(sql,/Unreviewed lexeme predecessor drift/);assert.match(sql,/Partial lexeme schema/);
});
test('typed candidates use exact decimal text and JSON text, preserve blanks and never access sidecar values',()=>{
 const r=spawnSync('python3',['-c',"import runpy,json;m=runpy.run_path('tools/migration/lexemes.py');print(json.dumps({'projects':[m['project'](t) for t in m['CATALOG']],'inputs':[m['input_body'](t) for t in m['CATALOG']]}))"],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout);
 assert.equal(v.projects.length,23);assert.ok([...v.projects,...v.inputs].every(s=>!s.includes('__lexeme')&&!s.includes('cell_kinds')));
 assert.match(v.projects.join('\n'),/"totalPrice"::text/);assert.match(v.inputs.join('\n'),/Ambiguous boolean/);
 assert.doesNotMatch(v.inputs.join('\n'),/nullif\(nullif\(.*::jsonb/);
});
test('physical removal exists only in the Unix-socket synthetic component fixture',()=>{
 const r=spawnSync('python3',['tools/migration/lexemes.py','--local-typed-fixture'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/inet_server_addr\(\) IS NULL/);assert.match(r.stdout,/current_database\(\) LIKE 'lx_%'/);
 assert.match(r.stdout,/purpose='isolated-staging'/);assert.match(r.stdout,/synthetic-only/);
 assert.equal((r.stdout.match(/DROP COLUMN ".*__lexeme" RESTRICT/g)||[]).length,48);
 assert.doesNotMatch(r.stdout,/DISABLE|CASCADE|BYPASSRLS|CREATE ROLE/);
});
