import {loadInventorySource}from "./inventory-source.mjs";
import { salesOwners } from "./sales-source.mjs";
import assert from "node:assert/strict";
import {readFileSync,existsSync}from"node:fs";
import {dirname,posix}from"node:path";
import vm from"node:vm";
import ts from"typescript";
import {googleGraph}from"./google-infrastructure.mjs";
import {DirectoryClock}from"./employee-directory.mjs";
import {salesQueryBefore}from"./inventory-sales-query-history.mjs";
export function salesQueryGraph({original=false,imports={}}={}){
 const provider=googleGraph({historical:original}),cache=new Map(),loadedImports=[],query="src/services/sales/getGoogleSheetsDailySales.ts";
 const headers=new Set(["receipts","receipt-items","receipt-payments","receipt-syncs"].map(d=>`@/modules/sales/infrastructure/google-sheets/${d}/const`));
 const allowed=new Set([...salesOwners,"src/modules/sales/server.ts","src/modules/sales/application/reports.ts","src/modules/sales/infrastructure/google-sheets/sales-reader.ts",query,...Object.keys(salesQueryBefore.files),salesQueryBefore.newFile,...["index","syncLoyverseDailySales","listSalesSyncStatus","getLoyverseReceiptsForSalesDate","idBuilders","rowMappers"].map(n=>`src/services/sales/${n}.ts`)]);
 function load(file){if(cache.has(file))return cache.get(file);assert.ok(allowed.has(file),`Unapproved Sales dependency: ${file}`);if(!original&&file==="src/services/stock-counts/manageStockCounts.ts"){const owned=loadInventorySource(file,{imports:{...imports,"@/services/sales/getGoogleSheetsDailySales":load(query),"@/externals/google/sheet/sheets/stock-counts/const":provider.load("src/externals/google/sheet/sheets/stock-counts/const.ts")},globals:{Date:DirectoryClock}});cache.set(file,owned);return owned;}const source=original&&salesQueryBefore.files[file]?salesQueryBefore.files[file].source:readFileSync(file,"utf8"),exports={};cache.set(file,exports);
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({exports,Error,Date:DirectoryClock,console,URL,URLSearchParams,fetch:()=>assert.fail("Live IO forbidden"),require(spec){loadedImports.push([file,spec]);if(Object.hasOwn(imports,spec))return imports[spec];if(spec==="server-only")return {};if(spec==="node:crypto")return {randomUUID:()=>"fixed-id"};if(spec==="@/externals/google/sheet")return provider.load("src/externals/google/sheet/index.ts");if(spec.includes("/profit-cost-overrides/const"))return provider.load("src/modules/sales/infrastructure/google-sheets/profit-cost-overrides/const.ts");if(headers.has(spec)||spec==="@/externals/google/sheet/sheets/stock-counts/const")return provider.load("src/"+spec.slice(2)+".ts");let target=spec.startsWith("@/")?"src/"+spec.slice(2):posix.normalize(dirname(file)+"/"+spec);target+=existsSync(target+".ts")?".ts":"/index.ts";if(/src\/modules\/sales\/infrastructure\/google-sheets\/[^/]+\/const\.ts$/.test(target))return provider.load(target);return load(target);}});new vm.Script(code,{filename:file}).runInContext(context);return exports;
 }return {load,query:()=>load(query),provider,loadedImports,cache};
}
export function salesQueryData(provider,events=[],{failure,block}={}){
 const registry=provider.load("src/externals/google/sheet/index.ts"),specs=[["salesReceipts","SalesReceiptsSheet","SALES_RECEIPT_HEADERS"],["salesReceiptItems","SalesReceiptItemsSheet","SALES_RECEIPT_ITEM_HEADERS"],["salesReceiptPayments","SalesReceiptPaymentsSheet","SALES_RECEIPT_PAYMENT_HEADERS"],["salesReceiptSyncs","SalesReceiptSyncsSheet","SALES_RECEIPT_SYNC_HEADERS"]],data={},service={};
 const records={salesReceipts:[{id:"s",salesDate:"2026-11-06",accountId:"shop",shopName:"Shop",receiptType:"SALE",receiptDate:"2026-11-06T01:00:00Z",totalMoney:10},{id:"r",salesDate:"2026-11-06",accountId:"shop",receiptType:"REFUND",receiptDate:"2026-11-06T02:00:00Z",totalMoney:2}],salesReceiptItems:[{id:"i1",receiptId:"s",itemId:"item",itemName:"Item",quantity:5,grossTotalMoney:"10",totalMoney:10,costTotal:4,taxes:0},{id:"i2",receiptId:"r",itemId:"item",itemName:"Item",quantity:1,grossTotalMoney:2,totalMoney:2,costTotal:0.8}],salesReceiptPayments:[{id:"p1",receiptId:"s",paymentTypeId:"cash",paymentName:"Cash",paymentType:"CASH",moneyAmount:10},{id:"p2",receiptId:"r",paymentTypeId:"cash",paymentName:"Cash",paymentType:"CASH",moneyAmount:2}],salesReceiptSyncs:[{id:"sync",salesDate:"2026-11-06",accountId:"shop",shopName:"Shop",status:"complete",receiptCount:2,itemCount:2,paymentCount:2}]};
 const client={getValues:async(name,range)=>{events.push(["read",name,range]);if(failure?.name===name)throw failure.error;if(block?.name===name)await block.promise;return data[name];}};
 for(const [name,C,H]of specs){const headers=registry[H];data[name]=[Array.from(headers),...records[name].map(row=>headers.map(k=>row[k]??""))];service[name]=new registry[C](client,name);}
 return {service,data};
}
