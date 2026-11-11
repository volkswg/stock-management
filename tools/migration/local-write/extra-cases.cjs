/* eslint-disable @typescript-eslint/no-require-imports -- Actual app/API/provider-fake acceptance on an explicitly approved local copy. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { PNG } = require('./runtime.cjs'), sales = require('../../../src/modules/sales/server.ts');
const receipt = (id, total, quantity, type = 'SALE', when = '2026-01-01T01:00:00.000Z') => ({ receipt_number: id, receipt_type: type, receipt_date: when, created_at: when, updated_at: when, store_id: 'WT_STORE_A', total_money: total, total_tax: 0, total_discount: 0, line_items: [{ id: id + '_item', item_name: 'WT item', quantity, price: total / quantity, gross_total_money: total, total_discount: 0, total_money: total, cost: 1, cost_total: quantity }], payments: [{ money_amount: total, name: 'Cash' }] });
function extend(Campaign) {
    Campaign.prototype.WT04 = async function () { const identity = { masterId: this.prefix + '_MOVEMENT', userId: 'WT_seed', startedAt: '2026-01-01T01:00:00.000Z' }, file = path.join(this.out, 'movement-seed.json'); fs.writeFileSync(file, JSON.stringify(identity), { mode: 0o600 }); const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'seed.cjs'), path.join(this.state, this.db + '-app-env.json'), file], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8', timeout: 30000 }); this.save('movement-seed-result.json', { exit: result.status, stdout: result.stdout, stderr: result.stderr }); assert.equal(result.status, 0, 'Synthetic movement fixture seed failed'); const first = (await this.get('/api/movements/' + identity.masterId)).records; assert.equal(first.length, 1); assert.equal(first[0].quantity, '3'); const delivery = await this.patch('/api/movements/' + identity.masterId, { status: 'delivered' }); const deliveredAt = delivery.body.movementMaster.deliverDateTime; this.inventoryMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(deliveredAt)).slice(0, 7); this.inventoryDate = this.inventoryMonth + '-02'; assert.ok(this.inventoryDate < new Date().toISOString().slice(0, 10), 'Fixture sync date must be historical'); const after = (await this.get('/api/movements/' + identity.masterId)).records; assert.equal(after[0].status, 'delivered'); const before = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_A'); await this.patch('/api/movements/' + identity.masterId, { status: 'delivered' }); const repeated = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_A'); assert.equal(before.stockIn, 3); assert.equal(repeated.stockIn, before.stockIn); this.context.movement = identity; };
    Campaign.prototype.WT05 = async function () { await this.api('/api/stock-counts', { method: 'PUT', key: this.key(), body: { month: new Date(Date.UTC(Number(this.inventoryMonth.slice(0, 4)), Number(this.inventoryMonth.slice(5)) - 2, 1)).toISOString().slice(0, 7), accountId: 'WT_ACCOUNT_A', physicalCount: 10, note: 'WT opening' } }); const read = async () => (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_A'); const start = await read(); assert.equal(start.openingStock, 10); assert.equal(start.stockIn, 3); assert.equal(start.calculatedStock, 13); const body = { requestId: crypto.randomUUID(), accountId: 'WT_ACCOUNT_A', date: this.inventoryDate, direction: 'out', reason: 'damage', quantity: 2, itemDescription: 'WT damage', photoUrl: '', note: 'WT', notInLoyverse: true }; const a = (await this.post('/api/stock-adjustments', body, { status: 201 })).body.record; assert.equal((await read()).calculatedStock, 11); await this.patch('/api/stock-adjustments', { action: 'reverse', id: a.id, note: 'WT reversal' }); assert.equal((await read()).calculatedStock, 13); await this.post('/api/stock-adjustments', { ...body, requestId: crypto.randomUUID(), quantity: 1, replacesId: a.id }, { status: 201 }); assert.equal((await read()).calculatedStock, 12); await this.api('/api/stock-counts', { method: 'PUT', key: this.key(), body: { month: this.inventoryMonth, accountId: 'WT_ACCOUNT_A', physicalCount: 12, note: 'WT physical' } }); const counted = await read(); assert.equal(counted.physicalCount, 12); assert.equal(counted.variance, 0); const b = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(s => s.accountId === 'WT_ACCOUNT_B'); assert.equal(b.calculatedStock, 0); };
    Campaign.prototype.WT06 = async function () {
        const r1 = receipt(this.prefix + '_SALE', 100, 2, 'SALE', this.inventoryDate + 'T01:00:00.000Z'), r2 = receipt(this.prefix + '_REFUND', 20, 1, 'REFUND', this.inventoryDate + 'T01:00:00.000Z');
        this.control({ salesPages: { A: [[r1], [r1,r2]] } });
        const key = this.key('sales');
        const result = await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: this.inventoryDate }, { key });
        assert.equal(result.body.outcome, 'synced'); this.save('overlapping-receipt-observation.json',{expectedUniqueReceipts:2,response:result.body,storedReceiptIdentities:await this.sql('SELECT id,count(*)::int AS copies FROM stock_operational.sales_receipts WHERE \"accountId\"=$1 AND \"salesDate\"=$2 GROUP BY id ORDER BY id',['WT_ACCOUNT_A',this.inventoryDate])});assert.equal(result.body.receiptCount,2,'Overlapping provider pages must not duplicate logical receipt identities');
        const calls = this.ledger().filter(x => x.provider === 'loyverse').length;
        const replay = await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: this.inventoryDate }, { key });
        assert.equal(replay.text, result.text);
        assert.equal(this.ledger().filter(x => x.provider === 'loyverse').length, calls);
        await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: this.inventoryDate }, { status: 409 });
        const dash = await this.get('/api/sales/dashboard?accounts=WT_ACCOUNT_A&from=' + this.inventoryMonth + '-01&to=' + this.inventoryMonth + '-28');
        assert.equal(dash.report.totals.netSales, 80);
        const source = { id: 'WT_ACCOUNT_A', shopName: 'WT Shop A', service: { getReceipts: async () => [r1, r2] } };
        await sales.syncLoyverseDailySales({ googleSheetsService: this.oracle.service, account: source, salesDate: this.inventoryDate });
        const oracle = await sales.getGoogleSheetsSalesDashboard({ googleSheetsService: this.oracle.service, accountIds: ['WT_ACCOUNT_A'], fromDate: this.inventoryMonth + '-01', toDate: this.inventoryMonth + '-28' });
        assert.deepEqual(dash.report, oracle.report);
        const stock = (await this.get('/api/stock-counts?month=' + this.inventoryMonth)).stockCounts.find(x => x.accountId === 'WT_ACCOUNT_A');
        assert.equal(stock.stockOut, 1);
        assert.equal(stock.calculatedStock, 11);
        const failDate = this.inventoryMonth + '-03', failed = receipt(this.prefix + '_FAIL_PAGE', 10, 1, 'SALE', failDate + 'T01:00:00.000Z');
        this.control({ salesPages: { A: [[failed], []] }, salesFailCursor: '1' });
        const rev = await this.revision(), failureKey = this.key('sales-failure');
        await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: failDate }, { key: failureKey, status: 502 });
        assert.equal(await this.revision(), rev);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.sales_receipts WHERE "receiptNumber"=$1', [failed.receipt_number]))[0].n, 0);
        this.control({ salesPages: { A: [[failed]] } });
        await this.post('/api/loyverse/daily-sales/sync', { account: 'WT_ACCOUNT_A', date: failDate }, { key: failureKey });
        this.control({});
    };
    Campaign.prototype.WT10 = async function () { const target = '/api/orders/' + this.context.order.id + '/images', before = await this.revision(); let form = new FormData(); form.set('imageType', 'product'); form.set('image', new Blob([Buffer.from('WT bad')], { type: 'text/plain' }), 'WT.txt'); await this.post(target, form, { status: 400 }); assert.equal(await this.revision(), before); for (const mime of ['image/jpeg', 'image/webp']) {
        form = new FormData();
        form.set('imageType', 'product');
        form.set('image', new Blob([PNG], { type: mime }), 'WT.image');
        const r = await this.post(target, form, { status: 201 });
        assert.match(r.body.record.imageUrl, /__wt\/images\/WT_FILE_/);
    } const key = this.key('file-intent'); const make = bytes => { const f = new FormData(); f.set('imageType', 'product'); f.set('image', new Blob([bytes], { type: 'image/png' }), 'WT.png'); return f; }; const first = await this.post(target, make(PNG), { key, status: 201 }), at = await this.revision(); assert.equal((await this.post(target, make(PNG), { key, status: 201 })).text, first.text); await this.post(target, make(Buffer.from('WT different')), { key, status: 409 }); assert.equal(await this.revision(), at); this.control({ driveFailure: true }); await this.post(target, make(PNG), { status: 500 }); this.control({}); assert.equal(await this.revision(), at); this.blocked.push({ id: 'WT10', variant: 'Oversize/orphan cleanup and product-image replacement', reason: 'Not yet executed by this local driver; successful upload and provider-failure rollback are narrower evidence.' }); };
    Campaign.prototype.remainingMethods = async function() {
        const shift=this.context.shifts[0];
        await this.api('/api/employees/timesheets/'+shift.id,{method:'PUT',key:this.key(),body:{date:this.date,employeeId:this.context.employee.id,shopId:'WT_ACCOUNT_A',status:'work',workdayType:'half'}});
        const overrides='/api/sales/profit-summary/cost-overrides';
        await this.post(overrides,{month:this.inventoryMonth,accountId:'WT_ACCOUNT_A',averageItemCost:2.5,note:'WT cost control'});
        await this.api(overrides,{method:'DELETE',key:this.key(),body:{month:this.inventoryMonth,accountId:'WT_ACCOUNT_A'}});
        const movement=this.context.movement, item=movement.masterId+'_ITEM',url='/api/movements/'+movement.masterId+'/items/'+item;
        await this.patch(url,{remark:'WT edited'});
        await this.api(url+'/image',{method:'PATCH',key:this.key(),body:PNG,headers:{'content-type':'image/png'}});
        await this.api(url,{method:'DELETE',key:this.key()});
        const form=new FormData();form.set('image',new Blob([PNG],{type:'image/png'}),'WT-replacement.png');
        await this.patch('/api/orders/'+this.context.imageOrder.id+'/items/'+this.context.productId+'/image',form);
        const advances=(await this.get('/api/employees/advances')).advances;
        const a=advances.find(x=>x.employeeId===this.context.employee.id&&x.reference==='WT advance');
        await this.patch('/api/employees/advances',{id:a.id,action:'pay',paidAmount:a.paidAmount,paidDate:a.paidDate,reference:a.reference});
    };
    Campaign.prototype.lineEvent = function (id, text, replyToken = id) { return { type: 'message', webhookEventId: id, replyToken: 'WT_' + replyToken, timestamp: Date.parse('2026-01-01T01:00:00.000Z'), source: { type: 'user', userId: 'WT_USER_' + this.prefix }, message: { id: 'WT_MSG_' + id, type: 'text', text } }; };
    Campaign.prototype.line = async function (events, status = 200) { const body = { events }, text = JSON.stringify(body), signature = crypto.createHmac('sha256', this.env.LINE_CHANNEL_SECRET).update(text).digest('base64'); return this.api('/api/line/webhook', { method: 'POST', body, auth: false, headers: { 'x-line-signature': signature }, status }); };
    Campaign.prototype.WT11 = async function () { const event = this.lineEvent(this.prefix + '_EVENT', 'create:order'); const first = await this.line([event]); assert.equal(first.body.ok, true); const q = 'SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1'; const count = await this.sql(q, [event.source.userId]); assert.equal(count[0].n, 1); const calls = this.ledger().filter(x => x.provider === 'line' && x.operation === 'reply').length; await this.line([{ ...event, replyToken: 'WT_redelivery', deliveryContext: { isRedelivery: true } }]); assert.equal((await this.sql(q, [event.source.userId]))[0].n, 1); assert.equal(this.ledger().filter(x => x.provider === 'line' && x.operation === 'reply').length, calls); const userState = (await this.sql('SELECT id,"referenceId","createdAt" FROM stock_operational.user_state WHERE "userId"=$1 ORDER BY row_order DESC LIMIT 1', [event.source.userId]))[0]; assert.ok(userState); this.context.lineEvent = event; this.context.lineState = userState; this.blocked.push({ id: 'WT11', variant: 'All multi-event/photo/session transitions', reason: 'Initial event and regrouped redelivery are verified; complete journey/photo coverage must be present before a family PASS.' }); };
    Campaign.prototype.WT13 = async function () { const { chromium } = require(process.env.STOCK_PLAYWRIGHT_MODULE || 'playwright'); const browser = await chromium.launch({ executablePath: process.env.STOCK_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
        let lost = false, key, committed;
        await context.route('**/*', async (route) => { const r = route.request(), u = new URL(r.url()); if (u.origin !== this.config.origin) {
            if (r.resourceType() === 'image')
                return route.fulfill({ body: PNG, contentType: 'image/png' });
            return route.abort();
        } if (u.pathname.startsWith('/__wt/images/'))
            return route.fulfill({ body: PNG, contentType: 'image/png' }); if (u.pathname.startsWith('/api/')) {
            const headers = { ...r.headers(), authorization: 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN };
            const response = await route.fetch({ headers, maxRedirects: 0 });
            if (r.method() === 'POST' && u.pathname === '/api/orders/with-images' && !lost) {
                key = r.headers()['idempotency-key'];
                committed = await response.json();
                assert.equal(response.status(), 201);
                lost = true;
                return route.abort('failed');
            }
            return route.fulfill({ response });
        } return route.continue(); });
        const page = await context.newPage();
        const fill = async () => { await page.getByPlaceholder('Seller', { exact: true }).fill(this.prefix + '_UI'); await page.getByPlaceholder('0.00').fill('25.25'); const inputs = page.locator('input[type=file]'); assert.equal(await inputs.count(), 2); await inputs.nth(0).setInputFiles({ name: 'WT_bill.png', mimeType: 'image/png', buffer: PNG }); await inputs.nth(1).setInputFiles({ name: 'WT_product.png', mimeType: 'image/png', buffer: PNG }); };
        await page.goto(this.config.origin + '/orders/create', { waitUntil: 'networkidle' });
        await fill();
        await page.locator('button[type=submit]').click();
        await page.waitForTimeout(500);
        assert.ok(lost && key && committed?.order?.id);
        const values = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
        assert.ok(!JSON.stringify(values).includes(this.env.STOCK_STAGING_AUTH_TOKEN));
        this.save('browser-pending-state.json', values);
        await page.screenshot({ path: path.join(this.out, 'WT13-mobile-response-loss.png'), fullPage: true });
        await page.reload({ waitUntil: 'networkidle' });
        await fill();
        await page.locator('button[type=submit]').click();
        await page.waitForURL('**/orders/' + committed.order.id);
        await page.screenshot({ path: path.join(this.out, 'WT13-mobile-replayed-order.png'), fullPage: true });
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1', [key]))[0].n, 1);
        await context.close();
        this.blocked.push({ id: 'WT13', variant: 'Ten browser loss/restart/double-click/new-intent trials', reason: 'One mobile reload/reselection response-loss trial implemented; remaining browser repetitions are not certified.' });
    }
    finally {
        await browser.close();
    } };
    Campaign.prototype.restartApp = async function () { const logfile = fs.openSync(path.join(this.out, 'restarted-app-' + Date.now() + '.log'), 'wx', 0o600); const env = { PATH: process.env.PATH, HOME: process.env.HOME, NEXT_TELEMETRY_DISABLED: '1', ...this.env }; this.child = cp.spawn(process.execPath, ['--require', path.join(this.app, '__local-write-harness/preload.cjs'), path.join(this.app, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(this.config.appPort)], { cwd: this.app, env, stdio: ['ignore', logfile, logfile] }); fs.closeSync(logfile); for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(this.config.origin + '/api/orders', { headers: { authorization: 'Bearer ' + this.env.STOCK_STAGING_AUTH_TOKEN }, redirect: 'error', signal: AbortSignal.timeout(1000) });
            await r.arrayBuffer();
            if (r.status === 200)
                return;
        }
        catch { }
        await new Promise(r => setTimeout(r, 250));
    } throw Error('Restarted local app unavailable'); };
    Campaign.prototype.WT15 = async function () { for (let i = 0; i < 10; i++) {
        const key = this.key('ack-loss');
        this.control({ loseCommitAck: { remaining: 1 } });
        const response = await this.post('/api/orders', { seller: this.prefix + '_ACK_' + i, totalPrice: 7 }, { key, status: 503 });
        assert.equal(response.status, 503);
        this.control({});
        const replay = await this.post('/api/orders', { seller: this.prefix + '_ACK_' + i, totalPrice: 7 }, { key, status: 201 });
        assert.ok(replay.body.order.id);
        assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.commands WHERE key=$1 AND state=\'complete\'', [key]))[0].n, 1);
    } const event = { ...this.lineEvent(this.prefix + '_CRASH', 'create:order'), source: { type: 'user', userId: 'WT_CRASH_' + this.prefix } }; this.control({ exitAfterEffectClaim: { remaining: 1 } }); let disconnected = false; try {
        await this.line([event]);
    }
    catch {
        disconnected = true;
    } assert.ok(disconnected); this.control({}); await this.restartApp(); const count = (await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1', [event.source.userId]))[0].n; assert.equal(count, 1); await this.line([{ ...event, replyToken: 'WT_retry_after_crash', deliveryContext: { isRedelivery: true } }]); assert.equal((await this.sql('SELECT count(*)::int n FROM stock_operational.orders WHERE "createdBy"=$1', [event.source.userId]))[0].n, 1); const sending = await this.sql("SELECT count(*)::int n FROM stock_operational.side_effects WHERE state IN ('sending','uncertain')"); assert.ok(sending[0].n >= 1); this.blocked.push({ id: 'WT15', variant: 'Full generated-state backup/restore', reason: 'Run separate guarded recovery verification after stopping copy ingress; not certified by the API runner alone.' }); };
}
module.exports = { extend, receipt };
