/* eslint-disable @typescript-eslint/no-require-imports -- Hash-pinned source inverse for earlier immutable witnesses only. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeBillIdentity=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
 const shipment=JSON.parse(fs.readFileSync('tests/fixtures/order-detail-shipment-before.json')).edits[name];
 if(shipment){assert.equal(data===null?null:hash(data),shipment.afterSha256,name);assert.equal(hash(shipment.before),shipment.beforeSha256,name);data=Buffer.from(shipment.before);}
 const retirement=JSON.parse(fs.readFileSync('tests/fixtures/receipt-payment-retirement-before.json')).edits[name];
 if(retirement){assert.equal(data===null?null:hash(data),retirement.afterSha256,name);assert.equal(hash(retirement.before),retirement.beforeSha256,name);data=Buffer.from(retirement.before);}
 const jsonb=JSON.parse(fs.readFileSync('tests/fixtures/receipt-payments-jsonb-before.json')).edits[name];
 if(jsonb){assert.equal(data===null?null:hash(data),jsonb.afterSha256,name);assert.equal(hash(jsonb.before),jsonb.beforeSha256,name);data=Buffer.from(jsonb.before);}
 const payment=JSON.parse(fs.readFileSync('tests/fixtures/single-receipt-payment-before.json')).edits[name];
 if(payment){assert.equal(data===null?null:hash(data),payment.afterSha256,name);assert.equal(hash(payment.before),payment.beforeSha256,name);data=Buffer.from(payment.before);}
 const lean=JSON.parse(fs.readFileSync('tests/fixtures/lean-loyverse-before.json')).edits[name];
 if(lean){assert.equal(data===null?null:hash(data),lean.afterSha256,name);assert.equal(hash(lean.before),lean.beforeSha256,name);data=Buffer.from(lean.before);}
 const row=JSON.parse(fs.readFileSync('tests/fixtures/row-edits-before.json')).edits[name];
 if(row){assert.equal(data===null?null:hash(data),row.afterSha256,name);assert.equal(hash(row.before),row.beforeSha256,name);data=Buffer.from(row.before);}
 const cleanup=JSON.parse(fs.readFileSync('tests/fixtures/safe-compatibility-cleanup-before.json')).edits[name];
 if(cleanup){assert.equal(data===null?null:hash(data),cleanup.afterSha256,name);assert.equal(hash(cleanup.before),cleanup.beforeSha256,name);data=Buffer.from(cleanup.before);}
 const upload=JSON.parse(fs.readFileSync('tests/fixtures/order-image-uploads-before.json')).edits[name];
 if(upload){assert.equal(data===null?null:hash(data),upload.afterSha256,name);assert.equal(hash(upload.before),upload.beforeSha256,name);data=Buffer.from(upload.before);}
 const reference=JSON.parse(fs.readFileSync('tests/fixtures/movement-reference-before.json')).edits[name];
 if(reference){assert.equal(data===null?null:hash(data),reference.afterSha256,name);assert.equal(hash(reference.before),reference.beforeSha256,name);data=Buffer.from(reference.before);}
 const item=JSON.parse(fs.readFileSync('tests/fixtures/item-identity-before.json')).edits[name];
 if(item){assert.equal(data===null?null:hash(data),item.afterSha256,name);assert.equal(hash(item.before),item.beforeSha256,name);data=Buffer.from(item.before);}
 const session=JSON.parse(fs.readFileSync('tests/fixtures/user-state-identity-before.json')).edits[name];
 if(session){assert.equal(data===null?null:hash(data),session.afterSha256,name);assert.equal(hash(session.before),session.beforeSha256,name);data=Buffer.from(session.before);}
 const latest=JSON.parse(fs.readFileSync('tests/fixtures/bill-revision-before.json')).edits[name];
 if(latest){assert.equal(data===null?null:hash(data),latest.afterSha256,name);assert.equal(hash(latest.before),latest.beforeSha256,name);data=Buffer.from(latest.before);}
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/bill-identity-before.json')).edits[name];
 if(!edit)return data;
 assert.equal(data===null?null:hash(data),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);
 return Buffer.from(edit.before);
};
