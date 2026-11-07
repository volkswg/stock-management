import assert from "node:assert/strict";
import {readFileSync}from"node:fs";
import {createHash}from"node:crypto";
export const salesQueryBefore=JSON.parse(readFileSync("tests/fixtures/inventory-sales-query-before.json","utf8"));
export const salesQueryFiles=new Set(Object.keys(salesQueryBefore.files));
export const salesQueryNewFiles=[salesQueryBefore.newFile];
export const salesQueryHash=x=>createHash("sha256").update(x).digest("hex");
export function restoreSalesQuerySource(file,source){for(const c of (salesQueryBefore.files[file]?.changes??[]).toReversed()){assert.equal(source.split(c.to).length-1,1,file);source=source.replace(c.to,c.from);}return source;}
export function assertSalesQueryHistory(file,expected){const saved=salesQueryBefore.files[file];assert.ok(saved,file);assert.equal(salesQueryHash(saved.source),saved.sha256);let source=restoreSalesQuerySource(file,readFileSync(file,"utf8"));assert.equal(source,saved.source,file);if(expected!==saved.sha256){assert.equal(file,"src/services/stock-counts/manageStockCounts.ts");const old=JSON.parse(readFileSync("tests/fixtures/inventory-employee-directory-before.json","utf8")).files[file];assert.equal(expected,old.sha256);for(const c of old.changes.toReversed()){assert.equal(source.split(c.to).length-1,1);source=source.replace(c.to,c.from);}assert.equal(source,old.source);}assert.equal(salesQueryHash(source),expected,file);}
