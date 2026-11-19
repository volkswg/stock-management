import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import {restoreSoftDeleteSource} from './helpers/soft-delete-history.mjs';

test('archive retirement is reproducible, maintenance-only and keeps automatic migrations unchanged',()=>{
 const sql=readFileSync('tools/migration/operator/20261119013852_retire_archived_at.sql','utf8');
 assert.equal(sql,execFileSync('python3',['tools/migration/soft-delete.py','retirement'],{encoding:'utf8'}));
 assert.equal((sql.match(/DROP COLUMN archived_at RESTRICT/g)||[]).length,6);
 assert.equal((sql.match(/RENAME COLUMN archived_at TO "deletedAt"/g)||[]).length,17);
 for(const guard of ['stock.allow_soft_delete_retirement','stock.expected_isolation_id','stock.expected_purpose','stock.soft_delete_revision','stock.soft_delete_restore_verified','stock.soft_delete_source','stock.soft_delete_fingerprint'])assert.ok(sql.includes(guard));
 assert.doesNotMatch(sql,/SECURITY DEFINER|CASCADE|DROP TABLE|DELETE FROM|CREATE ROLE|session_replication_role/);
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,9);
 assert.ok(restoreSoftDeleteSource('src/infrastructure/persistence/postgres/records.ts').includes('SET archived_at=now()'));
});

test('actual adapter checks deletion capability once per transaction and fails closed on partial layouts',async()=>{
 let active,mode='legacy';const queries=[];
 const client=()=>({async query(sql){queries.push(sql);
  if(sql.includes('lexeme_mapping_contract_v1()'))return {rows:[{mode:'typed'}]};
  if(sql.includes('to_regprocedure'))return {rows:[{present:mode!=='legacy'}]};
  if(sql.includes('soft_delete_contract_v1()'))return {rows:[{mode}]};
  return {rows:[]};
 }});
 class PersistenceFailure extends Error{constructor(status,message){super(message);this.status=status;}}
 const exports={};const code=ts.transpileModule(readFileSync('src/infrastructure/persistence/postgres/records.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script(code).runInNewContext({exports,WeakMap,Number,JSON,require:id=>id==='server-only'?{}:{currentTransaction:()=>active,requireMutation:()=>active,PersistenceFailure}});
 const records=new exports.PostgresRecords({table:'orders',headers:['id']});
 active=client();await records.readRows();assert.match(queries.at(-1),/WHERE archived_at IS NULL/);
 mode='deletedAt';active=client();await records.readRows();await records.readRows();assert.match(queries.at(-1),/WHERE "deletedAt" IS NULL/);
 assert.equal(queries.filter(q=>q==='SELECT stock_operational.soft_delete_contract_v1() AS mode').length,1);
 mode='partial';active=client();const n=queries.filter(q=>q.includes('FROM stock_operational.orders t')).length;
 await assert.rejects(records.readRows(),/Unsupported soft-delete schema/);
 assert.equal(queries.filter(q=>q.includes('FROM stock_operational.orders t')).length,n);
});
