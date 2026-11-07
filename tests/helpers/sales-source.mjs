import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
export const salesOwners=['server.ts','contracts.ts','application/reports.ts','application/ports/sales-reader.ts','application/sync-receipts.ts','application/ports/receipt-sync.ts','application/ports/receipt-source.ts','application/receipts-for-date.ts','application/cost-overrides.ts','application/ports/cost-overrides.ts','application/sync-status.ts','application/ports/sync-status.ts','domain/receipt-ids.ts','infrastructure/google-sheets/sales-reader.ts','infrastructure/google-sheets/receipt-sync.ts','infrastructure/google-sheets/receipt-row-mapping.ts','infrastructure/google-sheets/cost-overrides.ts','infrastructure/google-sheets/sync-status.ts'].map(f=>'src/modules/sales/'+f);
const headers={receipts:'SALES_RECEIPT_HEADERS','receipt-items':'SALES_RECEIPT_ITEM_HEADERS','receipt-payments':'SALES_RECEIPT_PAYMENT_HEADERS','receipt-syncs':'SALES_RECEIPT_SYNC_HEADERS','profit-cost-overrides':'SALES_PROFIT_COST_OVERRIDE_HEADERS'};
const legacy=['getGoogleSheetsDailySales','syncLoyverseDailySales','getLoyverseReceiptsForSalesDate','idBuilders','rowMappers','listSalesSyncStatus','manageSalesProfitCostOverrides','index'].map(f=>'src/services/sales/'+f+'.ts');
const allowed=new Set([...salesOwners,...legacy,...Object.keys(headers).map(f=>'src/modules/sales/infrastructure/google-sheets/'+f+'/const.ts')]);
export function loadSalesSource(entry,{imports={},globals={},originals={}}={}){
 const cache=new Map();function load(file){assert.ok(allowed.has(file),`Unapproved Sales source ${file}`);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const source=originals[file]?.source??originals[file]??readFileSync(file,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,URL,URLSearchParams,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){
  if(Object.hasOwn(imports,spec))return imports[spec];if(spec==='server-only')return {};if(spec==='node:crypto')return {randomUUID:()=>assert.fail('Provide a synthetic ID')};
  let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target+=existsSync(target+'.ts')?'.ts':'/index.ts';
  const folder=/google-sheets\/([^/]+)\/const\.ts$/.exec(target)?.[1],name=headers[folder];if(name&&imports['@/externals/google/sheet']?.[name])return {[name]:imports['@/externals/google/sheet'][name]};
  return load(target);
 }});return exports;}return load(entry);
}
