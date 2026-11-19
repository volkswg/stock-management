import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const read=p=>readFileSync(p,'utf8');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
test('current business runtime has only named PostgreSQL repositories and all23 explicit maps',()=>{
 const features=['orders','shipments','inventory','hr','expenses','sales','line-workflows'];let tables=0;
 for(const feature of features){
  assert.equal(existsSync(`src/modules/${feature}/infrastructure/google-sheets`+'/orders/const.ts'),false);
  const source=read(`src/modules/${feature}/infrastructure/postgres/tables.ts`);
  tables+=(source.match(/new NativeRecords\(/g)||[]).length;
  assert.doesNotMatch(source,/headers|google-sheets|typed_(input|project)|row_order|business_cells/);
  for(const file of files(`src/modules/${feature}/infrastructure/postgres`))assert.doesNotMatch(read(file),/GoogleSheet|\.readRows\(|\.appendRows\(|\.updateRows\(|referenceRow|["'`]A[12]?:[A-Z]/,file);
 }
 assert.equal(tables,23);assert.equal(existsSync('src/infrastructure/persistence/postgres/records.ts'),false);
 assert.doesNotMatch(read('src/composition/postgres/service.ts'),/GoogleSheet|readMovementRanges/);
 assert.match(read('src/infrastructure/persistence/postgres/database.ts'),/if \(mode !== "supabase"\)/);
 assert.doesNotMatch(read('src/composition/postgres/route.ts'),/storageMode\(\) === "google-sheets"/);
});
test('actual imports resolve; domain/application/UI cannot reach retired business Sheets or SQL owners',()=>{
 const source=files('src').filter(f=>/\.tsx?$/.test(f));
 for(const file of source){
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);
  for(const statement of tree.statements){
   if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;
   const spec=statement.moduleSpecifier;if(!spec||!ts.isStringLiteral(spec))continue;
   if(!spec.text.startsWith('.')&&!spec.text.startsWith('@/'))continue;
   const base=spec.text.startsWith('@/')?'src/'+spec.text.slice(2):path.resolve(path.dirname(file),spec.text);
   assert.ok(['','.ts','.tsx','/index.ts','/index.tsx','.json'].some(s=>existsSync(base+s)),`${file}: unresolved ${spec.text}`);
   if(/\/(domain|application|ui)\//.test(file))assert.doesNotMatch(spec.text,/infrastructure\/persistence|composition|infrastructure\/postgres/,file);
  }
 }
});
test('configuration remains a fixed read-only integration seam; Drive and LINE controls remain',()=>{
 const configuration=read('src/composition/loyverse-accounts.ts');assert.match(configuration,/PostgresLoyverseAccounts/);
 assert.match(read('src/infrastructure/configuration/postgres/loyverse-accounts.ts'),/stock_configuration.loyverse_accounts/);
 assert.equal(existsSync('src/infrastructure/persistence/google-sheets'),false);
 assert.match(read('src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts'),/GoogleOAuthRefreshTokenAuth/);
 assert.match(read('src/app/api/line/webhook/route.ts'),/verifyLineSignature/);
 const source=read('src/modules/line-workflows/server.ts');assert.match(source,/processPostgresWebhook/);assert.doesNotMatch(source,/storageMode|GoogleSheetRow/);
 const sql=read('src/infrastructure/persistence/postgres/native-records.ts');assert.doesNotMatch(sql,/typed_input_|typed_project_|\$\{.*range/);assert.match(sql,/revision=\$/);assert.match(sql,/media_ref_for_url_v1/);
});

test('financial rules, business use cases, provider implementations and browser UI preserve their predecessor bytes',()=>{
 const fixture=JSON.parse(read('tests/fixtures/native-postgres-before.json'));
 for(const file of Object.keys(fixture.files)){
  if(!/^src\/modules\/[^/]+\/(domain|application|ui)\//.test(file)&&!/^src\/infrastructure\/(external|files|configuration)\//.test(file))continue;
  const edit=fixture.edits[file];
  if(file==='src/modules/sales/application/reports.ts'){
   assert.equal(read(file),edit.before.replaceAll('googleSheetsService','storage'));continue;
  }
  assert.equal(edit,undefined,`Unexpected behavior change: ${file}`);
 }
});

test('current runtime/type graph is acyclic and browser entries cannot reach server-only storage',()=>{
 const source=files('src').filter(f=>/\.tsx?$/.test(f));const nodes=new Set(source.map(f=>path.resolve(f))),graph=new Map(),runtime=new Map();
 for(const file of nodes){
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true),all=[],values=[];
  for(const statement of tree.statements){
   if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;
   const spec=statement.moduleSpecifier;if(!spec||!ts.isStringLiteral(spec))continue;
   if(!spec.text.startsWith('.')&&!spec.text.startsWith('@/'))continue;
   const base=spec.text.startsWith('@/')?path.resolve('src',spec.text.slice(2)):path.resolve(path.dirname(file),spec.text);
   const target=['','.ts','.tsx','/index.ts','/index.tsx'].map(ext=>base+ext).find(f=>nodes.has(f));if(!target)continue;
   all.push(target);
   const clause=statement.importClause;
   const erased=statement.isTypeOnly||clause?.isTypeOnly||(clause&&!clause.name&&clause.namedBindings&&ts.isNamedImports(clause.namedBindings)&&clause.namedBindings.elements.every(e=>e.isTypeOnly));
   if(!erased)values.push(target);
  }
  graph.set(file,all);runtime.set(file,values);
 }
 const seen=new Set(),stack=new Set();
 function visit(file){if(seen.has(file))return;assert.ok(!stack.has(file),`Source cycle: ${file}`);stack.add(file);for(const next of graph.get(file)||[])visit(next);stack.delete(file);seen.add(file);}
 for(const file of nodes)visit(file);
 for(const root of nodes){
  if(!/^\s*["']use client["']/.test(read(root)))continue;
  const pending=[root],visited=new Set();
  while(pending.length){const file=pending.pop();if(visited.has(file))continue;visited.add(file);
   assert.doesNotMatch(read(file),/import ["']server-only["']|from ["']node:/,`Browser ${root} reaches ${file}`);
   assert.doesNotMatch(file,/\/infrastructure\/persistence\/postgres\//);
   pending.push(...runtime.get(file)||[]);
  }
 }
});
