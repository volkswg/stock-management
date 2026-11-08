import {evidenceHost} from "./helpers/retirement-history.mjs";
import {readArchive} from "./helpers/retirement-history.mjs";
import {restoreCleanupSource} from "./helpers/cleanup-history.mjs";
import { shipmentHttpFiles, assertShipmentHttpHistory } from "./helpers/shipments-http-history.mjs";
import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { shipmentServices } from "./helpers/shipments.mjs";
import { validationBefore,validationHash,shipmentValidationFile } from "./helpers/shipments-validation-history.mjs";
function helpers(){
  const {load,services}=shipmentServices();const exports={};
  const code=ts.transpileModule(validationBefore.source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script(code).runInNewContext({exports,require:name=>{assert.equal(name,"@/services/shipments");return services;}});
  return {original:exports,current:load(shipmentValidationFile),load,services};
}

test("original and current validation declarations/status outputs preserve four helper exports, original enum identity and all malformed status values",()=>{
  assert.equal(validationHash(validationBefore.source),"5a7eee8047a280c4c01df65457cd809de71b581ae565d1bbae1034a298e4d4df");
  const {original,current,load,services}=helpers();const enumObject=load("src/modules/shipments/status.ts").ShipmentStatus;
  for(const path of ["src/modules/shipments/contracts.ts","src/services/shipments/types.ts","src/services/shipments/index.ts"])assert.equal(load(path).ShipmentStatus,enumObject);
  assert.deepEqual(Object.keys(load("src/modules/shipments/contracts.ts")),["ShipmentStatus"]);assert.equal(services.ShipmentStatus,enumObject);
  assert.deepEqual(Object.keys(current),Object.keys(original));
  const source=ts.createSourceFile(shipmentValidationFile,restoreCleanupSource(shipmentValidationFile),ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
  for(const node of source.statements.filter(ts.isFunctionDeclaration))assert.equal(printer.printNode(ts.EmitHint.Unspecified,node,source),validationBefore.functions[node.name.text].ast);
  const values=[...Object.values(enumObject),"unknown"," shipping ","SHIPPING","",null,undefined,false,true,0,1,NaN,Infinity,{},[],new String("shipping"),Symbol("shipping"),1n,{valueOf(){assert.fail("No status coercion");}}];
  for(const value of values){const expected=["ready_to_ship","shipping","delivered"].includes(value);assert.equal(original.isUpdatableStatus(value),expected);assert.equal(current.isUpdatableStatus(value),expected);}
});

test("fee and PO validation retain finite inclusive bounds, original pre-trim length semantics and noncoercing malformed input behavior",()=>{
  const {original,current}=helpers();const malformed=[undefined,null,true,false,"0",[],{},new Number(0),Symbol("x"),1n,{valueOf(){assert.fail("No coercion");},toString(){assert.fail("No coercion");}}];
  for(const [value,expected]of [[0,true],[-0,true],[Number.MIN_VALUE,true],[1_000_000_000,true],[1_000_000_001,false],[-1,false],[-Number.MIN_VALUE,false],[NaN,false],[Infinity,false],[-Infinity,false],...malformed.map(v=>[v,false])]){
    assert.equal(original.isValidDeliveryFee(value),expected);assert.equal(current.isValidDeliveryFee(value),expected);
  }
  for(const [value,expected]of [["PO",true],[" PO ",true],["",false],[" \t\n",false],["a".repeat(100),true],["a".repeat(101),false],[" ".repeat(99)+"a",true],[" ".repeat(100)+"a",false],["a".repeat(100)+" ",false],[new String("PO"),false],...malformed.filter(v=>typeof v!=="string").map(v=>[v,false])]){
    assert.equal(original.isValidPoNumber(value),expected);assert.equal(current.isValidPoNumber(value),expected);
  }
});

test("readJsonBody preserves parsed identity, receiver binding, invalid JSON and malformed/getter/sync/async failures without retries",async()=>{
  const {original,current}=helpers();
  for(const helper of [original,current]){
    const result={synthetic:"value"};let calls=0;const request={json(){assert.equal(this,request);calls++;return Promise.resolve(result);}};
    assert.equal(await helper.readJsonBody(request),result);assert.equal(calls,1);
    for(const input of [null,undefined,{}, {json:1}, {get json(){throw new Error("synthetic getter");}}, {json(){throw new Error("synthetic parse");}}, {json:async()=>{throw new Error("synthetic rejection");}},new Request("https://example.test",{method:"POST",body:"{"})])assert.equal(await helper.readJsonBody(input),undefined);
    let resolveJson;const pending=new Promise(resolve=>{resolveJson=resolve;});let settled=false;const response=helper.readJsonBody({json:()=>pending}).then(v=>{settled=true;return v;});await Promise.resolve();assert.equal(settled,false);resolveJson(result);assert.equal(await response,result);
  }
});

test("updated helper resolves only public contracts/status at runtime, erased Orders types, and preserves API/legacy exports and browser ownership",async()=>{
  const {resolve,relative}=await import("node:path");
  const {assertShipmentValidationImportHistory}=await import("./helpers/shipments-validation-history.mjs");
  const {browserOwnership,ownershipEdges}=await import("./helpers/browser-ownership.mjs");
  assertShipmentValidationImportHistory(shipmentValidationFile,validationBefore.sha256);
  for(const [file,expected]of Object.entries(validationBefore.preserved)){if(shipmentHttpFiles.has(file))assertShipmentHttpHistory(file,expected);else assert.equal(validationHash(restoreCleanupSource(file)),expected,file);}
  const {load,services}=helpers(),server=load("src/modules/shipments/server.ts");
  for(const name of ["createShipment","listShipments","getShipmentDetail","linkOrderToShipment","updateShipmentStatus"])assert.equal(services[name],server[name],name);
  assert.equal(services.LinkOrderToShipmentError,load("src/modules/shipments/application/link-order-to-shipment.ts").LinkOrderToShipmentError);
  const options=ts.parseJsonConfigFileContent(ts.readConfigFile("tsconfig.json",ts.sys.readFile).config,ts.sys,process.cwd()).options;
  for(const types of [false,true]){
    const active=[],seen=new Set();
    function visit(file){assert.ok(!active.includes(file),[...active,file].join(" -> "));if(seen.has(file))return;active.push(file);
      const source=ts.createSourceFile(file,readArchive(file,"utf8"),ts.ScriptTarget.Latest,true);
      for(const node of source.statements){if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier)continue;
        const clause=node.importClause,bindings=clause?.namedBindings,elements=bindings&&ts.isNamedImports(bindings)?bindings.elements:undefined;
        if(!types&&(node.isTypeOnly||clause?.isTypeOnly||(elements?.length&&!clause.name&&elements.every(e=>e.isTypeOnly))))continue;
        const target=ts.resolveModuleName(node.moduleSpecifier.text,resolve(file),options,evidenceHost(ts.sys)).resolvedModule?.resolvedFileName;assert.ok(target,node.moduleSpecifier.text);
        visit(relative(process.cwd(),target).replaceAll("\\","/"));
      }active.pop();seen.add(file);
    }visit(shipmentValidationFile);
    assert.deepEqual([...seen].sort(),[shipmentValidationFile,"src/modules/shipments/http.ts","src/modules/shipments/contracts.ts","src/modules/shipments/status.ts",...(types?["src/modules/orders/contracts.ts"]:[])].sort());
    assert.deepEqual(ownershipEdges(browserOwnership({types})),["shipments->orders"]);
  }
});
