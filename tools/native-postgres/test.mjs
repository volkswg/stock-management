import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const owned=mkdtempSync(join(tmpdir(),'stock-pre-native-'));
function run(command,args,cwd){
 const result=spawnSync(command,args,{cwd,env:{PATH:process.env.PATH,CI:'1'},stdio:'inherit'});
 if(result.status!==0)throw Error(`${command} exited ${result.status}`);
}
try {
 run('python3',['tools/native-postgres/history-copy.py',owned]);
 console.log('Historical regression and type witnesses: pinned pre-native source (not current acceptance)');
 run('npm',['test'],owned);run('npm',['run','typecheck'],owned);
 console.log('Current native PostgreSQL source checks');
 run('node',['--test','tests/native-postgres/contracts.test.mjs']);
 run('node',['--test','tests/postgres-accounts.test.cjs']);
 run('node',['--test','tests/bill-identity.test.cjs']);
 run('python3',['-m','unittest','discover','-s','tools/migration','-p','test_loyverse_accounts.py']);
} finally {rmSync(owned,{recursive:true,force:true});}
