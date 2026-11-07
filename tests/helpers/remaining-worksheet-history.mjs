import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const remainingBefore=JSON.parse(readFileSync('tests/fixtures/remaining-worksheets-before.json','utf8'));
export const remainingFiles=new Set([...Object.keys(remainingBefore.moves),...Object.keys(remainingBefore.splits),...Object.keys(remainingBefore.edits)]);
export const expenseRecords='src/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet.ts';
export const remainingDestinations=[...Object.values(remainingBefore.moves).map(e=>e.to),...Object.values(remainingBefore.splits).map(e=>e.to),expenseRecords];
export function assertRemainingHistory(file,expected){
 const e=remainingBefore.moves[file]??remainingBefore.splits[file]??remainingBefore.edits[file];assert.ok(e,file);let witness=e.source;
 if(e.sha256!==expected){const earlier=JSON.parse(readFileSync('tests/fixtures/inventory-employee-directory-before.json','utf8')).files[file];assert.ok(earlier,file);for(const change of earlier.changes.toReversed()){assert.equal(witness.split(change.to).length,2,file);witness=witness.replace(change.to,change.from);}assert.equal(witness,earlier.source,file);}
 assert.equal(createHash('sha256').update(witness).digest('hex'),expected,file);
 if(e.after){
  const split=remainingBefore.splits['src/services/stock-adjustments/types.ts'];
  const exact=file===split.contracts?e.source+'\n'+split.contractDeclarations:e.source.replace('"@/services/stock-adjustments/types"','"@/modules/inventory/contracts"');
  assert.equal(e.after,exact,file);assert.equal(readFileSync(file,'utf8'),exact,file);return;
 }
 if(e.export){let restored=readFileSync(e.to,'utf8');for(const [a,b]of Object.entries(e.imports)){assert.equal(restored.split('"'+b+'"').length,2);restored=restored.replace('"'+b+'"','"'+a+'"');}assert.equal(restored,e.source,file);const owner=file.includes('/expenses/')?expenseRecords:e.to;assert.equal(readFileSync(file,'utf8'),`export { ${e.export} } from "@/${owner.slice(4,-3)}";\n`);}
 else{const declarations=e.names.map(name=>e.source.match(new RegExp('export const '+name+' = .*;\\n'))[0]);assert.equal(readFileSync(e.to,'utf8'),declarations.join(''));if(e.contracts){assert.equal(readFileSync(e.contracts,'utf8'),remainingBefore.edits[e.contracts].source+'\n'+e.contractDeclarations);assert.equal(readFileSync(file,'utf8'),`export { ADJUSTMENT_HEADERS } from "@/${e.to.slice(4,-3)}";\nexport { ADJUSTMENT_REASONS } from "@/modules/inventory/contracts";\nexport type { AdjustmentReason, StockAdjustment, AdjustmentEmployee } from "@/modules/inventory/contracts";\n`);return;}
 let original=e.source;for(const d of declarations)original=original.replace(d,'');const alias='@/'+e.to.slice(4,-3);const prefix=(file.includes('manageSalaryAdvances')?`import { ${e.names.join(', ')} } from "${alias}";\n`:'')+`export { ${e.names.join(', ')} } from "${alias}";\n`;assert.equal(readFileSync(file,'utf8'),prefix+original,file);}
}
