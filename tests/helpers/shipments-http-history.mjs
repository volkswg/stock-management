import {restoreCleanupSource} from "./cleanup-history.mjs";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import ts from "typescript";
export const shipmentHttpBefore=JSON.parse(readFileSync(new URL("../fixtures/shipments-http-before.json",import.meta.url),"utf8"));
export const shipmentHttpFiles=new Set(["src/app/api/shipments/route.ts","src/app/api/shipments/[id]/route.ts","src/app/api/shipments/[id]/orders/route.ts","src/modules/shipments/server.ts"]);
export const httpHash=value=>createHash("sha256").update(value).digest("hex");
export function assertShipmentHttpHistory(file,expected){
 assert.ok(shipmentHttpFiles.has(file),file);const saved=shipmentHttpBefore.sources[file];
 assert.equal(httpHash(saved.source),saved.sha256);if(expected!==undefined)assert.equal(saved.sha256,expected);
 const current=restoreCleanupSource(file);let forward=saved.source,restored=current;
 for(const {from,to}of shipmentHttpBefore.transforms[file]){assert.equal(forward.split(from).length,2);assert.equal(restored.split(to).length,2);forward=forward.replace(from,to);restored=restored.replace(to,from);}
 assert.equal(current,forward,`${file}: only reviewed imports/named class forwarding`);assert.equal(restored,saved.source,`${file}: exact original bytes restored`);assert.equal(httpHash(restored),saved.sha256);
 const source=ts.createSourceFile(file,current,ts.ScriptTarget.Latest,true),printer=ts.createPrinter();
 const functions=source.statements.filter(ts.isFunctionDeclaration);assert.deepEqual(functions.map(n=>n.name.text),Object.keys(saved.functions));
 for(const n of functions)assert.equal(httpHash(printer.printNode(ts.EmitHint.Unspecified,n,source)),saved.functions[n.name.text],`${file}:${n.name.text}`);
 assert.equal(httpHash(readFileSync(shipmentHttpBefore.classFile)),shipmentHttpBefore.classHash,"Original class/application unchanged");
}
