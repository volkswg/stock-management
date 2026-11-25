import {spawnSync} from 'node:child_process';
import {checkEnvironment} from './check-environment.mjs';
try {
  checkEnvironment();
  // The canonical runner isolates the native files and reconstructs historical
  // source. Never replace it with a glob against physical current source.
  const result=spawnSync(process.execPath,['tools/native-postgres/test.mjs'],{env:{PATH:process.env.PATH,CI:'1'},stdio:'inherit'});
  if(result.error) throw new Error('Canonical test runner could not execute. Use exact-SHA GitHub acceptance; this is not a pass.');
  process.exitCode=result.status ?? 1;
} catch(error) {console.error(error.message);process.exitCode=1;}
