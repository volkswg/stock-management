import {sheetsPersistenceStub} from "./sheets-persistence-stub.mjs";
import {featureFiles} from "./features-retirement-history.mjs";
import {resolveEvidence} from "./retirement-history.mjs";
import {canonicalPath} from "./retirement-history.mjs";
import {legacySpecifier} from "./cleanup-history.mjs";
import {loadInventorySource}from "./inventory-source.mjs";
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{posix}from'node:path';import vm from'node:vm';import ts from'typescript';import{googleGraph}from'./google-infrastructure.mjs';
export const ordersLineBefore=JSON.parse(readFileSync('tests/fixtures/orders-line-before.json','utf8'));
import {orderMutationOwners,lineWorkflowOwners} from './orders-line-ownership.mjs';
export {orderMutationOwners,lineWorkflowOwners} from './orders-line-ownership.mjs';
const previous=['contracts.ts','server.ts','application/create-order.ts','application/list-orders.ts','application/get-order-detail.ts','application/ports/created-order-writer.ts','application/ports/order-list-reader.ts','application/ports/order-detail-reader.ts','application/ports/order-detail-shipment-projection.ts','infrastructure/google-sheets/order-writer.ts','infrastructure/google-sheets/order-list-reader.ts','infrastructure/google-sheets/order-detail-reader.ts','infrastructure/google-sheets/order-row-mapping.ts'].map(f=>'src/modules/orders/'+f);
const extra=['src/composition/orders.ts','src/services/shipments/types.ts','src/infrastructure/persistence/google-sheets/read-and-repair-rows.ts','src/modules/orders/rules.ts','src/modules/shipments/status.ts','src/modules/shipments/contracts.ts','src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts','src/services/orders/index.ts','src/services/orders/createOrder.ts','src/services/orders/listOrders.ts','src/services/orders/OrderItemQuantityType.ts','src/shared/types/line-protocol.ts','src/shared/lib/line-messages.ts','src/shared/lib/is-record.ts'];
export function ordersLineGraph({original=false,imports={},globals={},overrides={},createId=()=>assert.fail('Provide a synthetic identifier')}={}){
 const provider=googleGraph(),cache=new Map(),allowed=new Set([...Object.keys(ordersLineBefore.files).map(canonicalPath),...orderMutationOwners,...lineWorkflowOwners,...previous,...extra]);
 const inventoryGraph=loadInventorySource(null,{globals,imports});
 function load(file){if(!original)assert.ok(!featureFiles[file],`Retired current feature path: ${file}`);if(file==="src/services/movements/worksheet-schema.ts")return inventoryGraph.load(canonicalPath(file));if(Object.hasOwn(overrides,file))return overrides[file];if(cache.has(file))return cache.get(file);assert.ok(allowed.has(file),`Unapproved Orders/LINE source ${file}`);const source=original&&ordersLineBefore.files[file]?ordersLineBefore.files[file].source:(featureFiles[file]?.source??readFileSync(file,'utf8')),exports={};cache.set(file,exports);const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,Buffer,File,URL,URLSearchParams,Request,Response,fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){ const storageStub=sheetsPersistenceStub(spec);if(storageStub)return storageStub;
  if(spec==='@/infrastructure/persistence/postgres/database')return {storageMode:()=>"google-sheets"};
  if(spec==='./infrastructure/postgres/webhook')return {processPostgresWebhook:()=>assert.fail('Supabase path requires the real PostgreSQL harness')};

  if(Object.hasOwn(imports,spec))return imports[spec];if(Object.hasOwn(imports,legacySpecifier(spec)))return imports[legacySpecifier(spec)];const oldExternal=spec.replace('@/infrastructure/external/','@/externals/');if(oldExternal!==spec&&Object.hasOwn(imports,oldExternal))return imports[oldExternal];if(spec==='server-only')return {};if(legacySpecifier(spec)==='@/externals/google/sheet')return provider.registry();if(legacySpecifier(spec)==='@/externals/line')return {...load("src/shared/types/line-protocol.ts"),...load("src/shared/lib/line-messages.ts")};
  let target=spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec);target=resolveEvidence(target);
  if(target.startsWith('src/modules/inventory/')||target==='src/services/movements/worksheet-schema.ts')return inventoryGraph.load(canonicalPath(target));
  if((target==='src/services/utils/createSortableId.ts'||target==='src/infrastructure/runtime/create-sortable-id.ts'))return {createSortableId:createId};
  if(target==='src/modules/line-workflows/infrastructure/google-sheets/user-state/const.ts'||target==='src/externals/google/sheet/const.ts'||target==='src/externals/google/sheet/sheets/user-state/const.ts'||target==='src/infrastructure/persistence/google-sheets/const.ts'||/^src\/(?:externals\/google\/sheet\/sheets|modules\/orders\/infrastructure\/google-sheets)\/(?:orders|order-items|order-bills)\/const\.ts$/.test(target))return provider.load(canonicalPath(target));
  return load(canonicalPath(target));
 }});return exports;}return {load,provider,cache};
}
