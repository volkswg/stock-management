import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative, resolve} from 'node:path';
import ts from 'typescript';
import {ESLint} from 'eslint';
import {retirement, currentSourceFiles, restoreRetirementSource} from './helpers/retirement-history.mjs';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
test('retirement removes all 65 compatibility files, preserves every inherited fixture and changes only the audited production imports', () => {
  assert.equal(existsSync('src/externals'), false);
  assert.equal(Object.keys(retirement.files).length, 65);
  const expected = [...Object.keys(retirement.productionHashes).filter(f => !retirement.files[f]), retirement.contract].sort();
  assert.deepEqual(currentSourceFiles('src').filter(f => !f.endsWith('.tsbuildinfo')).sort(), expected);
  for (const [file, beforeHash] of Object.entries(retirement.productionHashes)) {
    assert.equal(hash(restoreRetirementSource(file)), beforeHash, file);
  }
  for (const [file, beforeHash] of Object.entries(retirement.fixtureHashes)) {
    assert.equal(hash(readFileSync(file)), beforeHash, file);
  }
  const contract = readFileSync(retirement.contract, 'utf8');
  assert.equal(contract, retirement.files['src/externals/google/sheet/types.ts'].source);
  assert.equal(ts.transpileModule(contract, {compilerOptions: {module: ts.ModuleKind.ESNext}}).outputText.trim(), 'export {};');
});

test('physical current runtime/type graphs resolve canonical modules without archived files, retain public feature directions and keep browsers provider-free', () => {
  const graph = userStateGraph();
  assert.equal(graph.all.length, 393);
  assert.ok(graph.all.every(f => existsSync(f) && !f.startsWith(retirement.prefix)));
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.json', ts.sys.readFile).config, ts.sys, process.cwd()).options;
  for (const file of graph.all) {
    const source = readFileSync(file, 'utf8'), info = ts.preProcessFile(source, true, true);
    for (const spec of info.importedFiles.map(i => i.fileName).filter(s => s.startsWith('@/') || s.startsWith('.'))) {
      assert.ok(!/(?:^|\/)externals(?:\/|$)/.test(spec), `${file}: ${spec}`);
      const resolved = ts.resolveModuleName(spec, resolve(file), options, ts.sys).resolvedModule?.resolvedFileName;
      // CSS and Next's static asset imports have their existing bundler declarations.
      if (!/\.(css|svg|png|jpe?g|webp|ico)$/.test(spec)) assert.ok(resolved && existsSync(resolved), `${file}: unresolved ${spec}`);
      if (resolved) assert.ok(!relative(process.cwd(), resolved).startsWith(retirement.prefix));
    }
  }
  for (const types of [false, true]) {
    graph.modules(types);
    const seen = new Set(), active = [];
    function visit(file) {
      assert.ok(!active.includes(file), [...active, file].join(' -> '));
      if (seen.has(file)) return;
      active.push(file); graph.deps(file, types).forEach(visit); active.pop(); seen.add(file);
    }
    graph.all.forEach(visit);
    for (const file of graph.all.filter(f => /^src\/(infrastructure|shared)\//.test(f))) {
      assert.equal(graph.trace(file, types, p => /^src\/(modules|composition)\//.test(p)), null, file);
    }
    for (const root of graph.all.filter(f => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')))) {
      assert.equal(graph.trace(root, types, p => /^src\/(services|externals|infrastructure|composition|config)\//.test(p)
        || /^src\/modules\/[^/]+\/(application|infrastructure|server\.ts)/.test(p)), null, root);
    }
  }
});

test('retirement lint forbids alias, relative, erased, dynamic, CommonJS and folded imports while the pure service contract rejects runtime/provider bypasses', async () => {
  const eslint = new ESLint();
  const forbidden = [
    'import {Client} from "@/externals/google/sheet"; console.log(Client);',
    'export {Client} from "../src/externals/google/sheet";',
    'export * from "@/externals/line";',
    'import type {IGoogleSheetsService} from "@/externals/google/sheet/types"; export type S=IGoogleSheetsService;',
    'export type S=import("@/externals/line/types").ILineBotService;',
    'export const load=()=>import("@/externals/loyverse");',
    'export const load=()=>import(`@/externals/line`);',
    'export const load=()=>import("@/"+"externals/line");',
    'export const load=()=>require("@/externals/line");',
    'export const load=()=>require.resolve("../src/externals/line");',
    'import client = require("@/externals/line"); export {client};',
  ];
  for (const code of forbidden) {
    const [result] = await eslint.lintText(code, {filePath:'tests/retirement-probe.ts'});
    assert.ok(result.messages.some(m => m.ruleId === 'retirement/no-legacy-import'), code);
  }
  for (const code of [
    'export const value=1;',
    'export class Service {}',
    'export * from "@/infrastructure/persistence/google-sheets/types";',
    'export type S=import("@/composition/google-sheets").GoogleSheetsService;',
    'export const load=()=>import("@/composition/google-sheets");',
  ]) {
    const [result] = await eslint.lintText(code, {filePath:retirement.contract});
    assert.ok(result.messages.some(m => m.ruleId === 'retirement/pure-service-contracts'), code);
  }
  const [valid] = await eslint.lintFiles([retirement.contract]);
  assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages));
  const [recreated] = await eslint.lintText('export type Empty=never;', {filePath:'src/externals/probe.ts'});
  assert.ok(recreated.messages.some(m => m.ruleId === 'retirement/no-legacy-import'));
});
