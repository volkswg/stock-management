/* eslint-disable @typescript-eslint/no-require-imports -- Invoke the actual pure LINE consumer offline. */
require('../../tests/helpers/postgres-runtime.cjs');
const {readMovementSession}=require('../../src/modules/line-workflows/application/sessions.ts');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const metadata=entry=>entry==null?entry:Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='context'));
function contextValue(entry){
 const value=String(entry?.context??'');
 if(!value.trim())return {kind:'blank'};
 try{return {kind:'json',value:JSON.parse(value)};}catch{return {kind:'invalid',value};}
}
async function outcome(user,entry,eventId){
 const erased=[];
 const store={read:async()=>({latestForReading:()=>entry,eraseMovement:async id=>{erased.push(id);}})};
 try{return {result:await readMovementSession(store,user,eventId),erased};}
 catch(error){return {error:error.message,erased};}
}
async function compareLineSelections(before,after){
 if(before.length!==after.length)return {match:false,reason:'selection cardinality'};
 for(let i=0;i<before.length;i++){
  const left=before[i],right=after[i];
  if(left.user!==right.user)return {match:false,reason:'selection ordering'};
  for(const key of ['read','write']){
   if(!equal(metadata(left[key]),metadata(right[key])))return {match:false,reason:'selected identity/state/chronology'};
   // This is the existing JSON consumer contract, not raw-text normalization.
   // Blank and JSON null stay distinct; arrays, types and parsed values stay exact.
   if(!equal(contextValue(left[key]),contextValue(right[key])))return {match:false,reason:'context meaning'};
  }
  const context=contextValue(left.read),events=['lexeme-final-offline-probe'];
  if(context.kind==='json'&&typeof context.value?.lastEventId==='string'&&context.value.lastEventId)events.push(context.value.lastEventId);
  for(const event of events){
   if(!equal(await outcome(left.user,left.read,event),await outcome(right.user,right.read,event)))return {match:false,reason:'LINE parse/replay/erase outcome'};
  }
 }
 return {match:true,usersCompared:before.length,actualParserInvoked:true,providerCalls:false};
}
module.exports={compareLineSelections};
