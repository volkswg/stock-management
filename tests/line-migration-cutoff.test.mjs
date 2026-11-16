import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';

const floor='2026-11-17T00:00:00.000Z',epoch=Date.parse(floor);
function fixture({mode='supabase',environment='production',boundary=floor}={}){
 const env={VERCEL_ENV:environment,STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC:boundary};
 const counts={business:0,sql:0,replies:0},logs=[],journal=new Map(),effects=new Set(),cache={};
 class PersistenceFailure extends Error{constructor(status=503,message='Synthetic safe storage error'){super(message);this.status=status;}}
 const db={PersistenceFailure,storageMode:()=>mode,productionSettings:()=>({}),stagingSettings:()=>({}),stagingReadOnly:()=>false,requireMutation:()=>({query:async()=>{counts.sql++;return {};}})};
 const execute=async(_kind,key,intent,run)=>{const old=journal.get(key);if(old){assert.equal(old.intent,intent);return old.result;}const result=await run();journal.set(key,{intent,result});return result;};
 const imports={
  'server-only':{},'node:crypto':crypto,'next/server':{NextResponse:Response},
  '@/infrastructure/persistence/postgres/database':db,
  '@/infrastructure/persistence/postgres/commands':{executeCommand:execute,hashIntent:value=>JSON.stringify(value)},
  '@/infrastructure/persistence/postgres/uploads':{executeUploadCommand:execute,observeUpload:()=>assert.fail('No upload may occur')},
  '@/infrastructure/persistence/postgres/effects':{attemptEffectOnce:async(key,run)=>{if(!effects.has(key)){await run();effects.add(key);}}},
  '@/config':{getConfig:()=>({line:{channelAccessToken:'synthetic-access-token',channelSecret:'synthetic-signature-secret'}})},
  '@/composition/google-sheets':{createGoogleSheetsServiceFromConfig:()=>assert.fail('No Sheets access may occur')},
  '@/infrastructure/files/google-drive':{createGoogleDriveServiceFromConfig:()=>assert.fail('No Drive access may occur')},
 };
 function load(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new vm.Script(source,{filename:file}).runInNewContext({exports,process:{env},Buffer,Request,Response,URL,Error,console:{warn:(...args)=>logs.push(args)},fetch:()=>assert.fail('Live provider IO forbidden'),require(spec){
   if(Object.hasOwn(imports,spec))return imports[spec];
   if(spec==='./const')return load('src/infrastructure/external/line/const.ts');
   if(spec==='../domain/payload')return load('src/modules/line-workflows/domain/payload.ts');
   if(spec==='@/shared/lib/is-record')return load('src/shared/lib/is-record.ts');
   if(spec==='@/composition/postgres/route')return load('src/composition/postgres/route.ts');
   if(spec==='@/infrastructure/external/line')return load('src/infrastructure/external/line/LineBotService.ts');
   if(spec==='../../application/webhook')return {processWebhookEvents:async(input)=>{counts.business++;return {movementFailed:false,imageUploads:[],imageCounts:()=>({}),...await (async()=>{await input.lineBotService.sendReply(input.events[0].replyToken,[{type:'text',text:'Synthetic reply'}]);return {};})()};}};
   if(spec==='@/modules/line-workflows/server')return {
    parseLineWebhookPayload:load('src/modules/line-workflows/infrastructure/payload.ts').parseLineWebhookPayload,
    processLineWebhook:input=>load('src/modules/line-workflows/infrastructure/postgres/webhook.ts').processPostgresWebhook({...input,runtime:{error(){}},getImages:()=>assert.fail('No images in fixture'),lineBotService:{...input.lineBotService,sendReply:async()=>{counts.replies++;}}}),
   };
   throw Error('Unexpected dependency '+spec);
  }});return exports;
 }
 const route=load('src/app/api/line/webhook/route.ts');
 async function post(events,{signature=true,raw}={}){const body=raw??JSON.stringify({events}),signed=crypto.createHmac('sha256','synthetic-signature-secret').update(body).digest('base64');return route.POST(new Request('https://example.test/api/line/webhook',{method:'POST',headers:{'x-line-signature':signature?signed:'invalid'},body}));}
 return {post,counts,logs,env,journal};
}
const event=(timestamp=epoch,key='synthetic-event')=>({type:'message',webhookEventId:key,timestamp,replyToken:'synthetic-reply',message:{id:key,type:'text',text:'PRIVATE SYNTHETIC BUSINESS TEXT'}});
const noWork=f=>{assert.deepEqual(f.counts,{business:0,sql:0,replies:0});assert.equal(f.journal.size,0);};

test('LINE cutoff preserves the actual HMAC check and invalid-JSON response before admission',async()=>{
 const f=fixture({boundary:undefined});delete f.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC;
 assert.equal((await f.post([event()],{signature:false})).status,401);
 assert.equal((await f.post([],{raw:'{'})).status,400);noWork(f);assert.equal(f.logs.length,0);
});
test('LINE cutoff fails closed for a missing or invalid UTC floor without business, SQL or provider work',async()=>{
 for(const value of [undefined,'','not-a-date','2026-02-30T00:00:00Z','2026-11-17T00:00:00+00:00','2026-11-17']){
  const f=fixture();if(value===undefined)delete f.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC;else f.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC=value;
  assert.equal((await f.post([event()])).status,503);noWork(f);
 }
});
test('LINE cutoff rejects old and mixed batches as a whole, in either order',async()=>{
 for(const events of [[event(epoch-1)],[event(epoch,'new'),event(epoch-1,'old')],[event(epoch-1,'old'),event(epoch,'new')]]){
  const f=fixture();assert.equal((await f.post(events)).status,503);noWork(f);
  const logged=JSON.stringify(f.logs);assert.ok(logged.includes('old_event'));assert.ok(!logged.includes('PRIVATE SYNTHETIC BUSINESS TEXT'));assert.ok(!logged.includes('synthetic-reply'));
 }
});
test('LINE cutoff checks every raw event timestamp, including events filtered by the legacy parser',async()=>{
 for(const timestamp of [undefined,null,'1794873600000',-1,1.5,Number.MAX_SAFE_INTEGER]){
  const f=fixture(),invalid={...event(epoch,'invalid'),timestamp};assert.equal((await f.post([event(),invalid])).status,503);noWork(f);
 }
 for(const malformed of [{timestamp:epoch},null,42]){
  const f=fixture();assert.equal((await f.post([event(),malformed])).status,503);noWork(f);
 }
});
test('LINE cutoff accepts the exact floor and preserves fresh-event command/reply deduplication',async()=>{
 const f=fixture();const first=await f.post([event()]);assert.equal(first.status,200);const body=await first.json();
 const replay=await f.post([event()]);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),body);
 assert.deepEqual(f.counts,{business:1,sql:2,replies:1});assert.equal(f.journal.size,1);assert.equal(f.logs.length,0);
 assert.equal((await f.post([event(epoch+1,'later')])).status,200);assert.equal(f.counts.business,2);
});
test('LINE cutoff permits signed empty verification without a floor and preserves Sheets/staging selection',async()=>{
 const empty=fixture();delete empty.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC;
 assert.equal((await empty.post([])).status,200);noWork(empty);
 for(const settings of [{mode:'google-sheets'},{environment:'preview'}]){
  const f=fixture(settings);delete f.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC;
  assert.equal((await f.post([event(epoch-1)])).status,200);assert.equal(f.counts.business,1);assert.equal(f.logs.length,0);
 }
});
