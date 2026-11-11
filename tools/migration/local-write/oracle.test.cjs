/* eslint-disable @typescript-eslint/no-require-imports -- Actual application rules with in-memory transport only. */
const test = require('node:test'), assert = require('node:assert/strict');
const { memoryService } = require('./oracle.cjs');
const orders = require('../../../src/modules/orders/server.ts'), hr = require('../../../src/modules/hr/server.ts');
test('offline write oracle exercises actual order append/update/read without provider IO', async () => {
    const { service } = memoryService();
    const o = await orders.createOrder({
        googleSheetsService: service, id: 'WT_ORACLE', seller: ' WT seller ', totalPrice: 12.34, createdBy: 'WT'
    });
    assert.equal(o.seller, 'WT seller');
    await orders.updateOrderDetails({
        googleSheetsService: service, orderId: o.id, totalPrice: 15.25, remark: 'WT changed'
    });
    const list = await orders.listOrders({
        googleSheetsService: service
    });
    assert.equal(list[0].totalPrice, 15.25);
    assert.equal(list[0].remark, 'WT changed');
});
test('offline workforce oracle preserves daily/half-day fields and compensation history', async () => {
    const { service } = memoryService();
    const employee = await hr.createEmployee({
        googleSheetsService: service, createdBy: 'WT', input: {
            name: 'WT Employee', phone: '', status: 'active', hiredDate: '2020-01-01', terminatedDate: '', baseSalary: 100, commission: 0, compensationEffectiveFrom: '2020-01-01', compensationType: 'daily', commissionType: 'none', commissionBucketSales: 0, commissionBucketAmount: 0, commissionRoundupThreshold: 0
        }
    });
    await hr.clockInEmployee({
        googleSheetsService: service, date: '2026-01-02', employeeId: employee.id, shopId: 'WT_ACCOUNT_A', workdayType: 'half'
    });
    const entries = await hr.listEmployeeTimesheets({
        googleSheetsService: service, date: '2026-01-02'
    });
    assert.equal(entries[0].employeeId, employee.id);
    assert.equal(entries[0].workdayType, 'half');
    assert.equal((await hr.listEmployeeCompensations({
        googleSheetsService: service
    })).length, 1);
});
test('acceptance payroll control uses existing month-selected rate and work-versus-leave conflict', async () => {
    const { service } = memoryService();
    const employee = await hr.createEmployee({
        googleSheetsService: service, createdBy: 'WT', input: {
            name: 'WT Payroll Control', phone: '', status: 'active', hiredDate: '2020-01-01', terminatedDate: '', baseSalary: 100, commission: 0, compensationEffectiveFrom: '2020-01-01', compensationType: 'daily', commissionType: 'none', commissionBucketSales: 0, commissionBucketAmount: 0, commissionRoundupThreshold: 0
        }
    });
    for (const [date, workdayType] of [['2026-01-01', 'half'], ['2026-01-02', 'full']])
        await hr.clockInEmployee({
            googleSheetsService: service, date, employeeId: employee.id, shopId: 'WT_ACCOUNT_A', workdayType
        });
    await assert.rejects(hr.addEmployeeLeave({
        googleSheetsService: service, date: '2026-01-01', employeeId: employee.id, shopId: 'WT_ACCOUNT_A'
    }), hr.EmployeeTimesheetDateConflictError);
    await hr.updateEmployee({
        googleSheetsService: service, employeeId: employee.id, input: {
            baseSalary: 120, compensationEffectiveFrom: '2026-01-02'
        }
    });
    const { calculateEmployeePayroll } = require('../../../src/composition/hr-payroll.ts');
    const records = await calculateEmployeePayroll({
        googleSheetsService: service, month: '2026-01'
    });
    assert.equal(records[0].workedDays, 1.5);
    assert.equal(records[0].basePay, 180);
    assert.equal(records[0].totalPay, 180);
});
test('fake sale/refund fixtures preserve gross, net, quantity and payment controls through actual Sheets-compatible owners', async () => {
    const { service } = memoryService();
    const { receipt } = require('./extra-cases.cjs'), sales = require('../../../src/modules/sales/server.ts');
    const inputs = [receipt('WT_SALE', 100, 2), receipt('WT_REFUND', 20, 1, 'REFUND')];
    await sales.syncLoyverseDailySales({
        googleSheetsService: service, account: {
            id: 'WT_ACCOUNT_A', shopName: 'WT Shop A', service: {
                getReceipts: async () => inputs
            }
        }, salesDate: '2026-01-01'
    });
    const dashboard = await sales.getGoogleSheetsSalesDashboard({
        googleSheetsService: service, accountIds: ['WT_ACCOUNT_A'], fromDate: '2026-01-01', toDate: '2026-01-31'
    });
    assert.equal(dashboard.report.totals.netSales, 80);
    assert.equal(dashboard.report.totals.itemsSold, 2);
    assert.equal(dashboard.report.totals.itemsRefunded, 1);
});
test('mutation coverage uses pinned exported paths and gives static endpoints priority over dynamic IDs', () => {
    const { Campaign } = require('./campaign.cjs'), state = {};
    assert.equal(Campaign.prototype.routeKey.call(state, 'PATCH', '/api/employees/advances'), 'PATCH:/api/employees/advances');
    assert.equal(Campaign.prototype.routeKey.call(state, 'PATCH', '/api/orders/WT_unusual_id/items/WT_item/image'), 'PATCH:/api/orders/[id]/items/[itemId]/image');
    assert.equal(state.exportedMethods.length, 32);
    assert.equal(state.exportedMethods.filter(x => x.route !== '/api/line/webhook').length, 31);
    assert.throws(() => Campaign.prototype.routeKey.call(state, 'POST', '/api/unknown'));
});
test('real paginated provider feeds Sheets-compatible sync once per identity and rejects conflicts before any writes', async () => {
    const {service,rows}=memoryService(),{receipt}=require('./extra-cases.cjs');
    const {LoyverseService}=require('../../../src/infrastructure/external/loyverse/LoyverseService.ts'),sales=require('../../../src/modules/sales/server.ts');
    const sale=receipt('WT_NORMALIZED_SALE',100,2),refund=receipt('WT_NORMALIZED_REFUND',20,1,'REFUND');
    let pages=[[sale],[sale,refund]],index=0;const originalFetch=globalThis.fetch;
    globalThis.fetch=async(input,init)=>{
        const url=new URL(input);
        assert.equal(url.origin,'https://api.loyverse.com');assert.equal(url.pathname,'/v1.0/receipts');assert.equal(init.headers.Authorization,'Bearer WT_ONLY');
        const receipts=pages[index++];assert.ok(receipts,'Unexpected provider retry');
        return Response.json({receipts,cursor:index<pages.length?String(index):null});
    };
    try {
        const account={id:'WT_ACCOUNT_A',shopName:'WT Shop A',service:new LoyverseService({accessToken:'WT_ONLY'})};
        const synced=await sales.syncLoyverseDailySales({googleSheetsService:service,account,salesDate:'2026-01-01'});
        assert.equal(synced.receiptCount,2);assert.equal(synced.itemCount,2);assert.equal(synced.paymentCount,2);
        const dashboard=await sales.getGoogleSheetsSalesDashboard({googleSheetsService:service,accountIds:['WT_ACCOUNT_A'],fromDate:'2026-01-01',toDate:'2026-01-31'});
        assert.equal(dashboard.report.totals.netSales,80);assert.equal(rows.sales_receipts.length,3);
        const before=JSON.stringify(rows);pages=[[sale],[{...sale,total_money:101}]];index=0;
        await assert.rejects(sales.syncLoyverseDailySales({googleSheetsService:service,account,salesDate:'2026-01-02'}),/conflicting versions/);
        assert.equal(JSON.stringify(rows),before);
    }finally{globalThis.fetch=originalFetch;}
});
