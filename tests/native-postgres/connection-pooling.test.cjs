/* eslint-disable @typescript-eslint/no-require-imports -- Execute actual transport with closed synthetic capabilities. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{AsyncLocalStorage}=require('node:async_hooks');
const ref='abcdefghijklmnopqrst',id='11111111-2222-4333-8444-555555555555';
function fixture(mode='transaction',change=()=>{}){
 const release={version:1,projectRef:ref,isolationId:id,databaseHost:'aws-1-ap-northeast-1.pooler.supabase.com',connectionMode:mode,runtimeUser:'stock_prod_runtime',vercelProjectId:'prj_synthetic',sourceCommit:'a'.repeat(40),accessPolicy:'legacy-as-is'};
 const env={VERCEL_ENV:'production',VERCEL_PROJECT_ID:release.vercelProjectId,VERCEL_GIT_COMMIT_SHA:release.sourceCommit,STOCK_STORAGE:'supabase',STOCK_PRODUCTION_ENABLED:'true',STOCK_PRODUCTION_READ_ONLY:'false',STOCK_TARGET_ISOLATION_ID:id,STOCK_DATABASE_URL:`postgres://stock_prod_runtime.${ref}:synthetic-secret@${release.databaseHost}:${mode==='transaction'?6543:5432}/postgres`};
 if(mode==='direct'){release.databaseHost=`db.${ref}.supabase.co`;env.STOCK_DATABASE_URL=`postgres://stock_prod_runtime:synthetic-secret@${release.databaseHost}:5432/postgres`;}
 change(env,release);env.STOCK_PRODUCTION_RELEASE_JSON=JSON.stringify(release);
 const sql=[],logs=[],pools=[],attached=[],releases=[];let connectError,queryError;
 const role={runtime_user:'stock_prod_runtime',rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,rolconnlimit:6},guard={isolation_id:id,purpose:'production'};
 const client={on(){},removeListener(){},release(destroy){releases.push(destroy);},async query(text){sql.push(text);if(queryError?.text===text)throw queryError.error;if(text.includes('FROM pg_roles'))return{rows:[role]};if(text.includes('isolation_id::text,purpose'))return{rowCount:1,rows:[guard]};return{rows:[]};}};
 class Pool{constructor(options){this.options=options;this.listeners={};pools.push(this);}on(event,fn){this.listeners[event]=fn;}async connect(){if(connectError)throw connectError;return client;}async end(){this.ended=true;}}
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/infrastructure/persistence/postgres/database.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},URL,console:{error:(...args)=>logs.push(args)},require(name){if(name==='server-only')return{};if(name==='pg')return{Pool};if(name==='node:async_hooks')return{AsyncLocalStorage};if(name==='@vercel/functions/db-connections')return{attachDatabasePool:p=>attached.push(p)};throw Error('Unexpected dependency '+name);}});
 return{db:exports,env,release,sql,logs,pools,attached,releases,role,guard,failConnect:e=>connectError=e,failQuery:(text,error)=>queryError={text,error}};
}
test('explicit transaction pooler binding keeps exact host, project login, port, TLS and six-connection role guard',async()=>{
 const f=fixture();await f.db.transaction(true,async()=>{});assert.equal(f.pools[0].options.ssl.rejectUnauthorized,true);assert.equal(f.pools[0].options.max,2);assert.equal(f.pools[0].options.min,0);assert.equal(f.pools[0].options.idleTimeoutMillis,5000);assert.ok(f.sql.includes('SET LOCAL ROLE stock_runtime'));assert.ok(f.sql.includes('COMMIT'));assert.deepEqual(f.releases,[false]);
});
for(const mode of ['direct','session'])test(`${mode} release remains explicitly supported`,async()=>{const f=fixture(mode);await f.db.transaction(false,async()=>{});assert.ok(f.sql.includes('BEGIN READ ONLY'));});
for(const [name,change] of [
 ['transaction on session port',e=>e.STOCK_DATABASE_URL=e.STOCK_DATABASE_URL.replace(':6543',':5432')],
 ['session on transaction port',(e,p)=>p.connectionMode='session'],
 ['transaction without explicit port',e=>e.STOCK_DATABASE_URL=e.STOCK_DATABASE_URL.replace(':6543','')],
 ['wrong project suffix',e=>e.STOCK_DATABASE_URL=e.STOCK_DATABASE_URL.replace(ref,'z'.repeat(20))],
 ['foreign host',e=>e.STOCK_DATABASE_URL=e.STOCK_DATABASE_URL.replace('aws-1-ap-northeast-1.pooler.supabase.com','foreign.invalid')],
 ['direct host on pooled mode',(e,p)=>{p.databaseHost=`db.${ref}.supabase.co`;e.STOCK_DATABASE_URL=e.STOCK_DATABASE_URL.replace('aws-1-ap-northeast-1.pooler.supabase.com',p.databaseHost);}],
 ['unknown mode',(_e,p)=>p.connectionMode='automatic'],
 ['TLS override',e=>e.STOCK_DATABASE_URL+='?sslmode=disable'],
 ['wrong source',e=>e.VERCEL_GIT_COMMIT_SHA='b'.repeat(40)],
 ['wrong isolation',e=>e.STOCK_TARGET_ISOLATION_ID='22222222-2222-4222-8222-222222222222'],
])test(`binding rejects ${name} before connecting`,()=>{const f=fixture('transaction',change);assert.throws(()=>f.db.connectionPool());assert.equal(f.pools.length,0);});
test('one lifecycle hook per pool; close/recreate attaches to the new pool',async()=>{
 const f=fixture();assert.equal(f.db.connectionPool(),f.db.connectionPool());assert.deepEqual(f.attached,f.pools);await f.db.closePool();assert.equal(f.pools[0].ended,true);f.db.connectionPool();assert.equal(f.pools.length,2);assert.deepEqual(f.attached,f.pools);
});
test('53300 and idle disconnect diagnostics contain only phase and allowlisted code; HTTP failure stays generic',async()=>{
 const f=fixture(),secret='postgres://secret:password@host sensitive SQL and bind values';f.failConnect(Object.assign(Error(secret),{code:'53300',detail:secret}));let runs=0;
 await assert.rejects(f.db.transaction(true,async()=>runs++),e=>e.status===503&&!e.message.includes(secret));assert.equal(runs,0);assert.equal(f.logs[0][1].code,'53300');
 f.pools[0].listeners.error(Object.assign(Error(secret),{code:'ECONNRESET'}));f.pools[0].listeners.error(Object.assign(Error(secret),{code:secret}));assert.equal(f.logs[1][1].code,'ECONNRESET');assert.equal(f.logs[2][1].code,'unavailable');assert.ok(!JSON.stringify(f.logs).includes(secret));
});
test('query failure rolls back/destroys; ambiguous COMMIT is never retried',async()=>{
 for(const text of ['synthetic write','COMMIT']){const f=fixture();f.failQuery(text,Error('private driver detail'));let executions=0;
  await assert.rejects(f.db.transaction(true,async()=>{executions++;await f.db.currentTransaction().query('synthetic write');}),e=>e.status===503&&!e.message.includes('private'));assert.equal(executions,1);assert.equal(f.sql.filter(s=>s==='BEGIN').length,1);assert.ok(f.sql.includes('ROLLBACK'));assert.deepEqual(f.releases,[true]);
 }
});
test('nested work keeps one transaction and read-only scope cannot become writable',async()=>{
 const f=fixture();await f.db.transaction(true,()=>f.db.transaction(true,async()=>{}));assert.equal(f.sql.filter(s=>s==='BEGIN').length,1);
 await assert.rejects(f.db.transaction(false,()=>f.db.transaction(true,async()=>{})));assert.ok(f.sql.includes('ROLLBACK'));
});
test('transaction pooling retains runtime role and target verification before business work',async()=>{
 for(const [field,value]of [['runtime_user','postgres'],['rolsuper',true],['rolbypassrls',true],['rolcreatedb',true],['rolcreaterole',true],['rolinherit',true],['rolconnlimit',-1],['rolconnlimit',7]]){const f=fixture();f.role[field]=value;await assert.rejects(f.db.transaction(true,async()=>assert.fail('Unsafe role reached business work')));assert.ok(f.sql.includes('ROLLBACK'));}
 for(const change of [g=>g.purpose='isolated-staging',g=>g.isolation_id='22222222-2222-4222-8222-222222222222']){const f=fixture();change(f.guard);await assert.rejects(f.db.transaction(true,async()=>assert.fail('Wrong target reached business work')));assert.ok(f.sql.includes('ROLLBACK'));}
 const f=fixture('transaction',e=>delete e.STOCK_PRODUCTION_READ_ONLY);await assert.rejects(f.db.transaction(true,async()=>assert.fail('Read-only configuration wrote')));assert.equal(f.pools.length,0);
});
