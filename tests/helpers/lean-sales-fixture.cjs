// Synthetic provider fields only. Never use a live receipt as a fixture.
const unused='SYNTHETIC_UNUSED_PROVIDER_DETAIL';
function receipt(overrides={}) {
 return {receipt_number:'sale-1',receipt_type:'SALE',note:unused,refund_for:null,order:unused,
  created_at:'2026-11-01T02:00:00.000Z',updated_at:'2026-11-01T02:00:00.000Z',receipt_date:'2026-11-01T02:00:00.000Z',cancelled_at:null,
  source:unused,store_id:'synthetic-store',employee_id:unused,customer_id:unused,pos_device_id:unused,dining_option:unused,
  total_money:27,total_tax:1.89,total_discount:3,tip:0,surcharge:0,points_earned:1,points_deducted:0,points_balance:50,
  line_items:[{id:'line-1',item_id:'synthetic-product',variant_id:'synthetic-variant',item_name:'Synthetic product',variant_name:'Blue',sku:'SYNTHETIC-SKU',quantity:3,price:10,gross_total_money:30,total_discount:3,total_money:27,cost:4,cost_total:12,line_note:unused,line_discounts:[{id:unused,money_amount:3}],line_taxes:[{id:'tax-1',money_amount:0.5},{id:'tax-2',money_amount:1.39}],line_modifiers:[{id:unused,name:unused,option:unused,money_amount:0}]}],
  payments:[{payment_type_id:'cash',name:'Cash',type:'CASH',money_amount:20,paid_at:'2026-11-01T02:00:00.000Z',payment_details:{unused}},{payment_type_id:'card',name:'Card',type:'CARD',money_amount:7,paid_at:'2026-11-01T02:00:00.000Z',payment_details:{unused}}],...overrides};
}
function receipts() {
 const sale=receipt();
 const refund=receipt({receipt_number:'refund-1',receipt_type:'REFUND',refund_for:'sale-1',receipt_date:'2026-11-01T04:00:00.000Z',line_items:[{...sale.line_items[0],quantity:1,gross_total_money:10,total_discount:1,total_money:9,cost_total:4,line_taxes:[{id:'tax-1',money_amount:0.63}]}],payments:[{...sale.payments[0],money_amount:9}],total_money:9});
 return [sale,refund,receipt({receipt_number:'cancelled-1',cancelled_at:'2026-11-01T05:00:00.000Z'})];
}
// Regular one-payment scenario for current write acceptance. The original rich
// split fixture remains unchanged as the historical/report oracle and rejection case.
function singleReceipts() { return receipts().map(r=>({...r,payments:r.payments.length?[{...r.payments[0],money_amount:r.payments.reduce((sum,p)=>sum+p.money_amount,0)}]:[]})); }
module.exports={unused,receipt,receipts,singleReceipts};
