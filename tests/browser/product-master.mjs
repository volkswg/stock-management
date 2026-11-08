// Standalone offline UI verification. Uses the environment's Playwright and
// Chromium; no app dependency, live provider, credential or production data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {harness} from '../helpers/product-master.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.PRODUCT_UI_BASE_URL??'http://127.0.0.1:3025';
const w=harness(),stamp='2026-11-08T06:00:00.000Z';
w.state.sheets.order_items[1][6]=stamp;w.state.sheets.order_items[1][7]=stamp;
w.state.sheets.order_items.push(['no-image','order','','1','0','NO-PHOTO',stamp,stamp,'','line']);
const failures=[],calls=[];
const browser=await chromium.launch({executablePath:process.env.PRODUCT_UI_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking'],env:{PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8'}});
const page=await browser.newPage({viewport:{width:1365,height:1000}});
page.on('pageerror',error=>failures.push(error.message));
function detail(){return {order:{id:'order',status:'complete',seller:'Synthetic seller',totalPrice:100,remark:'',createdAt:stamp,updatedAt:stamp,createdBy:'web',shipmentId:null,shipment:null,billImages:[],productImages:w.state.sheets.order_items.slice(1).filter(row=>row[1]==='order'&&row[2]&&!row[8]).map(row=>({id:row[0],orderId:row[1],imageUrl:row[2],quoteQuantity:row[3],deliveredQuantity:row[4],productCode:row[5],createdAt:stamp}))}};}
async function dispatch(request){
 const url=new URL(request.url),method=request.method,path=url.pathname;
 const execute=async(file,params={})=>{const entry=w.load(file);assert.equal(typeof entry[method],'function',`${method} ${path}`);return entry[method](request,{params:Promise.resolve(params)});};
 if(path==='/api/product-access')return execute('src/app/api/product-access/route.ts');
 if(path==='/api/products')return execute('src/app/api/products/route.ts');
 if(path==='/api/products/suggestions')return execute('src/app/api/products/suggestions/route.ts');
 let match;if((match=/^\/api\/products\/creations\/([^/]+)\/cancel$/.exec(path)))return execute('src/app/api/products/creations/[requestId]/cancel/route.ts',{requestId:decodeURIComponent(match[1])});
 if((match=/^\/api\/products\/([^/]+)$/.exec(path)))return execute('src/app/api/products/[id]/route.ts',{id:decodeURIComponent(match[1])});
 if(path==='/api/orders/order/product-links')return execute('src/app/api/orders/[id]/product-links/route.ts',{id:'order'});
 if((match=/^\/api\/orders\/order\/items\/([^/]+)\/product$/.exec(path)))return execute('src/app/api/orders/[id]/items/[itemId]/product/route.ts',{id:'order',itemId:decodeURIComponent(match[1])});
 if(path==='/api/orders/order'&&method==='GET')return Response.json(detail());
 if(path==='/api/shipments'&&method==='GET')return Response.json({shipments:[],total:0,page:1,pageSize:10});
 if(path==='/api/orders/order/images'&&method==='POST'){
  const form=await request.formData();assert.equal(form.get('imageType'),'product');const id='uploaded';
  w.state.sheets.order_items.push([id,'order','https://example.test/uploaded.jpg','','','',stamp,stamp,'','web']);
  return Response.json({imageType:'product',record:detail().order.productImages.find(item=>item.id===id)},{status:201});
 }
 throw new Error(`Unexpected API ${method} ${path}`);
}
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(req.resourceType()==='image'||url.pathname==='/_next/image')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ddd"/></svg>'});
 if(url.origin!==new URL(base).origin){failures.push(`Blocked external request ${url.origin}`);return route.abort();}
 if(!url.pathname.startsWith('/api/'))return route.continue();
 try{
  calls.push([req.method(),url.pathname]);const headers=await req.allHeaders(),body=req.postDataBuffer();
  const response=await dispatch(new Request(req.url(),{method:req.method(),headers,...(body?{body}:{})}));
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 }catch(error){failures.push(error.message);await route.fulfill({status:500,json:{error:'Offline verification failed.'}});}
});
const wait=async predicate=>{for(let i=0;i<100;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail('Timed out waiting for UI/backend condition');};
try{
 await page.goto(base+'/orders/order');
 await page.getByRole('button',{name:'Identify product',exact:true}).first().waitFor();
 await wait(()=>page.getByRole('button',{name:'Identify product',exact:true}).count().then(count=>count===2));
 assert.equal(w.state.sheets.products.length,1);
 // Existing image upload remains available before catalog registration or login.
 await page.getByRole('button',{name:'plus Add images',exact:true}).click();
 const upload=page.getByRole('dialog',{name:'Add product images'});
 await upload.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])});
 await upload.getByRole('button',{name:'Upload images',exact:true}).click();
 await wait(()=>w.state.sheets.order_items.length===4);assert.equal(w.state.sheets.products.length,1);assert.equal(calls.filter(call=>call[0]==='POST'&&call[1]==='/api/products').length,0);
 await page.getByRole('button',{name:'Identify product',exact:true}).first().click();
 let association=page.getByRole('dialog',{name:'Product Master association',exact:true});
 await association.getByLabel('Staff ID',{exact:true}).fill('editor');await association.getByLabel('Staff access key',{exact:true}).fill('k'.repeat(43));await association.getByRole('button',{name:'Sign in for product changes'}).click();
 await association.getByText('Product editor: editor',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.cookie.includes('product_master_staff')),false);
 await association.getByRole('button',{name:'Create new product',exact:true}).click();
 let creation=page.getByRole('dialog',{name:'Create Product Master record',exact:true});
 assert.equal(await creation.getByLabel('Product code',{exact:true}).inputValue(),'DUP');assert.equal(await creation.getByLabel('Reference image URL',{exact:true}).inputValue(),'https://example.test/i.jpg');
 await creation.getByLabel('Product name',{exact:true}).fill('Tea');await creation.getByLabel('Variant',{exact:true}).fill('Large');await creation.getByRole('button',{name:'Review duplicate suggestions'}).click();
 await creation.getByRole('button',{name:'Confirm product creation',exact:true}).waitFor();assert.equal(w.state.sheets.products.length,1);
 await creation.getByRole('button',{name:'Confirm product creation',exact:true}).click();await wait(()=>w.state.sheets.products.length===2);await creation.waitFor({state:'hidden'});
 const firstId=w.state.sheets.products[1][0];w.state.mode='timeout-before';await association.locator('button').filter({hasText:/^Save association$/}).click();await association.getByText(/write outcome is not yet confirmed/i).first().waitFor();assert.equal(w.state.sheets.products.length,2);
 await page.reload();await page.getByRole('button',{name:'Identify product',exact:true}).first().click();association=page.getByRole('dialog',{name:'Product Master association',exact:true});w.state.mode='normal';await association.getByRole('button',{name:'Retry pending association'}).click();await wait(()=>w.state.sheets.order_items[1][10]===firstId);assert.equal(w.state.sheets.products.length,2);
 await association.getByRole('button',{name:'Create new product',exact:true}).click();creation=page.getByRole('dialog',{name:'Create Product Master record',exact:true});await creation.getByLabel('Product name',{exact:true}).fill('Tea small');await creation.getByLabel('Variant',{exact:true}).fill('Small');await creation.getByRole('button',{name:'Review duplicate suggestions'}).click();await creation.getByText('Possible duplicate products',{exact:true}).waitFor();assert.equal(w.state.sheets.products.length,2);await creation.getByRole('button',{name:'Confirm creation despite suggestions'}).click();await wait(()=>w.state.sheets.products.length===3);await creation.waitFor({state:'hidden'});
 const secondId=w.state.sheets.products[2][0];await association.locator('button').filter({hasText:/^Save association$/}).click();await wait(()=>w.state.sheets.order_items[1][10]===secondId);
 await association.getByRole('button',{name:'Edit / archive product',exact:true}).click();const edit=page.getByRole('dialog',{name:'Edit Product Master record',exact:true});await edit.getByLabel('Active (uncheck to archive; historical Orders remain)',{exact:true}).uncheck();await edit.getByRole('button',{name:'Confirm product update'}).click();await wait(()=>w.state.sheets.products[2][5]===false);assert.equal(w.state.sheets.order_items[1][10],secondId);await edit.waitFor({state:'hidden'});
 await association.getByRole('button',{name:'Remove association',exact:true}).click();await wait(()=>w.state.sheets.order_items[1][10]==='');assert.equal(w.state.sheets.products.length,3);
 await association.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Other Order Item identities',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.getByText('NO-PHOTO — Order Item no-image',{exact:true}).isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await page.screenshot({path:'/workspace/work/product-master-mobile.png',fullPage:true});
 assert.deepEqual(failures,[]);console.log('PASS: offline Chromium upload/no-auto-create, staff sign-in, duplicate confirmation, partial-failure/reload/retry, relink, archive, unlink, no-image items, and mobile layout');
}catch(error){await page.screenshot({path:'/workspace/work/product-master-failure.png',fullPage:true});console.error('Offline UI failure:',error.message,'API calls:',calls, 'dialogs',await page.locator('[role=dialog]').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,hidden:node.getAttribute('aria-hidden'),outer:node.outerHTML.slice(0,650)}))));throw error;}finally{await browser.close();}
