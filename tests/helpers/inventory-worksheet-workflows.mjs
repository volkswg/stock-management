import assert from "node:assert/strict";
import {loadSource,plain} from "./load-source.mjs";
import {googleGraph} from "./google-infrastructure.mjs";
import {DirectoryClock,directoryGraph} from "./employee-directory.mjs";

// Exact production business/HTTP files with synthetic collaborators; no general source loader.
export function inventoryWorkflow(historical){
 const events=[],g=googleGraph({historical}),registry=g.load("src/externals/google/sheet/index.ts");
 const globals={Date:DirectoryClock,Error,Request,Response,console:{error:(...args)=>events.push(["log",...plain(args)])}};
 const schema=loadSource("src/services/movements/worksheet-schema.ts");
 const state=loadSource("src/services/movements/state.ts",{imports:{"./worksheet-schema":schema,"@/externals/google/sheet/sheets/user-state/const":g.load("src/externals/google/sheet/sheets/user-state/const.ts"),"@/services/utils/createSortableId":{createSortableId:()=>assert.fail("No movement ID generation expected")}},globals});
 const data={counts:[Array.from(registry.STOCK_COUNT_HEADERS),["previous","2026-10","shop","Shop",10,"","old","old","actor"]],masters:[Array.from(state.MASTER_HEADERS),["M","user","2026-11-06","","created","5","created","updated"]],details:[Array.from(state.DETAIL_HEADERS),["I1","M","Shop","3","","from","to","image1","","created","c","u",false,false],["I2","M","Shop","2","","from","to","image2","","created","c","u",false,false]],adjustments:[]};
 let failure;const marker=new Error("synthetic write/read failure"),client={
  ensureWorksheet:async(name)=>events.push(["ensure",name]),
  getValues:async(name,range)=>{events.push(["read",name,range]);if(failure?.("read",name,range))throw marker;const match=/^[A-Z]+(\d*):[A-Z]+(\d*)$/.exec(range);return data[name].slice(Number(match?.[1]||1)-1,match?.[2]?Number(match[2]):undefined).map(row=>row.slice());},
  appendValues:async(name,range,values,mode)=>{events.push(["append",name,range,plain(values),mode??"USER_ENTERED"]);if(failure?.("append",name,range))throw marker;data[name].push(...values.map(row=>Array.from(row)));},
  updateValues:async(name,range,values,mode)=>{events.push(["update",name,range,plain(values),mode??"USER_ENTERED"]);if(failure?.("update",name,range))throw marker;const at=Number(/\d+/.exec(range)?.[0]??1)-1;values.forEach((row,i)=>{data[name][at+i]=Array.from(row);});},
  deleteRow:async(name,row)=>{events.push(["delete",name,row]);if(failure?.("delete",name,row))throw marker;data[name].splice(row-1,1);},
 };
 const {MovementSheet}=g.load("src/externals/google/sheet/sheets/movements/MovementSheet.ts"),{StockAdjustmentsSheet}=g.load("src/externals/google/sheet/sheets/stock-adjustments/StockAdjustmentsSheet.ts");
 const service={stockCounts:new registry.StockCountsSheet(client,"counts"),movementMasters:new MovementSheet(client,"masters"),movementDetails:new MovementSheet(client,"details"),stockAdjustments:new StockAdjustmentsSheet(client,"adjustments")};
 const movement=loadSource("src/services/movements/manageMovements.ts",{imports:{"./worksheet-schema":schema,"@/features/backend/line/services/movements/utils":loadSource("src/features/backend/line/services/movements/utils.ts")},globals});
 const adjustments=directoryGraph({service}).legacy();
 const count=loadSource("src/services/stock-counts/manageStockCounts.ts",{imports:{"@/services/stock-adjustments/manageStockAdjustments":adjustments,"node:crypto":{randomUUID:()=>{events.push(["uuid"]);return "fixed-uuid";}},"@/externals/google/sheet/sheets/stock-counts/const":{STOCK_COUNT_HEADERS:registry.STOCK_COUNT_HEADERS},"@/services/movements":movement,"@/services/sales":{getGoogleSheetsSalesDashboard:async(input)=>{events.push(["sales",input.accountIds,input.fromDate,input.toDate]);return {shopSeries:[{accountId:"shop",dailySales:[{salesDate:"2026-11-06",itemsSold:5,itemsRefunded:1}]}]};}}},globals});
 const imports={"next/server":{NextResponse:Response},"@/config":{getConfig:()=>{events.push(["config"]);return {loyverse:{accounts:[{id:"shop",shopName:"Shop"}]}};}},"@/externals/google/sheet":{createGoogleSheetsServiceFromConfig:()=>{events.push(["factory"]);return service;}},"@/services/movements":movement,"@/services/stock-counts":count,"@/features/backend/shared/utils":loadSource("src/features/backend/shared/utils.ts")};
 const routes={counts:loadSource("src/app/api/stock-counts/route.ts",{imports,globals}),movement:loadSource("src/app/api/movements/[id]/route.ts",{imports,globals}),item:loadSource("src/app/api/movements/[id]/items/[itemId]/route.ts",{imports,globals})};
 return {events,data,service,routes,count,movement,adjustments,marker,setFailure(fn){failure=fn;}};
}
