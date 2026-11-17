import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cellKindsHistory,restoreCellKindsSource} from './helpers/cell-kinds-history.mjs';
const policy=JSON.parse(readFileSync('tools/migration/cell-kinds-policy.json','utf8'));
const file='tools/migration/compatibility/20261117132332_cell_kinds_compatibility.sql';
test('all252 field policies are explicit; no data normalization or lexeme retirement is approved',()=>{
 assert.equal(policy.normalizationApproved,false);assert.equal(Object.keys(policy.tables).length,23);
 const fields=Object.values(policy.tables).flatMap(t=>t.fields);
 assert.equal(fields.length,252);assert.equal(fields.filter(f=>f.position!==null).length,248);
 assert.equal(fields.filter(f=>f.type==='timestamptz').length,47);
 assert.equal(fields.filter(f=>f.lexeme).length,48);
 assert.equal(policy.tables.employee_compensations.key,'migration_id');
 assert.ok(fields.every(f=>f.read&&Object.hasOwn(f,'lexeme')));
});
test('bounded predecessor preserves native/ordinal historical witnesses; actual adapter detects explicit capabilities',()=>{
 assert.deepEqual(Object.keys(cellKindsHistory.edits),['src/infrastructure/persistence/postgres/records.ts']);
 for(const [path,edit] of Object.entries(cellKindsHistory.edits)){
  const current=readFileSync(path,'utf8');assert.equal(createHash('sha256').update(current).digest('hex'),edit.afterSha256);
  assert.equal(restoreCellKindsSource(path),edit.before);
  assert.match(current,/mappingModes = new WeakMap/);assert.match(current,/column_mapping_contract_v1/);
  assert.match(current,/mode !== "retained" && mode !== "final"/);
  assert.doesNotMatch(current,/catch\s*\(/);assert.match(current,/mode !== "final" && c === 'cell_kinds'/);
 }
});
test('operator artifact is reproducible, additive, scoped and outside automatic discovery',()=>{
 const r=spawnSync('python3',['tools/migration/cell-kinds.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const sql=readFileSync(file,'utf8');assert.equal(r.stdout,sql);
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.doesNotMatch(sql,/DROP (?:COLUMN|TABLE|FUNCTION|TRIGGER)|ALTER TABLE|DISABLE|CASCADE|SECURITY DEFINER|CREATE ROLE|BYPASSRLS|CREATE OR REPLACE/);
 assert.match(sql,/stock.allow_cell_kinds_compatibility/);assert.match(sql,/Unreviewed mapping predecessor drift/);
 assert.equal((sql.match(/CREATE FUNCTION stock_operational\.column_project_/g)||[]).length,23);
 assert.equal((sql.match(/CREATE FUNCTION stock_operational\.column_input_/g)||[]).length,23);
 assert.equal((sql.match(/CREATE FUNCTION stock_operational\.column_compatible_/g)||[]).length,23);
 assert.match(sql,/RETURN stock_operational.project_orders\(r\)/);assert.doesNotMatch(sql,/EXCEPTION WHEN/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .* FROM PUBLIC,anon,authenticated/);
});
test('candidate projectors never read encoding; only the guarded Unix-socket synthetic fixture drops columns',()=>{
 const sql=readFileSync(file,'utf8');
 const projectors=[...sql.matchAll(/CREATE FUNCTION stock_operational\.column_project_.*? AS \$\$(.*?)\$\$;/gs)];assert.equal(projectors.length,23);
 for(const body of projectors)assert.doesNotMatch(body[1],/cell_kinds|cell_projection/);
 const result=spawnSync('python3',['tools/migration/cell-kinds.py','--local-final-fixture'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/inet_server_addr\(\) IS NULL/);assert.match(result.stdout,/current_database\(\) LIKE 'ck_%'/);
 assert.match(result.stdout,/synthetic-only/);assert.match(result.stdout,/purpose='isolated-staging'/);
 assert.equal((result.stdout.match(/DROP COLUMN cell_kinds RESTRICT/g)||[]).length,23);
 assert.doesNotMatch(result.stdout,/DISABLE|CASCADE|BYPASSRLS|CREATE ROLE/);
});
