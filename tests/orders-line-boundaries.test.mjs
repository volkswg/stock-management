import {restoreExternalSource} from "./helpers/external-history.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ESLint} from 'eslint';
import {userStateGraph} from './helpers/user-state-worksheet-graph.mjs';
import {ordersLineGraph} from './helpers/orders-line-source.mjs';
import {ordersLineBefore,restoreOrdersLineSource} from './helpers/orders-line-history.mjs';
import {ordersLineNewFiles} from './helpers/orders-line-ownership.mjs';

test('Orders/LINE physical ownership, source witnesses and legacy enum/helper/function identities remain explicit',()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex');
 for(const [file,e]of Object.entries(ordersLineBefore.files))assert.equal(hash(restoreOrdersLineSource(file)),e.sha256,file);
 for(const [file,e]of Object.entries(ordersLineBefore.edits))assert.equal(hash(restoreOrdersLineSource(file)),e.sha256,file);
 for(const [file,expected]of Object.entries(ordersLineBefore.ownerHashes))assert.equal(hash(restoreExternalSource(file)),expected,file);
 const g=ordersLineGraph(),orders=g.load('src/modules/orders/server.ts'),line=g.load('src/modules/line-workflows/server.ts');
 for(const file of Object.keys(ordersLineBefore.files).filter(f=>f.startsWith('src/services/orders/'))){for(const [name,value]of Object.entries(g.load(file))){const owner=['isActiveOrderCreateState','isOrderImageUploadState'].includes(name)?g.load('src/modules/orders/rules.ts'):name==='OrderStatus'||name==='OrderItemQuantityType'?g.load('src/modules/orders/contracts.ts'):name==='UserStateFlowName'?g.load('src/modules/line-workflows/contracts.ts'):Object.hasOwn(orders,name)?orders:line;assert.equal(value,owner[name],`${file}:${name}`);}}
 assert.equal(g.load('src/services/line/enum.ts').LineTextCommand,g.load('src/modules/line-workflows/contracts.ts').LineTextCommand);
 assert.equal(g.load('src/externals/line/enum.ts').LineMessageType,g.load('src/shared/types/line-protocol.ts').LineMessageType);
 assert.equal(g.load('src/externals/line/utils/messageBuilder.ts').createTextReplyMessage,g.load('src/shared/lib/line-messages.ts').createTextReplyMessage);
});

test('full current Orders/LINE graphs are acyclic, have only public feature edges and leave all browser graphs provider-free',()=>{
 const g=userStateGraph();for(const types of [false,true]){
  g.modules(types);const seen=new Set(),active=[];function visit(file){assert.ok(!active.includes(file),[...active,file].join(' -> '));if(seen.has(file))return;active.push(file);g.deps(file,types).forEach(visit);active.pop();seen.add(file);}g.all.forEach(visit);
  for(const file of ordersLineNewFiles.filter(f=>/\/(application|domain)\//.test(f)))assert.equal(g.trace(file,types,f=>/^src\/(?:services|externals|infrastructure|config|app)\//.test(f)||/\/modules\/[^/]+\/(?:server\.ts|infrastructure\/)/.test(f)),null,file);
  for(const file of g.all.filter(f=>f.startsWith('src/shared/')||f.startsWith('src/infrastructure/')))assert.equal(g.trace(file,types,f=>f.startsWith('src/modules/')),null,file);
  for(const root of g.all.filter(f=>/^\s*['"]use client['"]/.test(readFileSync(f,'utf8'))))assert.equal(g.trace(root,types,f=>/^src\/(?:services|externals|infrastructure|config)\//.test(f)||/\/modules\/[^/]+\/(?:server\.ts|application\/|infrastructure\/)/.test(f)),null,root);
  const core='src/modules/line-workflows/application/movement-events.ts';assert.ok(userStateGraph({[core]:'export {getConfig} from "@/config";'}).trace(core,types,f=>f==='src/config/index.ts'));
 }
});

test('new exact lint scopes reject provider/private/legacy, erased, relative, dynamic and implicit clock bypasses',async()=>{
 const eslint=new ESLint();for(const file of ordersLineNewFiles.filter(f=>/\/(application|domain)\//.test(f)||f.startsWith('src/shared/'))){
  const [ok]=await eslint.lintText(readFileSync(file,'utf8'),{filePath:file});assert.equal(ok.errorCount,0,JSON.stringify(ok.messages));
  for(const code of ['export type {GoogleSheetRow} from "@/externals/google/sheet";','export {getConfig} from "../../../../config";','export {saveMaster} from "@/services/movements/state";','export {OrderItemsSheet} from "@/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet";','export const x=import("@/config");','export type X=import("@/config").AppConfig;','export const x=require("node:fs");','export const x=process.env.LINE_CHANNEL_SECRET;','export const x=fetch("https://example.test");',...(/\/(application|domain)\//.test(file)?['export const x=Date.now();','export const x=new Date();']:[])]){const [bad]=await eslint.lintText(code,{filePath:file});assert.ok(bad.errorCount>0,file+code);}
 }
});

test('neutral batch repair retries only the original invalid-range 400 and awaits each repair before rereading',async()=>{
 const {readAndRepairRows}=ordersLineGraph().load('src/infrastructure/persistence/google-sheets/read-and-repair-rows.ts');
 for(const error of [new Error('Google Sheets API request failed: 500 Unable to parse range'),new Error('Google Sheets API request failed: 400 quota'),new Error('Unable to parse range'),{message:'Google Sheets API request failed: 400 Unable to parse range'}]){let repairs=0,reads=0;await assert.rejects(readAndRepairRows([{headers:['id'],headerRange:'A1',sheet:()=>({ensureExists:async()=>repairs++})}],async()=>{reads++;throw error;}),e=>e===error);assert.equal(repairs,0);assert.equal(reads,1);}
 const events=[];let release,reads=0;let entered;const start=new Promise(r=>entered=r);const gate=new Promise(r=>release=r),headers=['id'];const pending=readAndRepairRows([{headers,headerRange:'A1',sheet:()=>({ensureExists:async()=>{events.push('ensure');entered();await gate;},updateRows:async(range,values)=>{assert.equal(values[0],headers);events.push(['write',range]);}})}],async()=>{events.push('read');if(++reads===1)throw new Error('Google Sheets API request failed: 400 Unable to parse range');return [[]];});await start;assert.deepEqual(events,['read','ensure']);release();await pending;assert.deepEqual(events,['read','ensure','read',['write','A1']]);
});
