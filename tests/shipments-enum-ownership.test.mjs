import { sheetTypeFiles, assertOrdersSheetTypeHistory } from "./helpers/orders-sheet-type-history.mjs";
import { googleFiles, googleDestinations, assertGoogleHistory } from "./helpers/google-infrastructure.mjs";
import { shipmentHttpFiles, assertShipmentHttpHistory } from "./helpers/shipments-http-history.mjs";
import { shipmentValidationFile, assertShipmentValidationImportHistory } from "./helpers/shipments-validation-history.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { enumBefore, enumHash, enumParse, enumPrint, originalEnumGraph, assertShipmentEnumContractHistory } from "./helpers/shipments-enum-history.mjs";
import { shipmentServices, fakeShipmentSheets, shipmentRow } from "./helpers/shipments.mjs";
import { loadSource, plain } from "./helpers/load-source.mjs";
import { routeContracts } from "./helpers/routes.mjs";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";

const physical = "src/modules/shipments/status.ts", contract = "src/modules/shipments/contracts.ts", legacy = "src/services/shipments/types.ts";
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);

test("exactly one physical ShipmentStatus declaration retains original source/AST and generated runtime enumeration", () => {
  const definitions = [];
  for(const file of [...walk("src"),...walk("tests")].filter(f=>/\.(ts|tsx|mjs)$/.test(f))) {
    const source = enumParse(file);
    function visit(node) { if(ts.isEnumDeclaration(node)&&node.name.text==="ShipmentStatus") definitions.push([file,node.getText(source)]); ts.forEachChild(node,visit); }
    visit(source);
  }
  assert.deepEqual(definitions, [[physical,enumBefore.enum.source]]);
  const source=enumParse(physical); assert.equal(source.statements.length,1);
  const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  assert.equal(compile(readFileSync(physical,"utf8")), compile(enumBefore.enum.source));
  assert.equal(enumHash(enumPrint(source.statements[0],source)),enumBefore.enum.sha256);
  const fail=()=>assert.fail("Pure enum evaluated IO, a clock or an import");
  const loaded=loadSource(physical,{globals:{Date:fail,fetch:fail,Buffer:undefined,process:undefined,Math:{random:fail}}});
  assert.deepEqual(Object.keys(loaded),["ShipmentStatus"]);
  assert.deepEqual(Object.entries(loaded.ShipmentStatus),enumBefore.enum.keys.map((key,i)=>[key,enumBefore.enum.values[i]]));
});

test("physical, public, legacy leaf and unchanged barrel share one cached enum runtime object and original export keys", () => {
  const {load,services}=shipmentServices(); const definition=load(physical);
  for(const file of [physical,contract,legacy,"src/services/shipments/index.ts"]) {
    const loaded=load(file); assert.equal(loaded.ShipmentStatus,definition.ShipmentStatus); assert.equal(load(file),loaded);
  }
  const token=Symbol("single-enum-evaluation"); definition.ShipmentStatus[token]=true;
  assert.equal(services.ShipmentStatus[token],true); assert.equal(load(contract).ShipmentStatus[token],true); delete definition.ShipmentStatus[token];
  assert.deepEqual(Object.keys(load(contract)),enumBefore.enum.exports);
  const original=originalEnumGraph().load("src/services/shipments/index.ts"); assert.deepEqual(Object.keys(services).sort(),Object.keys(original).sort());
  assert.equal(enumHash(readFileSync("src/services/shipments/index.ts")),enumBefore.sources["src/services/shipments/index.ts"].sha256);
});

test("only the two reviewed existing production files change; all other source, routes, clients, DTO owners and provider bytes remain exact", () => {
  const changes=Object.entries(enumBefore.productionHashes).filter(([file,hash])=>{if(sheetTypeFiles.has(file)){assertOrdersSheetTypeHistory(file,hash);return false;}if(googleFiles.has(file)){assertGoogleHistory(file,hash);return false;}if(shipmentHttpFiles.has(file)){assertShipmentHttpHistory(file,hash);return false;}if(file===shipmentValidationFile){assertShipmentValidationImportHistory(file,hash);return false;}return enumHash(readFileSync(file))!==hash;}).map(([file])=>file).sort();
  assert.deepEqual(changes,[contract,legacy].sort());
  assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(enumBefore.productionHashes,f)&&!googleDestinations.includes(f)),[physical]);
  assert.equal(enumBefore.productionTypeScriptCount,277);
  assert.deepEqual(routeContracts(),enumBefore.routeContracts);
  assert.equal(routeContracts().filter(r=>r.kind==="page").length,23); assert.equal(routeContracts().filter(r=>r.kind==="api").length,35);
});

