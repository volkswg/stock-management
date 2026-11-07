import { googleGraph } from './google-infrastructure.mjs';
import { movementSchemaGraph } from './movement-schema-history.mjs';
import { plain } from './load-source.mjs';
export async function userStateWorkflow(historical=false) {
 const g=googleGraph({historical}),events=[],rows=[];
 class Clock extends Date { constructor(...args){super(...(args.length?args:['2026-11-07T00:00:00.000Z']));} }
 const state=movementSchemaGraph({globals:{Date:Clock}}).state(),{UserStateSheet}=g.load("src/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet.ts");
 let failure;
 const client={getValues:async(...args)=>{events.push(['read',...args]);if(failure){const e=failure;failure=undefined;throw e;}return rows.map(r=>r.slice());},updateValues:async(name,range,values)=>{events.push(['update',name,range,plain(values)]);const at=Number(/\d+/.exec(range)[0])-1;values.forEach((r,i)=>{rows[at+i]=Array.from(r);});},appendValues:async(name,range,values)=>{events.push(['append',name,range,plain(values)]);rows.push(...values.map(r=>Array.from(r)));},deleteRow:async(name,row)=>{events.push(['delete',name,row]);rows.splice(row-1,1);},ensureWorksheet:async name=>events.push(['ensure',name])};
 const sheets={userState:new UserStateSheet(client,'Session')},input={masterId:'M',itemId:'I',userId:'U',step:'shop',startedAt:'start',shop:'',quantity:'',remark:'',imageUrl:'',lastEventId:'E'};
 await state.saveMovementState(sheets,input);const first=await state.readMovementSession(sheets,'U','E');await state.saveMovementState(sheets,{...input,step:'quantity',shop:'Shop',lastEventId:'E2'});const second=await state.readMovementSession(sheets,'U','different');await state.saveMovementState(sheets,{...input,step:'complete'});
 failure=new Error('Google Sheets API request failed: 400 Unable to parse range');await state.readMovementTables(sheets,['userState']);
 const marker=new Error('quota');failure=marker;let same=false;try{await state.readMovementTables(sheets,['userState']);}catch(e){same=e===marker;}
 // Batch/fallback and header validation retain their original evaluation order.
 sheets.readMovementRanges=async ranges=>{events.push(['batch',plain(ranges)]);return [rows.map(r=>r.slice())];};await state.readMovementTables(sheets,['userState']);
 return plain({first,second,rows,events,same});
}
