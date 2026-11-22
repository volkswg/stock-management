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
  const dialog=page.getByRole('dialog');
  const fill=async(code,name)=>{await dialog.getByLabel('Product code',{exact:true}).fill(code);await dialog.getByLabel('Product name',{exact:true}).fill(name);await dialog.getByLabel('Product variant',{exact:true}).fill('Blue');};
  const closed=()=>dialog.waitFor({state:'hidden'});
  const edit=name=>page.getByRole('button',{name:'Change linked product: '+name,exact:true});
  const choose=async name=>{await dialog.getByRole('combobox',{name:'Select linked product',exact:true}).click();await page.locator('.ant-select-item-option').filter({hasText:name}).click();};
  await page.getByRole('button',{name:'Link product',exact:true}).first().waitFor({timeout:30000});
  await page.getByRole('button',{name:'Link product',exact:true}).first().click();
  assert.equal(await dialog.getByLabel('Product name',{exact:true}).count(),0);
  await dialog.getByRole('button',{name:'Create new product',exact:true}).click();
  await fill('UAT-CHAIR','Synthetic catalogue chair');
  await dialog.getByRole('button',{name:'Create and link',exact:true}).click();await closed();await edit('Synthetic catalogue chair').waitFor();
  assert.equal(await page.getByLabel('Product name',{exact:true}).count(),0);
  await edit('Synthetic catalogue chair').click();
  await dialog.getByRole('combobox',{name:'Select linked product',exact:true}).waitFor();
  assert.equal(await dialog.getByLabel('Product name',{exact:true}).count(),0);
  assert.equal(await dialog.getByRole('button',{name:'Save link',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await closed();
  // Catalogue edits belong to Product Master, never to the order-item link popup.
  await page.goto(url.origin+'/products');await page.getByRole('button',{name:'Edit product: Synthetic catalogue chair',exact:true}).click();
  await dialog.getByLabel('Product name',{exact:true}).fill('Synthetic catalogue chair edited');
  await dialog.getByRole('button',{name:'Save product',exact:true}).click();await closed();
  await page.goto(url.href);await edit('Synthetic catalogue chair edited').click();
  assert.equal(await dialog.getByLabel('Product name',{exact:true}).count(),0);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await closed();
  await page.getByRole('button',{name:'Link product',exact:true}).click();
  await dialog.getByRole('button',{name:'Create new product',exact:true}).click();
  await fill('UAT-CHAIR','Synthetic catalogue chair edited');await dialog.getByRole('button',{name:'Create and link',exact:true}).click();
  await dialog.getByText(/Similar products exist/).waitFor();
  await dialog.getByRole('button',{name:'Choose existing product',exact:true}).click();
  await choose('Synthetic catalogue chair edited');await dialog.getByRole('button',{name:'Save link',exact:true}).click();await closed();assert.equal(await edit('Synthetic catalogue chair edited').count(),2);
  // Creation is a separate intentional action inside the link chooser.
  await edit('Synthetic catalogue chair edited').first().click();
  await dialog.getByRole('button',{name:'Create new product',exact:true}).click();await fill('UAT-PENDING','Synthetic pending chair');let lost;
  await page.route('**/api/orders/UAT-PRODUCT-ORDER/items/*/product',async route=>{
   if(route.request().method()!=='POST'||lost)return route.continue();
   const response=await route.fetch();assert.equal(response.status(),201);lost={key:route.request().headers()['idempotency-key'],body:route.request().postData(),value:await response.json()};await route.abort('failed');
  });
  await dialog.getByRole('button',{name:'Create and link',exact:true}).click();await dialog.getByRole('button',{name:'Retry saved request',exact:true}).waitFor();assert.ok(lost?.key);
  await page.reload();await page.getByRole('button',{name:'Review pending product change',exact:true}).click();
  await dialog.getByRole('button',{name:'Retry saved request',exact:true}).waitFor();assert.equal(await dialog.getByLabel('Product name',{exact:true}).count(),0);
  const retried=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/product'));
  await dialog.getByRole('button',{name:'Retry saved request',exact:true}).click();
  const request=await retried;assert.equal(request.headers()['idempotency-key'],lost.key);assert.equal(request.postData(),lost.body);
  await closed();await edit('Synthetic pending chair').waitFor();
  const products=await page.evaluate(async()=>{const r=await fetch('/api/products?q=UAT-PENDING');return r.json();});
  assert.equal(products.products.length,1);assert.equal(products.products[0].id,lost.value.item.product.id);
  // Selecting a replacement can be cancelled, then a lost link ACK replays exactly.
  await edit('Synthetic pending chair').click();await choose('Synthetic catalogue chair edited');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await closed();await edit('Synthetic pending chair').waitFor();
  await page.unroute('**/api/orders/UAT-PRODUCT-ORDER/items/*/product');let lostLink;
  await page.route('**/api/orders/UAT-PRODUCT-ORDER/items/*/product',async route=>{
   if(route.request().method()!=='POST'||lostLink)return route.continue();
   assert.equal(JSON.parse(route.request().postData()).mode,'link');const response=await route.fetch();assert.equal(response.status(),200);lostLink={key:route.request().headers()['idempotency-key'],body:route.request().postData()};await route.abort('failed');
  });
  await edit('Synthetic pending chair').click();await choose('Synthetic catalogue chair edited');await dialog.getByRole('button',{name:'Save link',exact:true}).click();await dialog.getByRole('button',{name:'Retry saved request',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Review pending product change',exact:true}).click();
  const replay=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/product'));await dialog.getByRole('button',{name:'Retry saved request',exact:true}).click();const linkRequest=await replay;assert.equal(linkRequest.headers()['idempotency-key'],lostLink.key);assert.equal(linkRequest.postData(),lostLink.body);await closed();assert.equal(await edit('Synthetic catalogue chair edited').count(),2);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  if(process.argv[3])await page.screenshot({path:process.argv[3],fullPage:true});
  console.log(JSON.stringify({pass:true,inlineLinkedProduct:true,selectionPopupOnDemand:true,dropdownSelectionAndCancel:true,masterOnlyProductEditing:true,linkLostResponseReloadReplay:true,separateLinkAndCreate:true,browserCreateAndLink:true,duplicateReviewAndExistingLink:true,lostResponseReloadReplay:true,duplicateProducts:0,pageErrors:0,externalRequests:0}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
