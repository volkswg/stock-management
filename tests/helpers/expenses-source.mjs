import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const allowed=new Set(['src/services/expenses/manageExpenses.ts','src/services/expenses/types.ts','src/services/expenses/index.ts',...['contracts.ts','server.ts','application/manage-expenses.ts','domain/rules.ts','infrastructure/google-sheets/expense-store.ts','infrastructure/google-sheets/expenses/const.ts'].map(f=>'src/modules/expenses/'+f)]);
// Exact source closure for earlier characterization tests; no configuration/provider IO.
export function loadExpenseSource(file,{imports={},globals={}}={}){
 const cache=new Map();function load(file){assert.ok(allowed.has(file),`Unapproved Expense source ${file}`);if(cache.has(file))return cache.get(file);
  const exports={},code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;cache.set(file,exports);
  new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){if(spec==='server-only')return {};if(spec==='node:crypto'){assert.ok(imports[spec]);return imports[spec];}
   if(spec==='./expenses/const'&&imports['./types'])return imports['./types'];
   let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';return load(target);
  }});return exports;
 }return load(file);
}
