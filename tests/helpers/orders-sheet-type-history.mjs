import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import {createHash} from "node:crypto";
export const sheetTypesBefore=JSON.parse(readFileSync("tests/fixtures/orders-sheet-types-before.json","utf8"));
export const sheetTypeFiles=new Set(Object.keys(sheetTypesBefore.files));
export const sheetTypeHash=x=>createHash("sha256").update(x).digest("hex");
export function assertOrdersSheetTypeHistory(file,expected){
 const saved=sheetTypesBefore.files[file];assert.ok(saved,file);assert.equal(saved.sha256,expected);assert.equal(sheetTypeHash(saved.source),expected);
 const current=restoreCleanupSource(file);assert.equal(current.split('"@/externals/google/sheet/types"').length-1,1,file);
 assert.equal(current.replace('"@/externals/google/sheet/types"','"@/externals/google/sheet"'),saved.source,file);
}
