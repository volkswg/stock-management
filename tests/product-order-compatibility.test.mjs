import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,uuid,uuid2,input} from './helpers/product-master.mjs';
import {ordersLineGraph} from './helpers/orders-line-source.mjs';
import {googleGraph} from './helpers/google-infrastructure.mjs';
test('real legacy quantity/code/batch/image/append and Web creation paths preserve linked K and never register products implicitly',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);await w.save({revision:'initial',requestId:uuid2,productId:product.id});
 const registry=googleGraph().registry(),service={orderBills:new registry.OrderBillsSheet(w.client,'order_bills'),orders:new registry.OrdersSheet(w.client,'orders'),orderItems:new registry.OrderItemsSheet(w.client,'order_items')};
 const graph=ordersLineGraph({createId:()=> 'ORDER-NEW'}),api=graph.load('src/modules/orders/server.ts');
 const expectLinked=()=>{assert.equal(w.state.sheets.order_items[1][10],product.id);assert.equal(w.state.sheets.products.length,2);assert.equal(w.state.metadata.size,2);};
 const args={googleSheetsService:service,orderId:'order',orderItemId:'item'};
 await api.updateOrderItemQuantity({...args,quantity:4,quantityType:'quote'});expectLinked();
 await api.updateOrderItemQuantity({...args,quantity:2,quantityType:'delivered'});expectLinked();
 await api.updateOrderItemProductCode({...args,productCode:'CODE-CHANGED'});expectLinked();
 await api.updateOrderProducts({googleSheetsService:service,orderId:'order',items:[{id:'item',productCode:'BULK',quoteQuantity:8,deliveredQuantity:3}]});expectLinked();
 const drive={uploadImage:async()=>({id:'image',webViewLink:'https://example.test/new.jpg'}),deleteFile:()=>assert.fail('Existing referenced images must not be deleted')};
 await api.replaceOrderProductImage({googleSheetsService:service,googleDriveService:drive,orderId:'order',itemId:'item',image:new File(['synthetic'],'p.png',{type:'image/png'})});expectLinked();
 await api.createOrderItem({googleSheetsService:service,orderId:'order',imageUrl:'https://example.test/added.jpg',createdBy:'line-user'});expectLinked();assert.equal(w.state.sheets.order_items[2][10],undefined);
 await api.createOrderWithImages({googleSheetsService:service,googleDriveService:drive,images:[{imageType:'bill',contentType:'image/png',bytes:Buffer.from('bill')},{imageType:'product',contentType:'image/png',bytes:Buffer.from('product')}],seller:'Web',totalPrice:500,createdBy:'web'});expectLinked();
 assert.equal(w.state.sheets.order_items.at(-1)[10],undefined);assert.ok(w.events.filter(event=>event[0]==='legacy-write').every(event=>!/[K-Z]/.test(event[1].split('!')[1])));
});
test('historical missing K, multiple references, archived products and items without images retain explicit association semantics',async()=>{
 const w=harness(),product=await w.products.create(uuid,input,'staff',false);
 w.state.sheets.order_items.push(['no-image','order','','1','0','DUP','c','u','','line']);
 const all=await w.links.list('order');assert.equal(all.length,2);assert.equal(all[1].productId,null);assert.equal(all[1].imageUrl,'');
 await w.save({revision:'initial',requestId:uuid2,productId:product.id});await w.save({itemId:'no-image',revision:'initial',requestId:uuid,productId:product.id});assert.equal(w.state.sheets.order_items[2][10],product.id);
 await w.products.edit({id:product.id,values:{...input,active:false},expectedUpdatedAt:product.updatedAt,requestId:uuid2});assert.equal((await w.links.read('order','item')).productId,product.id);assert.equal((await w.links.read('order','no-image')).productId,product.id);assert.equal(w.state.sheets.orders.length,2);
});
