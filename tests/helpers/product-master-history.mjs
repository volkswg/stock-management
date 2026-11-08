import {routeContracts} from "./routes.mjs";
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const productHistory=JSON.parse(readFileSync('tests/fixtures/product-master-before.json','utf8'));
export const productNewFiles=productHistory.newFiles;
const hash=value=>createHash('sha256').update(value).digest('hex');
// Only historical source assertions receive these exact, bounded inverses.
// Current executable loaders, independent graphs and UI use physical source.
export function restoreProductSource(file,source=readFileSync(file,'utf8')){
 const edit=productHistory.edits[file];if(!edit)return source;
 const current=readFileSync(file,'utf8');assert.equal(hash(current),edit.afterHash,file);
 let restored=current;
 for(const change of edit.changes.toReversed()){
  assert.equal(restored.slice(change.afterStart,change.afterStart+change.after.length),change.after,file);
  restored=restored.slice(0,change.afterStart)+change.before+restored.slice(change.afterStart+change.after.length);
 }
 assert.equal(hash(restored),edit.beforeHash,file);
 return source===current?restored:source;
}

// Keep historical 23-page/35-API assertions verbatim, while checking the exact
// authorized additions before projecting the old route inventory.
export function legacyRouteContracts(){
 const routes=routeContracts(),added=new Set(productHistory.newRoutes.map(route=>route.file));
 assert.deepEqual(routes.filter(route=>added.has(route.file)),productHistory.newRoutes);
 return routes.filter(route=>!added.has(route.file));
}
