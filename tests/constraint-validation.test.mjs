import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('row-constraint operator is reproducible, guarded and outside automatic migrations',()=>{
 const generated=spawnSync('python3',['tools/migration/constraint-validation.py'],{encoding:'utf8'});
 assert.equal(generated.status,0,generated.stderr);
 const sql=readFileSync('tools/migration/final-removal/20261118100705_constraint_record_validation.sql','utf8');
 assert.equal(generated.stdout,sql);
 assert.equal((sql.match(/ADD CONSTRAINT /g)||[]).length,23);
 assert.equal((sql.match(/VALIDATE CONSTRAINT /g)||[]).length,23);
 assert.equal((sql.match(/CREATE FUNCTION /g)||[]).length,1);
 assert.equal((sql.match(/DROP FUNCTION /g)||[]).length,23);
 assert.equal((sql.match(/^CREATE TRIGGER /gm)||[]).length,23);
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.doesNotMatch(sql,/CASCADE|DROP (TABLE|COLUMN|SCHEMA)|SECURITY DEFINER|CREATE ROLE|DISABLE TRIGGER/);
 for(const gate of ['expected_isolation_id','expected_purpose','allow_constraint_validation','constraint_reviewed_revision','constraint_reviewed_source','constraint_reviewed_fingerprint','constraint_restore_verified','constraint_semantics_verified'])assert.ok(sql.includes('stock.'+gate));
 assert.match(sql,/BEGIN ISOLATION LEVEL READ COMMITTED/);
 assert.match(sql,/lower\(p.prosrc\)/);
 assert.match(sql,/NEW.revision := OLD.revision\+1/);
 assert.match(sql,/OLD.archived_at IS NOT NULL/);
 assert.match(sql,/shape->TG_ARGV\[0\] IS DISTINCT FROM to_jsonb\(OLD\)->TG_ARGV\[0\]/);
 // No schema-only replacement of normalization, identity changes or old/new
 // revision behavior; no stronger business rules or speculative foreign keys.
 assert.doesNotMatch(sql,/FOREIGN KEY|UNIQUE\s*\(|CHECK\s*\([^\n]*(totalPrice|quantity)/);
});