test("original public contract raw hashes remain authoritative with only the exact status forwarding source reversed", () => {
  const expected="77753cb8809856586d5399999b7be5ca5ca8983a8e67897391b976cac2aacd78";
  for(const file of ["shipments-browser-client.json","shipments-ui-relocation.json"]) {
    const fixture=JSON.parse(readFileSync(`tests/fixtures/${file}`,"utf8")); assert.equal(fixture.retained[contract],expected);
    assertShipmentEnumContractHistory(contract,expected);
  }
  const source=enumParse(contract), original=enumParse(legacy,enumBefore.sources[legacy].source);
  const dtoAST=s=>s.statements.filter(ts.isTypeAliasDeclaration).map(n=>enumPrint(n,s));
  assert.deepEqual(dtoAST(source),dtoAST(original));
});

const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
function dependencies(file,types) {
  return enumParse(file).statements.flatMap(n=>{
    if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)return [];
    const c=n.importClause,e=c?.namedBindings&&ts.isNamedImports(c.namedBindings)?c.namedBindings.elements:undefined;
    const erased=n.isTypeOnly||c?.isTypeOnly||(e?.length&&!c.name&&e.every(x=>x.isTypeOnly)); if(!types&&erased)return [];
    const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,ts.sys).resolvedModule?.resolvedFileName;
    return target&&relative(process.cwd(),target).startsWith("src/")?[relative(process.cwd(),target).replaceAll("\\","/")]:[];
  });
}
for(const types of [false,true]) test(`physical/public/DTO and feature graphs resolve acyclic one-way ownership (${types?"runtime plus types":"runtime"})`,()=>{
  assert.deepEqual(dependencies(physical,types),[]);
  assert.deepEqual(dependencies(contract,types),types?["src/modules/orders/contracts.ts",physical]:[physical]);
  assert.deepEqual(dependencies(legacy,types),types?[contract,contract]:[contract]);
  const active=[],seen=new Set(),edges=new Set();
  function visit(file,from) {
    assert.ok(!active.includes(file),[...active,file].join(" -> "));
    const owner=/^src\/modules\/(orders|shipments)\//.exec(file)?.[1]??from;
    if(owner&&from&&owner!==from)edges.add(`${from}->${owner}`);
    const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);
    for(const dep of dependencies(file,types))visit(dep,owner);
    active.pop();seen.add(key);
  }
  [...walk("src/modules/orders"),...walk("src/modules/shipments")].filter(f=>/\.tsx?$/.test(f)).forEach(f=>visit(f));
  assert.deepEqual([...edges].sort(),["shipments->orders"]);
  assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
  const browser=new Set(); function safe(file){if(browser.has(file))return;browser.add(file);assert.ok(!/\/application\/|\/infrastructure\/|\/server\.ts$|^src\/(config|externals)\//.test(file),file);assert.ok(!file.startsWith("src/services/"),file);dependencies(file,types).forEach(safe);}
  [contract,...walk("src/modules/shipments/ui").filter(f=>/\.tsx?$/.test(f))].forEach(safe);
  assert.ok(browser.has(physical));assert.equal(browser.has(legacy),false,"Public contracts now physically own DTOs; no legacy edge in either browser graph");
});

test("actual existing link use case retains Draft/Ready eligibility and enum-invalid/status-first outcomes",async()=>{
  const {services}=shipmentServices();
  for(const status of enumBefore.enum.values.concat("unknown")) {
    const fake=fakeShipmentSheets({shipments:[shipmentRow({status})],orders:[["o", "unknown-order-status", "", "", "", "", "", "", ""]]});
    const input={googleSheetsService:fake.sheets,shipmentId:"s/1",orderId:"o",createdBy:" actor "};
    if(["draft","ready_to_ship"].includes(status)) {const result=await services.linkOrderToShipment(input);assert.equal(result.created,true);assert.equal(result.shipmentOrder.createdBy," actor ");assert.equal(fake.events[3][2],"A:G");}
    else await assert.rejects(services.linkOrderToShipment(input),e=>e instanceof services.LinkOrderToShipmentError&&e.code==="shipment_not_linkable");
    assert.deepEqual(plain(fake.events.slice(0,3)),[["read","shipments"],["read","orders","A:I"],["read","shipmentOrders"]]);
  }
});
