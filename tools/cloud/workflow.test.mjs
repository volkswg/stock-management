import test from 'node:test';
import assert from 'node:assert/strict';
import {checkEnvironment} from './check-environment.mjs';
import {stagePacket,readyPacket,TARGET} from './release-packet.mjs';
import {readFileSync} from 'node:fs';
const A='a'.repeat(40),B='b'.repeat(40),TREE='c'.repeat(40);
function fixture(){
 const binding={version:1,projectRef:TARGET.ref,isolationId:TARGET.isolation,vercelProjectId:TARGET.project,runtimeUser:'stock_prod_runtime',databaseHost:TARGET.host,connectionMode:'transaction',accessPolicy:'legacy-as-is',sourceCommit:A};
 const project={id:TARGET.project,accountId:TARGET.team,link:{org:'volkswg',repo:'stock-management',repoId:123},autoAssignCustomDomains:false,targets:{production:{id:'dpl_OLD'}},env:[{id:'binding',key:'STOCK_PRODUCTION_RELEASE_JSON',target:['production'],type:'plain',value:JSON.stringify(binding)},{id:'private',key:'SYNTHETIC_PRIVATE_ENV',target:['production'],type:'encrypted',value:'synthetic-ciphertext-never-output'}],security:{firewallConfigVersion:5}};
 return {project,binding,live:{id:'dpl_OLD',projectId:TARGET.project,readyState:'READY',meta:{githubCommitSha:A}},aliasDeploymentId:'dpl_OLD',firewall:{rules:[],firewallEnabled:true},source:{sha:B,tree:TREE,mainSha:B,changedPaths:['src/modules/orders/ui/api.ts']},ci:{status:'completed',conclusion:'success',repository:TARGET.repository,workflowPath:'.github/workflows/migration-acceptance.yml',sha:B,tree:TREE}};
}
test('Cloud doctor treats denied child execution as blocked and never a passing test',()=>{
 assert.throws(()=>checkEnvironment(()=>({error:{code:'EPERM'},status:null})),/execution is denied.*Do not skip/);
 assert.throws(()=>checkEnvironment(()=>({status:1})),/unavailable/);
 assert.deepEqual(checkEnvironment(()=>({status:0})),{node:24,pythonSubprocess:true,nodeSubprocess:true});
});
test('application-only packet changes just source binding, stages without domains, preserves rollback and emits no secrets',()=>{
 const f=fixture(),p=stagePacket(f);
 assert.deepEqual(JSON.parse(p.bindingPatch.value),{...f.binding,sourceCommit:B});
 assert.deepEqual(JSON.parse(p.rollbackBinding.value),f.binding);
 assert.equal(p.deploymentRequest.autoAssignCustomDomains,false);
 assert.equal(p.deploymentRequest.gitSource.sha,B);assert.deepEqual(p.deploymentRequest.regions,['hnd1']);
 assert.equal(p.manifest.ownerApprovalRequired,true);assert.equal(p.requests.every(r=>r.phase==='AFTER_OWNER_STAGE_APPROVAL'),true);
 assert.ok(!JSON.stringify(p).includes('synthetic-ciphertext-never-output'));
});
test('wrong target, pending CI, unmerged source, schema changes and secret-bearing bindings refuse before planning writes',()=>{
 for(const change of [f=>f.project.accountId='other',f=>f.project.autoAssignCustomDomains=true,f=>f.ci.conclusion='failure',f=>f.ci.tree='d'.repeat(40),f=>f.source.mainSha=A,f=>f.source.changedPaths=['supabase/migrations/new.sql'],f=>f.source.changedPaths=['tools/migration/operator/change.sql'],f=>f.binding.password='synthetic-secret',f=>f.binding.connectionMode='session',f=>f.firewall.rules.push({name:'Existing maintenance'})]){
  const f=fixture();change(f);assert.throws(()=>stagePacket(f));
 }
});
function ready(){const f=fixture(),p=stagePacket(f);return {f:{...f,binding:p.manifest.afterBinding,protectedDeploymentVerified:true,staged:{id:'dpl_NEW',projectId:TARGET.project,target:'production',readyState:'READY',autoAssignCustomDomains:false,regions:['hnd1'],meta:{githubCommitSha:B,stockReleasePreviousDeployment:'dpl_OLD'}}},p};}
test('ready packet requires exact protected build and current baseline; keeps approval separate from preparation',()=>{
 const {f,p}=ready(),result=readyPacket(f,p.manifest);
 assert.equal(result.ownerPromotionApprovalRequired,true);assert.deepEqual(result.promotionCommand,['vercel','promote','dpl_NEW','--yes']);
 assert.deepEqual(result.rollbackCommand,['vercel','promote','dpl_OLD','--yes']);assert.equal(result.privateRecordReadsAllowed,false);
 assert.equal(result.writeCanariesAllowed,false);assert.deepEqual(result.rejectedProbes.map(p=>p.expected),[428,401]);
 for(const change of [f=>f.aliasDeploymentId='dpl_OTHER',f=>f.project.env[1].value='changed',f=>f.firewall.rules.push({name:'New rule'}),f=>f.protectedDeploymentVerified=false,f=>f.staged.protectionBypass={unsafe:true},f=>f.staged.meta.githubCommitSha=A,f=>f.staged.regions=['iad1'],f=>f.staged.readyState='ERROR']){
  const value=ready();change(value.f);assert.throws(()=>readyPacket(value.f,value.p.manifest));
 }
});
test('manual CI uses a validated SHA and isolated run concurrency, never a production credential',()=>{
 const yaml=readFileSync('.github/workflows/migration-acceptance.yml','utf8');
 assert.match(yaml,/workflow_dispatch:/);assert.match(yaml,/\[\[ "\$SOURCE_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
 assert.match(yaml,/github\.event\.pull_request\.number \|\| github\.run_id/);
 assert.doesNotMatch(yaml,/secrets\.|VERCEL_TOKEN|SUPABASE_ACCESS_TOKEN|pull_request_target/);
});
