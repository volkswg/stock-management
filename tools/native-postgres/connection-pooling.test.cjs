/* eslint-disable @typescript-eslint/no-require-imports -- Actual pg transport on a new local synthetic database. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{AsyncLocalStorage}=require('node:async_hooks'),{Client,Pool}=require('pg');
const {attachDatabasePool}=require('@vercel/functions/db-connections');
const {createHash}=require('node:crypto');
global.fetch=()=>{throw Error('Provider network is forbidden');};
for(const name of ['DIRECT','TRANSACTION'])assert.match(process.env[`STOCK_POOL_TEST_${name}_PORT`]||'',/^\d{1,5}$/);
const url=(port,user='stock_test')=>`postgres://${user}:synthetic-only@127.0.0.1:${port}/postgres`;
const owner=new Client({connectionString:url(process.env.STOCK_POOL_TEST_DIRECT_PORT,'postgres')});
const sql=fs.readFileSync('src/infrastructure/persistence/postgres/database.ts','utf8');
const commandSql=fs.readFileSync('src/infrastructure/persistence/postgres/commands.ts','utf8');
const apps=[];
function app(){
 const env={STOCK_STORAGE:'supabase',STOCK_STAGING_ENABLED:'true',STOCK_STAGING_AUTH_TOKEN:'synthetic-only-authorization-32-characters',STOCK_ALLOW_LOCAL_TEST_DATABASE:'true',STOCK_TARGET_ISOLATION_ID:'11111111-2222-4333-8444-555555555555',STOCK_DATABASE_URL:url(process.env.STOCK_POOL_TEST_TRANSACTION_PORT)};
 const cache={};function load(name,source){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},console,URL,Buffer,require(spec){if(spec==='server-only')return{};if(spec==='node:async_hooks')return{AsyncLocalStorage};if(spec==='pg')return{Pool};if(spec==='@vercel/functions/db-connections')return{attachDatabasePool};if(spec==='node:crypto')return{createHash};if(spec==='./database')return cache.db;throw Error('Unexpected capability '+spec);}});return exports;}
 cache.db=load('database.ts',sql);cache.commands=load('commands.ts',commandSql);apps.push(cache);return cache;
}
test.before(()=>owner.connect());
test.after(async()=>{await Promise.all(apps.map(a=>a.db.closePool()));await owner.end();});
const scalar=async(text,values)=>(await owner.query(text,values)).rows[0].value;
test('idle direct sessions reproduce the six-slot login exhaustion and SQLSTATE 53300',async()=>{
 const held=Array.from({length:6},()=>new Client({connectionString:url(process.env.STOCK_POOL_TEST_DIRECT_PORT)})),seventh=new Client({connectionString:url(process.env.STOCK_POOL_TEST_DIRECT_PORT)});
 try{await Promise.all(held.map(c=>c.connect()));await assert.rejects(seventh.connect(),e=>e.code==='53300');}
 finally{await Promise.allSettled([...held,seventh].map(c=>c.end()));}
});
test('24 warm clients across 12 app instances share at most four backends; transactions retain role and snapshot safety',async()=>{
 const instances=Array.from({length:12},app),clients=[];
 try{
  // Every local pool opens two connections. Unlike session mode, idle client
  // sockets cannot retain one PostgreSQL backend each after their transaction.
  for(const a of instances)clients.push(...await Promise.all([a.db.connectionPool().connect(),a.db.connectionPool().connect()]));
  await Promise.all(clients.map(async c=>{await c.query('BEGIN');await c.query('SELECT pg_sleep(0.02)');await c.query('COMMIT');}));
  const backends=await scalar("SELECT count(*)::int value FROM pg_stat_activity WHERE usename='stock_test'");assert.ok(backends<=4,`Unexpected backend count ${backends}`);assert.ok(backends>0);assert.equal(clients.length,24);
 }finally{clients.forEach(c=>c.release());}
 const results=await Promise.all(instances.map(a=>a.db.transaction(false,async()=>{
  const c=a.db.currentTransaction();const first=(await c.query('SELECT pg_backend_pid() pid,current_user AS role,current_setting(\'transaction_read_only\') AS readonly,current_setting(\'transaction_isolation\') AS isolation')).rows[0];
  await c.query('SELECT pg_sleep(0.02)');const next=(await c.query('SELECT pg_backend_pid() pid')).rows[0];assert.equal(next.pid,first.pid);assert.equal(first.role,'stock_runtime');assert.equal(first.readonly,'on');assert.equal(first.isolation,'repeatable read');return first;
 },{consistentRead:true})));
 assert.ok(new Set(results.map(r=>r.pid)).size<=4);
 await assert.rejects(instances[0].db.transaction(false,()=>instances[0].db.currentTransaction().query("UPDATE stock_operational.pooling_probe SET value=99")));
 const raw=await instances[0].db.connectionPool().connect();try{assert.equal((await raw.query('SELECT current_user AS role')).rows[0].role,'stock_test');await assert.rejects(raw.query('SELECT * FROM stock_operational.pooling_probe'),e=>e.code==='42501');}finally{raw.release(true);}
});
test('queued writes, rollback, simultaneous command replay and changed-input conflict preserve exactly-once business effects',async()=>{
 const instances=Array.from({length:12},app);
 const increment=a=>a.db.currentTransaction().query("UPDATE stock_operational.pooling_probe SET value=value+1 WHERE id='quantity' RETURNING value");
 await Promise.all(instances.map(a=>a.commands.executeCommand('pool-test','different-key-'+instances.indexOf(a),a.commands.hashIntent('increment'),async()=>{await increment(a);return 'saved';})));
 assert.equal(await scalar("SELECT value FROM stock_operational.pooling_probe WHERE id='quantity'"),12);
 const a=instances[0];await assert.rejects(a.commands.executeCommand('pool-test','rollback-key',a.commands.hashIntent('rollback'),async()=>{await increment(a);throw Error('synthetic rollback');}));
 assert.equal(await scalar("SELECT value FROM stock_operational.pooling_probe WHERE id='quantity'"),12);assert.equal(await scalar("SELECT count(*)::int value FROM stock_operational.commands WHERE key='rollback-key'"),0);
 let executions=0;await Promise.all(instances.map(a=>a.commands.executeCommand('pool-test','shared-key',a.commands.hashIntent('same'),async()=>{executions++;await increment(a);return 'saved';})));
 assert.equal(executions,1);assert.equal(await scalar("SELECT value FROM stock_operational.pooling_probe WHERE id='quantity'"),13);
 await assert.rejects(a.commands.executeCommand('pool-test','shared-key',a.commands.hashIntent('changed'),async()=>assert.fail('Changed input executed')),e=>e.status===409);
});
test('lost COMMIT acknowledgement is not retried; same-key recovery reads the committed journal',async()=>{
 const a=app(),client=await a.db.connectionPool().connect(),query=client.query.bind(client);let lose=true,executions=0;
 client.query=async(...args)=>{const result=await query(...args);if(args[0]==='COMMIT'&&lose){lose=false;throw Error('Synthetic lost COMMIT acknowledgement');}return result;};client.release();
 const run=()=>a.commands.executeCommand('pool-test','lost-commit-key',a.commands.hashIntent('lost'),async()=>{executions++;await a.db.currentTransaction().query("UPDATE stock_operational.pooling_probe SET value=value+1 WHERE id='quantity'");return 'committed';});
 await assert.rejects(run(),e=>e.status===503);assert.equal(executions,1);assert.equal(await scalar("SELECT value FROM stock_operational.pooling_probe WHERE id='quantity'"),14);assert.equal(await run(),'committed');assert.equal(executions,1);
});
test('actual Vercel lifecycle hook extends the request until the real pg idle timeout drains its clients',async()=>{
 const context=Symbol.for('@vercel/request-context'),saved=globalThis[context],pending=[];
 const oldUrl=process.env.VERCEL_URL,oldRegion=process.env.VERCEL_REGION;
 const pool=new Pool({connectionString:url(process.env.STOCK_POOL_TEST_TRANSACTION_PORT),max:2,min:0,idleTimeoutMillis:30});
 try{
  process.env.VERCEL_URL='synthetic.invalid';process.env.VERCEL_REGION='local-test';globalThis[context]={get:()=>({waitUntil:p=>pending.push(p)})};attachDatabasePool(pool);
  const client=await pool.connect();await client.query('SELECT 1');assert.equal(pending.length,0);client.release();assert.equal(pending.length,1);await Promise.all(pending);assert.equal(pool.totalCount,0);
 }finally{await pool.end();if(saved===undefined)delete globalThis[context];else globalThis[context]=saved;for(const [key,value]of [['VERCEL_URL',oldUrl],['VERCEL_REGION',oldRegion]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
