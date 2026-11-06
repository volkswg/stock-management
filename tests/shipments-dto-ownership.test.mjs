import { worksheetFiles, worksheetDestinations, assertWorksheetHistory } from "./helpers/worksheet-history.mjs";
import { sheetTypeFiles, assertOrdersSheetTypeHistory } from "./helpers/orders-sheet-type-history.mjs";
import { googleFiles, googleDestinations, assertGoogleHistory } from "./helpers/google-infrastructure.mjs";
import { shipmentHttpFiles, assertShipmentHttpHistory } from "./helpers/shipments-http-history.mjs";
import { shipmentValidationFile, assertShipmentValidationImportHistory } from "./helpers/shipments-validation-history.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { dtoBefore,dtoHash,dtoParse,dtoPrint,dtoContract,dtoLegacy,currentDtoDeclarations,assertShipmentDtoHistory,dtoPureGraph } from "./helpers/shipments-dto-history.mjs";
import { shipmentServices } from "./helpers/shipments.mjs";
import { routeContracts } from "./helpers/routes.mjs";
import { browserOwnership,ownershipEdges } from "./helpers/browser-ownership.mjs";
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);

test("all eight DTO declarations occur exactly once in production, verbatim in module contracts with original declaration order and AST hashes",()=>{
  const found=[];
  for(const file of walk("src").filter(f=>/\.tsx?$/.test(f))){const source=dtoParse(file);function visit(node){if(ts.isTypeAliasDeclaration(node)&&Object.hasOwn(dtoBefore.dtos,node.name.text))found.push([file,node.name.text]);ts.forEachChild(node,visit);}visit(source);}
  assert.deepEqual(found,dtoBefore.dtoOrder.map(name=>[dtoContract,name]));
  assert.ok(currentDtoDeclarations().every(d=>d.file===dtoContract));
  assert.equal(dtoParse(dtoLegacy).statements.filter(ts.isTypeAliasDeclaration).length,0);
  assertShipmentDtoHistory();
});

test("DTO erasure leaves only original enum exports; legacy direct/barrel/server operations and error class retain runtime identities",()=>{
  const {load,services}=shipmentServices(),physical=load("src/modules/shipments/status.ts"),server=load("src/modules/shipments/server.ts");
  for(const [file,names]of [[dtoContract,dtoBefore.runtime.public],[dtoLegacy,dtoBefore.runtime.legacy],["src/services/shipments/index.ts",dtoBefore.runtime.barrel]]){
    const loaded=load(file);assert.deepEqual(Object.keys(loaded),names);assert.equal(loaded.ShipmentStatus,physical.ShipmentStatus);assert.equal(load(file),loaded);
  }
  for(const name of ["createShipment","listShipments","getShipmentDetail","linkOrderToShipment","updateShipmentStatus"]){assert.equal(services[name],server[name],name);}
  assert.equal(services.linkOrderToShipment,load("src/services/shipments/linkOrderToShipment.ts").linkOrderToShipment);
  assert.equal(services.updateShipmentStatus,load("src/services/shipments/updateShipmentStatus.ts").updateShipmentStatus);
  assert.equal(services.LinkOrderToShipmentError,load("src/modules/shipments/application/link-order-to-shipment.ts").LinkOrderToShipmentError);
  const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  assert.equal(compile(readFileSync(dtoContract,"utf8")),compile('import { ShipmentStatus } from "./status";\nexport { ShipmentStatus };'));
  const graph=dtoPureGraph();graph.load(dtoLegacy);graph.load(dtoContract);graph.load("src/modules/shipments/status.ts");assert.equal(graph.evaluations.filter(f=>f.endsWith("/status.ts")).length,1);
});

