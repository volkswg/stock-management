/* eslint-disable @typescript-eslint/no-require-imports -- Actual current application owners with synthetic semantic ports only. */
require('../helpers/postgres-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {classifyLineEvent}=require('../../src/modules/line-workflows/application/classify-event.ts');
const {handleMovementEvent}=require('../../src/modules/line-workflows/application/movement-events.ts');
const {readMovementSession}=require('../../src/modules/line-workflows/application/sessions.ts');
const {getMonthlyStockCounts}=require('../../src/modules/inventory/application/stock-counts.ts');
const {createMovementStore}=require('../../src/modules/inventory/infrastructure/postgres/movements.ts');
const runtime={now:()=> '2026-11-22T01:00:00.000Z',createId:(()=>{let id=0;return()=>String(++id);})(),eventTime:()=> '2026-11-22T01:00:00.000Z',error:()=>{},received:()=>{}};
function fixture(shops=[{id:'S1',name:'Renamed NJ',active:true,aliases:['NJ']},{id:'S2',name:'YY',active:true,aliases:[]}],state){
 let saved=state;const writes=[],items=[],replies=[];let uploads=0;
 const snapshot={latestForReading:()=>saved?{id:'state',referenceId:saved.masterId,step:saved.step,context:JSON.stringify(saved)}:undefined,findForWriting:()=>saved?{id:'state',referenceId:saved.masterId}:undefined,nextIdentifier:async()=> 'state',eraseMovement:async()=>{saved=undefined;},writeMovement:async(_,value)=>{saved=JSON.parse(value.context);writes.push(saved);}};
 const context={shops:async()=>shops,sessions:{findLatest:async()=>undefined},movements:{read:async()=>snapshot},inventory:{sync:async()=>items,items:async()=>items,resumable:async()=>undefined,append:async read=>items.push(read())},photoContext:async()=>({sessions:snapshot,items:()=>items})};
 const line={sendReply:async(_,messages)=>replies.push(...messages),downloadMessageContent:async()=>({contentType:'image/jpeg',bytes:Buffer.from('synthetic')})};
 const drive=()=>({uploadImage:async()=>{uploads++;return{id:'synthetic',webViewLink:'https://example.test/synthetic'};}});
 let serial=0;
 const event=(text,{postback=false,image=false,id}={})=>({type:postback?'postback':'message',source:{userId:'user'},webhookEventId:id||'event-'+(++serial),replyToken:'reply',...(postback?{postback:{data:text}}:{message:{id:id||'message-'+serial,type:image?'image':'text',text}})});
 async function send(text,options={},mode='quantity_photo'){
  const e=event(text,options),classification=await classifyLineEvent({event:e,getContext:()=>context});
  if(classification.kind==='movement')await handleMovementEvent({event:classification.event,session:classification.session,context,line,drive,publicBaseUrl:'',createMode:mode,runtime});
  return classification;
 }
 return{send,event,context,items,replies,writes,get state(){return saved;},get uploads(){return uploads;}};
}
const oldState=(extra={})=>({masterId:'M1',itemId:'D1',userId:'user',step:'product_image',startedAt:runtime.now(),shop:'NJ',quantity:'7',remark:'original note',imageUrl:'https://example.test/already-uploaded',lastEventId:'previous',...extra});
const selection=(master,id)=>`movement:shop:${encodeURIComponent(master)}:${encodeURIComponent(id)}`;

test('LINE lists active master names, submits stable IDs and persists the selected identity',async()=>{
 const f=fixture();await f.send('create:new-movement');const master=f.state.masterId;
 const choices=f.replies.at(-1).quickReply.items;assert.deepEqual(choices.map(x=>x.action.label),['Renamed NJ','YY']);assert.equal(choices[0].action.displayText,'Renamed NJ');
 assert.equal(choices[0].action.data,selection(master,'S1'));await f.send(choices[0].action.data,{postback:true});
 assert.equal(f.state.shopId,'S1');assert.equal(f.state.shop,'Renamed NJ');assert.equal(f.state.step,'quantity');
 await f.send('3 original note');await f.send('',{image:true,id:'photo-1'});assert.equal(f.items.length,1);assert.equal(f.items[0].shopId,'S1');assert.equal(f.items[0].fromLocation,'Home');assert.equal(f.items[0].quantity,'3');assert.equal(f.uploads,1);
 // Distinct redelivery event sees the confirmed item rather than uploading again.
 const retry=fixture(undefined,oldState({shopId:'S1',imageUrl:''}));retry.items.push({...f.items[0],id:'D1'});await retry.send('',{image:true,id:'photo-redelivery'});assert.equal(retry.items.length,1);assert.equal(retry.uploads,0);
});

test('already-visible legacy text uses retained mapped labels after a master rename',async()=>{
 const f=fixture();await f.send('create:new-movement');await f.send('nj');assert.equal(f.state.shopId,'S1');assert.equal(f.state.shop,'Renamed NJ');
});

test('old pending sessions gain only identity and preserve quantities, notes and confirmed image URLs',async()=>{
 const f=fixture(undefined,oldState());await f.send('',{image:true});assert.equal(f.items[0].shopId,'S1');assert.equal(f.items[0].shop,'NJ');assert.equal(f.items[0].quantity,'7');assert.equal(f.items[0].remark,'original note');assert.equal(f.items[0].imageUrl,'https://example.test/already-uploaded');assert.equal(f.uploads,0);
});

test('ambiguous legacy destination stops before providers; explicit ID confirmation preserves the pending step',async()=>{
 const f=fixture([{id:'S1',name:'First',active:true,aliases:['NJ']},{id:'S2',name:'Second',active:true,aliases:['NJ']}],oldState());
 await f.send('',{image:true});assert.equal(f.items.length,0);assert.equal(f.uploads,0);assert.equal(f.writes.length,0);assert.match(f.replies.at(-1).text,/needs confirmation/);
 await f.send(selection('M1','S2'),{postback:true});assert.equal(f.state.shopId,'S2');assert.equal(f.state.step,'product_image');assert.equal(f.state.quantity,'7');assert.equal(f.state.imageUrl,oldState().imageUrl);
});

test('inactive, unknown and stale-movement callbacks never change the selected destination',async()=>{
 const shops=[{id:'S1',name:'NJ',active:true,aliases:[]},{id:'S2',name:'Inactive',active:false,aliases:[]}],f=fixture(shops);await f.send('create:new-movement');const master=f.state.masterId;
 assert.equal(f.replies.at(-1).quickReply.items.length,1);
 for(const data of [selection(master,'S2'),selection(master,'missing'),selection('different-movement','S1'),'movement:shop:%broken:S1']){await f.send(data,{postback:true});assert.equal(f.state.step,'shop');assert.equal(f.state.shopId,undefined);}
});

test('pagination respects LINE quick-reply limits and displays names rather than technical IDs',async()=>{
 const shops=Array.from({length:28},(_,i)=>({id:'ID'+i,name:'Destination '+i,active:true,aliases:[]})),f=fixture(shops);await f.send('create:new-movement');
 const first=f.replies.at(-1).quickReply.items;assert.ok(first.length<=13);assert.equal(first.length,12);assert.equal(first.at(-1).action.label,'More shops');
 await f.send(first.at(-1).action.data,{postback:true});const middle=f.replies.at(-1).quickReply.items;assert.equal(middle.length,13);assert.equal(middle[0].action.displayText,'Destination 11');
 assert.equal(f.state.step,'shop');assert.ok(middle.every(item=>[...item.action.label].length<=20));
});

test('empty master has no fixed NJ/YY fallback and preserves a resumable draft',async()=>{
 const f=fixture([]);await f.send('create:new-movement');assert.equal(f.state.step,'shop');assert.match(f.replies.at(-1).text,/No active shops/);assert.equal(f.replies.at(-1).quickReply,undefined);await f.send('NJ');assert.equal(f.state.shopId,undefined);
});

test('processed images and photo-only IDs retain stable shop identity without double counting',async()=>{
 const f=fixture(undefined,oldState({shopId:'S1',shop:'NJ',step:'close_bag',imageUrl:'',lastEventId:'already'}));f.items.push({id:'D0',shopId:'S1',shop:'Earlier label',imageUrl:'saved'});
 await f.send('',{image:true,id:'already'},'photo_only');assert.equal(f.uploads,0);assert.equal(f.items.length,1);
 await f.send('',{image:true,id:'new-photo'},'photo_only');assert.equal(f.items[1].shopId,'S1');assert.equal(f.items[1].id,'MOVED-LINE-new-photo');assert.equal(f.state.shopId,'S1');
});

test('malformed saved shop IDs fail before any event or provider processing',async()=>{
 const f=fixture(undefined,oldState({shopId:42}));await assert.rejects(readMovementSession(f.context.movements,'user','e'),/invalid shop identity/);
});

function table(rows){return{prepare:async()=>{},all:async()=>rows,update:async()=>{}};}
test('movement projection groups ID quantities separately while preserving saved labels and null-ID history',async()=>{
 const details=[{id:'D1',movementMasterId:'M',shopId:'S1',shopName:'Old NJ',quantity:'2'},{id:'D2',movementMasterId:'M',shopId:'S1',shopName:'New NJ',quantity:'3'},{id:'D3',movementMasterId:'M',shopName:'YY',quantity:'4'}];
 const store=createMovementStore({movementMasters:table([{id:'M',status:'delivered'}]),movementDetails:table(details)});
 const items=(await store.readDetails()).records(),master=(await store.readMasters()).entries()[0].project(items);
 assert.deepEqual(master.shopIdQuantities,{S1:5});assert.deepEqual(master.unlinkedShopQuantities,{YY:4});assert.deepEqual(master.shopQuantities,{'Old NJ':2,'New NJ':3,YY:4});assert.equal(items[0].shopId,'S1');assert.equal(Object.hasOwn(items[2],'shopId'),false);
});

async function counts(movements,shops){return getMonthlyStockCounts({accounts:[{id:'A1',shopName:'NJ'},{id:'A2',shopName:'YY'}],month:'2026-11',runtime:{now:runtime.now,today:()=> '2026-11-22',uuid:()=> 'id'},store:{prepare:async()=>{},read:async()=>({records:()=>[]})},readers:{movements:async()=>movements,shops:async()=>shops,adjustments:async()=>[],sales:async()=>({shopSeries:[]})}});}
const delivered=extra=>({status:'delivered',deliverDateTime:'2026-11-12T01:00:00Z',shopQuantities:{NJ:9},...extra});
test('stock-in follows stable shop/account mapping through renames without double counting',async()=>{
 const result=await counts([delivered({shopIdQuantities:{S1:5},unlinkedShopQuantities:{YY:4}})],[{id:'S1',loyverseAccountId:'A2'}]);assert.deepEqual(result.map(row=>row.stockIn),[0,9]);
});
test('an unmapped ID never falls back to a misleading name; legacy null-ID deliveries still work',async()=>{
 const result=await counts([delivered({shopIdQuantities:{missing:9},unlinkedShopQuantities:{}}),delivered({shopQuantities:{NJ:2}})],[]);assert.deepEqual(result.map(row=>row.stockIn),[2,0]);assert.match(result[0].warnings.join(' '),/no configured sales-account mapping/);
});
test('non-delivered and other-month ID quantities are not counted or warned about',async()=>{
 const result=await counts([delivered({status:'created',shopIdQuantities:{missing:7}}),delivered({deliverDateTime:'2026-10-01T00:00:00Z',shopIdQuantities:{missing:8}})],[]);assert.deepEqual(result.map(row=>row.stockIn),[0,0]);assert.ok(result.every(row=>!row.warnings.some(w=>w.includes('mapping'))));
});

test('actual web grouping keeps one stable shop together through renames and separates equal names with different IDs',()=>{
 const filename='src/app/movements/[id]/MovementDetailPage.tsx',source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='groupByShop');assert.ok(fn);const output=ts.transpileModule(fn.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const scope={};vm.runInNewContext(output,scope);const grouped=scope.groupByShop([{shopId:'S1',shopName:'Old'},{shopId:'S1',shopName:'New'},{shopId:'S2',shopName:'New'},{shopName:'Legacy'}]);assert.deepEqual(Object.keys(grouped),['S1','S2','Legacy']);assert.equal(grouped.S1.length,2);assert.equal(grouped.S2.length,1);
});

test('missing or deleted saved shop identity stops before any new image upload',async()=>{
 for(const [shops,state] of [[[],oldState({shop:'',shopId:undefined})],[[{id:'S1',name:'NJ',active:false,deleted:true,aliases:['NJ']}],oldState({shopId:'S1'})]]){
  const f=fixture(shops,state);await f.send('',{image:true});assert.equal(f.uploads,0);assert.equal(f.items.length,0);assert.match(f.replies.at(-1).text,/progress is kept/);
 }
});

test('a previously selected inactive shop can finish pending work but is not offered for new selection',async()=>{
 const f=fixture([{id:'S1',name:'NJ',active:false,aliases:[]}],oldState({shopId:'S1'}));await f.send('',{image:true});assert.equal(f.items.length,1);assert.equal(f.items[0].shopId,'S1');assert.equal(f.uploads,0);
});

test('master names that are JavaScript object keys still produce numeric totals',async()=>{
 const details=[{id:'P',movementMasterId:'M',shopId:'S',shopName:'__proto__',quantity:'2'},{id:'C',movementMasterId:'M',shopId:'S',shopName:'constructor',quantity:'3'}];
 const store=createMovementStore({movementMasters:table([{id:'M'}]),movementDetails:table(details)});const records=(await store.readDetails()).records();const master=(await store.readMasters()).entries()[0].project(records);
 assert.equal(master.shopQuantities.__proto__,2);assert.equal(master.shopQuantities.constructor,3);assert.equal(master.shopIdQuantities.S,5);
});
test('long Unicode labels fit LINE limits and oversized legacy identities stop safely',async()=>{
 const f=fixture([{id:'S',name:'😀'.repeat(25),active:true,aliases:[]}]);await f.send('create:new-movement');assert.ok(f.replies.at(-1).quickReply.items[0].action.label.length<=20);
 const invalid=fixture([{id:'x'.repeat(301),name:'Existing legacy shop',active:true,aliases:[]}]);await invalid.send('create:new-movement');assert.match(invalid.replies.at(-1).text,/operator review/);assert.equal(invalid.uploads,0);
});

test('late repeated destination callbacks with new event IDs cannot become quantities',async()=>{
 const f=fixture([{id:'SHOP-456',name:'NJ',active:true,aliases:[]}]);await f.send('create:new-movement');const data=selection(f.state.masterId,'SHOP-456');await f.send(data,{postback:true});const before=JSON.stringify(f.state),writes=f.writes.length;
 await f.send(data,{postback:true,id:'different-provider-event'});assert.equal(JSON.stringify(f.state),before);assert.equal(f.writes.length,writes);assert.equal(f.state.step,'quantity');assert.equal(f.state.quantity,'');
 await f.send(`movement:shops:${f.state.masterId}:0`,{postback:true});assert.equal(JSON.stringify(f.state),before);assert.equal(f.uploads,0);
});
