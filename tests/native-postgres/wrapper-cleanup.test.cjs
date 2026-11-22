/* eslint-disable @typescript-eslint/no-require-imports -- Actual current owners and synthetic in-memory composition, no live integrations. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const {beforeWrapperCleanup}=require('../helpers/wrapper-cleanup-history.cjs');
const {beforeMovementShopIds}=require('../helpers/movement-shop-ids-history.cjs');
const server='src/modules/line-workflows/server.ts';
const before=()=>beforeWrapperCleanup(server).toString();
const compile=text=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,removeComments:true}}).outputText;
function run(source){
 const real=createRequire(path.resolve(server)),exports={};let calls=0;
 const dispatcher=input=>{calls++;const context=input.getContext();return {events:input.events,line:input.lineBotService,images:input.getImages,mode:input.getCreateMode,base:input.getPublicBaseUrl,contextKeys:Object.keys(context),orderKeys:Object.keys(context.orders),inventoryKeys:Object.keys(context.inventory),runtimeKeys:Object.keys(input.runtime)};};
 vm.runInNewContext(compile(source),{exports,require(spec){return spec==='./infrastructure/postgres/webhook'?{processPostgresWebhook:dispatcher}:real(spec);}});
 return {exports,calls:()=>calls};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function declaration(source,name){const tree=ts.createSourceFile('server.ts',source,ts.ScriptTarget.Latest,true);const fn=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name.text===name);assert.ok(fn,name);return fn.getText(tree);}

test('LINE public surface contains only the two live webhook entrypoints',()=>{
 const current=run(fs.readFileSync(server,'utf8')),previous=run(before());
 assert.deepEqual(Object.keys(current.exports).sort(),['parseLineWebhookPayload','processLineWebhook']);
 for(const name of ['saveMovementState','resumeLegacyMovement','createDraftOrder','completeOrderBill','findLatestUserState'])assert.equal(typeof previous.exports[name],'function');
 assert.equal(current.calls(),0);assert.equal(previous.calls(),0);
});

test('webhook composition adds only the lazy shop reader; historical cleanup callbacks stay exact',async()=>{
 const current=run(fs.readFileSync(server,'utf8')),previous=run(before());
 const events=[{webhookEventId:'SYNTHETIC',type:'message'}],line={},images=()=>undefined,mode=()=> 'quantity_photo',base=()=> 'https://example.invalid';let loads=0;
 const input={events,lineBotService:line,getStorage:()=>{loads++;return {};},getGoogleDriveService:images,getCreateMode:mode,getPublicBaseUrl:base};
 const a=await current.exports.processLineWebhook(input),b=await previous.exports.processLineWebhook(input);
 assert.equal(loads,2);assert.equal(a.events,events);assert.equal(a.line,line);assert.equal(a.images,images);assert.equal(a.mode,mode);assert.equal(a.base,base);assert.deepEqual(plain({...a,contextKeys:a.contextKeys.filter(key=>key!=='shops')}),plain(b));assert.ok(a.contextKeys.includes('shops'));
 for(const name of ['createContext','processLineWebhook'])assert.equal(compile(declaration(beforeMovementShopIds(server).toString(),name)),compile(declaration(before(),name).replace(/\bsheets\b/g,'storage')),name);
});

test('synchronous Loyverse factory is absent while canonical account sources stay available',()=>{
 assert.equal(fs.existsSync('src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts'),false);
 const exports=require('../../src/infrastructure/external/loyverse/index.ts');assert.equal(Object.hasOwn(exports,'createLoyverseAccountsFromConfig'),false);assert.equal(typeof exports.LoyverseService,'function');
 const accounts=require('../../src/composition/loyverse-accounts.ts');assert.equal(typeof accounts.createLoyverseAccounts,'function');assert.equal(typeof accounts.listLoyverseAccounts,'function');
 const source=fs.readFileSync('src/composition/loyverse-accounts.ts','utf8');assert.match(source,/accountSource === "env"/);assert.match(source,/PostgresLoyverseAccounts/);
});

test('historical cleanup controls retain exact bytes through the bounded shop-ID feature inverse',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/wrapper-cleanup-before.json'));
 for(const [file,hash] of Object.entries(fixture.preserved))assert.equal(createHash('sha256').update(require('../helpers/connection-pooling-history.cjs').beforePooling(file,beforeMovementShopIds(file))).digest('hex'),hash,file);
 assert.match(fs.readFileSync('src/modules/line-workflows/application/movement-events.ts','utf8'),/await resumeLegacyMovement\(context, userId, runtime\)/);
 const helper=fs.readFileSync('tests/helpers/native-line-primitives.cjs','utf8');assert.match(helper,/application\/sessions.ts/);assert.match(helper,/infrastructure\/postgres\/sessions.ts/);assert.doesNotMatch(helper,/beforeWrapper|vm\.|readFile/);
});

test('current source has no consumers of retired factory or public LINE wrappers',()=>{
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
 for(const file of files('src').filter(f=>/\.tsx?$/.test(f))){
  const source=fs.readFileSync(file,'utf8');assert.doesNotMatch(source,/createLoyverseAccountsFromConfig|ConfiguredLoyverseAccount|createLoyverseServiceFromConfig/,file);
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  for(const node of tree.statements)if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='@/modules/line-workflows/server')assert.deepEqual(node.importClause.namedBindings.elements.map(s=>s.propertyName?.text||s.name.text).sort(),['parseLineWebhookPayload','processLineWebhook']);
 }
});