test("two exact production edits and chained PR15/PR16 history preserve every earlier fixture, route and enum/provider/browser byte",()=>{
  assertShipmentDtoHistory();
  const changed=Object.entries(dtoBefore.productionHashes).filter(([file,hash])=>{if(worksheetFiles.has(file)){assertWorksheetHistory(file,hash);return false;}if(sheetTypeFiles.has(file)){assertOrdersSheetTypeHistory(file,hash);return false;}if(googleFiles.has(file)){assertGoogleHistory(file,hash);return false;}if(shipmentHttpFiles.has(file)){assertShipmentHttpHistory(file,hash);return false;}if(file===shipmentValidationFile){assertShipmentValidationImportHistory(file,hash);return false;}return dtoHash(readFileSync(file))!==hash;}).map(([file])=>file).sort();
  assert.deepEqual(changed,[dtoContract,dtoLegacy].sort());
  assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(dtoBefore.productionHashes,f)&&!googleDestinations.includes(f)&&!worksheetDestinations.includes(f)),[]);
  for(const [file,hash]of Object.entries(dtoBefore.fixtureHashes))assert.equal(dtoHash(readFileSync(file)),hash,file);
  assert.deepEqual(routeContracts(),dtoBefore.routeContracts);assert.equal(routeContracts().filter(r=>r.kind==="page").length,23);assert.equal(routeContracts().filter(r=>r.kind==="api").length,35);
  const old=JSON.parse(readFileSync("tests/fixtures/shipments-enum-before.json","utf8"));
  const restored=dtoBefore.sources[dtoContract].source.replace('export { ShipmentStatus } from "./status";','export { ShipmentStatus } from "@/services/shipments/types";');
  assert.equal(restored,old.sources[dtoContract].source);assert.equal(dtoHash(restored),"77753cb8809856586d5399999b7be5ca5ca8983a8e67897391b976cac2aacd78");
  for(const source of currentDtoDeclarations())assert.equal(dtoPrint(source.node,source.source),old.dtos[source.node.name.text].ast);
});

const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
function edges(file,types){return dtoParse(file).statements.flatMap(n=>{
  if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];
  const c=n.importClause,b=c?.namedBindings,e=b&&ts.isNamedImports(b)?b.elements:undefined;
  const erased=!!(n.isTypeOnly||c?.isTypeOnly||(e?.length&&!c.name&&e.every(v=>v.isTypeOnly)));
  if(!types&&erased)return [];
  const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;
  if(!target)return [];const f=relative(process.cwd(),target).replaceAll("\\","/");return f.startsWith("src/")?[{target:f,erased}]:[];
});}
for(const types of [false,true])test(`resolved DTO/feature/browser graphs remove legacy reverse edge and remain acyclic (${types?"runtime plus erased types":"runtime"})`,()=>{
  assert.deepEqual(edges("src/modules/shipments/status.ts",types),[]);
  assert.deepEqual(edges(dtoContract,types),types?[{target:"src/modules/orders/contracts.ts",erased:true},{target:"src/modules/shipments/status.ts",erased:false}]:[{target:"src/modules/shipments/status.ts",erased:false}]);
  assert.deepEqual(edges(dtoLegacy,types),types?[{target:dtoContract,erased:false},{target:dtoContract,erased:true}]:[{target:dtoContract,erased:false}]);
  const active=[],visited=new Set(),owners=new Set();
  function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/(orders|shipments)\//.exec(file)?.[1]??from;if(owner&&from&&owner!==from)owners.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(visited.has(key))return;active.push(file);for(const edge of edges(file,types)){assert.ok(!file.startsWith("src/modules/")||edge.target!==dtoLegacy,`Module depends on legacy DTO facade: ${file}`);visit(edge.target,owner);}active.pop();visited.add(key);}
  [...walk("src/modules/orders"),...walk("src/modules/shipments")].filter(f=>/\.tsx?$/.test(f)).forEach(f=>visit(f));visit(dtoLegacy);
  assert.deepEqual([...owners].sort(),["shipments->orders"]);assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
  const safe=new Set();function browser(file){if(safe.has(file))return;safe.add(file);assert.ok(!/^src\/(services|externals|config)\//.test(file),file);assert.ok(!/\/(application|infrastructure)\/|\/server\.ts$/.test(file),file);edges(file,types).forEach(e=>browser(e.target));}
  [dtoContract,...walk("src/modules/shipments/ui").filter(f=>/\.tsx?$/.test(f)),"src/app/orders/[id]/OrderDetailClient.tsx"].forEach(browser);
  assert.equal(safe.has(dtoLegacy),false);assert.ok(safe.has("src/modules/shipments/status.ts"));
});
