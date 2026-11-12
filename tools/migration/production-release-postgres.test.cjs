/* eslint-disable @typescript-eslint/no-require-imports -- Real production owners and verified TLS in the freshly created synthetic container only. */
require('../../tests/helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),net=require('node:net');
const {Client}=require('pg'),port=Number(process.env.STOCK_PRODUCTION_FIXTURE_PORT),ca=fs.readFileSync(process.env.STOCK_PRODUCTION_FIXTURE_CA_FILE,'utf8'),host='db.abcdefghijklmnopqrst.supabase.co';
assert.ok(Number.isInteger(port)&&port>1024&&port<=65535);
const connect=net.Socket.prototype.connect;
// Route only the sealed synthetic Supabase-shaped host to this new local container.
// TLS still verifies the original hostname against the fixture CA/SAN; no TLS override.
net.Socket.prototype.connect=function(...args){let options=args[0],array=Array.isArray(options);if(array)options=options[0];if(typeof options==='number'){if(options===5432&&args[1]===host){args[0]=port;args[1]='127.0.0.1';}else assert.ok(options===port&&args[1]==='127.0.0.1');}else{assert.ok(options&&typeof options==='object');if(options.host===host&&Number(options.port)===5432){const replacement={...options,host:'127.0.0.1',port};args[0]=array?[replacement,...args[0].slice(1)]:replacement;}else assert.ok(options.host==='127.0.0.1'&&Number(options.port)===port);}return connect.apply(this,args);};
global.fetch=()=>{throw Error('Real provider network denied');};
const db=require('../../src/infrastructure/persistence/postgres/database.ts'),{withPersistence}=require('../../src/composition/postgres/route.ts'),{createPostgresService}=require('../../src/composition/postgres/service.ts'),orders=require('../../src/modules/orders/server.ts');
let owner;
test.after(async()=>{await db.closePool();await owner?.end();net.Socket.prototype.connect=connect;});
test('real TLS production profile preserves anonymous legacy API use, exact replay, role/purpose guards and read-only stop',async()=>{
 owner=new Client({connectionString:'postgres://postgres@127.0.0.1:'+port+'/postgres',ssl:{rejectUnauthorized:true,ca}});await owner.connect();
 const id=(await owner.query('SELECT isolation_id::text FROM stock_operational.environment')).rows[0].isolation_id;assert.notEqual(id,'160669bd-2f6f-4490-9259-bada5a1d02c4');
 const release={version:1,projectRef:'abcdefghijklmnopqrst',isolationId:id,databaseHost:host,connectionMode:'direct',runtimeUser:'stock_prod_runtime',vercelProjectId:'prj_WTLocalOnly',sourceCommit:'a'.repeat(40),accessPolicy:'legacy-as-is'};
 Object.assign(process.env,{VERCEL_ENV:'production',VERCEL_PROJECT_ID:release.vercelProjectId,VERCEL_GIT_COMMIT_SHA:release.sourceCommit,STOCK_STORAGE:'supabase',STOCK_PRODUCTION_ENABLED:'true',STOCK_PRODUCTION_RELEASE_JSON:JSON.stringify(release),STOCK_PRODUCTION_READ_ONLY:'false',STOCK_DATABASE_URL:'postgres://stock_prod_runtime:WT_production_fixture_only@'+host+':5432/postgres',STOCK_DATABASE_CA:ca,STOCK_TARGET_ISOLATION_ID:id});
 const service=createPostgresService();let executions=0;
 const handler=withPersistence(async()=>{executions++;return Response.json(await orders.createOrder({googleSheetsService:service,id:'WT_PRODUCTION_PROFILE',seller:'WT_production',totalPrice:12.34,createdBy:'web'}),{status:201});});
 const request=(seller='WT_production')=>new Request('https://example.test/api/orders',{method:'POST',headers:{'idempotency-key':'WT_PRODUCTION_PROFILE','content-type':'application/json'},body:JSON.stringify({seller})});
 const first=await handler(request());assert.equal(first.status,201);const body=await first.text();assert.equal(await (await handler(request())).text(),body);assert.equal(executions,1);assert.equal((await handler(request('WT_changed'))).status,409);
 assert.equal((await owner.query('SELECT count(*)::int n FROM stock_operational.orders WHERE id=$1',['WT_PRODUCTION_PROFILE'])).rows[0].n,1);
 await assert.rejects(owner.query("UPDATE stock_operational.environment SET purpose='unapproved'"),e=>e.code==='23514');
 await db.transaction(false,async()=>{const stream=db.currentTransaction().connection.stream;assert.equal(stream.encrypted,true);assert.equal(stream.authorized,true);assert.ok(stream.getPeerCertificate().subjectaltname.includes(host));});
 await assert.rejects(db.transaction(false,async()=>db.currentTransaction().query('SELECT * FROM stock_migration.orders LIMIT 1')));
 const reader=withPersistence(async()=>Response.json({ready:true}));assert.equal((await reader(new Request('https://example.test/api/orders'))).status,200);
 await owner.query("UPDATE stock_operational.environment SET purpose='isolated-staging'");assert.equal((await reader(new Request('https://example.test/api/orders'))).status,503);
 await owner.query("UPDATE stock_operational.environment SET purpose='production'");
 process.env.STOCK_PRODUCTION_READ_ONLY='true';assert.equal((await handler(request())).status,405);assert.equal(executions,1);
 // Production activation did not weaken the staging-only accessor or admit an invalid signature.
 assert.throws(()=>db.stagingSettings());process.env.STOCK_PRODUCTION_READ_ONLY='false';process.env.LINE_CHANNEL_SECRET='WT_production_signature';const line=require('../../src/app/api/line/webhook/route.ts');const raw=JSON.stringify({events:[]});assert.equal((await line.POST(new Request('https://example.test/api/line/webhook',{method:'POST',body:raw}))).status,401);const signature=require('node:crypto').createHmac('sha256',process.env.LINE_CHANNEL_SECRET).update(raw).digest('base64');assert.equal((await line.POST(new Request('https://example.test/api/line/webhook',{method:'POST',headers:{'x-line-signature':signature},body:raw}))).status,200);
 await db.closePool();release.runtimeUser='stock_prod_reader';process.env.STOCK_PRODUCTION_RELEASE_JSON=JSON.stringify(release);process.env.STOCK_DATABASE_URL=process.env.STOCK_DATABASE_URL.replace('stock_prod_runtime:WT_production_fixture_only','stock_prod_reader:WT_reader_fixture_only');process.env.STOCK_PRODUCTION_READ_ONLY='true';const readOrder=withPersistence(async()=>Response.json((await db.currentTransaction().query('SELECT id FROM stock_operational.orders WHERE id=$1',['WT_PRODUCTION_PROFILE'])).rows));assert.equal((await readOrder(new Request('https://example.test/api/orders'))).status,200);const restricted=new Client({connectionString:process.env.STOCK_DATABASE_URL,ssl:{rejectUnauthorized:true,ca}});await restricted.connect();try{await assert.rejects(restricted.query('UPDATE stock_operational.revision SET value=value'),e=>e.code==='42501');await assert.rejects(restricted.query('SET ROLE stock_runtime'),e=>e.code==='42501');}finally{await restricted.end();}
});
