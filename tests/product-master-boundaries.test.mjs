import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ESLint} from 'eslint';
import {productHistory,productNewFiles,restoreProductSource} from './helpers/product-master-history.mjs';
import {currentSourceFiles} from './helpers/retirement-history.mjs';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';
import {routeContracts} from './helpers/routes.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('Product Master has an exact additive source/route inventory, unchanged historical fixtures and bounded original-source witnesses',()=>{
 const actual=currentSourceFiles('src').filter(file=>productNewFiles.includes(file)).sort();assert.deepEqual(actual,productNewFiles);
 for(const [file,expected]of Object.entries(productHistory.newHashes))assert.equal(hash(readFileSync(file)),expected,file);
 for(const [file,expected]of Object.entries(productHistory.fixtureHashes))assert.equal(hash(readFileSync(file)),expected,file);
 assert.equal(Object.keys(productHistory.fixtureHashes).length,45);
 for(const [file,edit]of Object.entries(productHistory.edits))assert.equal(hash(restoreProductSource(file)),edit.beforeHash,file);
 const old=JSON.parse(readFileSync('tests/fixtures/route-contracts.json','utf8')),routes=routeContracts(),names=new Set(productHistory.newRoutes.map(route=>route.file));
 assert.deepEqual(routes.filter(route=>!names.has(route.file)),old);assert.deepEqual(routes.filter(route=>names.has(route.file)),productHistory.newRoutes);
 assert.equal(routes.filter(route=>route.kind==='page').length,23);assert.equal(routes.filter(route=>route.kind==='api').length,42);
});
test('physical new runtime/type/browser graphs remain acyclic, provider-free in clients and without new private module edges',()=>{
 const g=userStateGraph();for(const types of [false,true]){g.modules(types);const seen=new Set(),active=[];function visit(file){assert.ok(!active.includes(file),[...active,file].join(' -> '));if(seen.has(file))return;active.push(file);g.deps(file,types).forEach(visit);active.pop();seen.add(file);}g.all.forEach(visit);
 for(const root of g.all.filter(file=>/^\s*["']use client["']/.test(readFileSync(file,'utf8'))))assert.equal(g.trace(root,types,file=>/^src\/(services|features|externals|config|composition|infrastructure)\//.test(file)||/^src\/modules\/[^/]+\/(application|infrastructure|.*server\.ts)/.test(file)),null,root);
 for(const root of ['src/modules/products/application/products.ts','src/modules/products/domain/validation.ts','src/modules/orders/application/product-links.ts'])assert.equal(g.trace(root,types,file=>/^src\/(services|config|composition|infrastructure|app)\//.test(file)||/^src\/modules\/[^/]+\/infrastructure\//.test(file)),null,root);
 }
 for(const file of productNewFiles.filter(file=>file.includes('/infrastructure/')||file.endsWith('/server.ts')||file.includes('composition/')||file.includes('config/')))assert.match(readFileSync(file,'utf8'),/^import "server-only";/,file);
});
test('real scoped ESLint rejects erased/private/provider/config/time/dynamic bypasses while retaining existing boundary scopes',async()=>{
 const eslint=new ESLint(),restricted=messages=>messages.some(message=>message.ruleId?.startsWith('no-restricted'));
 for(const filePath of ['src/modules/products/contracts.ts','src/modules/products/application/products.ts','src/modules/products/domain/validation.ts','src/modules/products/application/ports/product-store.ts','src/modules/orders/application/product-links.ts','src/modules/orders/application/ports/product-links.ts','src/modules/products/ui/ProductSelector.tsx','src/modules/orders/ui/[id]/product-picker-port.ts','src/modules/orders/infrastructure/google-sheets/product-links.ts','src/app/api/products/[id]/route.ts']){
  for(const code of ['import type {X} from "@/modules/sales/infrastructure/private";export type Y=X;','export const x=import("@/services/orders");','import type X=require("@/config");export {X};','export type X=import("@/infrastructure/persistence/google-sheets/service-contracts").IGoogleSheetsService;']){const [r]=await eslint.lintText(code,{filePath});assert.ok(restricted(r.messages),`${filePath}: ${code}`);}
 }
 for(const filePath of ['src/modules/products/application/products.ts','src/modules/products/domain/validation.ts'])for(const code of ['export const now=Date.now();','export const now=new Date();','export const rows=fetch("https://example.test");','export const secret=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;']){const [r]=await eslint.lintText(code,{filePath});assert.ok(restricted(r.messages),`${filePath}: ${code}`);}
 const [ok]=await eslint.lintText('import type {Product} from "../../contracts";export type Result=Product;',{filePath:'src/modules/products/application/ports/product-store.ts'});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));
});
