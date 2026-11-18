import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {compareLineSelections}=require('../tools/migration/lexeme-line-proof.cjs');
const state={masterId:'synthetic-master',itemId:'synthetic-item',userId:'synthetic-user',startedAt:'2026-11-18T00:00:00Z',shop:'Synthetic',quantity:'1',remark:'',imageUrl:'',lastEventId:'synthetic-done-event',step:'product_image'};
const entry=context=>({id:'synthetic-session',referenceId:state.masterId,step:state.step,createdAt:state.startedAt,context});
const report=value=>[{user:state.userId,read:value,write:value}];
test('actual LINE parser preserves selection and processed-event outcomes across JSON spelling changes',async()=>{
 const old=entry(' '+JSON.stringify(state)+' '),next=entry(JSON.stringify(Object.fromEntries(Object.entries(state).reverse())));
 const result=await compareLineSelections(report(old),report(next));assert.equal(result.match,true);assert.equal(result.actualParserInvoked,true);
});
test('blank versus JSON null is never normalized away, including completed-session cleanup',async()=>{
 const blank={...entry(''),step:'complete'},jsonNull={...blank,context:'null'};
 assert.equal((await compareLineSelections(report(blank),report(jsonNull))).match,false);
});
test('selected identities, chronology, values, types and context arrays remain exact',async()=>{
 const old=entry(JSON.stringify(state));
 for(const next of [{...old,id:'another-session'},{...old,createdAt:'2026-11-19'},entry(JSON.stringify({...state,quantity:1})),entry(JSON.stringify({...state,unknown:[2,1]}))])assert.equal((await compareLineSelections(report(old),report(next))).match,false);
});
