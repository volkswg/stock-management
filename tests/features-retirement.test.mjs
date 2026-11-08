import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {ESLint} from 'eslint';
import {featureFiles,featuresHistory,restoreFeatureSource} from './helpers/features-retirement-history.mjs';
import {ordersLineGraph} from './helpers/orders-line-source.mjs';
import {loadSource} from './helpers/load-source.mjs';
import {currentSourceFiles} from './helpers/retirement-history.mjs';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';
import {restoreWorkbookSource} from './helpers/loyverse-workbook-history.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
test('all seven forwards retire safely with exact canonical function/enum identities, unchanged production bodies and immutable history',()=>{
  assert.equal(existsSync('src/features'),false);assert.equal(Object.keys(featureFiles).length,7);
  const current=currentSourceFiles('src').filter(f=>!f.endsWith('.tsbuildinfo')).sort().map(file=>[file,hash(restoreWorkbookSource(file))]);
  assert.equal(current.length,featuresHistory.unchangedProduction.count);
  assert.equal(hash(JSON.stringify(current)),featuresHistory.unchangedProduction.sha256);
  for(const [file,expected]of Object.entries(featuresHistory.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
  for(const [file,edit]of Object.entries(featuresHistory.edits))assert.equal(hash(restoreFeatureSource(file)),edit.beforeHash,file);
  const graph=ordersLineGraph(),owners=new Map();
  function owner(file){if(!owners.has(file))owners.set(file,file==='src/modules/shipments/http.ts'?loadSource(file,{imports:{'./contracts':graph.load('src/modules/shipments/contracts.ts')}}):graph.load(file));return owners.get(file);}
  let runtime=0,types=0;
  for(const [file,saved]of Object.entries(featureFiles)){
    assert.equal(hash(saved.source),saved.sha256,file);
    const exports={},code=ts.transpileModule(saved.source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new vm.Script(code,{filename:file}).runInNewContext({exports,require:spec=>owner('src/'+spec.slice(2)+'.ts')});
    assert.deepEqual(Object.keys(exports),saved.runtimeKeys,file);
    for(const entry of saved.exports){if(entry.typeOnly){types++;continue;}
      const canonical=owner(entry.module)[entry.imported];assert.notEqual(canonical,undefined,entry.name);
      assert.equal(exports[entry.name],canonical,entry.name);assert.equal(exports[entry.name].prototype,canonical.prototype,entry.name);runtime++;
    }
    assert.throws(()=>loadSource(file),/Retired current source path/,file);
  }
  assert.equal(runtime,15);assert.equal(types,3);
});

test('physical runtime/type/browser graphs and alias resolution contain no retired feature modules or new cycles/private edges',()=>{
  const graph=userStateGraph(),options=ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.json',ts.sys.readFile).config,ts.sys,process.cwd()).options;
  assert.equal(graph.all.length,389);
  const aliases=JSON.parse(readFileSync('tsconfig.json','utf8')).compilerOptions.paths;
  const expected={...featuresHistory.aliasesBefore};delete expected['@/feature/*'];assert.deepEqual(aliases,expected);
  for(const file of graph.all){assert.ok(existsSync(file)&&!file.startsWith('src/features/'),file);
    for(const {fileName:spec}of ts.preProcessFile(readFileSync(file,'utf8'),true,true).importedFiles){
      assert.ok(!/(?:^|\/)features(?:\/|$)|^@\/feature\//.test(spec),`${file}: ${spec}`);
      if((spec.startsWith('@/')||spec.startsWith('.'))&&!/\.(css|svg|png|jpe?g|webp|ico)$/.test(spec))assert.ok(ts.resolveModuleName(spec,resolve(file),options,ts.sys).resolvedModule,`${file}: ${spec}`);
    }
  }
  for(const spec of ['@/feature/backend/shared/utils','@/features/backend/shared/utils'])assert.equal(ts.resolveModuleName(spec,resolve('src/probe.ts'),options,ts.sys).resolvedModule,undefined);
  for(const types of [false,true]){
    graph.modules(types);const seen=new Set(),active=[];
    function visit(file){assert.ok(!active.includes(file),[...active,file].join(' -> '));if(seen.has(file))return;active.push(file);graph.deps(file,types).forEach(visit);active.pop();seen.add(file);}graph.all.forEach(visit);
    for(const root of graph.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))))assert.equal(graph.trace(root,types,p=>/^src\/(features|externals|config|infrastructure|composition|services)\//.test(p)||/^src\/modules\/[^/]+\/(application|infrastructure|server\.ts)/.test(p)),null,root);
  }
});

test('real lint forbids retired aliases, relative/erased/dynamic/CommonJS references and physical recreation without weakening existing scopes',async()=>{
  const eslint=new ESLint(),filePath='tests/features-retirement.probe.ts';
  for(const code of [
    'import {isRecord} from "@/features/backend/shared/utils";export {isRecord};',
    'export {isRecord} from "../src/features/backend/shared/utils";',
    'export * from "@/feature/backend/shared/utils";',
    'import type {MovementImageUploadProgress} from "@/features/backend/line/services/movements";export type X=MovementImageUploadProgress;',
    'export type X=import("@/features/backend/line/utils").LineEventClassification;',
    'export const load=()=>import("@/features/backend/line/utils");',
    'export const load=()=>import(`@/features/backend/line/utils`);',
    'export const load=()=>import("@/"+"features/backend/line/utils");',
    'export const load=()=>require("@/features/backend/shared/utils");',
    'export const load=()=>require.resolve("../src/features/backend/shared/utils");',
    'import x=require("@/feature/backend/shared/utils");export {x};',
  ]){const [result]=await eslint.lintText(code,{filePath});assert.ok(result.messages.some(m=>m.ruleId==='features-retirement/imports'),code);}
  for(const code of ['export {isRecord} from "@/shared/lib/is-record";','export {parseQuantity} from "@/modules/inventory/quantity";','export type {MovementImageUploadProgress} from "@/modules/line-workflows/contracts";']){
    const [result]=await eslint.lintText(code,{filePath});assert.equal(result.errorCount,0,JSON.stringify(result.messages));
  }
  const [recreated]=await eslint.lintText('export const accidental=1;',{filePath:'src/features/probe.ts'});assert.ok(recreated.messages.some(m=>m.ruleId==='features-retirement/imports'));
});
