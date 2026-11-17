/* eslint-disable @typescript-eslint/no-require-imports -- Actual adapters on disposable synthetic PostgreSQL only. */
require('../../tests/helpers/postgres-runtime.cjs');
global.fetch=()=>{throw Error('Real providers forbidden');};
const test=require('node:test'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.STOCK_DATABASE_URL).hostname,'127.0.0.1');
const {Client}=require('pg');
const nativeQuery=Client.prototype.query;
Client.prototype.query=function(...args){const result=nativeQuery.apply(this,args);return result?.catch?result.catch(error=>{console.error('Synthetic ordinal SQL diagnostic:',error.code,error.message);throw error;}):result;};
const {transaction,currentTransaction,closePool}=require('../../src/infrastructure/persistence/postgres/database.ts');
const {createPostgresService}=require('../../src/composition/postgres/service.ts');
const {createSessionAdapter}=require('../../src/modules/line-workflows/infrastructure/google-sheets/sessions.ts');
const {createMovementJourneyAdapter}=require('../../src/modules/inventory/infrastructure/google-sheets/movement-journeys.ts');
const {GoogleSheetsShipmentOrderLinkStore}=require('../../src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts');
const {GoogleSheetsOrderDetailShipmentProjection}=require('../../src/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection.ts');
const {ShipmentStatus}=require('../../src/modules/shipments/status.ts');
const {listEmployees}=require('../../src/modules/hr/server.ts');
const service=createPostgresService(),query=(sql,values)=>currentTransaction().query(sql,values);
test.after(closePool);
const order=(id,time)=>[id,'waiting_for_total_price','Synthetic','10.00','retained',time,'','','synthetic'];

test('creation order and stable IDs work in both physical schemas with unknowns last',async()=>transaction(true,async()=>{
 assert.equal(Number((await query("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema='stock_operational' AND column_name='row_order'")).rows[0].n),process.env.STOCK_EXPECT_NO_ROW_ORDER==='true'?0:23);
 await service.orders.appendRows('A:I',[order('FA_ORDER_UNKNOWN',''),order('FA_ORDER_TIE_B','2026-11-10T09:00:00+07:00'),order('FA_ORDER_TIE_A','2026-11-10T02:00:00Z'),order('FA_ORDER_OLD','2026-11-01')]);
 assert.deepEqual((await service.orders.readSelectionRows()).filter(r=>String(r[0]).startsWith('FA_ORDER_')).map(r=>r[0]),['FA_ORDER_OLD','FA_ORDER_TIE_A','FA_ORDER_TIE_B','FA_ORDER_UNKNOWN']);
}));
test('actual LINE latest choices put unknown dates last and retain numeric allocation after reversal',async()=>transaction(true,async()=>{
 const rows=[];
 for(const [flow,user,start] of [['OrderCreate','FA_LINE_ORDER',91000],['MovementCreate','FA_LINE_MOVEMENT',92000]]){
  for(const [offset,created] of [[3,'2026-11-10'],[1,'2026-11-01'],[2,'']])rows.push([String(start+offset),user,flow,'FA_ORDER_OLD','waiting_for_bill_image',created,'','']);
 }
 rows.push(['91004','FA_LINE_ORDER','OrderCreate','FA_ORDER_OLD','waiting_for_bill_image','2026-11-10','','']);
 for(const id of ['93002','93001'])rows.push([id,'FA_LINE_ALL_UNKNOWN','OrderCreate','FA_ORDER_OLD','waiting_for_bill_image','','','']);
 await service.userState.appendRows('A:H',rows);
 const sessions=createSessionAdapter(service,createMovementJourneyAdapter(service));
 assert.equal((await sessions.orders.findLatest('FA_LINE_ORDER','OrderCreate')).id,'91003');
 assert.equal((await sessions.orders.findLatest('FA_LINE_ALL_UNKNOWN','OrderCreate')).id,'93001');
 const snapshot=await sessions.movements.read();
 assert.equal(snapshot.latestForReading('FA_LINE_MOVEMENT').id,'92003');
 const selected=snapshot.findForWriting(()=>'FA_LINE_MOVEMENT');assert.equal(selected.id,'92003');
 assert.equal(snapshot.nextIdentifier(),'93003');
 assert.equal(await createPostgresService().userState.nextRecordNumber(),93004);
 await snapshot.writeMovement(selected,{id:'92003',userId:'FA_LINE_MOVEMENT',flowname:'MovementCreate',referenceId:'FA_ORDER_OLD',state:'waiting_for_quantity',createdAt:selected.createdAt,updatedAt:'2026-11-11',context:''});
 const state=(await query('SELECT state FROM stock_operational.user_state WHERE id=$1',['92003'])).rows[0];assert.equal(state.state,'waiting_for_quantity');
}));
test('shipment choices keep the unique active link and ignore deleted history regardless of creation order',async()=>transaction(true,async()=>{
 const status=Object.values(ShipmentStatus)[0];
 for(const id of ['FA_SHIP_A','FA_SHIP_B'])await service.shipments.appendRows('A:M',[[id,status,'','FA_PO',0,'','','','2026-11-01','','','synthetic','']]);
 await service.shipmentOrders.appendRows('A:G',[
  ['FA_LINK_A','FA_SHIP_A','FA_ORDER_OLD','2026-11-10','','','synthetic'],
  ['FA_LINK_Z','FA_SHIP_B','FA_ORDER_OLD','2026-11-10','','2026-11-12','synthetic'],
  ['FA_LINK_NULL','FA_SHIP_B','FA_ORDER_OLD','','','2026-11-12','synthetic'],
  ['FA_LINK_OLD','FA_SHIP_B','FA_ORDER_OLD','2026-11-01','','2026-11-12','synthetic']]);
 const snapshot=await new GoogleSheetsShipmentOrderLinkStore(service).readLinkSnapshot();
 assert.equal(snapshot.findLatestActiveLink('FA_ORDER_OLD').id,'FA_LINK_A');
 const links=await new GoogleSheetsOrderDetailShipmentProjection(service).readLinks();
 assert.equal(links.findShipmentIdForOrder('FA_ORDER_OLD'),'FA_SHIP_A');
}));
test('effective compensation dates retain business priority over creation order',async()=>transaction(true,async()=>{
 await service.employees.appendRows('A:I',[['FA_EMP','Synthetic','','active','','','2026-11-01','','synthetic']]);
 await service.employeeCompensations.appendRows('A:L',[
  ['FA_EMP','300','','2026-11-10','','synthetic','2020-01-01','monthly','','','',''],
  ['FA_EMP','100','','2026-11-01','','synthetic','2021-01-01','monthly','','','','']]);
 const employee=(await listEmployees({googleSheetsService:service})).find(e=>e.id==='FA_EMP');
 assert.equal(employee.compensation.baseSalary,100);assert.equal(employee.compensation.effectiveFrom,'2021-01-01');
}));
