import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {restoreTypedPostgresSource,typedPostgresHistory} from './helpers/typed-postgres-history.mjs';
test('typed-only runtime has one bounded historical inverse and no legacy dispatch or catalog column discovery',()=>{
 const name='src/infrastructure/persistence/postgres/records.ts',s=readFileSync(name,'utf8');
 assert.equal(restoreTypedPostgresSource(name),typedPostgresHistory.edits[name].before);
 assert.match(s,/mode !== "typed"/);assert.match(s,/typedSchemas = new WeakMap/);
 assert.doesNotMatch(s,/information_schema|pg_typeof|cell_kinds|__lexeme|business_cells|column_mapping_contract|column_compatible_|created_at_timestamp/);
});
test('operator cleanup is reproducible, explicit, outside discovery and drops only116 functions',()=>{
 const r=spawnSync('python3',['tools/migration/typed-cleanup.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout,readFileSync('tools/migration/final-removal/20261118082624_retire_legacy_mappers.sql','utf8'));
 assert.equal((r.stdout.match(/DROP FUNCTION /g)||[]).length,116);
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.doesNotMatch(r.stdout,/CASCADE|DROP (TABLE|COLUMN|SCHEMA)|CREATE (FUNCTION|ROLE)|GRANT |DISABLE/);
 for(const tag of ['stock.expected_isolation_id','stock.expected_purpose','stock.mapper_reviewed_revision','stock.mapper_reviewed_source','stock.mapper_reviewed_fingerprint','stock.mapper_restore_verified','stock.mapper_semantics_verified'])assert.ok(r.stdout.includes(tag));
 assert.match(r.stdout,/BEGIN ISOLATION LEVEL READ COMMITTED/);assert.match(r.stdout,/lower\(p.prosrc\)/);
});
