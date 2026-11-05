import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
export const dtoBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-dto-before.json", import.meta.url), "utf8"));
export const dtoHash = value => createHash("sha256").update(value).digest("hex");
export const dtoParse = (file, text = readFileSync(file, "utf8")) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
export const dtoPrint = (node, source) => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, source);
export const dtoContract = "src/modules/shipments/contracts.ts", dtoLegacy = "src/services/shipments/types.ts";
const enumLeaf = "src/modules/shipments/status.ts", barrel = "src/services/shipments/index.ts";

// Path-independent characterization; post-migration tests separately require the
// exact module owner. No duplicate declaration can pass either phase.
export function currentDtoDeclarations() {
  const found = [dtoContract, dtoLegacy].flatMap(file => {
    const source = dtoParse(file); return source.statements.filter(ts.isTypeAliasDeclaration).map(node => ({ file, source, node }));
  });
  assert.deepEqual(found.map(({node})=>node.name.text), dtoBefore.dtoOrder);
  for (const {source,node} of found) {
    const saved=dtoBefore.dtos[node.name.text];
    assert.equal(node.getText(source),saved.text,node.name.text); assert.equal(dtoPrint(node,source),saved.ast,node.name.text);
    assert.equal(dtoHash(dtoPrint(node,source)),saved.sha256);
  }
  return found;
}

export function restorePr15DtoSources() {
  const declarations=currentDtoDeclarations(); assert.ok(declarations.every(d=>d.file===dtoContract));
  const texts=declarations.map(({node,source})=>node.getText(source)).join("\n\n")+"\n";
  const publicPrefix='import type { OrderStatus } from "@/modules/orders/contracts";\nimport { ShipmentStatus } from "./status";\n\nexport { ShipmentStatus };\n\n';
  assert.equal(readFileSync(dtoContract,"utf8"),publicPrefix+texts,"Only DTO ownership/import/obsolete comment changes in the public contract");
  const forwards='export type {\n'+dtoBefore.publicTypeForwardNames.map(name=>`  ${name},`).join("\n")+'\n} from "@/modules/shipments/contracts";\n';
  assert.equal(readFileSync(dtoLegacy,"utf8"),'export { ShipmentStatus } from "@/modules/shipments/contracts";\n'+forwards,"Exact named compatibility exports only");
  const oldPublic=dtoBefore.sources[dtoContract].source, oldLegacy=dtoBefore.sources[dtoLegacy].source;
  // Recreate both actual PR 15 sources from the transferred declarations and
  // reviewed import/forwarding reversal, including its old ownership comment.
  const restoredPublic=oldPublic.slice(0,oldPublic.indexOf('export { ShipmentStatus }'))+
    'export { ShipmentStatus } from "./status";\n'+forwards.replaceAll('"@/modules/shipments/contracts"','"@/services/shipments/types"');
  const restoredLegacy=oldLegacy.slice(0,oldLegacy.indexOf('export type Shipment ='))+texts;
  for(const [file,restored] of [[dtoContract,restoredPublic],[dtoLegacy,restoredLegacy]]) {
    assert.equal(restored,dtoBefore.sources[file].source); assert.equal(dtoHash(restored),dtoBefore.sources[file].sha256);
  }
  return { contract:restoredPublic,legacy:restoredLegacy };
}

export function assertShipmentDtoHistory() {
  for(const {source,sha256} of Object.values(dtoBefore.sources))assert.equal(dtoHash(source),sha256);
  const restored=restorePr15DtoSources();
  const older=JSON.parse(readFileSync(new URL("../fixtures/shipments-enum-before.json",import.meta.url),"utf8"));
  for(const name of dtoBefore.dtoOrder) {
    assert.equal(dtoBefore.dtos[name].ast,older.dtos[name].ast);assert.equal(dtoBefore.dtos[name].sha256,older.dtos[name].sha256);
  }
  assert.equal(restored.legacy.replace('import { ShipmentStatus } from "@/modules/shipments/status";\nexport { ShipmentStatus };',older.enum.source),older.sources[dtoLegacy].source,"Older pre-PR15 legacy enum/DTO source remains a distinct witness");
  for(const file of [enumLeaf,barrel])assert.equal(dtoHash(readFileSync(file)),dtoBefore.sources[file].sha256,file);
}

// Closed runtime graph: only the captured pure files, with inert placeholders
// for unrelated barrel operations. Actual operation identity uses shipmentServices.
export function dtoPureGraph({ original = false } = {}) {
  const cache=new Map(),evaluations=[];
  function load(file) {
    assert.ok(dtoBefore.sources[file],file);if(cache.has(file))return cache.get(file);
    const exports={};cache.set(file,exports);evaluations.push(file);
    const source=original?dtoBefore.sources[file].source:readFileSync(file,"utf8");
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const fail=()=>assert.fail("IO or clock during pure contract evaluation");
    new vm.Script(code,{filename:file}).runInNewContext({exports,fetch:fail,Date:fail,Math:{random:fail},require:specifier=>{
      const targets={"./status":enumLeaf,"@/modules/shipments/status":enumLeaf,"@/modules/shipments/contracts":dtoContract,"./types":dtoLegacy,"@/services/shipments/types":dtoLegacy};
      if(Object.hasOwn(targets,specifier))return load(targets[specifier]);
      assert.equal(file,barrel);assert.ok(["./createShipment","./listShipments","./linkOrderToShipment","./updateShipmentStatus"].includes(specifier),specifier);return Object.freeze({});
    }});
    return exports;
  }
  return {load,evaluations};
}
