/** Token-free, application-only release packets for an approved Cloud operator.
 * No provider, production-data query, deployment or configuration write occurs here.
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,chmodSync,lstatSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const TARGET=Object.freeze({repository:'volkswg/stock-management',project:'prj_XH4nEje5cicuBuucGumuHgr73l1E',team:'team_bkDqHUBMbLyAXmwZqvCmovcu',ref:'hzynvirpedqnvtbifobx',isolation:'349b9289-f684-4ec5-ac22-924b2be1946b',host:'aws-1-ap-northeast-1.pooler.supabase.com',domain:'inventra-beta-one.vercel.app',region:'hnd1'});
const requireGate=(condition,message)=>{if(!condition)throw new Error(message);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const deployment=value=>typeof value==='string'&&/^dpl_[A-Za-z0-9]+$/.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function stateFingerprint(project,firewall) {
  // Operate on Vercel's encrypted variable metadata only. Never request/pull
  // runtime secret values, and never include the input project in an output packet.
  const variables=project.env.filter(e=>!(e.key==='STOCK_PRODUCTION_RELEASE_JSON'&&JSON.stringify(e.target)==='["production"]')).map(e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['createdAt','updatedAt'].includes(k)))).sort((a,b)=>a.id.localeCompare(b.id));
  return hash({variables,firewall,regions:project.resourceConfig,autoAssign:project.autoAssignCustomDomains,protection:Object.fromEntries(['passwordProtection','ssoProtection','trustedIps','protectionBypass','security','trustedSources'].map(k=>[k,project[k]]))});
}
function bindingGate(binding) {
  const keys=['version','projectRef','isolationId','databaseHost','connectionMode','runtimeUser','vercelProjectId','sourceCommit','accessPolicy'];
  requireGate(binding?.version===1&&Object.keys(binding).length===keys.length&&Object.keys(binding).every(k=>keys.includes(k)),'Only the existing non-secret release binding is accepted.');
  requireGate(binding?.projectRef===TARGET.ref&&binding.isolationId===TARGET.isolation&&binding.vercelProjectId===TARGET.project&&binding.runtimeUser==='stock_prod_runtime'&&binding.databaseHost===TARGET.host&&binding.connectionMode==='transaction'&&binding.accessPolicy==='legacy-as-is'&&sha(binding.sourceCommit),'Unexpected production binding; stop for review.');
}
function snapshotGate(input) {
  const {project,live,binding,firewall}=input;
  requireGate(project?.id===TARGET.project&&project.accountId===TARGET.team&&project.link?.org==='volkswg'&&project.link?.repo==='stock-management'&&/^[0-9]+$/.test(String(project.link.repoId)),'Wrong Vercel project/team/repository.');
  requireGate(project.autoAssignCustomDomains===false,'Domain auto-assignment must stay disabled.');
  requireGate(Array.isArray(project.env)&&project.env.every(e=>typeof e.id==='string'),'Missing encrypted environment metadata.');
  requireGate(deployment(live?.id)&&live.projectId===TARGET.project&&live.readyState==='READY'&&live.meta?.githubCommitSha===binding?.sourceCommit&&project.targets?.production?.id===live.id,'Live deployment/binding mismatch.');
  requireGate(input.aliasDeploymentId===live.id,'Canonical domain deployment mismatch.');
  requireGate(firewall&&Array.isArray(firewall.rules)&&!firewall.rules.some(r=>/maintenance/i.test(r.name||'')),'Existing maintenance or incomplete firewall snapshot; use its supervised operator.');
  requireGate(!project.crons?.definitions?.length,'Scheduled jobs require separate release review.');
  bindingGate(binding);
}
export function stagePacket(input) {
  snapshotGate(input);
  const {source,ci,project,binding,live,firewall}=input;
  requireGate(sha(source?.sha)&&source.sha===source.mainSha&&sha(source.tree),'Release source must be verified merged main.');
  requireGate(source.baseSha===binding.sourceCommit,'Changed paths must compare from the actual live source.');
  requireGate(ci?.status==='completed'&&ci.conclusion==='success'&&ci.repository===TARGET.repository&&ci.workflowPath==='.github/workflows/migration-acceptance.yml'&&sha(ci.sha)&&ci.tree===source.tree,'Exact source/tree CI evidence is required.');
  requireGate(Array.isArray(source.changedPaths)&&source.changedPaths.length>0&&source.changedPaths.every(p=>typeof p==='string'&&!p.startsWith('/')&&!p.split('/').includes('..')),'Provide the complete comparison from live source to release source.');
  requireGate(!source.changedPaths.some(p=>/^(supabase\/|tools\/migration\/|tools\/product-uat\/.*\.sql$|\.env|vercel\.json$)/.test(p)),'Database/environment changes require the Mac recovery and maintenance packet; application-only release refused.');
  const variable=project.env.filter(e=>e.key==='STOCK_PRODUCTION_RELEASE_JSON'&&JSON.stringify(e.target)==='["production"]');
  requireGate(variable.length===1&&/^[A-Za-z0-9_-]+$/.test(variable[0].id),'Expected one production source-binding variable.');
  const next={...binding,sourceCommit:source.sha};
  const manifest={version:1,target:TARGET,source:source.sha,tree:source.tree,ciSha:ci.sha,previousSource:binding.sourceCommit,previousDeployment:live.id,releaseVariableId:variable[0].id,baselineFingerprint:stateFingerprint(project,firewall),afterBinding:next,applicationOnly:true,ownerApprovalRequired:true,noTemporaryAccessLink:true,noBusinessRecordsOrCredentials:true};
  return {manifest,bindingPatch:{value:JSON.stringify(next)},rollbackBinding:{value:JSON.stringify(binding)},deploymentRequest:{name:'stock-management',project:TARGET.project,target:'production',autoAssignCustomDomains:false,regions:[TARGET.region],gitSource:{type:'github',repoId:String(project.link.repoId),sha:source.sha,ref:source.sha},meta:{releaseReason:'owner-approved-cloud-application-release',stockReleaseSource:source.sha,stockReleasePreviousDeployment:live.id}},requests:[{phase:'AFTER_OWNER_STAGE_APPROVAL',method:'PATCH',path:`/v9/projects/${TARGET.project}/env/${variable[0].id}`,bodyFile:'bindingPatch.json'},{phase:'AFTER_OWNER_STAGE_APPROVAL',method:'POST',path:'/v13/deployments?forceNew=1',bodyFile:'deploymentRequest.json'}]};
}
export function readyPacket(input,manifest) {
  const {project,binding,live,firewall,staged}=input;
  requireGate(manifest?.version===1&&manifest.target?.project===TARGET.project&&sha(manifest.source)&&deployment(manifest.previousDeployment),'Invalid release manifest.');
  requireGate(project?.id===TARGET.project&&project.accountId===TARGET.team&&input.aliasDeploymentId===manifest.previousDeployment&&live?.id===manifest.previousDeployment&&project.targets?.production?.id===manifest.previousDeployment,'Live routing changed during staging.');
  requireGate(stateFingerprint(project,firewall)===manifest.baselineFingerprint,'Unrelated environment/protection/firewall drift.');
  bindingGate(binding);requireGate(JSON.stringify(canonical(binding))===JSON.stringify(canonical(manifest.afterBinding)),'Source binding changed during staging.');
  requireGate(deployment(staged?.id)&&staged.projectId===TARGET.project&&staged.target==='production'&&staged.readyState==='READY'&&staged.autoAssignCustomDomains===false&&JSON.stringify(staged.regions)==='["hnd1"]'&&staged.meta?.githubCommitSha===manifest.source&&staged.meta?.stockReleasePreviousDeployment===manifest.previousDeployment&&!staged.protectionBypass,'Staged build source, region or protection mismatch.');
  requireGate(input.protectedDeploymentVerified===true,'Verify staged host denies access without a bypass; no new link is authorized.');
  return {source:manifest.source,deployment:staged.id,ownerPromotionApprovalRequired:true,promotionCommand:['vercel','promote',staged.id,'--yes'],rollbackCommand:['vercel','promote',manifest.previousDeployment,'--yes'],rollbackBindingFile:'rollbackBinding.json',headChecks:['/api/orders','/api/movements','/api/products','/api/shipments'],rejectedProbes:[{path:'/api/orders/cloud-release-guard-no-record',method:'PATCH',body:'{}',expected:428},{path:'/api/line/webhook',method:'POST',body:'{"events":[]}',headers:{'x-line-signature':'invalid-cloud-release-check'},expected:401}],privateRecordReadsAllowed:false,writeCanariesAllowed:false,rollbackOnFailedChecks:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2),phase=args.shift();
    const flag=name=>{const i=args.indexOf(name);requireGate(i>=0&&args[i+1],`Missing ${name}.`);return args[i+1];};
    const input=JSON.parse(readFileSync(flag('--input'),'utf8'));
    const result=phase==='stage-plan'?stagePacket(input):phase==='ready-plan'?readyPacket(input,JSON.parse(readFileSync(flag('--manifest'),'utf8'))):null;
    requireGate(result,'Use stage-plan or ready-plan; this command never deploys.');
    const out=resolve(flag('--out'));requireGate(!existsSync(out)||!lstatSync(out).isSymbolicLink(),'Output directory may not be a symlink.');mkdirSync(out,{recursive:true,mode:0o700});chmodSync(out,0o700);
    for(const [name,value] of Object.entries(result))writeFileSync(resolve(out,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify({prepared:true,phase,providerWrites:0,ownerApprovalRequired:true}));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
