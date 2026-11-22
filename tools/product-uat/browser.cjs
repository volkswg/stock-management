/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in Playwright UAT, supplied by existing verification tooling. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=new URL(process.argv[2]||'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/orders/UAT-PRODUCT-ORDER');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.STOCK_CHROMIUM_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const request=new URL(route.request().url());if(request.origin===url.origin)return route.continue();external.push(request.origin);return route.abort();});
  await page.goto(url.href);
  const open=async(index)=>{await page.getByRole('button',{name:'Product catalogue',exact:true}).nth(index).click();await page.getByLabel('Catalogue product name',{exact:true}).waitFor();await page.getByRole('button',{name:'Refresh saved item',exact:true}).waitFor({state:'visible'});};
  const fill=async(code,name)=>{await page.getByLabel('Catalogue product code',{exact:true}).fill(code);await page.getByLabel('Catalogue product name',{exact:true}).fill(name);await page.getByLabel('Catalogue product variant',{exact:true}).fill('Blue');};
  const close=()=>page.locator('.ant-modal-close').click();
  await page.getByRole('button',{name:'Product catalogue',exact:true}).first().waitFor({timeout:30000});
  await open(0);await fill('UAT-CHAIR','Synthetic catalogue chair');
  await page.getByRole('button',{name:'Confirm create and link',exact:true}).click();
  await page.getByText('Product created and linked.',{exact:true}).waitFor();
  await page.getByText(/Linked: UAT-CHAIR · Synthetic catalogue chair/).waitFor();
  await close();await open(1);
  await fill('UAT-CHAIR','Synthetic catalogue chair');await page.getByRole('button',{name:'Confirm create and link',exact:true}).click();
  await page.getByText(/Similar products exist/).waitFor();
  await page.getByRole('button',{name:'Use this product',exact:true}).first().click();await page.getByText('Existing product linked.',{exact:true}).waitFor();await close();
  // An uncertain post-COMMIT response survives a real page reload and replays once.
  await open(0);await fill('UAT-PENDING','Synthetic pending chair');let lost;
  await page.route('**/api/orders/UAT-PRODUCT-ORDER/items/*/product',async route=>{
   if(route.request().method()!=='POST'||lost)return route.continue();
   const response=await route.fetch();assert.equal(response.status(),201);lost={key:route.request().headers()['idempotency-key'],body:route.request().postData(),value:await response.json()};await route.abort('failed');
  });
  await page.getByRole('button',{name:'Confirm create and link',exact:true}).click();await page.getByRole('button',{name:'Retry saved request',exact:true}).waitFor();assert.ok(lost?.key);
  await page.reload();await page.getByRole('button',{name:'Product catalogue',exact:true}).first().waitFor();await open(0);
  await page.getByRole('button',{name:'Retry saved request',exact:true}).waitFor();
  const retried=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/product'));
  await page.getByRole('button',{name:'Retry saved request',exact:true}).click();
  const request=await retried;assert.equal(request.headers()['idempotency-key'],lost.key);assert.equal(request.postData(),lost.body);
  await page.getByText('Saved product operation confirmed.',{exact:true}).waitFor();
  await page.getByText(/Linked: UAT-PENDING · Synthetic pending chair/).waitFor();
  const products=await page.evaluate(async()=>{const r=await fetch('/api/products?q=UAT-PENDING');return r.json();});
  assert.equal(products.products.length,1);assert.equal(products.products[0].id,lost.value.item.product.id);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  if(process.argv[3])await page.screenshot({path:process.argv[3],fullPage:true});
  console.log(JSON.stringify({pass:true,browserCreateAndLink:true,duplicateReviewAndExistingLink:true,lostResponseReloadReplay:true,duplicateProducts:0,pageErrors:0,externalRequests:0}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
