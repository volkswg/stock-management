import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const file='tools/migration/final-removal/20261118040625_remove_lexemes.sql';
test('operator retirement is reproducible,outside discovery and never repairs stored records or weakens permissions',()=>{
 const r=spawnSync('python3',['tools/migration/lexemes-final.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const sql=readFileSync(file,'utf8');assert.equal(sql,r.stdout);assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.equal((sql.match(/DROP COLUMN ".*__lexeme" RESTRICT/g)||[]).length,48);assert.equal((sql.match(/DROP FUNCTION /g)||[]).length,4);
 assert.doesNotMatch(sql,/UPDATE stock_|CREATE (?:FUNCTION|ROLE)|GRANT |CASCADE|DISABLE|BYPASSRLS|SECURITY DEFINER/);
});
test('all193 predecessors are pinned;97dependent bodies change and4unused helpers retire',()=>{
 const r=spawnSync('python3',['-c',"import runpy,json;m=runpy.run_path('tools/migration/lexemes-final.py');print(json.dumps({'originals':len(m['originals']()),'changed':len(m['replacements']()),'bodies':list(m['replacements']().values()),'helpers':len(m['RETIRED_HELPERS'])}))"],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const m=JSON.parse(r.stdout);assert.equal(m.originals,193);assert.equal(m.changed,97);assert.equal(m.helpers,4);assert.ok(m.bodies.every(b=>!b.includes('__lexeme')));
});
test('reviewed recovery,identity,revision and semantics are rechecked after all51table locks',()=>{
 const s=readFileSync(file,'utf8');for(const tag of ['stock.expected_isolation_id','stock.expected_purpose','stock.allow_final_lexeme_removal','stock.lexeme_reviewed_revision','stock.lexeme_reviewed_source','stock.lexeme_reviewed_fingerprint','stock.lexeme_restore_verified','stock.lexeme_semantics_verified'])assert.ok(s.includes(tag));
 assert.match(s,/BEGIN ISOLATION LEVEL READ COMMITTED/);assert.ok(s.lastIndexOf("value::text=current_setting('stock.lexeme_reviewed_revision'")>s.indexOf('LOCK TABLE'));
 assert.match(s,/pg_depend d JOIN pg_attribute/);assert.match(s,/n.nspname NOT IN \('pg_catalog','information_schema'\)/);assert.doesNotMatch(s,/archived_at IS NULL|EXCEPTION WHEN/);
});
