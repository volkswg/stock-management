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
 run('node',['--test','tests/native-postgres/order-page-size.test.mjs']);
 run('node',['--test','tests/native-postgres/order-list-pagination.test.mjs']);
 run('node',['--test','tools/cloud/workflow.test.mjs']);
 run('node',['--test','tests/native-postgres/order-seller.test.cjs','tests/native-postgres/order-seller-ui.test.mjs']);
 run('node',['--test','tests/native-postgres/movement-shop-ids.test.cjs']);
 run('node',['--test','tests/native-postgres/connection-pooling.test.cjs']);
 run('node',['--test','tests/native-postgres/product-catalogue.test.mjs','tests/native-postgres/product-uat-gateway.test.cjs','tests/native-postgres/product-catalogue-ui.test.mjs','tests/native-postgres/product-master-page.test.mjs']);
 run('node',['--test','tests/postgres-browser-keys.test.mjs']);
 run('node',['--test','tests/native-postgres/lean-sales.test.cjs']);
 run('node',['--test','tests/native-postgres/receipt-payments-jsonb.test.cjs']);
 run('node',['--test','tests/native-postgres/contracts.test.mjs']);
 run('node',['--test','tests/native-postgres/sales-naming.test.cjs']);
 run('node',['--test','tests/native-postgres/api-fields.test.cjs']);
 run('node',['--test','tests/native-postgres/wrapper-cleanup.test.cjs']);
 run('node',['--test','tests/native-postgres/order-detail-shipment.test.cjs']);
 run('node',['--test','tests/native-postgres/order-image-uploads.test.mjs']);
 run('node',['--test','tests/postgres-accounts.test.cjs']);
 run('node',['--test','tests/bill-identity.test.cjs']);
 run('node',['--test','tests/user-state-identity.test.cjs']);
 run('node',['--test','tests/item-identity.test.cjs']);
 run('node',['--test','tests/movement-reference-retirement.test.cjs']);
 run('python3',['-m','unittest','discover','-s','tools/migration','-p','test_loyverse_accounts.py']);
} finally {rmSync(owned,{recursive:true,force:true});}
