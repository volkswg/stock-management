import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
export const externalBefore=JSON.parse(readFileSync('tests/fixtures/external-infrastructure-before.json','utf8'));
export function externalGraph({original=false,globals={}}={}){
 const cache=new Map();
 function load(file){if(cache.has(file))return cache.get(file);assert.ok(Object.hasOwn(externalBefore.files,file)||/^src\/infrastructure\/external\/(?:line|loyverse)\/(?:index|types|const|LineBotService|LoyverseService|createLoyverseServiceFromConfig)\.ts$/.test(file)||['src/shared/types/line-protocol.ts','src/shared/lib/line-messages.ts'].includes(file),`Unapproved external dependency ${file}`);
 const source=original&&externalBefore.files[file]?externalBefore.files[file].source:readFileSync(file,'utf8'),exports={};cache.set(file,exports);const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,Buffer,Uint8Array,URL,URLSearchParams,Response,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){if(spec==='node:crypto')return crypto;let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';return load(target);}});return exports;}
 return {load,cache};
}
