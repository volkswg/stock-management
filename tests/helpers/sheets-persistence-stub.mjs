import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// Execute the actual pure reference bridge in every legacy characterization.
// This adds one exact dependency, not a provider or configuration escape hatch.
export const recordReferences={};
new vm.Script(ts.transpileModule(readFileSync('src/infrastructure/persistence/google-sheets/record-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({exports:recordReferences,Error,require:spec=>spec==='server-only'?{}:assert.fail('Unexpected record-reference dependency: '+spec)});
// Closed legacy characterizations explicitly select Sheets. PostgreSQL and the
// actual request wrapper are executed separately by the real-DB test harness.
export function sheetsPersistenceStub(spec) {
 if(spec==='@/infrastructure/persistence/google-sheets/record-reference')return recordReferences;
 if(spec==='@/composition/postgres/route')return {withPersistence:handler=>handler,assertProductionLineCutoff:()=>{}};
 if(spec==='@/infrastructure/persistence/postgres/database')return {storageMode:()=> 'google-sheets'};
 if(spec==='../postgres/service')return {createPostgresService:()=>{throw new Error('Use the PostgreSQL harness');}};
 if(spec==='./infrastructure/postgres/webhook')return {processPostgresWebhook:()=>{throw new Error('Use the PostgreSQL harness');}};
}
