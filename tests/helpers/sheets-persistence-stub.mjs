// Closed legacy characterizations explicitly select Sheets. PostgreSQL and the
// actual request wrapper are executed separately by the real-DB test harness.
export function sheetsPersistenceStub(spec) {
 if(spec==='@/composition/postgres/route')return {withPersistence:handler=>handler};
 if(spec==='@/infrastructure/persistence/postgres/database')return {storageMode:()=> 'google-sheets'};
 if(spec==='../postgres/service')return {createPostgresService:()=>{throw new Error('Use the PostgreSQL harness');}};
 if(spec==='./infrastructure/postgres/webhook')return {processPostgresWebhook:()=>{throw new Error('Use the PostgreSQL harness');}};
}
