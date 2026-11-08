import {sheetsPersistenceStub} from "./sheets-persistence-stub.mjs";
import {canonicalPath} from "./retirement-history.mjs";
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
export const cleanupBefore = JSON.parse(readFileSync('tests/fixtures/final-cleanup-before.json', 'utf8'));
export function evaluateCleanup(file, { original = false, imports = {}, globals = {} } = {}) {
    if(!original)file=canonicalPath(file);
    const source = original ? cleanupBefore.files[file].source : readFileSync(file, 'utf8'), exports = {};
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new vm.Script(code, { filename: file }).runInNewContext({ exports, Error, Date, Buffer, URL, URLSearchParams, Uint8Array, Response, fetch: () => assert.fail('Live IO forbidden'), ...globals, require(spec) { const storageStub=sheetsPersistenceStub(spec);if(storageStub)return storageStub; if (Object.hasOwn(imports, spec))
            return imports[spec]; let to = spec.startsWith('@/') ? 'src/' + spec.slice(2) : posix.normalize(posix.dirname(file) + '/' + spec); if (!to.endsWith('.ts'))
            to += existsSync(to + '.ts') ? '.ts' : '/index.ts'; return evaluateCleanup(to, { imports, globals }); } });
    return exports;
}
