import {evidenceHost} from "./helpers/retirement-history.mjs";
import {readArchive} from "./helpers/retirement-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {shipmentHttpBefore} from "./helpers/shipments-http-history.mjs";
import {runShipmentHttpCase} from "./helpers/shipments-http.mjs";
for(const group of ["collection","detail","links"])test(`Shipment ${group} handlers preserve original HTTP/Sheets/Drive results, errors and event order`,async()=>{
 for(const example of shipmentHttpBefore.cases.filter(c=>c.group===group)){
  assert.deepEqual(await runShipmentHttpCase(example),example.expected,example.name);
  assert.deepEqual(await runShipmentHttpCase(example,{original:true}),example.expected,`${example.name}: saved original`);
 }
});

test("all routes use exact public imports, reconstructed source bytes/function hashes and the original server/direct/barrel error-class identity",async()=>{
 const ts=(await import("typescript")).default;
 const {shipmentHttpFiles,assertShipmentHttpHistory,httpHash}=await import("./helpers/shipments-http-history.mjs");
 const {shipmentServices}=await import("./helpers/shipments.mjs");
 for(const file of shipmentHttpFiles)assertShipmentHttpHistory(file,shipmentHttpBefore.sources[file].sha256);
 const {load,services}=shipmentServices(),server=load("src/modules/shipments/server.ts"),app=load(shipmentHttpBefore.classFile),direct=load("src/services/shipments/linkOrderToShipment.ts");
 assert.equal(server.LinkOrderToShipmentError,app.LinkOrderToShipmentError);assert.equal(server.LinkOrderToShipmentError,direct.LinkOrderToShipmentError);assert.equal(server.LinkOrderToShipmentError,services.LinkOrderToShipmentError);
 for(const name of ["createShipment","listShipments","getShipmentDetail","linkOrderToShipment","updateShipmentStatus"])assert.equal(server[name],services[name]);
 const status=load("src/modules/shipments/status.ts").ShipmentStatus;
 for(const file of ["src/modules/shipments/contracts.ts","src/services/shipments/types.ts","src/services/shipments/index.ts"])assert.equal(load(file).ShipmentStatus,status);
 assert.deepEqual(Object.keys(load("src/modules/shipments/contracts.ts")),["ShipmentStatus"]);
 const expected={"src/app/api/shipments/route.ts":{createShipment:"server",listShipments:"server",ShipmentStatus:"contracts"},"src/app/api/shipments/[id]/route.ts":{advanceShipmentStatusWithBill:"server",getShipmentDetail:"server",updateShipmentStatus:"server",ShipmentStatus:"contracts"},"src/app/api/shipments/[id]/orders/route.ts":{linkOrderToShipment:"server",LinkOrderToShipmentError:"server"}};
 for(const [file,names]of Object.entries(expected)){
  const source=ts.createSourceFile(file,readArchive(file,"utf8"),ts.ScriptTarget.Latest,true),found={};
  for(const n of source.statements.filter(ts.isImportDeclaration)){
   assert.notEqual(n.moduleSpecifier.text,"@/services/shipments");
   for(const binding of n.importClause?.namedBindings?.elements??[])if(Object.hasOwn(names,binding.name.text))found[binding.name.text]=n.moduleSpecifier.text;
  }
  assert.deepEqual(found,Object.fromEntries(Object.entries(names).map(([name,entry])=>[name,`@/modules/shipments/${entry}`])));
 }
 assert.equal(httpHash(readArchive(shipmentHttpBefore.classFile)),shipmentHttpBefore.classHash);
});

test("actual HTTP import resolution and server graphs remain acyclic with unchanged one-way browser ownership and guarded server exports",async()=>{
 const ts=(await import("typescript")).default,{readdirSync}=await import("node:fs"),{resolve,relative}=await import("node:path");
 const {browserOwnership,ownershipEdges}=await import("./helpers/browser-ownership.mjs");const {ESLint}=await import("eslint");
 const {load}= (await import("./helpers/shipments.mjs")).shipmentServices();
 const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):/\.tsx?$/.test(e.name)?[`${dir}/${e.name}`]:[]);
 for(const types of [false,true]){
  const active=[],seen=new Set(),owners=new Set();
  function visit(file,from){assert.ok(!active.includes(file),[...active,file].join(" -> "));const owner=/^src\/modules\/(orders|shipments)\//.exec(file)?.[1]??from;if(owner&&from&&owner!==from)owners.add(`${from}->${owner}`);const key=`${owner}:${file}`;if(seen.has(key))return;active.push(file);
   const s=ts.createSourceFile(file,readArchive(file,"utf8"),ts.ScriptTarget.Latest,true);
   for(const n of s.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier)continue;const c=n.importClause,b=c?.namedBindings,e=b&&ts.isNamedImports(b)?b.elements:undefined;if(!types&&(n.isTypeOnly||c?.isTypeOnly||(e?.length&&!c.name&&e.every(x=>x.isTypeOnly))))continue;
    const resolved=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,evidenceHost(ts.sys)).resolvedModule?.resolvedFileName;
    if(resolved){const target=relative(process.cwd(),resolved).replaceAll("\\","/");if(target.startsWith("src/"))visit(target,owner);}
   }active.pop();seen.add(key);
  }
  [...walk("src/modules/orders"),...walk("src/modules/shipments"),"src/services/shipments/index.ts"].forEach(f=>visit(f));
  assert.deepEqual([...owners].sort(),["shipments->orders"]);assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
 }
 const routeFiles=Object.keys(shipmentHttpBefore.sources).filter(f=>f.startsWith("src/app/"));
 for(const file of routeFiles){const source=ts.createSourceFile(file,readArchive(file,"utf8"),ts.ScriptTarget.Latest,true);for(const n of source.statements.filter(ts.isImportDeclaration)){if(n.moduleSpecifier.text.startsWith("@/modules/shipments/")){const target=ts.resolveModuleName(n.moduleSpecifier.text,resolve(file),options,evidenceHost(ts.sys)).resolvedModule?.resolvedFileName;assert.ok(target);assert.ok(["src/modules/shipments/server.ts","src/modules/shipments/contracts.ts","src/modules/shipments/http.ts"].includes(relative(process.cwd(),target)));}}}
 const serverFile="src/modules/shipments/server.ts";assert.ok(readArchive(serverFile,"utf8").startsWith('import "server-only";'));
 const eslint=new ESLint();for(const file of [...routeFiles,serverFile]){const [r]=await eslint.lintFiles(file);assert.equal(r.errorCount,0,JSON.stringify(r.messages));assert.equal(r.warningCount,0,JSON.stringify(r.messages));}
 assert.deepEqual(Object.keys(load(serverFile)).sort(),["LinkOrderToShipmentError","advanceShipmentStatusWithBill","createShipment","getShipmentDetail","linkOrderToShipment","listShipments","updateShipmentStatus"]);
});
