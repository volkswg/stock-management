/* eslint-disable @typescript-eslint/no-require-imports -- Isolated offline execution of TypeScript application owners. */
const test=require('node:test');
const assert=require('node:assert/strict');
const {compareApplications}=require('./application-parity.cjs');
const catalog=require('./worksheets.json');
const config={months:['2026-11'],accounts:[],asOf:'2026-11-09T00:00:00+07:00'};
function fixture(display='12.34'){
 const source={version:1,spreadsheetId:'synthetic-only',sheets:Object.fromEntries(Object.entries(catalog).map(([t,s])=>[t,{headers:s.headers,rows:[],formattedRows:[]}]))};
 const row=['0002','complete','Synthetic',12.34,'','2026-11-09T01:00:00Z','2026-11-09T01:00:00Z','','synthetic'];
 source.sheets.orders.rows=[row];source.sheets.orders.formattedRows=[[...row.slice(0,3),display,...row.slice(4)]];
 return source;
}
test('offline original application read parity covers modules and retains the production gate',async()=>{
 const source=fixture(),result=await compareApplications(source,source,config);
 assert.equal(result.match,true,JSON.stringify(Object.fromEntries(Object.entries(result.sections).map(([k,v])=>[k,v.match]))));assert.equal(result.cutoverReady,false);
 for(const key of ['orders','orderDetails','shipments','movements','adjustments','employees','compensation','advances','settlements','shops','categories','lineSessions','stock:2026-11','payroll:2026-11','sales:2026-11','profit:2026'])assert.equal(result.sections[key].match,true,key);
});
test('formatted money differences are detected by actual existing application readers',async()=>{
 const source=fixture('12.3'),result=await compareApplications(source,source,config);
 assert.equal(result.match,false);assert.equal(result.sections.orders.match,false);assert.equal(result.cutoverReady,false);
});
test('missing original formatted cells blocks parity instead of assuming compatibility',async()=>{
 const source=fixture();delete source.sheets.orders.formattedRows;
 await assert.rejects(compareApplications(source,source,config));
});
test('an omitted historical month or account cannot produce a complete parity pass',async()=>{
 const source=fixture();source.sheets.orders.rows[0][5]='2020-01-01T00:00:00Z';source.sheets.orders.formattedRows[0][5]='2020-01-01T00:00:00Z';
 source.sheets.shops.rows=[['shop-synthetic','Synthetic',true,'2026-11-09','2026-11-09','account-not-selected']];
 source.sheets.shops.formattedRows=structuredClone(source.sheets.shops.rows);
 const result=await compareApplications(source,source,config);assert.equal(result.match,false);assert.ok(result.coverage.missingMonths.includes('2020-01'));
 // Account column position is taken from canonical headers, not assumed here.
 const column=source.sheets.shops.headers.indexOf('loyverseAccountId');source.sheets.shops.rows[0][column]='account-not-selected';source.sheets.shops.formattedRows[0][column]='account-not-selected';
 const checked=await compareApplications(source,source,config);assert.ok(checked.coverage.missingAccounts.includes('account-not-selected'));
});
