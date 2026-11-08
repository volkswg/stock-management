import {retirement,evidenceHost,readArchive} from "./retirement-history.mjs";
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { userStateBefore } from './user-state-worksheet-history.mjs';
const options = ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.json', ts.sys.readFile).config, ts.sys, process.cwd()).options;
export function userStateGraph(overrides = {}) {
  const host = { ...evidenceHost(ts.sys,overrides), fileExists: f => Object.hasOwn(overrides, relative(process.cwd(), f)) || (Object.keys(overrides).length>0&&Object.hasOwn(retirement.files,relative(process.cwd(),f))) || ts.sys.fileExists(f), directoryExists: d => Object.keys(overrides).some(f => resolve(f).startsWith(resolve(d) + '/')) || (Object.keys(overrides).length>0&&evidenceHost(ts.sys,overrides).directoryExists(d)) || ts.sys.directoryExists(d) };
  const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);
  const all = [...new Set([...walk("src"),...Object.keys(overrides), ...Object.values(userStateBefore.moves).map(e=>e.to).filter(existsSync)])].filter(f=>/\.tsx?$/.test(f));
  const cache = new Map();
  function deps(file, types) {
    const key = `${types}:${file}`; if (cache.has(key)) return cache.get(key);
    const source=overrides[file]??(existsSync(file)?readFileSync(file,'utf8'):readArchive(file,'utf8')), ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true), result=[];
    function add(spec, erased) { if (!types && erased) return; const r=ts.resolveModuleName(spec,resolve(file),options,host).resolvedModule?.resolvedFileName,p=r&&relative(process.cwd(),r); if(p?.startsWith('src/')&&/\.tsx?$/.test(p)) result.push(p); }
    function visit(n) {
      if ((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)) { const c=n.importClause,e=c?.namedBindings&&ts.isNamedImports(c.namedBindings)?c.namedBindings.elements:ts.isNamedExports(n.exportClause??{})?n.exportClause.elements:[]; add(n.moduleSpecifier.text,n.isTypeOnly||c?.isTypeOnly||(e?.length&&!c?.name&&e.every(x=>x.isTypeOnly))); }
      else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)) add(n.argument.literal.text,true);
      else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||n.expression.getText(ast)==='require')&&ts.isStringLiteral(n.arguments[0]??{})) add(n.arguments[0].text,false);
      else if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression) add(n.moduleReference.expression.text,n.isTypeOnly);
      ts.forEachChild(n,visit);
    }visit(ast);cache.set(key,result);return result;
  }
  function trace(root, types, match) { const seen=new Set();function visit(file,path){if(seen.has(file))return;seen.add(file);if(match(file))return [...path,file];for(const dep of deps(file,types)){const p=visit(dep,[...path,file]);if(p)return p;}}return visit(root,[])??null; }
  function modules(types) { const seen=new Set(),active=[],edges=new Set();function visit(file,from){assert.ok(!active.includes(file),`Cycle: ${[...active,file].join(' -> ')}`);const owner=/^src\/modules\/([^/]+)\//.exec(file)?.[1]??from;if(from&&owner!==from)edges.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);deps(file,types).forEach(dep=>{const next=/^src\/modules\/([^/]+)\//.exec(dep)?.[1];if(file.includes('/user-state/')&&next&&owner!==next)assert.fail(`${owner}->${next}: worksheet depends on feature composition`);if(owner&&next&&owner!==next)assert.ok(/^src\/modules\/[^/]+\/(?:contracts|server|status|quantity)\.ts$/.test(dep)||owner==='line-workflows'&&dep==='src/modules/orders/rules.ts'||owner==='shipments'&&['src/modules/orders/application/ports/order-detail-shipment-projection.ts','src/modules/orders/ui/OrderImageGallery.tsx'].includes(dep),`${owner}->${next}: private cross-feature dependency ${file} -> ${dep}`);visit(dep,owner);});active.pop();seen.add(key);}all.filter(f=>f.startsWith('src/modules/')).forEach(f=>visit(f));assert.deepEqual([...edges].sort(),types?['hr->expenses','inventory->hr','inventory->sales','line-workflows->inventory','line-workflows->orders','sales->expenses','shipments->orders']:['inventory->hr','inventory->sales','line-workflows->inventory','line-workflows->orders','shipments->orders']);return [...edges]; }
  return {all,deps,trace,modules};
}
