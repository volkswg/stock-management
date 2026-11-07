import {restoreCleanupSource} from "./cleanup-history.mjs";
import { restoreSalesQuerySource } from "./inventory-sales-query-history.mjs";
import { restoreMovementSchemaSource } from "./movement-schema-history.mjs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {directoryBefore} from "./employee-directory.mjs";
export const directoryFiles=new Set(Object.keys(directoryBefore.files));
export const directoryNewFiles=directoryBefore.newFiles;
export const directoryHash=x=>createHash("sha256").update(x).digest("hex");
export function assertDirectoryHistory(file,expected){const saved=directoryBefore.files[file];assert.ok(saved,file);assert.equal(saved.sha256,expected);assert.equal(directoryHash(saved.source),expected);let source=restoreMovementSchemaSource(file,restoreSalesQuerySource(file,restoreCleanupSource(file)));for(const change of saved.changes.toReversed()){assert.equal(source.split(change.to).length-1,1,file);source=source.replace(change.to,change.from);}assert.equal(source,saved.source,file);}
