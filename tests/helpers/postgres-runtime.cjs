/* eslint-disable @typescript-eslint/no-require-imports -- Isolated CJS loader must install the TypeScript require hook before loading actual owners. */
// Actual current TypeScript owners, real pg driver, synthetic test credentials.
// No historical overlays or application substitutes are used by PG integration.
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const resolve = Module._resolveFilename, load = Module._load;
Module._resolveFilename = function(spec, parent, ...rest) {
  if (spec.startsWith('@/')) spec = path.resolve('src',spec.slice(2));
  return resolve.call(this,spec,parent,...rest);
};
Module._load = function(spec, ...args) { if (spec === 'server-only') return {}; return load.call(this,spec,...args); };
require.extensions['.ts'] = function(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename}).outputText;
  module._compile(output,filename);
};
