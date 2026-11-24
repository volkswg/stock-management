import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function checkEnvironment(run=spawnSync) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24, matching migration acceptance CI.');
  for (const [command,args] of [[process.execPath,['-e','process.stdout.write("node-child-ready")']],['python3',['-c','import sys; assert sys.version_info >= (3,9); print("python-ready")']]]) {
    const result=run(command,args,{env:{PATH:process.env.PATH},encoding:'utf8',timeout:15000});
    if(result.error || result.status!==0) {
      const reason=result.error?.code==='EPERM' || result.error?.code==='EACCES' ? 'Process execution is denied by this environment.' : 'A required Node/Python subprocess is unavailable.';
      throw new Error(`${reason} Fix the Cloud environment permissions/setup, or run Migration acceptance on the exact branch/SHA in GitHub Actions. Do not skip tests or weaken database guards.`);
    }
  }
  return {node:24,pythonSubprocess:true,nodeSubprocess:true};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log(JSON.stringify(checkEnvironment()));} catch(error) {console.error(error.message);process.exitCode=1;}
}
