import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const file='tools/migration/final-removal/20261117174324_remove_cell_kinds.sql';
test('final retirement is reproducible, operator-only and retains original automatic migrations',()=>{
 const generated=spawnSync('python3',['tools/migration/cell-kinds-final.py'],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
 const sql=readFileSync(file,'utf8');assert.equal(sql,generated.stdout);
 assert.equal(readdirSync('supabase/migrations').filter(s=>s.endsWith('.sql')).length,9);
 assert.equal((sql.match(/DROP COLUMN cell_kinds RESTRICT/g)||[]).length,23);
 assert.doesNotMatch(sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n'),/CASCADE|DISABLE|SECURITY DEFINER|CREATE ROLE|GRANT |INSERT INTO|UPDATE stock_operational|ADD COLUMN/);
 for(const name of ['allow_final_cell_kinds_removal','cell_kinds_reviewed_revision','cell_kinds_reviewed_source','cell_kinds_restore_verified','cell_kinds_semantics_verified'])assert.ok(sql.includes(name));
 assert.ok(sql.indexOf('LOCK TABLE')<sql.lastIndexOf("value::text=current_setting('stock.cell_kinds_reviewed_revision'"));
});
test('all147 function bodies are pinned; only115 dependent bodies and one unused helper retire',()=>{
 const output=spawnSync('python3',['-c',"import runpy,json;m=runpy.run_path('tools/migration/cell-kinds-final.py');print(json.dumps({'old':len(m['original_bodies']()),'changed':len(m['final_bodies']()),'bodies':list(m['final_bodies']().values()),'tails':m['OPTIONAL_TAILS']}))"],{encoding:'utf8'});
 assert.equal(output.status,0,output.stderr);const v=JSON.parse(output.stdout);assert.equal(v.old,147);assert.equal(v.changed,115);
 assert.ok(v.bodies.every(s=>!s.includes('cell_kinds')&&!s.includes('cell_projection')));
 assert.deepEqual(v.tails.movement_details,['stockCounted','isNewArrival']);assert.deepEqual(v.tails.user_state,['context']);
 assert.equal(Object.values(v.tails).flat().length,10);
});
test('retirement guards exact prefixes including archived rows; no generic coercion or silent data repair',()=>{
 const sql=readFileSync(file,'utf8');assert.equal((sql.match(/Unreviewed encoding representation in /g)||[]).length,23);
 assert.ok(sql.includes('old->i IS DISTINCT FROM candidate->i'));
 assert.doesNotMatch(sql,/archived_at IS NULL|EXCEPTION WHEN/);
 assert.ok(sql.includes("prosrc LIKE '%cell_kinds%'"));assert.ok(sql.includes('DROP FUNCTION stock_operational.cell_projection(jsonb,text,text,text) RESTRICT'));
});
