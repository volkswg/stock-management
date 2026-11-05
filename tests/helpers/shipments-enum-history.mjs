import { restorePr15DtoSources } from "./shipments-dto-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

export const enumBefore = JSON.parse(readFileSync(new URL("../fixtures/shipments-enum-before.json", import.meta.url), "utf8"));
export const enumHash = value => createHash("sha256").update(value).digest("hex");
export const enumParse = (file, text = readFileSync(file, "utf8")) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
export const enumPrint = (node, source) => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, source);

// The original three-file graph is evaluated from the saved source. Unrelated
// barrel operations are inert named placeholders; no provider/config is loaded.
export function originalEnumGraph() {
  const cache = new Map(), evaluations = [];
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    assert.ok(enumBefore.sources[file], file);
    const exports = {}; cache.set(file, exports); evaluations.push(file);
    const text = enumBefore.sources[file].source;
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new vm.Script(output, { filename: file }).runInNewContext({ exports, require: name => {
      if (name === "./types" || name === "@/services/shipments/types") return load("src/services/shipments/types.ts");
      assert.equal(file, "src/services/shipments/index.ts");
      assert.ok(["./createShipment", "./listShipments", "./linkOrderToShipment", "./updateShipmentStatus"].includes(name), name);
      return Object.freeze({});
    } });
    return exports;
  }
  return { load, evaluations };
}

export function assertShipmentEnumContractHistory(file, expected) {
  assert.equal(file, "src/modules/shipments/contracts.ts");
  const original = enumBefore.sources[file]; assert.equal(enumHash(original.source), expected); assert.equal(original.sha256, expected);
  // Reverse PR 16 DTO ownership first (including its obsolete-comment removal),
  // then reverse only PR 15 enum forwarding against the original older witness.
  const current = restorePr15DtoSources().contract;
  assert.equal(current.replace('export { ShipmentStatus } from "./status";', 'export { ShipmentStatus } from "@/services/shipments/types";'), original.source);
  const physical = enumParse("src/modules/shipments/status.ts");
  assert.equal(physical.statements.length, 1);
  assert.equal(enumPrint(physical.statements[0], physical), enumBefore.enum.ast);
  assert.equal(enumHash(enumPrint(physical.statements[0], physical)), enumBefore.enum.sha256);
}
