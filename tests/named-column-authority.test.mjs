import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const catalog=JSON.parse(read('tools/migration/worksheets.json'));
test('every operational binding has an explicit named input, projection and validation mapping',()=>{
 const migration=read('supabase/migrations/'+readdirSync('supabase/migrations').find(n=>n.endsWith('_named_column_authority.sql')));
 assert.equal(Object.keys(catalog).length,23);
 for(const [table,spec] of Object.entries(catalog)){
  for(const operation of ['input','project','validate','compat'])assert.ok(migration.includes(`CREATE FUNCTION stock_operational.${operation}_${table}(`),`${operation} ${table}`);
  for(const name of spec.headers)assert.ok(migration.includes(`r."${name}"`),`${table}.${name}`);
  assert.ok(migration.includes(`Unrepresentable ${table} row; transition aborted`));
 }
 const records=read('src/infrastructure/persistence/postgres/records.ts');
 assert.doesNotMatch(records,/SET business_cells=|INSERT INTO[^\n]*\(business_cells/);
 assert.match(records,/input_\$\{this.definition.table\}/);assert.match(records,/project_\$\{this.definition.table\}/);
 assert.ok(read('tools/migration/promote.sql').includes('Legacy promotion is incompatible'));
});
test('historical adapter and operational assertions retain exact source witnesses',()=>{
 const history=JSON.parse(read('tests/fixtures/named-columns-before.json'));
 const hash=s=>createHash('sha256').update(s).digest('hex');
 for(const [file,e] of Object.entries(history.edits)){assert.equal(hash(e.before),e.beforeHash);assert.equal(hash(read(file)),e.afterHash);}
 const operational=JSON.parse(read('tests/fixtures/named-columns-operational-before.json'));
 assert.equal(hash(operational.source),operational.sha256);
 assert.match(operational.source,/preserves canonical app precedence/);
 assert.match(read('tools/migration/operational.test.cjs'),/rejects conflicting dual writes/);
});
