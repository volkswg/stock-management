import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {postgresHistory,postgresNewFiles,postgresHash} from './helpers/postgres-history.mjs';

test('Phase 2 history keeps every original route handler body byte-identical behind the actual wrapper',()=>{
 for(const [file,entry] of Object.entries(postgresHistory.edits)){
  assert.equal(postgresHash(entry.before),entry.beforeHash,file);
  const current=readFileSync(file,'utf8');assert.equal(postgresHash(current),entry.afterHash,file);
  if(file.startsWith('src/app/api/')){
   const methods=[...entry.before.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)].map(m=>m[1]);
   let expected=entry.before;
   for(const method of methods)expected=expected.replace(`export async function ${method}(`,`async function ${method}Operation(`);
   expected='import { withPersistence } from "@/composition/postgres/route";\n'+expected+'\n'+methods.map(m=>`export const ${m} = withPersistence(${m}Operation${file==='src/app/api/line/webhook/route.ts'?', { lineWebhook: true }':''});\n`).join('');
   assert.equal(current,expected,file);
  }
 }
});

test('all new PostgreSQL source paths are explicitly inventoried and server-only; all feature applications and rules remain outside the change',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
 assert.deepEqual(walk('src').filter(f=>f.includes('/postgres/')&&f.endsWith('.ts')).sort(),postgresNewFiles.toSorted());
 for(const file of postgresNewFiles){
  const source=readFileSync(file,'utf8');
  assert.equal(postgresHash(source),postgresHistory.newFiles[file],file);
  assert.match(source,/import "server-only";/,file);
  if(file.startsWith('src/infrastructure/'))assert.doesNotMatch(source,/from ["']@\/modules\//,file);
 }
 assert.ok(Object.keys(postgresHistory.edits).every(file=>!file.includes('/domain/')&&!file.includes('/application/')));
});

test('storage dependencies are pinned without replacing existing dependencies or adding a second lockfile',()=>{
 const before=JSON.parse(postgresHistory.edits['package.json'].before),current=JSON.parse(readFileSync('package.json','utf8'));
 assert.equal(current.dependencies.pg,'8.16.3');assert.equal(current.devDependencies['@types/pg'],'8.15.5');
 delete current.dependencies.pg;delete current.devDependencies['@types/pg'];assert.deepEqual(current,before);
 assert.equal(existsSync('package-lock.json'),false);
 const lock=readFileSync('yarn.lock','utf8');
 for(const entry of postgresHistory.edits['yarn.lock'].before.trim().split('\n\n').slice(1))assert.ok(lock.includes(entry),entry.slice(0,100));
});

test('existing factory, LINE composition and layout changes are limited to explicit storage selection',()=>{
 const factory='src/composition/google-sheets/createGoogleSheetsServiceFromConfig.ts';
 const prefix='import { storageMode } from "@/infrastructure/persistence/postgres/database";\nimport { createPostgresService } from "../postgres/service";\nimport type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";\n';
 assert.equal(readFileSync(factory,'utf8'),prefix+postgresHistory.edits[factory].before.replace('): GoogleSheetsService {','): IGoogleSheetsService {\n  if (storageMode() === "supabase") return createPostgresService();'));
 const line='src/modules/line-workflows/server.ts';
 const linePrefix='import { storageMode } from "@/infrastructure/persistence/postgres/database";\nimport { processPostgresWebhook } from "./infrastructure/postgres/webhook";\n';
 assert.equal(readFileSync(line,'utf8'),linePrefix+postgresHistory.edits[line].before.replace('}) { return processWebhookEvents({ events, lineBotService, getContext:', '}) { return (storageMode() === "supabase" ? processPostgresWebhook : processWebhookEvents)({ events, lineBotService, getContext:'));
 const layout='src/app/layout.tsx';
 assert.equal(readFileSync(layout,'utf8'),'import Script from "next/script";\n'+postgresHistory.edits[layout].before.replace('      <body>','      <body>\n        {process.env.STOCK_STORAGE === "supabase" && <Script src="/stock-staging-operations.js" strategy="beforeInteractive" />}'));
});
